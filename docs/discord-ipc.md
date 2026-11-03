# Discord IPC

How the extension talks to the Discord desktop app: the pipe path, frame format, handshake, the `SET_ACTIVITY` payload, rate limiting, reconnect, and shutdown. This file is the source of truth for the protocol handling in `src/ipc/` and the activity object; what the activity shows is in `docs/requirements.md`. Update this file in the same change as any protocol change.

Discord does not publish a full specification of this local IPC. The format below follows the behavior of existing open-source clients. Anything not confirmed on a real client is marked **[live test]**.

## 1. Pipe Path

`src/ipc/getIpcPath.ts` returns the candidate paths. No other file may branch on the OS.

| OS | Path |
|---|---|
| Windows | `\\?\pipe\discord-ipc-<n>` |
| Linux (planned) | `discord-ipc-<n>` under `$XDG_RUNTIME_DIR`, `$TMPDIR`, `$TMP`, `$TEMP`, or `/tmp`. Snap and Flatpak builds use further subdirectories. |

- `n` is 0 to 9. Try them in order and use the first that accepts a connection. Several Discord builds (Stable, PTB, Canary) running at once take different numbers.
- Connect with `net.createConnection(path)`.

## 2. Frame Format

```
[opcode: uint32 LE][length: uint32 LE][payload: JSON, UTF-8, length bytes]
```

| Opcode | Name | Direction | Use |
|---|---|---|---|
| 0 | HANDSHAKE | send | First frame after connecting: `{ "v": 1, "client_id": "<Client ID>" }` |
| 1 | FRAME | both | Commands and their responses, and events |
| 2 | CLOSE | both | Discord closes the connection; the payload has `code` and `message` |
| 3 | PING | receive | Reply with PONG and the same payload |
| 4 | PONG | send | Reply to PING |

`frame.ts`:

- `length` is the byte length of the UTF-8 payload (`Buffer.byteLength`), not the string length. File and workspace names may contain non-ASCII characters.
- Received data can arrive split across `data` events, or several frames in one event. Append to a buffer and take out complete frames only; keep the rest for the next event.
- A payload that is not valid JSON is logged and skipped; the connection stays open.

## 3. Connection Sequence

1. Connect to the first available pipe (1).
2. Send HANDSHAKE with the Client ID.
3. Wait for a FRAME with `cmd: "DISPATCH"` and `evt: "READY"`. Only then is the client connected; send the current activity.
4. If CLOSE arrives instead (for example, an invalid Client ID), log `code` and `message` and treat it as a disconnect (7).

With several connections using the same Client ID, Discord shows only the activity of the connection made first (confirmed with two windows). The extension therefore keeps a single connection across windows (`requirements.md` §5.5).

Until `READY`, activity updates are not sent. `discordIpc.ts` drops them; `presenceController.ts` keeps the latest state and sends it from the `onReady` callback.

## 4. Commands

`SET_ACTIVITY` is the only command used.

```json
{
  "cmd": "SET_ACTIVITY",
  "args": { "pid": 12345, "activity": { } },
  "nonce": "<unique string>"
}
```

- `pid`: `process.pid` of the extension host.
- `nonce`: `crypto.randomUUID()`. The response carries the same `nonce`.
- To clear the activity, send `SET_ACTIVITY` without `activity`.
- A response with `evt: "ERROR"` has `data.code` and `data.message`. Log them and do not resend the same activity.

## 5. Activity Object

Built by `activityBuilder.ts` (`requirements.md` §5.1–5.2). Only these fields are used.

| Field | Type | Notes |
|---|---|---|
| `details` | string | Always present |
| `state` | string | Omitted when hidden or empty |
| `timestamps.start` | number | Epoch ms. `timestamps` omitted when hidden. |
| `assets.large_image` | string | HTTPS URL |
| `assets.large_text` | string | |
| `assets.small_image` | string | HTTPS URL. Omitted with `small_text` when `showLanguage` is false or idle. |
| `assets.small_text` | string | |

- Omit a field instead of sending an empty string or `null`.
- String fields: at most 128 characters. Longer text is cut to 127 characters plus `…`. Count characters by code point so a surrogate pair is never split.
- Minimum length: strings of 1 character are reported to be rejected **[live test]**. If confirmed, pad or replace short values in `activityBuilder.ts` and record the rule here.

## 6. Rate Limiting

Discord accepts about 5 `SET_ACTIVITY` per 20 s. Every update goes through `presenceController.ts`:

1. **Debounce** (about 1 s): rapid tab switching produces one update.
2. **Throttle** (at least about 4 s between sends): an update that arrives during the interval is held; only the latest is kept and sent when the interval ends.
3. **Deduplicate**: an activity equal to the last one sent is not sent.

Exceptions:

- The resend after `READY` (3) skips the debounce but still waits for the throttle interval.
- The clear on `deactivate` (8) skips both, because the extension host is shutting down. One extra send at shutdown stays within the limit.

## 7. Reconnect

- On connection failure, socket `error` or `close`, or a received CLOSE: discard the socket and the frame buffer, and retry after 15 s.
- Only one connection attempt or retry timer exists at a time.
- After reconnecting, the last-sent record used for deduplication is reset, so the current activity is sent again.
- `reconnect` command: cancel the timer, close the socket, and connect at once.
- `enabled` false: cancel the timer and do not retry.

## 8. Shutdown

- `deactivate` sends the clear (`SET_ACTIVITY` without `activity`), then closes the socket.
- VS Code gives `deactivate` little time. Do not wait for the clear's response for more than about 1 s; close the socket anyway. When the pipe closes, Discord removes the activity of that connection **[live test]**.

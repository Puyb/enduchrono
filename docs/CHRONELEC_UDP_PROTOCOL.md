# Chronelec UDP Protocol (Inferred)

This document describes the UDP protocol used between `chrono` and a Chronelec timing device.
It is reverse-engineered from the implementations in `chrono/chrono.js` and `sim/chrono.js`.

## Transport
- UDP
- Port: `2008`
- Bidirectional communication
- `chrono` acts as client/controller
- Chronelec device (or `sim`) acts as data producer

### Framing: a UDP datagram may contain several messages
Confirmed by hand against real chronelec hardware (not reproducible with `sim`,
which always sends one frame per datagram): a single UDP packet can bundle
several of the ASCII messages below, back to back, each terminated by `\r\n`
(`0x0D 0x0A`). The order between message types is not guaranteed.

Examples captured on real hardware (one passage, then a lap sharing a packet
with a status response):
```
<STA 119376 00:16'10"371 99 01 3 1583>\r\n
```
```
<STA 119370 00:16'10"398 97 01 3 1584>\r\n[00:16'13" 23 02 10 10]\r\n
```
A status frame can also arrive *before* the lap it is bundled with. Since
`TRANSPONDEUR_REGEXP`/`STATUS_REGEXP` are anchored with `^`, `chrono` must
split an incoming datagram on `\r\n` and match each resulting frame
independently — matching the whole raw buffer only finds a message that
happens to start at byte 0, silently dropping (never ACKing) any lap that
isn't first. See the frame-splitting loop in `chrono.js`'s `socket.on('message', ...)`
(mirrored in `chrono-rust/src/udp.rs`'s `recv_loop`/`handle_frame`).

## Command Frames (chrono → device)
All commands are sent as raw bytes.

- START: `1b07`
- STOP: `1b135c`
- STATUS: `1b05`
- ACK (acknowledge a received lap): `1b11`
- REPEAT (request resend of last lap): `1b12`

## Device → chrono messages

### 1. Lap / Transponder passage
Format:
```
<STA {transponder} HH:MM'SS"mmm {signal} {detectionCount} {battery} {crc}>
```

Example:
```
<STA 119371 00:00'11"648 99 01 3 1579>
```

Parsed fields:
- `transponder`: racer identifier
- time components: `HH`, `MM`, `SS`, `mmm`
- additional fields (in order):
  - `signal`: received signal strength, roughly `0`-`100`. Displayed thresholds: `>= 90` good, `>= 70` medium, `< 70` weak (shown in red in the UI)
  - `detectionCount`: number of radio detections that contributed to this passage (how many times the transponder was actually heard for this lap, usually `01`)
  - `battery`: transponder battery level, `0` (dead) to `3` (full). Displayed as weak/red when `<= 1`
  - trailing field: CRC/counter, not currently exploited

Timestamp computation:
```
((HH * 60 + MM) * 60 + SS) * 1000 + mmm
```

Behavior:
- Device sends one lap at a time
- `chrono` must reply with `ACK` (`1b11`), for every frame that matches, including retransmits (see below) — otherwise the device keeps retrying forever
- Until ACK is received, the device keeps the lap in a queue and retransmits it (observed bundled with unrelated status frames in the same or a later packet — see Framing above)
- After ACK, the device sends the next lap (if any)
- `chrono` drops immediate duplicate messages: if the same `(transponder, timestamp)` pair repeats back-to-back (a retransmit of a lap that *was* received but whose ACK the device missed, e.g. due to the framing issue above), only the first is turned into a `passage` event — the retransmit is still ACKed, but neither persisted nor forwarded to `classements`. See `lastSeenTranspondeur`/`lastSeenTimestamp` in `chrono.js` (`last_seen` in `chrono-rust/src/udp.rs`).

### Storage and propagation
- `chrono` persists every non-duplicate passage (`transpondeur`, `timestamp`) in its local `passages` SQLite table (`chrono/model.js`), and forwards it to `classements` over the passage WebSocket.
- `classements` persists them per lap in the `tours` table and keeps a running in-memory list per team (`equipe.tours`), used to compute lap duration (`duree`) and detect near-duplicate laps within a short time window (`isDuplicate` in `classements/models.js`).

### 2. Start acknowledgment
Format:
```
DEPART_<ISO_DATE>__HH:MM:SS
```

Example:
```
DEPART_2024-01-01__12:00:00
```

Meaning:
- Confirms race start after START command

### 3. Stop acknowledgment
Format:
```
STOP_<ISO_DATE>__HH:MM:SS
```

Meaning:
- Confirms race stop after STOP command

### 4. Status response
Format:
```
[HH:MM'SS" XX XX XX XX]
```

Example:
```
[00:00'12" 23 00 10 10]
```

Parsed fields:
- `HH:MM:SS`: current race time (no milliseconds)
- remaining values: noise / signal metrics

Behavior:
- Returned in response to STATUS command
- Used by `chrono` to determine:
  - connection status
  - race state (start/stop inferred from timestamp)

## Reliability Model

The protocol implements a simple reliability layer over UDP:

- Laps are sent one-by-one
- Each lap must be acknowledged (`ACK`)
- If no ACK is received, the device keeps the lap pending
- `REPEAT` command forces resend of the current pending lap

Implications:
- Ordering of laps is guaranteed by the device queue (one lap pending ACK at a time)
- At the UDP transport level though, batching does happen: the device may bundle
  a lap frame with an unrelated status frame in the same datagram (see Framing
  above) — `chrono` must not assume one message per packet
- `chrono` must ACK quickly to avoid blocking the stream

## State Machine (simplified)

Device side (`sim` behavior):
- On START:
  - reset time
  - begin emitting laps over time
- On STOP:
  - stop time
  - stop emitting laps
- On ACK:
  - drop current lap
  - send next lap if available
- On REPEAT:
  - resend current lap
- On STATUS:
  - send status frame

## Notes / Non-obvious behaviors
- Messages are mixed:
  - commands are binary (hex)
  - responses are ASCII strings
- `chrono` matches responses using regex, not message types
- Timeout for command responses is ~1s (`command()` in chrono)
- Connection status is inferred from STATUS timeout
- Immediately after START, `chrono` may force status to "start" because device time is still 0

### Incident: unacked lap during a race produced a 0s lap and froze the live page
Observed during a race, before the framing fix above: a datagram bundled a lap
with a status frame in an order where the lap frame wasn't first. `chrono`
matched the whole raw buffer against `TRANSPONDEUR_REGEXP` (anchored at `^`),
so the lap was silently dropped — not ACKed. The device, seeing no ACK,
retransmitted the same lap (same transponder + timestamp), which this time
arrived alone (or first) and got processed normally. Net effect: the same
physical passage was recorded once, but `classements`' near-duplicate check
(`isDuplicate`) compared timestamps with a strict `<`, which does not catch an
*exact* timestamp collision — so a second, coincidental exact-timestamp
passage (or a chrono-level bug in an earlier deploy) could still slip through
and be inserted as a genuine 0-second lap for the team. That in turn hit an
off-by-one in `addTourToEquipe` (`classements/models.js`): when the new lap's
timestamp tied the team's last lap, `findIndex` returned `-1` and got passed
to `Array.prototype.splice(-1, 0, tour)`, which inserts *before* the last
element instead of appending — silently reordering the team's laps. Once a
lap ended up positioned after a later one, `Tour.duree` (computed as
`this.timestamp - previous.timestamp`) went negative for it, and the live UI's
`formatDuree` (`classements/ui/src/utils.js`) looped forever on negative input
(`Math.floor(-1 / 60) === -1`, never reaching `0`), freezing the live "tours"
page (blank/white) — while API-backed pages, which don't call `formatDuree`
synchronously in a render loop, kept working. Deleting the spurious 0s laps
through the tour-deletion API unblocked the page without a restart, since the
frozen render was per-request, not a crashed process.

Fixed by, in order: splitting UDP datagrams on `\r\n` and matching each frame
independently (this doc's Framing section); the `lastSeenTranspondeur`/
`lastSeenTimestamp` dedup in `chrono.js`; `isDuplicate` treating an exact
timestamp match as a duplicate (`tour.timestamp <= timestamp`); the
`addTourToEquipe` append fix; and a defensive guard in `formatDuree` against
non-positive/non-finite input.

## Where to look in code
- Command handling and framing: `chrono/chrono.js` (Node, in production) and `chrono-rust/src/udp.rs` (Rust reimplementation, standalone service — see `chrono-rust`'s comment header for how it maps to `chrono.js`)
- Device simulation: `sim/chrono.js`
- Regex definitions:
  - transponder: `TRANSPONDEUR_REGEXP`
  - status: `STATUS_REGEXP`
- Duplicate/ordering handling downstream: `classements/models.js` (`isDuplicate`, `addTourToEquipe`)
- Live UI duration formatting: `classements/ui/src/utils.js` (`formatDuree`)
- Regression tests: `chrono/test/protocol.test.js`, `chrono-rust/src/udp.rs` (`#[cfg(test)] mod tests`, run with `cargo test`), `classements/test/models.test.js`, `classements/ui/test/unit/unit-utils-003-format-duree.test.js`

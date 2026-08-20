// ponytail — spend firewall: reads token usage out of the agent's session
// transcript.
//
// The transcript is JSONL, append-only, and the only place a hook can see what
// a turn actually cost. Two things make a naive read wrong:
//
//   1. One assistant message spans several lines (one per content block) and
//      every line repeats the same usage block. Summing lines double-counts —
//      measured 61 lines for 29 real messages on a normal session. Dedupe by
//      message id.
//   2. Re-reading the whole file on every tool call is O(session) work inside a
//      5-second hook timeout. Read only the bytes appended since last time.

const fs = require('fs');

// Duplicate blocks of one message are always adjacent, so a short rolling
// window catches them all. This is what keeps the cursor a fixed size.
const SEEN_WINDOW = 200;

// A cold read of a very long session shouldn't stall the hook. Past this, start
// from the tail and accept that the earlier spend is missed — undercounting is
// the safe direction for a guard that blocks.
const MAX_SCAN_BYTES = 32 * 1024 * 1024;

function readSlice(fd, start, end) {
  const length = end - start;
  const buffer = Buffer.allocUnsafe(length);
  let filled = 0;
  while (filled < length) {
    const read = fs.readSync(fd, buffer, filled, length - filled, start + filled);
    if (read <= 0) break;
    filled += read;
  }
  return buffer.subarray(0, filled).toString('utf8');
}

// Returns { offset, seen, records } — records are the usage blocks that are new
// since `cursor`, each { id, model, usage }. Never throws: an unreadable or
// half-written transcript yields no records and leaves the cursor alone.
function readUsageSince(transcriptPath, cursor) {
  const seen = Array.isArray(cursor && cursor.seen) ? cursor.seen.slice() : [];
  let offset = Number(cursor && cursor.offset) > 0 ? Number(cursor.offset) : 0;
  const empty = { offset, seen, records: [] };

  if (!transcriptPath) return empty;

  let fd;
  try {
    const size = fs.statSync(transcriptPath).size;
    // Truncated, rotated, or a different session reusing the path — the byte
    // offset means nothing now, so recount from the top.
    if (size < offset) offset = 0;
    if (size === offset) return { offset, seen, records: [] };
    if (size - offset > MAX_SCAN_BYTES) offset = size - MAX_SCAN_BYTES;

    fd = fs.openSync(transcriptPath, 'r');
    const chunk = readSlice(fd, offset, size);

    // Stop at the last newline: the tail may be a line the agent is still
    // writing. Leaving it unconsumed means the next run picks it up whole.
    const lastBreak = chunk.lastIndexOf('\n');
    if (lastBreak < 0) return { offset, seen, records: [] };

    const records = [];
    const seenSet = new Set(seen);
    for (const line of chunk.slice(0, lastBreak).split('\n')) {
      if (!line || line[0] !== '{') continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (e) {
        continue; // a corrupt line is not a reason to stop metering
      }
      const message = entry && entry.message;
      if (!message || !message.usage) continue;

      // requestId is the fallback for transcripts that omit message.id; a line
      // with neither is counted rather than dropped, since skipping real spend
      // is worse than the rare double count.
      const id = message.id || entry.requestId;
      if (id) {
        if (seenSet.has(id)) continue;
        seenSet.add(id);
        seen.push(id);
      }
      records.push({ id: id || null, model: message.model, usage: message.usage });
    }

    if (seen.length > SEEN_WINDOW) seen.splice(0, seen.length - SEEN_WINDOW);
    return { offset: offset + Buffer.byteLength(chunk.slice(0, lastBreak + 1), 'utf8'), seen, records };
  } catch (e) {
    return empty;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (e) { /* best-effort */ }
    }
  }
}

module.exports = { readUsageSince, SEEN_WINDOW, MAX_SCAN_BYTES };

#!/usr/bin/env node

const MAX_INPUT_BYTES = 1024 * 1024;

function readHookPayload(callback, timeoutMs = 1000) {
  let input = '';
  let bytes = 0;
  let done = false;
  let timer;

  function finish(exitAfter = false) {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);

    let payload = null;
    try {
      payload = JSON.parse(input.replace(/^\uFEFF/, ''));
    } catch (_) {}

    try { callback(payload); } catch (_) {}
    if (exitAfter) process.exit(0);
  }

  process.stdin.on('data', (chunk) => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > MAX_INPUT_BYTES) {
      input = '';
      finish(true);
      return;
    }
    input += chunk;
  });
  process.stdin.on('end', () => finish());
  process.stdin.on('error', () => finish(true));

  timer = setTimeout(() => finish(true), timeoutMs);
  timer.unref();
}

module.exports = { readHookPayload };

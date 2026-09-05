// Shared stdin pump for Claude/Codex hooks. Clears the fallback timer so a
// ref'd timeout can fire on a hung stdin without delaying the normal path.

function consumeStdin(onDone, timeoutMs = 1000) {
  let input = '';
  let done = false;
  const timer = setTimeout(() => finish(true), timeoutMs);

  function finish(fromTimeout) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    onDone(input);
    if (fromTimeout) process.exit(0);
  }

  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => finish(false));
  process.stdin.on('error', () => {
    finish(false);
    process.exit(0);
  });
}

module.exports = { consumeStdin };

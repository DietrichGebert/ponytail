import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function start(name, directory, args) {
  const child = spawn(process.execPath, args, {
    cwd: path.join(root, directory),
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  children.push(child);
  child.on("error", () => {
    console.error(
      name + " could not start. Run npm ci in " + directory + " first.",
    );
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(name + " stopped.");
      stop(code || 1);
    }
  });
}
console.log(
  "Vision Estates: frontend http://localhost:3000 · backend http://127.0.0.1:3001",
);
start("Backend", "backend", [
  "--env-file-if-exists=.env",
  "node_modules/@nestjs/cli/bin/nest.js",
  "start",
  "--watch",
]);
start("Frontend", "frontend", [
  "node_modules/next/dist/bin/next",
  "dev",
  "--port",
  "3000",
]);
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

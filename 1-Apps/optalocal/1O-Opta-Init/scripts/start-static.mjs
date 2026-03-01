#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const forwarded = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "-p" || arg === "--port") {
    const value = args[i + 1];
    if (value) {
      forwarded.push("-l", value);
      i += 1;
      continue;
    }
  }
  forwarded.push(arg);
}

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npxCmd, ["serve", "out", ...forwarded], { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

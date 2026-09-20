import { spawn } from "node:child_process";
import process from "node:process";

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const vite = spawn(npm, ["run", "vite-only"], { stdio: "inherit" });
const payment = spawn(npm, ["run", "payment-server"], { stdio: "inherit" });

let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of [vite, payment]) {
    if (!child.killed) {
      try { child.kill(); } catch {}
    }
  }
  process.exit(code);
};

vite.on("exit", (code) => stop(code ?? 0));
payment.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

console.log("SugarCafe development stack starting...");
console.log("Website: Vite");
console.log("Payment API: local Razorpay server on port 8267");

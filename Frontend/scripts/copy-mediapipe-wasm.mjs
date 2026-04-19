import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = path.join(root, "public", "mediapipe-tasks-vision", "wasm");

if (!fs.existsSync(src)) {
  console.warn("[copy-mediapipe-wasm] skip: @mediapipe/tasks-vision/wasm not found (run npm install)");
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
}
console.log("[copy-mediapipe-wasm] synced to public/mediapipe-tasks-vision/wasm");

// Copies the shared catalog into the web app (spec 001, AC-1.5).
// Runs before `dev`, `build` and `test` so the app always ships the same catalog as the api.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(webRoot, "../shared/catalog.json");
const target = resolve(webRoot, "src/generated/catalog.json");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`synced ${source} -> ${target}`);

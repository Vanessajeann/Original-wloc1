import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildWorker } from "../worker/scripts/build.mjs";

const root = new URL("../", import.meta.url);
const source = async (path) => (await readFile(new URL(path, root), "utf8")).replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
await mkdir(new URL("dist/", root), { recursive: true });
const state = await source("src/state.js");
const settings = await source("src/settings.js");
const core = await source("src/wloc-core.js");
await writeFile(new URL("dist/wloc-settings.js", root), `// Generated from src/state.js and src/settings.js. Run node scripts/build.mjs.\n(() => {\n${state}\n${settings}\nrunWlocSettings();\n})();\n`);
await writeFile(new URL("dist/wloc.js", root), `// Generated from src/state.js and the preserved upstream WLOC core.\n(() => {\n${state}\n${core}\n})();\n`);
await buildWorker();
console.log("Built proxy scripts and both Worker deployment formats.");

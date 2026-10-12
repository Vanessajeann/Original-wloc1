import { readFile, writeFile, mkdir } from "node:fs/promises";

export async function buildWorker() {
  const root = new URL("../", import.meta.url);
  const sources = await Promise.all(["coords.js", "parse.js", "page.js", "index.js"].map(async name => {
    const text = await readFile(new URL(`src/${name}`, root), "utf8");
    return text.replace(/^import .*;\r?\n/gm, "").replace(/^export (?!default)/gm, "");
  }));
  await mkdir(new URL("dist/", root), { recursive: true });
  const bundle = "// Generated from worker/src/. Do not edit directly.\n" + sources.join("\n");
  await writeFile(new URL("wloc-worker.js", root), bundle);
  await writeFile(new URL("dist/_worker.js", root), bundle);
}

if (process.argv[1] && new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href === import.meta.url) {
  await buildWorker();
  console.log("Built standalone Worker and Pages entry point.");
}

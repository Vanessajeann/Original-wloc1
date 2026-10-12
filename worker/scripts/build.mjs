import { readFile, writeFile, mkdir } from "node:fs/promises";

export async function buildWorker() {
  const root = new URL("../", import.meta.url);
  // Serialize source before minification: Function.toString() after bundling can
  // refer to renamed symbols that do not exist in the browser script.
  const coordinates = (await readFile(new URL("src/coords.js", root), "utf8")).replace(/^export /gm, "").replace(/\r\n/g, "\n");
  await mkdir(new URL("src/generated/", root), { recursive: true });
  await writeFile(new URL("src/generated/coordinates.js", root), "// Generated from coords.js.\nexport const COORDINATE_SCRIPT = " + JSON.stringify(coordinates) + ";\n");
  const sources = await Promise.all(["coords.js", "generated/coordinates.js", "parse.js", "page.js", "index.js"].map(async name => {
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

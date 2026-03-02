/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function ensureFile(p, content) {
  if (fs.existsSync(p)) return false;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  return true;
}

const nextAppDir = path.join(process.cwd(), ".next", "server", "app");
if (!fs.existsSync(nextAppDir)) {
  console.log("[postbuild] .next/server/app not found; skipping");
  process.exit(0);
}

const files = walk(nextAppDir);
const pageLike = files.filter((f) =>
  /\/page(\.js|\.mjs|\.cjs)$/.test(f.replace(/\\/g, "/"))
);

let created = 0;
for (const pageFile of pageLike) {
  const dir = path.dirname(pageFile);
  const mf = path.join(dir, "page_client-reference-manifest.js");
  const added = ensureFile(mf, "module.exports = {};\n");
  if (added) created += 1;
}

console.log(`[postbuild] ensured missing client-reference manifests: ${created}`);

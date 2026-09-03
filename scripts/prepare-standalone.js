const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(standalone)) {
  console.warn("No .next/standalone — skip prepare-standalone");
  process.exit(0);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

copyDir(standalone, root);
const staticSrc = path.join(root, ".next", "static");
if (fs.existsSync(staticSrc)) {
  copyDir(staticSrc, path.join(root, ".next", "static"));
}
const publicSrc = path.join(root, "public");
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, path.join(root, "public"));
}
console.log("standalone ready → server.js");

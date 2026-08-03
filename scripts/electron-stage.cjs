const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, ".next", "standalone");
const stage = path.join(root, ".pack", "standalone");

fs.rmSync(path.join(root, ".pack"), { recursive: true, force: true });
fs.cpSync(src, stage, { recursive: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(stage, ".next", "static"), {
  recursive: true,
});
fs.cpSync(path.join(root, "public"), path.join(stage, "public"), { recursive: true });

console.log("Staged Electron server at .pack/standalone");

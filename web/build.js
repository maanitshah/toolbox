// Bundles public/app.jsx (plus React/ReactDOM from node_modules) into a single
// self-contained public/app.bundle.js — no CDN, no runtime Babel transform.
const esbuild = require("esbuild");
const path = require("path");

esbuild.build({
  entryPoints: [path.join(__dirname, "src", "app.jsx")],
  outfile: path.join(__dirname, "..", "public", "app.bundle.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  jsx: "automatic",
  logLevel: "info",
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

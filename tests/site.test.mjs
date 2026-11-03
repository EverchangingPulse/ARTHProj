import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const text = name => readFileSync(join(root, name), "utf8");
const asset = name => readFileSync(join(root, "assets", name));
const pages = ["index.html", "reference.html", "overlay-preview.html", "compile.html", "404.html"];
const scripts = ["ar-app.js", "ar-settings.js", "target-compiler.js"];

test("all AR application pages, scripts and images are present", () => {
  for (const file of [...pages, ...scripts, "styles.css", "reference.css"]) {
    assert.ok(existsSync(join(root, file)), file + " is missing");
  }
  for (const file of ["inscription-reference.jpg", "inscription-highlighted.jpg", "inscription-tracking.png", "overlay.png", "icon.svg"]) {
    assert.ok(existsSync(join(root, "assets", file)), file + " is missing");
  }
});

test("internal HTML links work under GitHub Pages project subdirectory", () => {
  for (const page of pages) {
    const content = text(page);
    assert.doesNotMatch(content, /(?:href|src)="\/(?!\/)/, "Root absolute path in " + page);
    const attributes = [...content.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)];
    for (const match of attributes) {
      assert.ok(existsSync(join(root, match[1])), page + ": missing " + match[1]);
    }
  }
});

test("JavaScript imports and asset paths are subpath-safe", () => {
  for (const file of scripts) {
    assert.doesNotMatch(text(file), /from\s+['"]\//, "Root absolute import in " + file);
  }
  for (const file of ["inscription-reference.jpg", "inscription-tracking.png", "overlay.png", "targets.mind"]) {
    assert.ok(text("ar-settings.js").includes("./assets/" + file), "Missing asset path " + file);
  }
});

test("reference JPEGs and tracking PNG have correct signatures", () => {
  for (const file of ["inscription-reference.jpg", "inscription-highlighted.jpg"]) {
    const jpeg = asset(file);
    assert.equal(jpeg.readUInt16BE(0), 0xffd8);
    assert.ok(jpeg.length > 10000);
  }
  const tracking = asset("inscription-tracking.png");
  assert.equal(tracking.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(tracking.readUInt32BE(16), 1024);
  assert.equal(tracking.readUInt32BE(20), 702);
});

test("transparent overlay matches the Roman inscription dimensions", () => {
  const overlay = asset("overlay.png");
  assert.equal(overlay.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(overlay.readUInt32BE(16), 1536);
  assert.equal(overlay.readUInt32BE(20), 1053);
  assert.match(text("index.html"), /mindar-image-target="targetIndex: 0"/);
  assert.match(text("target-compiler.js"), /MINDAR\?\.IMAGE\?\.Compiler/);
});

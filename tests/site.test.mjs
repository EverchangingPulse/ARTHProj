import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const text = name => readFileSync(join(root, name), "utf8");
const asset = name => readFileSync(join(root, "assets", name));
const pages = ["index.html", "reference.html", "overlay-preview.html", "compile.html", "404.html"];
const scripts = ["ar-app.js", "ar-settings.js", "target-compiler.js", "target-library.js", "target-manifest.js"];

test("frontend files and built-in Roman inscription assets are present", () => {
  for (const file of [...pages, ...scripts, "styles.css", "reference.css"]) {
    assert.ok(existsSync(join(root, file)), file + " is missing");
  }
  for (const file of ["inscription-reference.jpg", "inscription-highlighted.jpg", "inscription-tracking.png", "overlay.png", "icon.svg"]) {
    assert.ok(existsSync(join(root, "assets", file)), file + " is missing");
  }
});

test("frontend scripts are syntactically valid JavaScript", () => {
  for (const file of scripts) {
    const result = spawnSync(process.execPath, ["--check", join(root, file)], { encoding: "utf8" });
    assert.equal(result.status, 0, file + ": " + result.stderr);
  }
});

test("internal HTML links remain valid for GitHub Pages repository paths", () => {
  for (const page of pages) {
    const content = text(page);
    assert.doesNotMatch(content, /(?:href|src)="\/(?!\/)/, "Root-absolute URL in " + page);
    const links = [...content.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)];
    for (const match of links) {
      assert.ok(existsSync(join(root, match[1])), page + " refers to missing " + match[1]);
    }
  }
  for (const file of scripts) {
    assert.doesNotMatch(text(file), /from\s+['"]\//, "Root-absolute import in " + file);
  }
});

test("image and overlay assets use valid signatures and aspect ratios", () => {
  for (const file of ["inscription-reference.jpg", "inscription-highlighted.jpg"]) {
    const jpeg = asset(file);
    assert.equal(jpeg.readUInt16BE(0), 0xffd8);
    assert.ok(jpeg.length > 10000);
  }
  const tracking = asset("inscription-tracking.png");
  const overlay = asset("overlay.png");
  for (const png of [tracking, overlay]) {
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  }
  assert.deepEqual([tracking.readUInt32BE(16), tracking.readUInt32BE(20)], [1024, 702]);
  assert.deepEqual([overlay.readUInt32BE(16), overlay.readUInt32BE(20)], [1536, 1053]);
});

test("camera starts without a start-button interaction", () => {
  assert.doesNotMatch(text("index.html"), /id="start-btn"/);
  assert.match(text("ar-app.js"), /void app\.start\(\)/);
  assert.match(text("ar-app.js"), /navigator\.mediaDevices\.getUserMedia/);
  assert.match(text("index.html"), /id="retry-btn"/);
});

test("different reference pictures get different PNG overlays", () => {
  const script = text("ar-app.js");
  const library = text("target-library.js");
  assert.match(script, /this\.targets\.forEach\(\(target, index\)/);
  assert.match(script, /mindar-image-target/);
  assert.match(script, /target\.overlayImage/);
  assert.match(library, /async add\(name, referenceFile, overlayFile\)/);
  assert.match(library, /async replaceOverlay\(id, png\)/);
  assert.match(library, /"image\/png"/);
  assert.match(library, /"arthproj-image-pairs"/);
  assert.match(text("target-manifest.js"), /roman-inscription/);
});

test("overlay changes do not force unnecessary image target recompilation", () => {
  assert.match(text("target-library.js"), /trackingRevision: record\.id/);
  assert.match(text("target-compiler.js"), /trackingRevision \|\| target\.revision/);
});

test("freeze waits for the scanning overlay to disappear", () => {
  const app = text("ar-app.js");
  assert.match(app, /this\.view\.scanner\.hidden = true;\s*await nextFrame\(\)/);
  assert.match(app, /this\.composeSnapshot\(\)/);
  assert.match(app, /this\.stopTracking\(\)/);
  assert.match(text("index.html"), /id="auto-freeze"/);
  assert.match(text("ar-settings.js"), /freezeDelayMs: 700/);
});

test("photo capture includes grayscale flash, Polaroid and synthesized shutter sound", () => {
  const html = text("index.html");
  const css = text("styles.css");
  const app = text("ar-app.js");
  assert.match(html, /id="scanner-hud"/);
  assert.match(html, /id="capture-flash"/);
  assert.match(html, /id="polaroid"/);
  assert.match(html, /id="shutter-sound"/);
  assert.match(css, /@keyframes sonar-sweep/);
  assert.match(css, /@keyframes gray-shutter-flash/);
  assert.match(css, /@keyframes polaroid-develop/);
  assert.match(app, /class MechanicalShutter/);
  assert.match(app, /this\.sound\.click\(\)/);
  assert.match(app, /link\.download = "arthproj-"/);
});

test("target compiler uses MindAR's supported image compiler API", () => {
  assert.match(text("target-compiler.js"), /MINDAR\?\.IMAGE\?\.Compiler/);
});

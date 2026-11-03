import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseTargetConfig } from "../docs/target-manifest.js";
import { parseAppSettings } from "../docs/app-config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const text = name => readFileSync(join(root, name), "utf8");
const asset = name => readFileSync(join(root, "assets", name));
const json = name => JSON.parse(text(name));
const pages = ["index.html", "reference.html", "overlay-preview.html", "compile.html", "404.html"];
const scripts = ["ar-app.js", "app-config.js", "target-compiler.js", "target-manifest.js"];

test("public frontend and administrator configuration exist", () => {
  for (const file of [...pages, ...scripts, "styles.css", "reference.css", "config/targets.json", "config/settings.json"]) {
    assert.ok(existsSync(join(root, file)), file + " is missing");
  }
  for (const file of ["inscription-reference.jpg", "inscription-highlighted.jpg", "inscription-tracking.png", "overlay.png", "icon.svg"]) {
    assert.ok(existsSync(join(root, "assets", file)), file + " is missing");
  }
});

test("frontend source files have valid JavaScript syntax", () => {
  for (const file of scripts) {
    const result = spawnSync(process.execPath, ["--check", join(root, file)], { encoding: "utf8" });
    assert.equal(result.status, 0, file + ": " + result.stderr);
  }
});

test("HTML links use GitHub Pages-safe relative paths", () => {
  for (const page of pages) {
    const content = text(page);
    assert.doesNotMatch(content, /(?:href|src)="\/(?!\/)/, "Root-relative URL in " + page);
    for (const [, path] of content.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
      assert.ok(existsSync(join(root, path)), page + ": missing " + path);
    }
  }
  for (const file of scripts) {
    assert.doesNotMatch(text(file), /from\s+['"]\//, "Root-relative import in " + file);
  }
});

test("admin target configuration registers all pairs and real repository assets", () => {
  const targets = parseTargetConfig(json("config/targets.json"));
  assert.ok(targets.length > 0);
  for (const target of targets) {
    assert.ok(existsSync(join(root, target.referenceImage)), "Missing reference for " + target.id);
    assert.ok(existsSync(join(root, target.overlayImage)), "Missing overlay for " + target.id);
  }
  assert.equal(targets[0].id, "roman-inscription");
});

test("target config rejects duplicate IDs and unsafe paths", () => {
  const config = json("config/targets.json");
  assert.throws(() => parseTargetConfig({ ...config, targets: [...config.targets, config.targets[0]] }), /Duplicate target ID/);
  assert.throws(() => parseTargetConfig({ ...config, targets: [{ ...config.targets[0], referenceImage: "../../private.jpg" }] }), /must be a file/);
  assert.throws(() => parseTargetConfig({ ...config, targets: [{ ...config.targets[0], overlayImage: "./assets/symbols.jpg" }] }), /unsupported extension/);
  assert.throws(() => parseTargetConfig({ ...config, targets: [] }), /between 1 and/);
});

test("admin settings JSON is validated and has valid camera defaults", () => {
  const settings = parseAppSettings(json("config/settings.json"));
  assert.equal(settings.camera.autoStart, true);
  assert.equal(settings.tracking.maxTrack, 1);
  assert.equal(settings.overlay.opacity, 1);
  assert.equal(settings.capture.autoFreeze, true);
  assert.equal(settings.capture.freezeDelayMs, 700);
  assert.equal(settings.capture.shutterSound, true);
  assert.equal(settings.scanner.enabled, true);
});

test("settings config rejects invalid values", () => {
  const config = json("config/settings.json");
  assert.throws(() => parseAppSettings({ ...config, tracking: { maxTrack: 0 } }), /tracking.maxTrack/);
  assert.throws(() => parseAppSettings({ ...config, overlay: { opacity: 3 } }), /overlay.opacity/);
  assert.throws(() => parseAppSettings({ ...config, capture: { ...config.capture, shutterSound: "yes" } }), /shutterSound/);
  assert.throws(() => parseAppSettings({ ...config, camera: { autoStart: "true" } }), /camera.autoStart/);
});

test("public users cannot create or replace reference pictures", () => {
  const html = text("index.html");
  const app = text("ar-app.js");
  assert.doesNotMatch(html, /type="file"|id="target-editor"|id="pair-form"/);
  assert.doesNotMatch(app, /class TargetEditor|TargetLibrary|indexedDB\.open\("arthproj-image-pairs"/);
  assert.equal(existsSync(join(root, "target-library.js")), false);
});

test("all camera and capture settings are loaded from configuration", () => {
  const app = text("ar-app.js");
  assert.match(app, /loadAppSettings\(\)/);
  assert.match(app, /settings\.camera\.autoStart/);
  assert.match(app, /settings\.tracking\.maxTrack/);
  assert.match(app, /settings\.overlay\.opacity/);
  assert.match(app, /settings\.scanner\.enabled/);
  assert.match(app, /settings\.capture\.autoFreeze/);
  assert.match(app, /settings\.capture\.freezeDelayMs/);
  assert.match(app, /settings\.capture\.shutterSound/);
  assert.match(app, /navigator\.mediaDevices\.getUserMedia/);
});

test("a separate overlay is anchored to every configured image", () => {
  const app = text("ar-app.js");
  const manifest = text("target-manifest.js");
  assert.match(app, /this\.targets\.forEach\(\(target, index\)/);
  assert.match(app, /target\.overlayImage/);
  assert.match(manifest, /"config\/targets.json"/);
  assert.match(manifest, /overlayRatio/);
  assert.match(manifest, /trackingRevision/);
});

test("built-in Roman image assets have correct image formats and aspect ratios", () => {
  for (const name of ["inscription-reference.jpg", "inscription-highlighted.jpg"]) {
    const jpeg = asset(name);
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

test("scanner hides before frozen camera screenshot is captured", () => {
  const app = text("ar-app.js");
  assert.match(app, /this\.view\.scanner\.hidden = true;\s*await nextFrame\(\)/);
  assert.match(app, /this\.composeSnapshot\(\)/);
  assert.match(app, /this\.stopTracking\(\)/);
});

test("camera capture provides gray flash, shutter sound and static Polaroid", () => {
  const html = text("index.html");
  const css = text("styles.css");
  const app = text("ar-app.js");
  for (const name of ["scanner-hud", "capture-flash", "polaroid", "frozen-canvas"]) {
    assert.ok(html.includes('id="' + name + '"'));
  }
  assert.match(css, /@keyframes sonar-sweep/);
  assert.match(css, /@keyframes gray-shutter-flash/);
  assert.match(css, /@keyframes polaroid-develop/);
  assert.match(app, /class MechanicalShutter/);
  assert.match(app, /this\.sound\.click\(\)/);
  assert.match(app, /link\.download = "arthproj-"/);
});

test("image compiler uses MindAR's official export API", () => {
  const compiler = text("target-compiler.js");
  assert.match(compiler, /MINDAR\?\.IMAGE\?\.Compiler/);
  assert.match(compiler, /trackingRevision \|\| target\.revision/);
});

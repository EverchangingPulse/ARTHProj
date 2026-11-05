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
const scripts = ["ar-app.js", "app-config.js", "target-compiler.js", "target-manifest.js", "north-compass.js", "instrument-layout.js", "instrument-artwork.js", "immersive-fullscreen.js", "vendor/wmm2025.js", "vendor/wmm2025-coefficients.js", "vendor/wmm2025-utils.js"];

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
      if (["./assets/hud-portrait.webp", "./assets/hud-landscape.webp"].includes(path)) continue;
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
  assert.equal(settings.compass.enabled, true);
  assert.equal(settings.compass.preferTrueNorth, false);
  assert.equal(settings.compass.requestLocation, false);
  assert.equal(settings.compass.headingSmoothing, 0.21);
  assert.equal(settings.display.fullscreen, true);
});

test("settings config rejects invalid values", () => {
  const config = json("config/settings.json");
  assert.throws(() => parseAppSettings({ ...config, tracking: { maxTrack: 0 } }), /tracking.maxTrack/);
  assert.throws(() => parseAppSettings({ ...config, overlay: { opacity: 3 } }), /overlay.opacity/);
  assert.throws(() => parseAppSettings({ ...config, capture: { ...config.capture, shutterSound: "yes" } }), /shutterSound/);
  assert.throws(() => parseAppSettings({ ...config, camera: { autoStart: "true" } }), /camera.autoStart/);
  assert.throws(() => parseAppSettings({ ...config, scanner: { enabled: "yes" } }), /scanner.enabled/);
  assert.throws(() => parseAppSettings({ ...config, display: { fullscreen: "yes" } }), /display.fullscreen/);
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
  assert.match(manifest, /"\.\/config\/targets.json"/);
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

test("astrolabe scanner is a transparent vector asset with a moving sextant arm", () => {
  const html = text("index.html");
  const app = text("ar-app.js");
  const css = text("styles.css");
  const svg = text("assets/astrolabe-scanner.svg");
  assert.match(html, /id="portrait-instrument"[^>]+src="\.\/assets\/hud-portrait\.webp"/);
  assert.match(html, /id="landscape-instrument"[^>]+src="\.\/assets\/hud-landscape\.webp"/);
  assert.match(text("instrument-artwork.js"), /astrolabe-portrait\.svg/);
  assert.match(text("instrument-artwork.js"), /astrolabe-landscape\.svg/);
  assert.doesNotMatch(html, /scanner-radar|scanner-ring|scanner-sweep|data-style/);
  assert.doesNotMatch(css, /scanner-radar|scanner-ring|scanner-sweep|turn-orbit/);
  assert.doesNotMatch(app, /scanner\.dataset\.style/);
  assert.match(svg, /<svg[^>]+viewBox="0 0 900 650"/);
  assert.match(svg, /class="sight"/);
  assert.match(svg, /class="turn"/);
  assert.doesNotMatch(svg, /<image\b/);
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
  assert.match(css, /@keyframes gray-flash/);
  assert.match(css, /@keyframes develop/);
  assert.match(app, /class MechanicalShutter/);
  assert.match(app, /this\.sound\.click\(\)/);
  assert.match(app, /this\.running = false;\s*this\.view\.update\("Developing photograph/);
});

test("image compiler uses MindAR's official export API", () => {
  const compiler = text("target-compiler.js");
  assert.match(compiler, /MINDAR\?\.IMAGE\?\.Compiler/);
  assert.match(compiler, /trackingRevision \|\| target\.revision/);
});

test("Italian brigandine scanner and wind rose SVG assets exist", () => {
  for (const file of ["astrolabe-scanner.svg", "wind-rose.svg"]) {
    const svg = asset(file).toString("utf8");
    assert.match(svg, /<svg/);
    assert.match(svg, /<\/svg>/);
  }
  assert.match(asset("astrolabe-scanner.svg").toString("utf8"), /italian-brigandine-woodwork/);
  assert.match(asset("astrolabe-scanner.svg").toString("utf8"), /riveted-blue-brigandine/);
  assert.match(asset("astrolabe-scanner.svg").toString("utf8"), /sliding-rails/);
  assert.match(text("index.html"), /id="compass-panel"/);
  assert.match(text("index.html"), /assets\/wind-rose.svg/);
});

test("compass and theme settings are administrator-configured", () => {
  const app = text("ar-app.js");
  const settings = text("app-config.js");
  assert.match(app, /compass\.start\(settings\.compass\)/);
  assert.match(app, /compass\.requestLocation\(\)/);
  assert.match(settings, /compass\.headingSmoothing/);
  assert.match(settings, /compass\.requestLocation/);
  assert.doesNotMatch(text("index.html"), /id="compass-settings"/);
  assert.ok(existsSync(join(root, "vendor/WMM2025-LICENSE.txt")));
});

test("immersive experience has no modern UI controls or outward navigation", () => {
  const html = text("index.html");
  const css = text("styles.css");
  const app = text("ar-app.js");
  assert.doesNotMatch(html, /<a(?:\s|>)|<header(?:\s|>)|<footer(?:\s|>)|<nav(?:\s|>)|IMAGE TRACKING|SCANNING|ACQUIRING TARGET|TRUE N|MAG N|compass-heading|compass-mode/);
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  assert.match(html, /<button id="save-btn"[^>]*>Save image<\/button>/);
  assert.doesNotMatch(html, /open-in-browser|Roman reference|Green symbols/);
  assert.doesNotMatch(app, /getElementById\("(?:retry-btn|scan-btn|stop-btn|capture-btn|external-btn|polaroid-title)"/);
  assert.doesNotMatch(css, /\.bottom-panel|\.topbar|\.actions-row/);
  assert.match(html, /id="sr-status"/);
  assert.match(app, /stage\.addEventListener\("pointerup"/);
});

test("portrait and landscape artwork use the same responsive frame and remain undistorted", () => {
  const html = text("index.html");
  const css = text("styles.css");
  const portrait = asset("astrolabe-portrait.svg").toString("utf8");
  const landscape = asset("astrolabe-landscape.svg").toString("utf8");
  assert.match(html, /id="instrument-frame" class="instrument-frame"/);
  assert.match(html, /id="portrait-instrument"/);
  assert.match(html, /id="landscape-instrument"/);
  assert.match(css, /\.landscape-instrument \{ display: none; \}/);
  assert.match(css, /data-instrument-mode="landscape"/);
  assert.match(css, /\.scanner-instrument \{[^}]+object-fit: fill;/s);
  assert.match(portrait, /viewBox="0 0 900 1900"/);
  assert.match(landscape, /viewBox="0 0 1900 900"/);
  assert.match(portrait, /mask="url\(#apertures\)"/);
  assert.match(landscape, /mask="url\(#apertures\)"/);
  assert.match(portrait, /url\(#stud\)/);
  assert.match(landscape, /url\(#stud\)/);
  assert.match(portrait, /id="cloth"/);
  assert.match(landscape, /id="woodgrain"/);
});

test("compass rose sits under a stationary glass lens and does not display a bearing", () => {
  const html = text("index.html");
  const compass = text("north-compass.js");
  assert.match(html, /id="wind-rose"/);
  assert.match(html, /class="glass-lens"/);
  assert.match(html, /class="compass-hinge"/);
  assert.match(html, /class="latch-clasp"/);
  assert.doesNotMatch(html, /compass-heading|compass-mode|compass-enable|<output/);
  assert.doesNotMatch(compass, /headingLabel|modeLabel|permissionButton|\.textContent/);
  assert.match(compass, /this\.rose\.style\.transform/);
});

test("automatic camera and Polaroid gestures remain usable with only the save button", () => {
  const app = text("ar-app.js");
  const css = text("styles.css");
  assert.match(app, /settings\.camera\.autoStart/);
  assert.match(app, /void app\.start\(\)/);
  assert.match(app, /app\.frozen \|\| \(!app\.starting && !app\.running\)/);
  assert.match(app, /this\.stopTracking\(\);\s*this\.running = false;\s*this\.view\.update\("Developing photograph/);
  assert.match(css, /--app-height/);
  assert.doesNotMatch(css, /min-height: 530px|47dvh/);
  assert.match(text("index.html"), /ar-app\.js\?v=9\.0\.0/);
});

test("Renaissance ornament stays visible during live camera but disappears for captured photograph", () => {
  const app = text("ar-app.js");
  const css = text("styles.css");
  assert.match(app, /this\.scanner\.hidden = !this\.scannerEnabled \|\| \["frozen", "developing"\]\.includes\(state\)/);
  assert.match(app, /this\.compass\.classList\.toggle\("compass-concealed", \["frozen", "developing"\]\.includes\(state\)\)/);
  assert.match(css, /\.embedded-compass\.compass-concealed \{ visibility: hidden; \}/);
  assert.match(app, /this\.view\.scanner\.hidden = true;\s*await nextFrame\(\)/);
});

test("captured image composites live camera first and aligned symbols second, never DOM decoration", () => {
  const app = text("ar-app.js");
  const source = app.slice(app.indexOf("  composeSnapshot() {"), app.indexOf("  savePicture() {"));
  assert.match(source, /const video = system\.video/);
  assert.match(source, /const overlayCanvas = renderer\.domElement/);
  assert.match(source, /renderer\.render\(this\.scene\.object3D, this\.scene\.camera\)/);
  assert.ok(source.indexOf("context.drawImage(video") < source.indexOf("context.drawImage(overlayCanvas"));
  assert.doesNotMatch(source, /scanner-hud|compass-panel|scanner-instrument|wind-rose|polaroid-paper/);
});

test("only a frozen augmented image can be saved and its button cannot trigger a rescan", () => {
  const html = text("index.html");
  const app = text("ar-app.js");
  const css = text("styles.css");
  assert.match(html, /id="polaroid"[^>]+hidden/);
  assert.ok(html.indexOf('id="save-btn"') > html.indexOf('id="polaroid"'));
  assert.match(app, /if \(!this\.frozen \|\| this\.saveButton\.disabled\) return/);
  assert.match(app, /this\.snapshot\.toDataURL\("image\/png"\)/);
  assert.match(app, /link\.download = "speculum-arcana-"/);
  assert.match(app, /event\.target\.closest\("#save-btn"\)/);
  assert.match(app, /event\.stopPropagation\(\)/);
  assert.match(css, /\.polaroid-save/);
});

test("all instrument artwork is one full-viewport mechanical frame with transparent apertures", () => {
  const css = text("styles.css");
  const portrait = text("assets/astrolabe-portrait.svg");
  const landscape = text("assets/astrolabe-landscape.svg");
  for (const artwork of [portrait, landscape]) {
    assert.match(artwork, /<mask id="apertures">/);
    assert.match(artwork, /<circle[^>]+fill="black"/);
    assert.match(artwork, /id="cloth"/);
    assert.match(artwork, /id="woodgrain"/);
    assert.match(artwork, /stroke="url\(#brass\)"/);
  }
  assert.match(css, /\.instrument-picture \{/);
  assert.match(css, /object-fit: cover/);
  assert.match(text("index.html"), /class="compass-panel embedded-compass"/);
});

test("Telegram full screen and ordinary browser gesture fallback are wired", () => {
  const app = text("ar-app.js");
  const fullscreen = text("immersive-fullscreen.js");
  assert.match(app, /fullscreen\.onLaunch\(settings\.display\.fullscreen\)/);
  assert.match(app, /fullscreen\.requestFromGesture\(\)/);
  assert.match(fullscreen, /requestFullscreen/);
  assert.match(fullscreen, /fullscreenEnabled/);
  assert.match(text("config/settings.json"), /"fullscreen": true/);
  assert.match(text("styles.css"), /\.camera-stage:fullscreen/);
});

test("compass is a child of the HUD's relative frame, underneath the brass image", () => {
  const html = text("index.html");
  const css = text("styles.css");
  const frame = html.indexOf('id="instrument-frame"');
  const compass = html.indexOf('id="compass-panel"');
  const image = html.indexOf('id="portrait-instrument"');
  assert.ok(frame >= 0 && compass > frame && image > compass);
  assert.match(css, /\.instrument-frame \{/);
  assert.match(css, /\.embedded-compass \{[^}]+z-index: 0;/s);
  assert.match(css, /\.instrument-picture \{[^}]+z-index: 1;/s);
});

test("relative compass anchors are validated and supplied by administrator JSON", async () => {
  const { parseAppSettings } = await import("../docs/app-config.js");
  const settings = parseAppSettings(json("config/settings.json"));
  const css = text("styles.css");
  const layout = text("instrument-layout.js");
  for (const artwork of ["photographic", "illustrated"]) {
    for (const orientation of ["portrait", "landscape"]) {
      const config = settings.instrument[artwork][orientation];
      for (const value of Object.values(config.compass)) assert.ok(value > 0 && value <= 1);
      assert.equal(config.frame.centerX, 0.5);
      assert.equal(config.frame.centerY, 0.5);
    }
  }
  assert.match(css, /left: var\(--compass-center-x/);
  assert.match(css, /top: var\(--compass-center-y/);
  assert.match(css, /width: var\(--compass-diameter/);
  assert.match(layout, /--compass-center-x/);
  assert.doesNotMatch(layout, /1253|1238|1900|1672|941/);
});

test("photographic artwork falls back to known SVGs if media are unavailable", () => {
  const source = text("instrument-artwork.js");
  assert.match(source, /addEventListener\("error"/);
  assert.match(source, /astrolabe-portrait\.svg/);
  assert.match(source, /astrolabe-landscape\.svg/);
  assert.match(source, /dataset\["frame" \+ orientation\]/);
});

test("photographic image must contain transparent camera and compass apertures when uploaded", () => {
  const pictureFiles = ["hud-portrait.webp", "hud-landscape.webp"];
  const available = pictureFiles.filter(name => existsSync(join(root, "assets", name)));
  assert.ok(available.length === 0 || available.length === pictureFiles.length);
  for (const filename of available) {
    const data = asset(filename);
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    assert.equal(data.toString("ascii", 8, 12), "WEBP");
  }
});

test("compass dial is magnified concentrically to fill the photographed brass aperture", () => {
  const css = text("styles.css");
  const html = text("index.html");
  const app = text("ar-app.js");
  assert.match(css, /\.compass-casing img \{[^}]+width: 126%;[^}]+height: 126%;[^}]+left: -13%;[^}]+top: -13%;[^}]+transform-origin: 50% 50%;/s);
  assert.match(html, /id="wind-rose"/);
  assert.doesNotMatch(html, /scanner-radar|scanner-ring|scanner-sweep/);
  assert.doesNotMatch(css, /turn-orbit|conic-gradient/);
  assert.doesNotMatch(app, /dataset\.style = settings\.scanner\.style/);
});

test("default magnetic heading uses no geographic position or location prompt", () => {
  const settings = json("config/settings.json");
  const app = text("ar-app.js");
  assert.equal(settings.compass.preferTrueNorth, false);
  assert.equal(settings.compass.requestLocation, false);
  assert.match(app, /settings\.compass\.preferTrueNorth && settings\.compass\.requestLocation/);
  assert.doesNotMatch(app, /finally\(\(\) => compass\.requestLocation\(\)\)/);
});

test("both overlays derive from one responsive frame instead of independent pixel anchors", () => {
  const css = text("styles.css");
  const html = text("index.html");
  const layout = text("instrument-layout.js");
  const app = text("ar-app.js");
  assert.match(css, /\.instrument-frame \{[^}]+left: var\(--frame-center-x[^}]+top: var\(--frame-center-y/s);
  assert.match(css, /\.instrument-picture \{[^}]+width: 100%;[^}]+height: 100%;/s);
  assert.match(css, /\.embedded-compass \{[^}]+left: var\(--compass-center-x[^}]+top: var\(--compass-center-y/s);
  assert.match(layout, /const frameWidth = Math\.min\(viewportWidth, viewportHeight \* aspectRatio\)/);
  assert.match(layout, /image\.naturalWidth \/ image\.naturalHeight/);
  assert.match(layout, /--frame-width/);
  assert.match(layout, /orientationTimers/);
  assert.match(app, /layout\.configure\(settings\.instrument\)/);
  assert.match(html, /styles\.css\?v=9\.0\.0/);
  assert.match(html, /ar-app\.js\?v=9\.0\.0/);
});


test("invalid relative instrument coordinates cannot be loaded", async () => {
  const { parseAppSettings } = await import("../docs/app-config.js");
  const config = json("config/settings.json");
  assert.throws(() => parseAppSettings({
    ...config,
    instrument: {
      ...config.instrument,
      photographic: {
        ...config.instrument.photographic,
        portrait: {
          ...config.instrument.photographic.portrait,
          compass: { ...config.instrument.photographic.portrait.compass, centerX: 1.2 }
        }
      }
    }
  }), /instrument\.photographic\.portrait\.compass\.centerX/);
});

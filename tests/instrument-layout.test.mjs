import test from "node:test";
import assert from "node:assert/strict";
import { calculateInstrumentLayout } from "../docs/instrument-layout.js";
import { parseAppSettings } from "../docs/app-config.js";
import { ImmersiveFullscreen } from "../docs/immersive-fullscreen.js";
import { readFileSync } from "node:fs";

const settings = parseAppSettings(JSON.parse(readFileSync(new URL("../docs/config/settings.json", import.meta.url))));
const photographicPortrait = settings.instrument.photographic.portrait;
const photographicLandscape = settings.instrument.photographic.landscape;

test("relative frame fills available viewport without stretching the image", () => {
  const layout = calculateInstrumentLayout(390, 844, 0.5628, photographicPortrait);
  assert.ok(layout.frame.width > 0 && layout.frame.width <= 390);
  assert.ok(layout.frame.height > 0 && layout.frame.height <= 844);
  assert.equal(layout.frame.centerX, 0.5);
  assert.equal(layout.frame.centerY, 0.5);
  assert.equal(layout.compass.centerX, photographicPortrait.compass.centerX);
  assert.equal(layout.compass.centerY, photographicPortrait.compass.centerY);
});

test("relative instrument anchors survive rotation and changes in screen size", () => {
  for (const [width, height, aspect, geometry] of [
    [390, 844, 0.5628, photographicPortrait],
    [690, 1496, 0.5628, photographicPortrait],
    [844, 390, 1.8462, photographicLandscape],
    [1280, 720, 1.8462, photographicLandscape]
  ]) {
    const layout = calculateInstrumentLayout(width, height, aspect, geometry);
    assert.equal(layout.compass.centerX, geometry.compass.centerX);
    assert.equal(layout.compass.centerY, geometry.compass.centerY);
    assert.equal(layout.compass.diameter, geometry.compass.diameter);
    assert.equal(layout.compass.aspectRatio, geometry.compass.aspectRatio);
    assert.ok(layout.frame.width <= width + 1e-8);
    assert.ok(layout.frame.height <= height + 1e-8);
    const x = width * layout.frame.centerX - layout.frame.width / 2 + layout.frame.width * layout.compass.centerX;
    const y = height * layout.frame.centerY - layout.frame.height / 2 + layout.frame.height * layout.compass.centerY;
    assert.ok(x >= 0 && x <= width);
    assert.ok(y >= 0 && y <= height);
  }
});

test("compass size changes proportionally with the HUD, not the screen width alone", () => {
  const small = calculateInstrumentLayout(360, 740, 0.5628, photographicPortrait);
  const large = calculateInstrumentLayout(720, 1480, 0.5628, photographicPortrait);
  assert.equal(large.frame.width / small.frame.width, 2);
  assert.equal(large.frame.height / small.frame.height, 2);
  assert.equal(large.frame.width * large.compass.diameter / (small.frame.width * small.compass.diameter), 2);
});

test("layout uses each loaded image's intrinsic aspect ratio, including fallback", () => {
  const normal = calculateInstrumentLayout(800, 480, 1.8462, photographicLandscape);
  const fallback = calculateInstrumentLayout(800, 480, 2.1111, settings.instrument.illustrated.landscape);
  assert.notEqual(normal.frame.height, fallback.frame.height);
  assert.notEqual(normal.compass.centerX, fallback.compass.centerX);
});

test("relative HUD frame can be re-centered and scaled from config without changing code", () => {
  const changed = {
    frame: { centerX: 0.45, centerY: 0.55, scale: 0.8 },
    compass: { centerX: 0.28, centerY: 0.7, diameter: 0.18, aspectRatio: 1 }
  };
  const layout = calculateInstrumentLayout(800, 1000, 0.5628, changed);
  assert.equal(layout.frame.centerX, 0.45);
  assert.equal(layout.frame.centerY, 0.55);
  assert.equal(layout.compass.centerX, 0.28);
  assert.equal(layout.frame.width, Math.min(800, 1000 * 0.5628) * 0.8);
});

test("invalid viewport or missing relative geometry is rejected", () => {
  assert.throws(() => calculateInstrumentLayout(0, 840, 0.56, photographicPortrait), /Invalid viewport/);
  assert.throws(() => calculateInstrumentLayout(390, 840, 0, photographicPortrait), /Invalid viewport/);
  assert.throws(() => calculateInstrumentLayout(390, 840, 0.56, null), /Relative instrument geometry/);
});

test("Telegram fullscreen remains enabled on launch", () => {
  const calls = [];
  const controller = new ImmersiveFullscreen({}, {
    ready: () => calls.push("ready"),
    expand: () => calls.push("expand"),
    requestFullscreen: () => calls.push("fullscreen")
  });
  controller.onLaunch(true);
  assert.ok(calls.includes("fullscreen"));
  assert.ok(calls.includes("expand"));
});

test("browser fullscreen gesture fallback still works", () => {
  const oldDocument = globalThis.document;
  globalThis.document = { fullscreenElement: null, fullscreenEnabled: true };
  try {
    let requested = false;
    const controller = new ImmersiveFullscreen({
      requestFullscreen: () => { requested = true; return Promise.resolve(); }
    }, { initData: "" });
    controller.onLaunch(true);
    controller.requestFromGesture();
    assert.equal(requested, true);
    controller.onLaunch(false);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});

test("compass positions scale independently of viewport size using calibrated HUD ratios", () => {
  const portrait = settings.instrument.photographic.portrait;
  const landscape = settings.instrument.photographic.landscape;
  assert.ok(Math.abs(portrait.compass.centerX - 0.22831023) < 1e-8);
  assert.ok(Math.abs(portrait.compass.centerY - 1.32419624 * 941 / 1672) < 1e-8);
  assert.ok(Math.abs(landscape.compass.centerX - 141 / 1200) < 1e-6);
  assert.ok(Math.abs(landscape.compass.centerY - 234 / 650) < 1e-6);
  for (const [width, height, aspect, config] of [
    [390, 844, 941 / 1672, portrait],
    [1080, 2340, 941 / 1672, portrait],
    [844, 390, 1200 / 650, landscape],
    [1920, 1080, 1200 / 650, landscape]
  ]) {
    const rendered = calculateInstrumentLayout(width, height, aspect, config);
    assert.equal(rendered.compass.centerX, config.compass.centerX);
    assert.equal(rendered.compass.centerY, config.compass.centerY);
    assert.equal(rendered.compass.diameter, config.compass.diameter);
  }
});

test("portrait compass preserves the manually calibrated normalized center and radius", () => {
  const { compass } = photographicPortrait;
  assert.ok(Math.abs(compass.centerX * 941 - 0.22831023 * 941) < 0.0001);
  assert.ok(Math.abs(compass.centerY * 1672 - 1.32419624 * 941) < 0.0001);
  assert.ok(Math.abs(compass.diameter * 941 / 2 - 128) < 0.0001);
  assert.equal(compass.aspectRatio, 1);
});

test("landscape compass matches elliptical opening with ±1px radii", () => {
  const { compass } = photographicLandscape;
  const radiusX = compass.diameter * 1200 / 2;
  const radiusY = radiusX / compass.aspectRatio;
  assert.ok(Math.abs(compass.centerX * 1200 - 141) < 0.0001);
  assert.ok(Math.abs(compass.centerY * 650 - 234) < 0.0001);
  assert.ok(Math.abs(radiusX - 75) < 0.001);
  assert.ok(Math.abs(radiusY - 92) < 0.001);
});

test("calibrated rotor scales proportionally for four screen dimensions", () => {
  for (const [w,h,aspect,geometry] of [
    [390,844,941/1672,photographicPortrait],
    [1080,2340,941/1672,photographicPortrait],
    [844,390,1200/650,photographicLandscape],
    [1920,1080,1200/650,photographicLandscape]
  ]) {
    const layout = calculateInstrumentLayout(w,h,aspect,geometry);
    const cw = layout.frame.width * layout.compass.diameter;
    const ch = cw / layout.compass.aspectRatio;
    assert.ok(cw > 0 && ch > 0);
    assert.ok(Math.abs(cw/ch-layout.compass.aspectRatio) < 1e-9);
    assert.equal(layout.compass.centerX,geometry.compass.centerX);
    assert.equal(layout.compass.centerY,geometry.compass.centerY);
  }
});

test("user-measured portrait compass retains its diameter and changes center in both axes", () => {
  const { compass } = photographicPortrait;
  const measuredXOverHudWidth = 0.22831023;
  const measuredYOverHudWidth = 1.32419624;
  const hudWidth = 941;
  const hudHeight = 1672;
  const measuredYOverHudHeight = measuredYOverHudWidth * hudWidth / hudHeight;
  assert.ok(Math.abs(compass.centerX - measuredXOverHudWidth) < 1e-8);
  assert.ok(Math.abs(compass.centerY - measuredYOverHudHeight) < 1e-8);
  assert.equal(compass.diameter, 0.27205101);
  assert.equal(compass.aspectRatio, 1);
  assert.ok(compass.centerX > 0.21997875);
  assert.ok(compass.centerY > 0.74282297);
  assert.ok(compass.centerX < 1 && compass.centerY < 1);
});


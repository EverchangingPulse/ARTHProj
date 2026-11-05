import test from "node:test";
import assert from "node:assert/strict";
import { calculateInstrumentLayout } from "../docs/instrument-layout.js";
import { ImmersiveFullscreen } from "../docs/immersive-fullscreen.js";

test("portrait instrument fills viewport without stretching circular geometry", () => {
  const result = calculateInstrumentLayout(390, 844);
  assert.equal(result.mode, "portrait");
  assert.ok(result.scale > 0);
  assert.ok(result.dial.x > 0 && result.dial.x < 390);
  assert.ok(result.dial.y > 0 && result.dial.y < 844);
  assert.ok(result.compass.diameter > 0);
});

test("landscape uses a distinct composition and aligned inset compass", () => {
  const result = calculateInstrumentLayout(844, 390);
  assert.equal(result.mode, "landscape");
  assert.ok(result.dial.x > 0 && result.dial.x < 844);
  assert.ok(result.dial.y > 0 && result.dial.y < 390);
  assert.ok(result.compass.x > 0 && result.compass.x < 844);
  assert.ok(result.compass.y > 0 && result.compass.y < 390);
});

test("instrument rejects invalid viewport dimensions", () => {
  assert.throws(() => calculateInstrumentLayout(0, 800), /Invalid viewport/);
  assert.throws(() => calculateInstrumentLayout(800, 0), /Invalid viewport/);
});

test("Telegram requests full screen on launch when configured", () => {
  const calls = [];
  const webApp = {
    initData: "signed",
    ready: () => calls.push("ready"),
    expand: () => calls.push("expand"),
    setHeaderColor: value => calls.push("header:" + value),
    requestFullscreen: () => calls.push("fullscreen"),
    unlockOrientation: () => calls.push("unlock")
  };
  const controller = new ImmersiveFullscreen({}, webApp);
  controller.onLaunch(true);
  assert.ok(calls.includes("fullscreen"));
  assert.ok(calls.includes("expand"));
  const count = calls.length;
  controller.onLaunch(false);
  assert.equal(calls.length, count);
});

test("standard browser full screen can be requested from a tap", async () => {
  const originalDocument = globalThis.document;
  const calls = [];
  globalThis.document = { fullscreenEnabled: true, fullscreenElement: null };
  try {
    const stage = { requestFullscreen: options => {
      calls.push(options.navigationUI);
      return Promise.resolve();
    } };
    const controller = new ImmersiveFullscreen(stage, { initData: "" });
    controller.onLaunch(true);
    controller.requestFromGesture();
    assert.deepEqual(calls, ["hide"]);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("fullscreen disabled by settings never invokes browser API", () => {
  const originalDocument = globalThis.document;
  globalThis.document = { fullscreenEnabled: true, fullscreenElement: null };
  try {
    let called = 0;
    const controller = new ImmersiveFullscreen({ requestFullscreen: () => called++ }, {});
    controller.onLaunch(false);
    controller.requestFromGesture();
    assert.equal(called, 0);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("landscape photographic frame remains completely within the viewport", async () => {
  const { calculateInstrumentLayout, PHOTOGRAPHIC_INSTRUMENTS } = await import("../docs/instrument-layout.js");
  for (const [width, height] of [[844,390],[1386,525],[1280,720],[512,320],[390,844]]) {
    const result = calculateInstrumentLayout(width,height,"photographic");
    const frame = result.frame;
    const spec = PHOTOGRAPHIC_INSTRUMENTS[result.mode];
    assert.ok(frame.x >= -1e-9, "frame x");
    assert.ok(frame.y >= -1e-9, "frame y");
    assert.ok(frame.x+frame.width <= width+1e-9,"frame width within viewport");
    assert.ok(frame.y+frame.height <= height+1e-9,"frame height within viewport");
    assert.equal(result.compass.x, spec.compass.x*result.scale+result.offsetX);
    assert.equal(result.compass.y, spec.compass.y*result.scale+result.offsetY);
    assert.equal(result.compass.diameter, spec.compass.radius*2*result.scale);
    assert.ok(result.compass.diameter>0);
  }
});

test("landscape resize preserves all photographic HUD elements without cropping", async () => {
  const { calculateInstrumentLayout } = await import("../docs/instrument-layout.js");
  const first=calculateInstrumentLayout(844,390,"photographic");
  const second=calculateInstrumentLayout(390,844,"photographic");
  const third=calculateInstrumentLayout(844,390,"photographic");
  assert.ok(first.frame.width < 844);
  assert.equal(first.frame.height,390);
  assert.equal(first.mode,"landscape");
  assert.equal(second.mode,"portrait");
  assert.deepEqual(first,third);
});

test("photographic compass is aligned to the actual brass housing, not the older alpha-cutout center", async () => {
  const { PHOTOGRAPHIC_INSTRUMENTS } = await import("../docs/instrument-layout.js");
  const portrait = PHOTOGRAPHIC_INSTRUMENTS.portrait.compass;
  const landscape = PHOTOGRAPHIC_INSTRUMENTS.landscape.compass;
  assert.deepEqual(portrait, { x: 210, y: 1253, radius: 102 });
  assert.deepEqual(landscape, { x: 152, y: 241, radius: 68 });
  assert.ok(portrait.y > 1238);
  assert.ok(landscape.x > 141);
  assert.ok(portrait.radius > 86 && landscape.radius > 55);
});

test("portrait and landscape compass stay centered after their image contain transform", async () => {
  const { PHOTOGRAPHIC_INSTRUMENTS } = await import("../docs/instrument-layout.js");
  for (const [width, height] of [[390,844],[691,1280],[844,390],[1280,720],[600,300]]) {
    const layout = calculateInstrumentLayout(width,height,"photographic");
    const compass = PHOTOGRAPHIC_INSTRUMENTS[layout.mode].compass;
    assert.ok(Math.abs(layout.compass.x - (layout.offsetX + compass.x*layout.scale)) < 1e-8);
    assert.ok(Math.abs(layout.compass.y - (layout.offsetY + compass.y*layout.scale)) < 1e-8);
    assert.ok(Math.abs(layout.compass.diameter - 2*compass.radius*layout.scale) < 1e-8);
  }
});

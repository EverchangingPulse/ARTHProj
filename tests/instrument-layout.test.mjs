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

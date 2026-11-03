import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHeading, shortestArc, headingFromOrientation, applyDeclination } from "../docs/north-compass.js";
import { magvar, calculateMagVar } from "../docs/vendor/wmm2025.js";
import { gregorianToJulian } from "../docs/vendor/wmm2025-utils.js";
import { parseAppSettings } from "../docs/app-config.js";
import { readFileSync } from "node:fs";

const settings = JSON.parse(readFileSync(new URL("../docs/config/settings.json", import.meta.url)));

test("compass heading normalizes and crosses north by the shortest arc", () => {
  assert.equal(normalizeHeading(-90), 270);
  assert.equal(normalizeHeading(720), 0);
  assert.equal(shortestArc(359, 1), 2);
  assert.equal(shortestArc(1, 359), -2);
});

test("absolute magnetic orientation follows W3C alpha in a flat portrait", () => {
  assert.equal(headingFromOrientation({ absolute: true, alpha: 0, beta: 0, gamma: 0 }), 0);
  assert.equal(headingFromOrientation({ absolute: true, alpha: 90, beta: 0, gamma: 0 }), 270);
  assert.equal(headingFromOrientation({ absolute: true, alpha: 270, beta: 0, gamma: 0 }), 90);
});

test("absolute magnetic orientation follows camera azimuth when held vertically", () => {
  assert.ok(Math.abs(headingFromOrientation({ absolute: true, alpha: 90, beta: 90, gamma: 0 }) - 270) < 1e-7);
  assert.ok(Math.abs(headingFromOrientation({ absolute: true, alpha: 0, beta: 90, gamma: 0 })) < 1e-7);
});

test("iOS webkit magnetic compass heading and orientation screen angle", () => {
  assert.equal(headingFromOrientation({ webkitCompassHeading: 10 }, 90), 100);
  assert.equal(headingFromOrientation({ webkitCompassHeading: -1 }), null);
  assert.equal(headingFromOrientation({ absolute: false, alpha: 120 }), null);
  assert.equal(headingFromOrientation({ absolute: true, alpha: null }), null);
});

test("east magnetic declination corrects magnetic compass to true north", () => {
  assert.equal(applyDeclination(355, 8), 3);
  assert.equal(applyDeclination(10, -14), 356);
});

test("WMM2025 model matches the published reference declination sample", () => {
  const date = gregorianToJulian(2026, 0, 1);
  const declination = calculateMagVar(date, -57, 3, 74);
  assert.ok(Math.abs(declination - (-22.51)) < 0.8, "WMM2025 sample: " + declination);
  assert.ok(Number.isFinite(magvar(45, 9)));
});

test("compass config can disable location; invalid smoothing is rejected", () => {
  const parsed = parseAppSettings(settings);
  assert.equal(parsed.compass.preferTrueNorth, true);
  assert.equal(parsed.compass.requestLocation, true);
  assert.equal(parsed.compass.headingSmoothing, 0.21);
  assert.throws(() => parseAppSettings({ ...settings, compass: { ...settings.compass, headingSmoothing: 0 } }), /headingSmoothing/);
  assert.throws(() => parseAppSettings({ ...settings, compass: { ...settings.compass, enabled: "yes" } }), /compass.enabled/);
});

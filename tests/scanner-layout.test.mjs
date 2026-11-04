import test from "node:test";
import assert from "node:assert/strict";
import { calculateScannerGeometry } from "../docs/responsive-scanner.js";

const calculate = ({ width, height, header, footerTop, compass = 0 }) =>
  calculateScannerGeometry({
    viewportWidth: width,
    viewportHeight: height,
    headerBottom: header,
    controlsTop: footerTop,
    compassVisible: compass > 0,
    compassWidth: compass
  });

test("portrait scanner fits available camera region without stretching", () => {
  const box = calculate({ width: 390, height: 820, header: 88, footerTop: 632 });
  assert.ok(box.imageWidth > 0 && box.imageWidth <= 390);
  assert.ok(box.imageWidth / box.aspectRatio <= box.availableHeight);
  assert.equal(box.right, 0);
});

test("landscape scanner recalculates using available vertical space", () => {
  const portrait = calculate({ width: 390, height: 820, header: 88, footerTop: 632 });
  const landscape = calculate({ width: 820, height: 390, header: 60, footerTop: 288, compass: 78 });
  assert.ok(landscape.imageWidth > 0);
  assert.notEqual(landscape.imageWidth, portrait.imageWidth);
  assert.ok(landscape.imageWidth <= 820 - landscape.right);
  assert.ok(landscape.imageWidth / landscape.aspectRatio <= landscape.availableHeight);
});

test("landscape layout expands when available camera height increases", () => {
  const shortScreen = calculate({ width: 1100, height: 400, header: 60, footerTop: 280 });
  const tallScreen = calculate({ width: 1100, height: 650, header: 60, footerTop: 530 });
  assert.ok(tallScreen.imageWidth > shortScreen.imageWidth);
});

test("landscape canvas reserves room for visible compass", () => {
  const withCompass = calculate({ width: 930, height: 480, header: 56, footerTop: 370, compass: 90 });
  const withoutCompass = calculate({ width: 930, height: 480, header: 56, footerTop: 370 });
  assert.ok(withCompass.right > 0);
  assert.equal(withoutCompass.right, 0);
  assert.ok(withCompass.imageWidth <= withoutCompass.imageWidth);
});

test("very short viewport produces a safe non-negative layout", () => {
  const box = calculate({ width: 300, height: 100, header: 85, footerTop: 85 });
  assert.ok(box.imageWidth >= 0);
  assert.ok(box.availableHeight >= 0);
  assert.ok(box.bottom >= 0);
  assert.equal(box.hideCaption, true);
});

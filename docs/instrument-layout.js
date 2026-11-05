export const ILLUSTRATED_INSTRUMENTS = Object.freeze({
  portrait: Object.freeze({
    width: 900,
    height: 1900,
    dial: Object.freeze({ x: 450, y: 922, radius: 312 }),
    compass: Object.freeze({ x: 238, y: 1630, radius: 88 })
  }),
  landscape: Object.freeze({
    width: 1900,
    height: 900,
    dial: Object.freeze({ x: 945, y: 452, radius: 291 }),
    compass: Object.freeze({ x: 245, y: 226, radius: 79 })
  })
});

export const PHOTOGRAPHIC_INSTRUMENTS = Object.freeze({
  portrait: Object.freeze({
    width: 941,
    height: 1672,
    dial: Object.freeze({ x: 466, y: 715, radius: 289 }),
    compass: Object.freeze({ x: 210, y: 1253, radius: 102 })
  }),
  landscape: Object.freeze({
    width: 1200,
    height: 650,
    dial: Object.freeze({ x: 602, y: 330, radius: 245 }),
    compass: Object.freeze({ x: 152, y: 241, radius: 68 })
  })
});

export const INSTRUMENTS = ILLUSTRATED_INSTRUMENTS;

export function calculateInstrumentLayout(width, height, artwork = "illustrated") {
  if (!(width > 0) || !(height > 0)) throw new Error("Invalid viewport dimensions.");
  const mode = width > height ? "landscape" : "portrait";
  const selected = artwork === "photographic" ? PHOTOGRAPHIC_INSTRUMENTS : ILLUSTRATED_INSTRUMENTS;
  const spec = selected[mode];
  const scale = Math.min(width / spec.width, height / spec.height);
  const offsetX = (width - spec.width * scale) / 2;
  const offsetY = (height - spec.height * scale) / 2;
  const position = point => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
    diameter: point.radius * 2 * scale
  });
  return {
    mode,
    compass: position(spec.compass),
    dial: position(spec.dial),
    frame: {
      x: offsetX,
      y: offsetY,
      width: spec.width * scale,
      height: spec.height * scale
    },
    scale,
    offsetX,
    offsetY
  };
}

export class InstrumentLayout {
  constructor(stage, options = {}) {
    this.stage = stage;
    this.frame = null;
    this.last = "";
    this.listener = options.onResize || (() => {});
    this.onChange = () => this.schedule();
    this.onRotate = () => {
      this.schedule();
      this.clearOrientationTimers();
      for (const delay of [150, 400, 850]) {
        this.orientationTimers.push(window.setTimeout(() => this.schedule(), delay));
      }
    };
    this.observer = null;
    this.orientationTimers = [];
  }

  start() {
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.onChange);
      this.observer.observe(this.stage);
    }
    window.addEventListener("resize", this.onChange);
    window.addEventListener("orientationchange", this.onRotate);
    window.visualViewport?.addEventListener("resize", this.onChange);
    window.screen.orientation?.addEventListener?.("change", this.onRotate);
    this.schedule();
  }

  schedule() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
        const heightValue = Math.round(viewportHeight) + "px";
        if (document.documentElement.style.getPropertyValue("--app-height") !== heightValue) {
          document.documentElement.style.setProperty("--app-height", heightValue);
        }
      }
      const { width, height } = this.stage.getBoundingClientRect();
      if (!width || !height) return;
      const orientation = width > height ? "landscape" : "portrait";
      const artwork = this.stage.dataset["frame" + orientation] || "illustrated";
      const signature = width.toFixed(1) + "x" + height.toFixed(1) + ":" + artwork;
      if (signature === this.last) return;
      const layout = calculateInstrumentLayout(width, height, artwork);
      this.stage.dataset.instrumentMode = layout.mode;
      this.stage.style.setProperty("--compass-x", layout.compass.x.toFixed(2) + "px");
      this.stage.style.setProperty("--compass-y", layout.compass.y.toFixed(2) + "px");
      this.stage.style.setProperty("--compass-size", layout.compass.diameter.toFixed(2) + "px");
      this.stage.style.setProperty("--dial-x", layout.dial.x.toFixed(2) + "px");
      this.stage.style.setProperty("--dial-y", layout.dial.y.toFixed(2) + "px");
      this.stage.style.setProperty("--dial-size", layout.dial.diameter.toFixed(2) + "px");
      this.stage.style.setProperty("--frame-width", layout.frame.width.toFixed(2) + "px");
      this.stage.style.setProperty("--frame-height", layout.frame.height.toFixed(2) + "px");
      const changed = this.last !== "";
      this.last = signature;
      if (changed) this.listener();
    });
  }

  clearOrientationTimers() {
    for (const handle of this.orientationTimers) window.clearTimeout(handle);
    this.orientationTimers.length = 0;
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.clearOrientationTimers();
    this.observer?.disconnect();
    window.removeEventListener("resize", this.onChange);
    window.removeEventListener("orientationchange", this.onRotate);
    window.visualViewport?.removeEventListener("resize", this.onChange);
    window.screen.orientation?.removeEventListener?.("change", this.onRotate);
  }
}

export const INSTRUMENTS = Object.freeze({
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

export function calculateInstrumentLayout(width, height) {
  if (!(width > 0) || !(height > 0)) throw new Error("Invalid viewport dimensions.");
  const mode = width > height ? "landscape" : "portrait";
  const spec = INSTRUMENTS[mode];
  const scale = Math.max(width / spec.width, height / spec.height);
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
    this.observer = null;
  }

  start() {
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.onChange);
      this.observer.observe(this.stage);
    }
    window.addEventListener("resize", this.onChange);
    window.addEventListener("orientationchange", this.onChange);
    window.visualViewport?.addEventListener("resize", this.onChange);
    window.screen.orientation?.addEventListener?.("change", this.onChange);
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
      const signature = width.toFixed(1) + "x" + height.toFixed(1);
      if (signature === this.last) return;
      const layout = calculateInstrumentLayout(width, height);
      this.stage.dataset.instrumentMode = layout.mode;
      this.stage.style.setProperty("--compass-x", layout.compass.x.toFixed(2) + "px");
      this.stage.style.setProperty("--compass-y", layout.compass.y.toFixed(2) + "px");
      this.stage.style.setProperty("--compass-size", layout.compass.diameter.toFixed(2) + "px");
      this.stage.style.setProperty("--dial-x", layout.dial.x.toFixed(2) + "px");
      this.stage.style.setProperty("--dial-y", layout.dial.y.toFixed(2) + "px");
      this.stage.style.setProperty("--dial-size", layout.dial.diameter.toFixed(2) + "px");
      const changed = this.last !== "";
      this.last = signature;
      if (changed) this.listener();
    });
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.observer?.disconnect();
    window.removeEventListener("resize", this.onChange);
    window.removeEventListener("orientationchange", this.onChange);
    window.visualViewport?.removeEventListener("resize", this.onChange);
    window.screen.orientation?.removeEventListener?.("change", this.onChange);
  }
}

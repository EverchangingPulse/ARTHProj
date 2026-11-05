export function calculateInstrumentLayout(viewportWidth, viewportHeight, aspectRatio, geometry) {
  if (![viewportWidth, viewportHeight, aspectRatio].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error("Invalid viewport or artwork aspect ratio.");
  }
  if (!geometry?.frame || !geometry?.compass) {
    throw new Error("Relative instrument geometry is required.");
  }

  const frameWidth = Math.min(viewportWidth, viewportHeight * aspectRatio) * geometry.frame.scale;
  const frameHeight = frameWidth / aspectRatio;

  return {
    frame: {
      centerX: geometry.frame.centerX,
      centerY: geometry.frame.centerY,
      width: frameWidth,
      height: frameHeight
    },
    compass: {
      centerX: geometry.compass.centerX,
      centerY: geometry.compass.centerY,
      diameter: geometry.compass.diameter,
      aspectRatio: geometry.compass.aspectRatio
    }
  };
}

export class InstrumentLayout {
  constructor(stage, options = {}) {
    this.stage = stage;
    this.frameElement = stage.querySelector("#instrument-frame");
    this.images = {
      portrait: stage.querySelector("#portrait-instrument"),
      landscape: stage.querySelector("#landscape-instrument")
    };
    this.geometry = null;
    this.frame = null;
    this.last = "";
    this.lastViewport = "";
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

  configure(geometry) {
    this.geometry = geometry;
    this.last = "";
    this.schedule();
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
      this.update();
    });
  }

  update() {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
      const heightValue = Math.round(viewportHeight) + "px";
      if (document.documentElement.style.getPropertyValue("--app-height") !== heightValue) {
        document.documentElement.style.setProperty("--app-height", heightValue);
      }
    }

    const { width, height } = this.stage.getBoundingClientRect();
    if (!(width > 0 && height > 0)) return;

    const orientation = width > height ? "landscape" : "portrait";
    this.stage.dataset.instrumentMode = orientation;
    const image = this.images[orientation];
    const artwork = this.stage.dataset["frame" + orientation] || "photographic";
    const geometry = this.geometry?.[artwork]?.[orientation];

    if (!geometry || !image?.naturalWidth || !image?.naturalHeight) {
      this.frameElement.hidden = true;
      return;
    }

    const signature = [width.toFixed(2), height.toFixed(2), orientation, artwork, image.naturalWidth, image.naturalHeight, JSON.stringify(geometry)].join(":");
    if (signature === this.last) return;

    const aspectRatio = image.naturalWidth / image.naturalHeight;
    const layout = calculateInstrumentLayout(width, height, aspectRatio, geometry);
    const percent = value => (value * 100).toFixed(4) + "%";

    this.stage.style.setProperty("--frame-center-x", percent(layout.frame.centerX));
    this.stage.style.setProperty("--frame-center-y", percent(layout.frame.centerY));
    this.stage.style.setProperty("--frame-width", layout.frame.width.toFixed(2) + "px");
    this.stage.style.setProperty("--frame-height", layout.frame.height.toFixed(2) + "px");
    this.stage.style.setProperty("--compass-center-x", percent(layout.compass.centerX));
    this.stage.style.setProperty("--compass-center-y", percent(layout.compass.centerY));
    this.stage.style.setProperty("--compass-diameter", percent(layout.compass.diameter));
    this.stage.style.setProperty("--compass-aspect-ratio", layout.compass.aspectRatio.toFixed(8));
    this.frameElement.hidden = false;

    const viewportSignature = width.toFixed(2) + "x" + height.toFixed(2);
    const changed = this.lastViewport !== "" && this.lastViewport !== viewportSignature;
    this.lastViewport = viewportSignature;
    this.last = signature;
    if (changed) this.listener();
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

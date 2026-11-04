const INSTRUMENT_ASPECT = 900 / 650;

export function calculateScannerGeometry({
  viewportWidth,
  viewportHeight,
  headerBottom,
  controlsTop,
  compassVisible = false,
  compassWidth = 0
}) {
  const width = Math.max(0, viewportWidth);
  const height = Math.max(0, viewportHeight);
  const landscape = width > height;
  const padding = landscape ? 7 : 12;
  const overlap = landscape ? 12 : 4;
  const top = Math.min(height, Math.max(0, headerBottom - overlap));
  const bottom = Math.min(height - top, Math.max(0, height - controlsTop - overlap));
  const clearHeight = Math.max(0, height - top - bottom);
  const hideCaption = clearHeight < 275;
  const captionHeight = hideCaption ? 0 : 30;
  const reserveCompass = landscape && compassVisible && width >= 650
    ? Math.min(width * 0.18, compassWidth + 20)
    : 0;
  const availableWidth = Math.max(0, width - padding * 2 - reserveCompass);
  const availableHeight = Math.max(0, clearHeight - padding * 2 - captionHeight);
  const imageWidth = Math.floor(Math.max(0, Math.min(availableWidth, availableHeight * INSTRUMENT_ASPECT)));
  return {
    top,
    bottom,
    right: reserveCompass,
    imageWidth,
    hideCaption,
    availableHeight,
    aspectRatio: INSTRUMENT_ASPECT
  };
}

export class ResponsiveScanner {
  constructor(stage, onCameraResize = () => {}) {
    this.stage = stage;
    this.header = stage.querySelector(".topbar");
    this.controls = stage.querySelector(".bottom-panel");
    this.compass = stage.querySelector("#compass-panel");
    this.scanner = stage.querySelector("#scanner-hud");
    this.caption = this.scanner.querySelector(".scanner-caption");
    this.onCameraResize = onCameraResize;
    this.frame = null;
    this.orientationTimeouts = [];
    this.lastSize = null;
    this.scheduleUpdate = () => this.schedule();
    this.afterOrientationChange = () => {
      this.schedule();
      for (const delay of [150, 400]) {
        this.orientationTimeouts.push(window.setTimeout(() => this.schedule(), delay));
      }
    };
    this.observer = null;
  }

  start() {
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.scheduleUpdate);
      for (const element of [this.stage, this.header, this.controls, this.compass]) {
        if (element) this.observer.observe(element);
      }
    }
    window.addEventListener("resize", this.scheduleUpdate);
    window.addEventListener("orientationchange", this.afterOrientationChange);
    window.visualViewport?.addEventListener("resize", this.scheduleUpdate);
    window.screen.orientation?.addEventListener?.("change", this.afterOrientationChange);
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
    const visibleHeight = window.visualViewport?.height || window.innerHeight;
    if (Number.isFinite(visibleHeight) && visibleHeight > 0) {
      const value = Math.round(visibleHeight) + "px";
      if (document.documentElement.style.getPropertyValue("--app-height") !== value) {
        document.documentElement.style.setProperty("--app-height", value);
        this.schedule();
      }
    }

    const stage = this.stage.getBoundingClientRect();
    const header = this.header.getBoundingClientRect();
    const controls = this.controls.getBoundingClientRect();
    const compass = this.compass.getBoundingClientRect();
    const geometry = calculateScannerGeometry({
      viewportWidth: stage.width,
      viewportHeight: stage.height,
      headerBottom: header.bottom - stage.top,
      controlsTop: controls.top - stage.top,
      compassVisible: !this.compass.hidden,
      compassWidth: compass.width
    });

    this.stage.style.setProperty("--hud-top", geometry.top + "px");
    this.stage.style.setProperty("--hud-bottom", geometry.bottom + "px");
    this.stage.style.setProperty("--hud-right", geometry.right + "px");
    this.stage.style.setProperty("--instrument-width", geometry.imageWidth + "px");
    this.stage.style.setProperty("--photo-max-height", Math.max(60, geometry.availableHeight) + "px");
    this.caption.hidden = geometry.hideCaption;

    const size = stage.width + "x" + stage.height;
    if (this.lastSize !== null && this.lastSize !== size) this.onCameraResize();
    this.lastSize = size;
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.observer?.disconnect();
    window.removeEventListener("resize", this.scheduleUpdate);
    window.removeEventListener("orientationchange", this.afterOrientationChange);
    window.visualViewport?.removeEventListener("resize", this.scheduleUpdate);
    window.screen.orientation?.removeEventListener?.("change", this.afterOrientationChange);
    for (const timeout of this.orientationTimeouts) clearTimeout(timeout);
    this.orientationTimeouts.length = 0;
  }
}

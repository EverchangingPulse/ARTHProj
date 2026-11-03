import { magvar } from "./vendor/wmm2025.js";

export function normalizeHeading(degrees) {
  return ((degrees % 360) + 360) % 360;
}

export function shortestArc(from, to) {
  return ((normalizeHeading(to) - normalizeHeading(from) + 540) % 360) - 180;
}

export function headingFromOrientation(event, screenAngle = 0) {
  if (Number.isFinite(event?.webkitCompassHeading) && event.webkitCompassHeading >= 0) {
    return normalizeHeading(event.webkitCompassHeading + screenAngle);
  }
  if (!event?.absolute || !Number.isFinite(event.alpha)) return null;

  const alpha = event.alpha * Math.PI / 180;
  const beta = (Number.isFinite(event.beta) ? event.beta : 0) * Math.PI / 180;
  const gamma = (Number.isFinite(event.gamma) ? event.gamma : 0) * Math.PI / 180;

  const east = -Math.cos(alpha) * Math.sin(gamma) - Math.sin(alpha) * Math.sin(beta) * Math.cos(gamma);
  const north = -Math.sin(alpha) * Math.sin(gamma) + Math.cos(alpha) * Math.sin(beta) * Math.cos(gamma);
  const heading = Math.hypot(east, north) >= 0.3
    ? Math.atan2(east, north) * 180 / Math.PI
    : 360 - event.alpha;

  return normalizeHeading(heading + screenAngle);
}

export function applyDeclination(magneticHeading, declination) {
  return normalizeHeading(magneticHeading + declination);
}

export class NorthCompass {
  constructor(root) {
    this.root = root;
    this.rose = document.getElementById("wind-rose");
    this.headingLabel = document.getElementById("compass-heading");
    this.modeLabel = document.getElementById("compass-mode");
    this.permissionButton = document.getElementById("compass-enable");
    this.permissionButton.addEventListener("click", () => void this.askPermission());
    this.onOrientation = event => this.update(event);
    this.started = false;
    this.hasAbsolute = false;
    this.lastAngle = null;
    this.declination = null;
    this.lastValidReading = 0;
    this.minimumUpdateMs = 45;
  }

  start(settings) {
    if (this.started || !settings.enabled) return;
    this.started = true;
    this.settings = settings;
    this.root.hidden = false;
    this.modeLabel.textContent = "SEARCHING N";
    window.addEventListener("deviceorientationabsolute", this.onOrientation);
    window.addEventListener("deviceorientation", this.onOrientation);
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      this.permissionButton.hidden = false;
      this.modeLabel.textContent = "TAP ENABLE";
    }
  }

  requestLocation() {
    if (!this.started || !this.settings.preferTrueNorth || !this.settings.requestLocation) return;
    if (!navigator.geolocation) {
      this.setMode("MAG N");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        try {
          const { latitude, longitude, altitude } = position.coords;
          const variation = magvar(latitude, longitude, Number.isFinite(altitude) ? altitude / 1000 : 0);
          if (Number.isFinite(variation)) this.declination = variation;
          this.setMode(this.declination === null ? "MAG N" : "TRUE N");
        } catch {
          this.setMode("MAG N");
        }
      },
      () => this.setMode("MAG N"),
      { enableHighAccuracy: false, timeout: 13000, maximumAge: 900000 }
    );
  }

  async askPermission() {
    if (typeof DeviceOrientationEvent === "undefined" || typeof DeviceOrientationEvent.requestPermission !== "function") return;
    try {
      const granted = await DeviceOrientationEvent.requestPermission(true);
      if (granted !== "granted") {
        this.modeLabel.textContent = "SENSOR BLOCKED";
        return;
      }
      this.permissionButton.hidden = true;
      this.modeLabel.textContent = "SEARCHING N";
    } catch {
      this.modeLabel.textContent = "SENSOR BLOCKED";
    }
  }

  update(event) {
    if (!this.started) return;
    if (this.hasAbsolute && event.type !== "deviceorientationabsolute" && !Number.isFinite(event.webkitCompassHeading)) return;
    const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0;
    const magneticHeading = headingFromOrientation(event, Number(screenAngle) || 0);
    if (magneticHeading === null) return;
    if (event.type === "deviceorientationabsolute") this.hasAbsolute = true;
    const now = performance.now();
    if (now - this.lastValidReading < this.minimumUpdateMs) return;
    this.lastValidReading = now;

    const trueNorth = this.declination !== null && this.settings.preferTrueNorth;
    const heading = trueNorth ? applyDeclination(magneticHeading, this.declination) : magneticHeading;
    if (this.lastAngle === null) {
      this.lastAngle = heading;
    } else {
      this.lastAngle += shortestArc(this.lastAngle, heading) * this.settings.headingSmoothing;
    }
    this.rose.style.transform = "rotate(" + (-this.lastAngle).toFixed(2) + "deg)";
    this.headingLabel.textContent = Math.round(normalizeHeading(this.lastAngle)) + "°";
    this.modeLabel.textContent = trueNorth ? "TRUE N" : "MAG N";
    this.permissionButton.hidden = true;
  }

  setMode(mode) {
    if (this.lastAngle !== null) {
      this.modeLabel.textContent = mode;
    }
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("deviceorientationabsolute", this.onOrientation);
    window.removeEventListener("deviceorientation", this.onOrientation);
  }
}

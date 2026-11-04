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
    this.onOrientation = event => this.update(event);
    this.started = false;
    this.hasAbsolute = false;
    this.lastAngle = null;
    this.declination = null;
    this.lastValidReading = 0;
    this.minimumUpdateMs = 45;
    this.permissionRequested = false;
  }

  start(settings) {
    if (this.started || !settings.enabled) return;
    this.started = true;
    this.settings = settings;
    this.root.hidden = false;
    window.addEventListener("deviceorientationabsolute", this.onOrientation);
    window.addEventListener("deviceorientation", this.onOrientation);
  }

  requestLocation() {
    if (!this.started || !this.settings.preferTrueNorth || !this.settings.requestLocation) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      position => {
        try {
          const { latitude, longitude, altitude } = position.coords;
          const variation = magvar(latitude, longitude, Number.isFinite(altitude) ? altitude / 1000 : 0);
          if (Number.isFinite(variation)) this.declination = variation;
        } catch {
          this.declination = null;
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 13000, maximumAge: 900000 }
    );
  }

  async askPermission() {
    if (!this.started || this.permissionRequested) return;
    if (typeof DeviceOrientationEvent === "undefined" || typeof DeviceOrientationEvent.requestPermission !== "function") return;
    this.permissionRequested = true;
    try {
      await DeviceOrientationEvent.requestPermission(true);
    } catch {
      this.permissionRequested = false;
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

    const useTrueNorth = this.declination !== null && this.settings.preferTrueNorth;
    const heading = useTrueNorth ? applyDeclination(magneticHeading, this.declination) : magneticHeading;
    this.lastAngle = this.lastAngle === null
      ? heading
      : this.lastAngle + shortestArc(this.lastAngle, heading) * this.settings.headingSmoothing;

    this.rose.style.transform = "rotate(" + (-this.lastAngle).toFixed(2) + "deg)";
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("deviceorientationabsolute", this.onOrientation);
    window.removeEventListener("deviceorientation", this.onOrientation);
  }
}

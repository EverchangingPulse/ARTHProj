function requireBoolean(value, path) {
  if (typeof value !== "boolean") throw new Error(path + " must be true or false.");
  return value;
}

function requireNumber(value, min, max, path) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(path + " must be a number from " + min + " to " + max + ".");
  }
  return value;
}

function requireInteger(value, min, max, path) {
  const number = requireNumber(value, min, max, path);
  if (!Number.isInteger(number)) throw new Error(path + " must be a whole number.");
  return number;
}

function requireScannerStyle(value) {
  if (!["astrolabe", "sonar"].includes(value)) {
    throw new Error('scanner.style must be "astrolabe" or "sonar".');
  }
  return value;
}

export function parseAppSettings(config) {
  if (config?.version !== 1) throw new Error("Invalid settings version: expected version 1.");

  return {
    camera: {
      autoStart: requireBoolean(config.camera?.autoStart, "camera.autoStart")
    },
    tracking: {
      maxTrack: requireInteger(config.tracking?.maxTrack, 1, 3, "tracking.maxTrack")
    },
    overlay: {
      opacity: requireNumber(config.overlay?.opacity, 0.1, 1, "overlay.opacity")
    },
    scanner: {
      enabled: requireBoolean(config.scanner?.enabled, "scanner.enabled"),
      style: requireScannerStyle(config.scanner?.style)
    },
    compass: {
      enabled: requireBoolean(config.compass?.enabled, "compass.enabled"),
      preferTrueNorth: requireBoolean(config.compass?.preferTrueNorth, "compass.preferTrueNorth"),
      requestLocation: requireBoolean(config.compass?.requestLocation, "compass.requestLocation"),
      headingSmoothing: requireNumber(config.compass?.headingSmoothing, 0.05, 1, "compass.headingSmoothing")
    },
    capture: {
      autoFreeze: requireBoolean(config.capture?.autoFreeze, "capture.autoFreeze"),
      freezeDelayMs: requireInteger(config.capture?.freezeDelayMs, 0, 5000, "capture.freezeDelayMs"),
      shutterSound: requireBoolean(config.capture?.shutterSound, "capture.shutterSound")
    }
  };
}

export async function loadAppSettings(fetcher = fetch) {
  const response = await fetcher("./config/settings.json", { cache: "no-store" });
  if (!response.ok) throw new Error("AR settings could not be loaded (HTTP " + response.status + ").");
  return parseAppSettings(await response.json());
}

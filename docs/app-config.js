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

function parseRelativeInstrument(config) {
  const result = {};
  for (const artwork of ["photographic", "illustrated"]) {
    result[artwork] = {};
    for (const orientation of ["portrait", "landscape"]) {
      const prefix = "instrument." + artwork + "." + orientation;
      const source = config?.[artwork]?.[orientation];
      result[artwork][orientation] = {
        frame: {
          centerX: requireNumber(source?.frame?.centerX, 0, 1, prefix + ".frame.centerX"),
          centerY: requireNumber(source?.frame?.centerY, 0, 1, prefix + ".frame.centerY"),
          scale: requireNumber(source?.frame?.scale, 0.2, 1, prefix + ".frame.scale")
        },
        compass: {
          centerX: requireNumber(source?.compass?.centerX, 0, 1, prefix + ".compass.centerX"),
          centerY: requireNumber(source?.compass?.centerY, 0, 1, prefix + ".compass.centerY"),
          diameter: requireNumber(source?.compass?.diameter, 0.01, 1, prefix + ".compass.diameter")
        }
      };
    }
  }
  return result;
}

export function parseAppSettings(config) {
  if (config?.version !== 1) throw new Error("Invalid settings version: expected version 1.");

  return {
    camera: {
      autoStart: requireBoolean(config.camera?.autoStart, "camera.autoStart")
    },
    display: {
      fullscreen: requireBoolean(config.display?.fullscreen, "display.fullscreen")
    },
    tracking: {
      maxTrack: requireInteger(config.tracking?.maxTrack, 1, 3, "tracking.maxTrack")
    },
    overlay: {
      opacity: requireNumber(config.overlay?.opacity, 0.1, 1, "overlay.opacity")
    },
    scanner: {
      enabled: requireBoolean(config.scanner?.enabled, "scanner.enabled")
    },
    instrument: parseRelativeInstrument(config.instrument),
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

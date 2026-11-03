const MAX_TARGETS = 12;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ASSET_PATTERN = /^\.\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function requireAssetPath(value, label, extensions) {
  if (typeof value !== "string" || !ASSET_PATTERN.test(value)) {
    throw new Error(label + " must be a file in ./assets/.");
  }
  if (!extensions.some(extension => value.toLowerCase().endsWith(extension))) {
    throw new Error(label + " has an unsupported extension.");
  }
  return value;
}

function requireRevision(value, label) {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) {
    throw new Error(label + " must be a version string containing letters, numbers, dots, dashes or underscores.");
  }
  return value;
}

export function parseTargetConfig(config) {
  if (config?.version !== 1 || !Array.isArray(config.targets)) {
    throw new Error("Invalid target configuration. Expected version 1 and a targets array.");
  }
  if (config.targets.length === 0 || config.targets.length > MAX_TARGETS) {
    throw new Error("Target configuration must contain between 1 and " + MAX_TARGETS + " pictures.");
  }

  const seen = new Set();
  return config.targets.map((entry, index) => {
    if (!entry || typeof entry !== "object" || !ID_PATTERN.test(entry.id || "")) {
      throw new Error("Invalid ID for target " + (index + 1) + ".");
    }
    if (seen.has(entry.id)) throw new Error("Duplicate target ID: " + entry.id);
    seen.add(entry.id);
    if (typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 80) {
      throw new Error("Invalid display name for target " + entry.id + ".");
    }

    return {
      id: entry.id,
      name: entry.name.trim(),
      referenceImage: requireAssetPath(entry.referenceImage, "Reference image for " + entry.id, [".jpg", ".jpeg", ".png", ".webp"]),
      overlayImage: requireAssetPath(entry.overlayImage, "Symbols PNG for " + entry.id, [".png"]),
      trackingRevision: requireRevision(entry.trackingRevision, "Tracking revision for " + entry.id),
      overlayRevision: requireRevision(entry.overlayRevision, "Overlay revision for " + entry.id)
    };
  });
}

function versionedAsset(path, revision) {
  return path + "?v=" + encodeURIComponent(revision);
}

async function readImageDimensions(path) {
  const image = new Image();
  image.decoding = "async";
  image.src = path;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("Cannot decode image " + path);
  }
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export async function loadTargets(fetcher = fetch, imageDimensions = readImageDimensions) {
  const response = await fetcher("./config/targets.json", { cache: "no-store" });
  if (!response.ok) throw new Error("AR target configuration could not be loaded (HTTP " + response.status + ").");
  const targets = parseTargetConfig(await response.json());

  return Promise.all(targets.map(async target => {
    const referenceImage = versionedAsset(target.referenceImage, target.trackingRevision);
    const overlayImage = versionedAsset(target.overlayImage, target.overlayRevision);
    const [reference, overlay] = await Promise.all([
      imageDimensions(referenceImage),
      imageDimensions(overlayImage)
    ]);

    const ratio = reference.height / reference.width;
    const overlayRatio = overlay.height / overlay.width;
    if (!Number.isFinite(ratio) || !Number.isFinite(overlayRatio) || !ratio || !overlayRatio) {
      throw new Error("Invalid dimensions for " + target.name + ".");
    }
    if (Math.abs(ratio - overlayRatio) / ratio > 0.015) {
      throw new Error("The reference and overlay aspect ratios differ for " + target.name + ".");
    }

    return {
      id: target.id,
      name: target.name,
      referenceImage,
      overlayImage,
      aspectRatio: ratio,
      trackingRevision: target.trackingRevision,
      revision: target.trackingRevision
    };
  }));
}

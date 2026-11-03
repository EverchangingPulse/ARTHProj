import { projectTargets } from "./target-manifest.js";

const MAX_CUSTOM_TARGETS = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TRACKING_SIZE = 1024;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("This browser does not support local image storage."));
      return;
    }
    const request = indexedDB.open("arthproj-image-pairs", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("pairs")) request.result.createObjectStore("pairs", { keyPath: "id" });
      if (!request.result.objectStoreNames.contains("overrides")) request.result.createObjectStore("overrides", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local storage unavailable."));
  });
}

async function transact(storeName, mode, operation) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = operation(tx.objectStore(storeName));
      if (request) request.onsuccess = () => resolve(request.result);
      else tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Local storage error."));
      tx.onabort = () => reject(tx.error || new Error("Storage operation cancelled."));
      if (request) request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

function validateFile(file, accepted, label) {
  if (!(file instanceof Blob) || !accepted.includes(file.type)) {
    throw new Error(label + " has an unsupported format.");
  }
  if (!file.size || file.size > MAX_FILE_BYTES) {
    throw new Error(label + " must be smaller than 8 MB.");
  }
}

async function decodeImage(blob, minDimension = 1) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth < minDimension || image.naturalHeight < minDimension) {
      throw new Error("Reference picture must be at least 160 pixels in each dimension.");
    }
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function imageToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not process image.")), "image/png");
  });
}

function drawCanvas(image, width, height, contain) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas processing is unavailable.");
  if (contain) {
    const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * ratio;
    const drawHeight = image.naturalHeight * ratio;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    context.drawImage(image, 0, 0, width, height);
  }
  return canvas;
}

export class TargetLibrary {
  constructor() {
    this.objectUrls = [];
    this.urlCache = new Map();
  }

  objectUrl(key, blob) {
    if (this.urlCache.has(key)) return this.urlCache.get(key);
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    this.urlCache.set(key, url);
    return url;
  }

  async list() {
    const [custom, overrides] = await Promise.all([
      transact("pairs", "readonly", store => store.getAll()),
      transact("overrides", "readonly", store => store.getAll())
    ]);
    const byId = new Map(overrides.map(item => [item.id, item]));
    const sharedTargets = projectTargets.map(target => {
      const customOverlay = byId.get(target.id);
      if (!customOverlay) return target;
      return {
        ...target,
        overlayImage: this.objectUrl(target.id + ":override:" + customOverlay.revision, customOverlay.overlayBlob),
        trackingRevision: target.revision,
        revision: target.revision + ":" + customOverlay.revision,
        overlayCustomized: true
      };
    });
    const localTargets = custom.sort((a, b) => a.createdAt - b.createdAt).map(record => ({
      id: record.id,
      name: record.name,
      referenceImage: this.objectUrl(record.id + ":reference", record.referenceBlob),
      overlayImage: this.objectUrl(record.id + ":overlay:" + (record.revision || record.id), record.overlayBlob),
      aspectRatio: record.aspectRatio,
      revision: record.revision || record.id,
      trackingRevision: record.id,
      local: true
    }));
    return [...sharedTargets, ...localTargets];
  }

  async add(name, referenceFile, overlayFile) {
    const trimmedName = name?.trim().slice(0, 64);
    if (!trimmedName) throw new Error("Enter a name for this picture.");
    validateFile(referenceFile, ["image/png", "image/jpeg", "image/webp"], "Reference picture");
    validateFile(overlayFile, ["image/png"], "Symbols overlay");
    const count = await transact("pairs", "readonly", store => store.count());
    if (count >= MAX_CUSTOM_TARGETS) throw new Error("Maximum of five custom pictures per device.");

    const reference = await decodeImage(referenceFile, 160);
    const overlay = await decodeImage(overlayFile);
    const ratio = Math.min(1, MAX_TRACKING_SIZE / Math.max(reference.naturalWidth, reference.naturalHeight));
    const width = Math.max(1, Math.round(reference.naturalWidth * ratio));
    const height = Math.max(1, Math.round(reference.naturalHeight * ratio));
    const referenceBlob = await imageToBlob(drawCanvas(reference, width, height, false));
    const overlayBlob = await imageToBlob(drawCanvas(overlay, width, height, true));
    const id = crypto.randomUUID();

    await transact("pairs", "readwrite", store => store.put({
      id,
      name: trimmedName,
      referenceBlob,
      overlayBlob,
      aspectRatio: height / width,
      createdAt: Date.now(),
      revision: id
    }));
    return id;
  }

  async remove(id) {
    if (!id || projectTargets.some(item => item.id === id)) throw new Error("Built-in targets cannot be removed.");
    await transact("pairs", "readwrite", store => store.delete(id));
  }

  async replaceOverlay(id, png) {
    validateFile(png, ["image/png"], "Symbols overlay");
    const builtIn = projectTargets.find(target => target.id === id);
    const stored = builtIn ? null : await transact("pairs", "readonly", store => store.get(id));
    if (!builtIn && !stored) throw new Error("Reference picture no longer exists.");

    const referenceSource = builtIn ? builtIn.referenceImage : URL.createObjectURL(stored.referenceBlob);
    let reference;
    try {
      reference = new Image();
      reference.src = referenceSource;
      await reference.decode();
    } finally {
      if (!builtIn) URL.revokeObjectURL(referenceSource);
    }

    const overlay = await decodeImage(png);
    const overlayBlob = await imageToBlob(drawCanvas(overlay, reference.naturalWidth, reference.naturalHeight, true));
    const revision = crypto.randomUUID();
    if (builtIn) {
      await transact("overrides", "readwrite", store => store.put({ id, overlayBlob, revision }));
    } else {
      await transact("pairs", "readwrite", store => store.put({ ...stored, overlayBlob, revision }));
    }
  }

  async restoreDefaultOverlay(id) {
    if (!projectTargets.some(target => target.id === id)) throw new Error("This picture has no built-in overlay.");
    await transact("overrides", "readwrite", store => store.delete(id));
  }

  releaseUrls() {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls = [];
    this.urlCache.clear();
  }
}

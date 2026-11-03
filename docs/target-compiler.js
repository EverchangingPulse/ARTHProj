import { arSettings } from "./ar-settings.js";

class ImageTargetCache {
  constructor(databaseName = "ar-lens-targets") {
    this.databaseName = databaseName;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("targets");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    const database = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction("targets", "readonly");
        const request = transaction.objectStore("targets").get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }

  async set(key, blob) {
    const database = await this.open();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("targets", "readwrite");
        transaction.objectStore("targets").put(blob, key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }
}

async function loadImage(url) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return image;
}

export class TargetCompiler {
  constructor(cache = new ImageTargetCache()) {
    this.cache = cache;
    this.pending = null;
    this.objectUrl = null;
  }

  async prepare(onProgress = () => {}) {
    if (this.objectUrl) return this.objectUrl;
    if (!this.pending) {
      this.pending = this.prepareTarget(onProgress).catch(error => {
        this.pending = null;
        throw error;
      });
    }
    return this.pending;
  }

  async prepareTarget(onProgress) {
    try {
      const result = await fetch(arSettings.compiledTargetFile, { method: "HEAD" });
      if (result.ok) {
        onProgress("Using the precompiled inscription target…");
        return arSettings.compiledTargetFile;
      }
    } catch {
      onProgress("Checking local image-target cache…");
    }

    let blob = null;
    try {
      blob = await this.cache.get(arSettings.targetCacheKey);
    } catch {
      blob = null;
    }

    if (!blob) {
      onProgress("Loading image-target compiler…");
      const Compiler = globalThis.MINDAR?.IMAGE?.Compiler ?? globalThis.MINDAR?.Compiler;
      if (!Compiler) {
        throw new Error("MindAR target compiler did not load. Reload the page or deploy a precompiled targets.mind file.");
      }

      onProgress("Preparing inscription tracking image…");
      const image = await loadImage(arSettings.trackingImage);
      const compiler = new Compiler();
      await compiler.compileImageTargets([image], percentage => {
        onProgress(`Extracting image features: ${Math.round(percentage)}%`);
      });
      const data = await compiler.exportData();
      blob = new Blob([data], { type: "application/octet-stream" });
      if (!blob.size) throw new Error("Image target compilation produced an empty result.");
      try {
        await this.cache.set(arSettings.targetCacheKey, blob);
      } catch {
        onProgress("Target compiled. Browser caching is unavailable.");
      }
    } else {
      onProgress("Using the previously compiled inscription target…");
    }

    this.objectUrl = URL.createObjectURL(blob);
    return this.objectUrl;
  }
}

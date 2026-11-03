import { arSettings } from "./ar-settings.js";

class ImageTargetCache {
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("ar-lens-targets", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("targets");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction("targets", "readonly").objectStore("targets").get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  async set(key, blob) {
    const db = await this.open();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("targets", "readwrite");
        transaction.objectStore("targets").put(blob, key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }
}

async function loadImage(source) {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

export class TargetCompiler {
  constructor(cache = new ImageTargetCache()) {
    this.cache = cache;
    this.pending = null;
    this.activeKey = null;
    this.objectUrl = null;
  }

  async prepare(targets, onProgress = () => {}) {
    if (!targets.length) throw new Error("At least one reference picture is required.");
    const key = "arthproj-multi-v1:" + targets.map(target => target.id + ":" + (target.trackingRevision || target.revision)).join("|");
    if (this.objectUrl && this.activeKey === key) return this.objectUrl;
    if (this.pending?.key === key) return this.pending.promise;

    const promise = this.compile(targets, key, onProgress);
    this.pending = { key, promise };
    try {
      return await promise;
    } finally {
      if (this.pending?.promise === promise) this.pending = null;
    }
  }

  async compile(targets, key, onProgress) {
    if (targets.length === 1 && targets[0].id === "roman-inscription") {
      try {
        const response = await fetch(arSettings.compiledTargetFile, { method: "HEAD", cache: "no-cache" });
        if (response.ok && !response.headers.get("content-type")?.includes("text/html")) {
          onProgress("Using compiled Roman inscription target…");
          return this.swapUrl(arSettings.compiledTargetFile, key);
        }
      } catch {
        onProgress("Checking local tracking cache…");
      }
    }

    let blob;
    try {
      blob = await this.cache.get(key);
    } catch {
      blob = null;
    }

    if (!blob) {
      const Compiler = globalThis.MINDAR?.IMAGE?.Compiler ?? globalThis.MINDAR?.Compiler;
      if (!Compiler) throw new Error("MindAR compiler unavailable. Check your connection or try Chrome.");
      onProgress("Preparing " + targets.length + " recognition picture(s)…");
      const images = await Promise.all(targets.map(target => loadImage(target.referenceImage)));
      const compiler = new Compiler();
      await compiler.compileImageTargets(images, percent => {
        onProgress("Building recognition targets: " + Math.round(percent) + "%");
      });
      const data = await compiler.exportData();
      blob = new Blob([data], { type: "application/octet-stream" });
      if (!blob.size) throw new Error("Recognition target data is empty.");
      try {
        await this.cache.set(key, blob);
      } catch {
        onProgress("Tracking ready (persistent cache unavailable).");
      }
    } else {
      onProgress("Restoring previously compiled recognition targets…");
    }

    return this.swapUrl(URL.createObjectURL(blob), key);
  }

  swapUrl(url, key) {
    if (this.objectUrl?.startsWith("blob:")) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = url;
    this.activeKey = key;
    return url;
  }

  dispose() {
    if (this.objectUrl?.startsWith("blob:")) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.activeKey = null;
  }
}

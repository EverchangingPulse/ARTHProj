const LENS_WIDTH = 176;
const LENS_HEIGHT = 178;
const OPTICAL_STRENGTH = 0.13;
const FRAME_INTERVAL_MS = 50;

class LiveAmberLens {
  constructor(stage, canvas) {
    this.stage = stage;
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    this.source = document.createElement("canvas");
    this.source.width = LENS_WIDTH;
    this.source.height = LENS_HEIGHT;
    this.sourceContext = this.source.getContext("2d", { willReadFrequently: true });
    this.output = this.context.createImageData(LENS_WIDTH, LENS_HEIGHT);
    this.sampleMap = this.createSampleMap();
    this.lastFrame = 0;
    this.hasFrame = false;
    this.handle = null;
    this.canvas.width = LENS_WIDTH;
    this.canvas.height = LENS_HEIGHT;
  }

  createSampleMap() {
    const result = new Int32Array(LENS_WIDTH * LENS_HEIGHT);
    const centerX = LENS_WIDTH / 2;
    const centerY = LENS_HEIGHT / 2;
    for (let y = 0; y < LENS_HEIGHT; y++) {
      for (let x = 0; x < LENS_WIDTH; x++) {
        const nx = (x + 0.5 - centerX) / centerX;
        const ny = (y + 0.5 - centerY) / centerY;
        const radiusSquared = nx * nx + ny * ny;
        const index = y * LENS_WIDTH + x;
        if (radiusSquared >= 1) {
          result[index] = -1;
          continue;
        }
        const scale = 1 - OPTICAL_STRENGTH * (1 - radiusSquared);
        const sampleX = Math.max(0, Math.min(LENS_WIDTH - 1, Math.round(centerX + (x - centerX) * scale)));
        const sampleY = Math.max(0, Math.min(LENS_HEIGHT - 1, Math.round(centerY + (y - centerY) * scale)));
        result[index] = (sampleY * LENS_WIDTH + sampleX) * 4;
      }
    }
    return result;
  }

  cameraVideo() {
    const scene = document.getElementById("ar-scene");
    const trackedVideo = scene?.systems?.["mindar-image-system"]?.video;
    if (trackedVideo?.readyState >= 2 && trackedVideo.videoWidth) return trackedVideo;
    const preview = document.getElementById("permission-preview");
    if (preview && !preview.hidden && preview.readyState >= 2 && preview.videoWidth) return preview;
    return null;
  }

  isVisible() {
    const hud = document.getElementById("scanner-hud");
    const frame = document.getElementById("instrument-frame");
    return this.stage.dataset.instrumentMode === "portrait"
      && this.stage.dataset.frameportrait !== "illustrated"
      && !document.hidden
      && !hud.hidden
      && !frame.hidden;
  }

  clear() {
    if (!this.hasFrame) return;
    this.context.clearRect(0, 0, LENS_WIDTH, LENS_HEIGHT);
    this.hasFrame = false;
  }

  render(video) {
    const lensRect = this.canvas.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    if (!lensRect.width || !lensRect.height || !videoRect.width || !videoRect.height) return;

    const sourceX = (lensRect.left - videoRect.left) * video.videoWidth / videoRect.width;
    const sourceY = (lensRect.top - videoRect.top) * video.videoHeight / videoRect.height;
    const sourceWidth = lensRect.width * video.videoWidth / videoRect.width;
    const sourceHeight = lensRect.height * video.videoHeight / videoRect.height;

    this.sourceContext.clearRect(0, 0, LENS_WIDTH, LENS_HEIGHT);
    this.sourceContext.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, LENS_WIDTH, LENS_HEIGHT);
    const sourcePixels = this.sourceContext.getImageData(0, 0, LENS_WIDTH, LENS_HEIGHT).data;
    const targetPixels = this.output.data;

    for (let pixel = 0; pixel < this.sampleMap.length; pixel++) {
      const sourceIndex = this.sampleMap[pixel];
      const targetIndex = pixel * 4;
      if (sourceIndex === -1) {
        targetPixels[targetIndex + 3] = 0;
        continue;
      }
      targetPixels[targetIndex] = sourcePixels[sourceIndex];
      targetPixels[targetIndex + 1] = sourcePixels[sourceIndex + 1];
      targetPixels[targetIndex + 2] = sourcePixels[sourceIndex + 2];
      targetPixels[targetIndex + 3] = 255;
    }

    this.context.putImageData(this.output, 0, 0);
    this.hasFrame = true;
  }

  update = timestamp => {
    this.handle = requestAnimationFrame(this.update);
    const video = this.isVisible() ? this.cameraVideo() : null;
    if (!video) {
      this.clear();
      return;
    }
    if (timestamp - this.lastFrame < FRAME_INTERVAL_MS) return;
    this.lastFrame = timestamp;
    try {
      this.render(video);
    } catch {
      this.clear();
    }
  };

  start() {
    if (this.handle !== null) return;
    this.handle = requestAnimationFrame(this.update);
  }

  stop() {
    if (this.handle !== null) cancelAnimationFrame(this.handle);
    this.handle = null;
    this.clear();
  }
}

const stage = document.getElementById("camera-stage");
const canvas = document.getElementById("amber-lens-camera");
if (stage && canvas) {
  const lens = new LiveAmberLens(stage, canvas);
  lens.start();
  window.addEventListener("pagehide", () => lens.stop(), { once: true });
}

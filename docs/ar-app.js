import { loadAppSettings } from "./app-config.js?v=11.0.0";
import { NorthCompass } from "./north-compass.js?v=7.1.0";
import { loadTargets } from "./target-manifest.js?v=3.0.0";
import { TargetCompiler } from "./target-compiler.js?v=3.0.0";
import { InstrumentLayout } from "./instrument-layout.js?v=11.0.0";
import { InstrumentArtwork } from "./instrument-artwork.js?v=7.0.0";
import { ImmersiveFullscreen } from "./immersive-fullscreen.js?v=6.0.0";

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

class StatusView {
  constructor() {
    this.status = document.getElementById("sr-status");
    this.scanner = document.getElementById("scanner-hud");
    this.polaroid = document.getElementById("polaroid");
    this.compass = document.getElementById("compass-panel");
    this.cameraFeedback = document.getElementById("camera-feedback");
    this.scannerEnabled = true;
  }

  update(message, state) {
    this.status.textContent = message;
    this.scanner.dataset.state = state;
    this.scanner.hidden = !this.scannerEnabled || ["frozen", "developing"].includes(state);
    this.compass.classList.toggle("compass-concealed", ["frozen", "developing"].includes(state));
    this.cameraFeedback.textContent = state === "error"
      ? message + " Tap the screen to retry. If Telegram blocks the camera, open the page in Chrome."
      : message;
    this.cameraFeedback.hidden = !["loading", "error"].includes(state);
    this.polaroid.hidden = state !== "frozen";
  }
}

class CameraPreview {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.requestId = 0;
  }

  async open() {
    const requestId = ++this.requestId;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "environment" }
    });
    if (requestId !== this.requestId) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    this.stream = stream;
    this.video.srcObject = this.stream;
    this.video.hidden = false;
    await this.video.play().catch(() => {});
  }

  close() {
    this.requestId++;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.video.hidden = true;
  }
}

class MechanicalShutter {
  constructor() {
    this.enabled = true;
    this.audio = null;
  }

  unlock() {
    if (!this.enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      this.audio ||= new Audio();
      if (this.audio.state === "suspended") {
        void this.audio.resume().catch(() => {});
      }
    } catch {
      this.audio = null;
    }
  }

  click() {
    if (!this.enabled) return;
    this.unlock();
    const context = this.audio;
    if (!context || context.state !== "running") return;
    const now = context.currentTime;
    const noise = (delay, length, intensity, pitch) => {
      const frames = Math.max(32, Math.floor(length * context.sampleRate));
      const buffer = context.createBuffer(1, frames, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        const envelope = Math.pow(1 - i / frames, 2.4);
        samples[i] = (Math.random() * 2 - 1) * envelope;
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = pitch;
      filter.Q.value = 0.55;
      gain.gain.value = intensity;
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(now + delay);
      source.stop(now + delay + length);
    };
    noise(0, 0.035, 0.18, 1400);
    noise(0.052, 0.055, 0.22, 650);
    noise(0.115, 0.08, 0.09, 900);
  }
}

class ArExperience {
  constructor(compiler = new TargetCompiler()) {
    this.compiler = compiler;
    this.view = new StatusView();
    this.scene = document.getElementById("ar-scene");
    this.stage = document.getElementById("camera-stage");
    this.preview = new CameraPreview(document.getElementById("permission-preview"));
    this.snapshot = document.getElementById("frozen-canvas");
    this.flash = document.getElementById("capture-flash");
    this.saveButton = document.getElementById("save-btn");
    this.sound = new MechanicalShutter();
    this.anchors = [];
    this.targets = [];
    this.running = false;
    this.starting = false;
    this.frozen = false;
    this.capturedTargetName = null;
    this.generation = 0;
    this.freezeTimer = null;
    this.activeAnchor = null;
    this.opacity = 1;
    this.autoFreeze = true;
    this.freezeDelayMs = 700;

    this.scene.addEventListener("arReady", () => this.onReady());
    this.scene.addEventListener("arError", () => this.onError());
  }

  async start(preloadedSettings = null) {
    if (this.starting || this.running) return;
    this.stopTracking();
    this.starting = true;
    const generation = ++this.generation;
    this.frozen = false;
    this.capturedTargetName = null;
    this.activeAnchor = null;
    this.flash.hidden = true;
    this.view.update("Requesting camera permission…", "loading");

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.starting = false;
      this.view.update("Camera requires HTTPS and a compatible browser.", "error");
      return;
    }

    try {
      const [settings, targets] = await Promise.all([
        preloadedSettings ? Promise.resolve(preloadedSettings) : loadAppSettings(),
        loadTargets()
      ]);
      if (generation !== this.generation) return;

      this.opacity = settings.overlay.opacity;
      this.autoFreeze = settings.capture.autoFreeze;
      this.freezeDelayMs = settings.capture.freezeDelayMs;
      this.sound.enabled = settings.capture.shutterSound;
      this.view.scannerEnabled = settings.scanner.enabled;
      this.targets = targets;
      await this.waitForScene();
      this.scene.renderer?.setClearAlpha(0);
      await this.installAnchors();
      const targetUrl = await this.compiler.prepare(targets, message => {
        if (generation === this.generation) this.view.update(message, "loading");
      });
      if (generation !== this.generation) return;

      const system = this.scene.systems["mindar-image-system"];
      if (!system) throw new Error("MindAR image tracking is not available.");
      this.installResizeGuard(system);
      system.imageTargetSrc = targetUrl;
      system.maxTrack = settings.tracking.maxTrack;
      this.preview.close();
      this.running = true;
      this.starting = false;
      this.view.update("Opening AR camera…", "loading");
      system.start();
    } catch (error) {
      if (generation !== this.generation) return;
      this.preview.close();
      this.running = false;
      this.starting = false;
      const message = error?.name === "NotAllowedError"
        ? "Camera permission denied. Allow camera access and retry."
        : error?.message || "Unable to open the AR camera.";
      this.view.update(message, "error");
    }
  }

  async waitForScene() {
    if (!window.AFRAME) throw new Error("AR libraries did not load.");
    if (this.scene.hasLoaded) return;
    await new Promise(resolve => this.scene.addEventListener("loaded", resolve, { once: true }));
  }

  async installAnchors() {
    const system = this.scene.systems["mindar-image-system"];
    if (!system) throw new Error("MindAR system is missing.");
    for (const anchor of this.anchors) anchor.entity.remove();
    system.anchorEntities.length = 0;
    this.anchors = [];

    this.targets.forEach((target, index) => {
      const entity = document.createElement("a-entity");
      entity.classList.add("tracked-anchor");
      entity.setAttribute("mindar-image-target", "targetIndex: " + index);
      const plane = document.createElement("a-plane");
      plane.setAttribute("position", "0 0 0.008");
      plane.setAttribute("width", "1");
      plane.setAttribute("height", target.aspectRatio);
      plane.setAttribute("material", "shader: flat; transparent: true; depthWrite: false; side: double; opacity: " + this.opacity);
      plane.setAttribute("material", "src", target.overlayImage);
      entity.appendChild(plane);
      this.scene.appendChild(entity);
      const anchor = { target, entity, plane };
      entity.addEventListener("targetFound", () => this.onTargetFound(anchor));
      entity.addEventListener("targetLost", () => this.onTargetLost(anchor));
      this.anchors.push(anchor);
    });
    await nextFrame();
    await nextFrame();
  }

  onReady() {
    if (this.running) this.view.update("Searching " + this.targets.length + " reference picture(s)…", "searching");
  }

  onError() {
    if (!this.running) return;
    this.stop();
    this.view.update("Camera failed. Try again or open in Chrome.", "error");
  }

  onTargetFound(anchor) {
    if (!this.running || this.frozen) return;
    this.activeAnchor = anchor;
    this.view.update("Recognized: " + anchor.target.name, "found");
    this.cancelFreeze();
    if (this.autoFreeze) {
      this.freezeTimer = setTimeout(() => {
        if (this.running && this.activeAnchor === anchor && anchor.entity.object3D.visible) {
          void this.freeze();
        }
      }, this.freezeDelayMs);
    }
  }

  onTargetLost(anchor) {
    if (this.activeAnchor !== anchor || !this.running || this.frozen) return;
    this.activeAnchor = null;
    this.cancelFreeze();
    this.view.update("Picture lost. Keep it in view…", "searching");
  }

  cancelFreeze() {
    if (this.freezeTimer !== null) clearTimeout(this.freezeTimer);
    this.freezeTimer = null;
  }

  async freeze() {
    if (!this.running || !this.activeAnchor || this.frozen) return;
    const anchor = this.activeAnchor;
    this.cancelFreeze();
    this.view.scanner.hidden = true;
    await nextFrame();
    if (!this.running || this.activeAnchor !== anchor || !anchor.entity.object3D.visible) {
      if (this.running) this.view.update("Keep the inscription in view.", "searching");
      return;
    }

    try {
      this.composeSnapshot();
      this.capturedTargetName = anchor.target.name;
      this.frozen = true;
      this.sound.click();
      this.stopTracking();
      this.running = false;
      this.view.update("Developing photograph…", "developing");
      this.flash.hidden = true;
      void this.flash.offsetWidth;
      this.flash.hidden = false;
      const session = this.generation;
      await new Promise(resolve => setTimeout(resolve, 220));
      if (session !== this.generation) return;
      this.view.update("Captured: " + anchor.target.name + ". Scan again or save picture.", "frozen");
      setTimeout(() => {
        if (session === this.generation) this.flash.hidden = true;
      }, 330);
    } catch {
      this.view.update("Capture failed. Continue scanning or try again.", "found");
    }
  }

  composeSnapshot() {
    const system = this.scene.systems["mindar-image-system"];
    const video = system.video;
    const renderer = this.scene.renderer;
    if (!video || video.readyState < 2 || !renderer || !this.scene.camera) {
      throw new Error("Camera frame is not ready.");
    }

    const stage = this.stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(stage.width * ratio));
    const height = Math.max(1, Math.round(stage.height * ratio));
    this.snapshot.width = width;
    this.snapshot.height = height;
    const context = this.snapshot.getContext("2d", { alpha: false });
    context.fillStyle = "#0a1118";
    context.fillRect(0, 0, width, height);

    const videoRect = video.getBoundingClientRect();
    if (videoRect.width && videoRect.height) {
      context.drawImage(video, (videoRect.left - stage.left) * ratio, (videoRect.top - stage.top) * ratio, videoRect.width * ratio, videoRect.height * ratio);
    } else {
      const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
      const scaledWidth = video.videoWidth * scale;
      const scaledHeight = video.videoHeight * scale;
      context.drawImage(video, (width - scaledWidth) / 2, (height - scaledHeight) / 2, scaledWidth, scaledHeight);
    }

    renderer.render(this.scene.object3D, this.scene.camera);
    const overlayCanvas = renderer.domElement;
    const overlayRect = overlayCanvas.getBoundingClientRect();
    context.drawImage(overlayCanvas, (overlayRect.left - stage.left) * ratio, (overlayRect.top - stage.top) * ratio, overlayRect.width * ratio, overlayRect.height * ratio);
  }

  savePicture() {
    if (!this.frozen || this.saveButton.disabled) return;
    this.saveButton.disabled = true;
    try {
      const image = this.snapshot.toDataURL("image/png");
      const name = (this.capturedTargetName || "inscription")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const link = document.createElement("a");
      link.href = image;
      link.download = "speculum-arcana-" + (name || "image") + ".png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      this.view.status.textContent = "Photograph prepared for download.";
    } catch {
      this.view.status.textContent = "Unable to save this photograph in the current browser.";
    } finally {
      this.saveButton.disabled = false;
    }
  }

  setOpacity(value) {
    this.opacity = value;
    for (const anchor of this.anchors) anchor.plane.setAttribute("material", "opacity", value);
  }

  installResizeGuard(system) {
    if (system.arthResizeGuarded) return;
    const resize = system._resize;
    system._resize = function () {
      if (!this.video || !this.controller) return;
      return resize.call(this);
    };
    system.arthResizeGuarded = true;
  }

  stopTracking() {
    const system = this.scene.systems?.["mindar-image-system"];
    if (!system) return;
    const video = system.video;
    if (!video) return;
    try {
      if (system.controller && video.srcObject) {
        system.stop();
      } else {
        video.srcObject?.getTracks().forEach(track => track.stop());
        video.remove();
      }
    } catch {
      video.srcObject?.getTracks().forEach(track => track.stop());
      video.remove();
    } finally {
      system.video = null;
      system.controller = null;
    }
  }

  stop() {
    this.generation++;
    this.cancelFreeze();
    this.preview.close();
    this.stopTracking();
    this.running = false;
    this.starting = false;
    this.activeAnchor = null;
    this.frozen = false;
    this.flash.hidden = true;
    this.view.update("Camera stopped.", "stopped");
  }
}

function initialize() {
  const app = new ArExperience();
  const compass = new NorthCompass(document.getElementById("compass-panel"));
  const stage = document.getElementById("camera-stage");
  const fullscreen = new ImmersiveFullscreen(stage);
  const layout = new InstrumentLayout(stage, {
    onResize: () => {
      const system = app.scene.systems?.["mindar-image-system"];
      if (app.running && system?.video && system?.controller) system._resize?.();
    }
  });
  layout.start();
  const artwork = new InstrumentArtwork(stage, () => layout.schedule());
  artwork.initialize();

  stage.addEventListener("pointerdown", event => {
    if (event.target.closest("#save-btn")) return;
    app.sound.unlock();
    void compass.askPermission();
    fullscreen.requestFromGesture();
  });

  document.getElementById("save-btn").addEventListener("click", event => {
    event.stopPropagation();
    app.savePicture();
  });

  stage.addEventListener("pointerup", event => {
    if (event.target.closest("#save-btn")) return;
    if (app.frozen || (!app.starting && !app.running)) {
      void app.start();
      return;
    }
    if (app.running && app.activeAnchor && !app.autoFreeze) {
      void app.freeze();
    }
  });

  window.addEventListener("pagehide", () => {
    app.stop();
    compass.stop();
    layout.stop();
    app.compiler.dispose();
  });

  void loadAppSettings().then(settings => {
    layout.configure(settings.instrument);
    fullscreen.onLaunch(settings.display.fullscreen);
    compass.start(settings.compass);
    if (settings.compass.preferTrueNorth && settings.compass.requestLocation) {
      compass.requestLocation();
    }
    if (settings.camera.autoStart) return app.start(settings);
    app.view.update("Camera ready; touch the instrument to begin.", "stopped");
  }).catch(error => {
    app.view.update(error?.message || "Cannot load the instrument.", "error");
  });
}

initialize();

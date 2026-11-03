import { arSettings } from "./ar-settings.js";
import { projectTargets } from "./target-manifest.js";
import { TargetLibrary } from "./target-library.js";
import { TargetCompiler } from "./target-compiler.js";

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

class StatusView {
  constructor() {
    this.status = document.getElementById("status-text");
    this.indicator = document.getElementById("status-indicator");
    this.label = document.getElementById("tracking-label");
    this.pill = document.getElementById("tracking-pill");
    this.placeholder = document.getElementById("camera-placeholder");
    this.retry = document.getElementById("retry-btn");
    this.scan = document.getElementById("scan-btn");
    this.capture = document.getElementById("capture-btn");
    this.save = document.getElementById("save-btn");
    this.stop = document.getElementById("stop-btn");
    this.scanner = document.getElementById("scanner-hud");
    this.polaroid = document.getElementById("polaroid");
  }

  update(message, state) {
    this.status.textContent = message;
    this.indicator.dataset.state = state;
    this.pill.dataset.state = state;
    this.label.textContent = {
      loading: "STARTING",
      searching: "SCANNING",
      found: "LOCKED",
      frozen: "FROZEN",
      stopped: "OFF",
      error: "ERROR"
    }[state] || "READY";
    this.placeholder.hidden = ["searching", "found", "frozen"].includes(state);
    this.retry.hidden = !["error", "stopped"].includes(state);
    this.scan.hidden = state !== "frozen";
    this.save.hidden = state !== "frozen";
    this.capture.disabled = state !== "found";
    this.stop.disabled = !["searching", "found"].includes(state);
    this.scanner.hidden = !["searching", "found"].includes(state);
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
  constructor(library = new TargetLibrary(), compiler = new TargetCompiler()) {
    this.library = library;
    this.compiler = compiler;
    this.view = new StatusView();
    this.scene = document.getElementById("ar-scene");
    this.stage = document.getElementById("camera-stage");
    this.preview = new CameraPreview(document.getElementById("permission-preview"));
    this.snapshot = document.getElementById("frozen-canvas");
    this.flash = document.getElementById("capture-flash");
    this.polaroidTitle = document.getElementById("polaroid-title");
    this.sound = new MechanicalShutter();
    this.anchors = [];
    this.targets = [];
    this.running = false;
    this.starting = false;
    this.frozen = false;
    this.generation = 0;
    this.freezeTimer = null;
    this.activeAnchor = null;
    this.opacity = arSettings.initialOpacity;
    this.autoFreeze = arSettings.autoFreeze;

    this.scene.addEventListener("arReady", () => this.onReady());
    this.scene.addEventListener("arError", () => this.onError());
  }

  async start() {
    if (this.starting || this.running) return;
    this.stopTracking();
    this.starting = true;
    const generation = ++this.generation;
    this.frozen = false;
    this.activeAnchor = null;
    this.flash.hidden = true;
    this.view.update("Requesting camera permission…", "loading");

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.starting = false;
      this.view.update("Camera requires HTTPS and a compatible browser.", "error");
      return;
    }

    try {
      const cameraPermission = this.preview.open();
      const targetsPromise = this.library.list().catch(() => projectTargets);
      const [, targets] = await Promise.all([cameraPermission, targetsPromise]);
      if (generation !== this.generation) return;

      this.targets = targets;
      await this.waitForScene();
      await this.installAnchors();
      const targetUrl = await this.compiler.prepare(targets, message => {
        if (generation === this.generation) this.view.update(message, "loading");
      });
      if (generation !== this.generation) return;

      const system = this.scene.systems["mindar-image-system"];
      if (!system) throw new Error("MindAR image tracking is not available.");
      this.installResizeGuard(system);
      system.imageTargetSrc = targetUrl;
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
      }, arSettings.freezeDelayMs);
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
    if (!this.running || this.activeAnchor !== anchor || !anchor.entity.object3D.visible) return;

    try {
      this.composeSnapshot();
      this.frozen = true;
      this.polaroidTitle.textContent = anchor.target.name;
      this.sound.click();
      this.stopTracking();
      this.view.update("Developing photograph…", "loading");
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
    if (!this.frozen) return;
    const canvas = document.createElement("canvas");
    const photograph = this.snapshot;
    const margin = Math.round(photograph.width * 0.055);
    const captionHeight = Math.round(photograph.width * 0.17);
    canvas.width = photograph.width + margin * 2;
    canvas.height = photograph.height + margin + captionHeight;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f1efe7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(photograph, margin, margin);
    ctx.fillStyle = "#333b40";
    ctx.font = Math.max(16, Math.round(canvas.width * .028)) + "px Georgia, serif";
    ctx.fillText(this.polaroidTitle.textContent.slice(0, 48), margin + 9, canvas.height - captionHeight * .36, canvas.width - 2 * margin - 18);
    const link = document.createElement("a");
    link.download = "arthproj-" + Date.now() + ".png";
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  setOpacity(value) {
    this.opacity = value;
    for (const anchor of this.anchors) anchor.plane.setAttribute("material", "opacity", value);
  }

  async refreshTargets() {
    if (this.starting) throw new Error("Camera is still starting. Try again shortly.");
    this.stop();
    await this.start();
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

class TargetEditor {
  constructor(app) {
    this.app = app;
    this.library = app.library;
    this.list = document.getElementById("targets-list");
    this.form = document.getElementById("pair-form");
    this.form.addEventListener("submit", event => void this.add(event));
  }

  async render() {
    let targets;
    try {
      targets = await this.library.list();
    } catch {
      this.list.textContent = "Local storage is unavailable. Built-in reference is still supported.";
      return;
    }
    this.list.replaceChildren();
    for (const target of targets) {
      const row = document.createElement("div");
      row.className = "target-row";
      const title = document.createElement("span");
      title.textContent = target.name + (target.local ? " (this device)" : " (included)");
      row.appendChild(title);

      const controls = document.createElement("div");
      controls.className = "target-controls";
      const label = document.createElement("label");
      label.textContent = "Change PNG";
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png";
      input.setAttribute("aria-label", "Replace PNG symbols overlay for " + target.name);
      input.addEventListener("change", () => {
        if (input.files?.[0]) void this.replaceOverlay(target.id, input.files[0]);
      });
      label.appendChild(input);
      controls.appendChild(label);

      if (target.overlayCustomized) {
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "text-button";
        reset.textContent = "Default PNG";
        reset.addEventListener("click", () => void this.restoreOverlay(target.id));
        controls.appendChild(reset);
      }

      if (target.local) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "text-button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => void this.remove(target.id));
        controls.appendChild(remove);
      }
      row.appendChild(controls);
      this.list.appendChild(row);
    }
  }

  async add(event) {
    event.preventDefault();
    const button = this.form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await this.library.add(
        document.getElementById("pair-name").value,
        document.getElementById("pair-reference").files?.[0],
        document.getElementById("pair-overlay").files?.[0]
      );
      this.form.reset();
      await this.app.refreshTargets();
      await this.render();
    } catch (error) {
      this.app.view.update(error?.message || "Could not add picture.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async replaceOverlay(id, file) {
    try {
      await this.library.replaceOverlay(id, file);
      await this.app.refreshTargets();
      await this.render();
    } catch (error) {
      this.app.view.update(error?.message || "Could not replace PNG.", "error");
    }
  }

  async restoreOverlay(id) {
    try {
      await this.library.restoreDefaultOverlay(id);
      await this.app.refreshTargets();
      await this.render();
    } catch (error) {
      this.app.view.update(error?.message || "Could not restore default PNG.", "error");
    }
  }

  async remove(id) {
    try {
      await this.library.remove(id);
      await this.app.refreshTargets();
      await this.render();
    } catch (error) {
      this.app.view.update(error?.message || "Could not remove picture.", "error");
    }
  }
}

class TelegramIntegration {
  constructor() {
    this.app = window.Telegram?.WebApp;
    this.app?.ready();
    this.app?.expand();
  }

  openExternal() {
    if (this.app?.openLink) this.app.openLink(location.href);
    else window.open(location.href, "_blank", "noopener,noreferrer");
  }
}

function initialize() {
  const app = new ArExperience();
  const editor = new TargetEditor(app);
  const telegram = new TelegramIntegration();
  const slider = document.getElementById("opacity-slider");
  const opacityOutput = document.getElementById("opacity-output");
  slider.value = String(Math.round(arSettings.initialOpacity * 100));
  opacityOutput.value = slider.value + "%";

  slider.addEventListener("input", () => {
    opacityOutput.value = slider.value + "%";
    app.setOpacity(Number(slider.value) / 100);
  });
  document.getElementById("auto-freeze").addEventListener("change", event => {
    app.autoFreeze = event.target.checked;
    if (!app.autoFreeze) app.cancelFreeze();
  });
  document.getElementById("shutter-sound").addEventListener("change", event => {
    app.sound.enabled = event.target.checked;
    if (app.sound.enabled) app.sound.unlock();
  });
  document.addEventListener("pointerdown", () => app.sound.unlock(), { once: true });
  document.getElementById("retry-btn").addEventListener("click", () => void app.start());
  document.getElementById("scan-btn").addEventListener("click", () => void app.start());
  document.getElementById("stop-btn").addEventListener("click", () => app.stop());
  document.getElementById("capture-btn").addEventListener("click", () => void app.freeze());
  document.getElementById("save-btn").addEventListener("click", () => app.savePicture());
  document.getElementById("external-btn").addEventListener("click", () => telegram.openExternal());
  window.addEventListener("pagehide", () => {
    app.stop();
    app.library.releaseUrls();
    app.compiler.dispose();
  });
  void editor.render();
  void app.start();
}

initialize();

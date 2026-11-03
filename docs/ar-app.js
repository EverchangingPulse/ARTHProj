import { arSettings } from "./ar-settings.js";
import { TargetCompiler } from "./target-compiler.js?v=1.1.1";

class StatusView {
  constructor() {
    this.status = document.getElementById("status-text");
    this.indicator = document.getElementById("status-indicator");
    this.label = document.getElementById("tracking-label");
    this.pill = document.getElementById("tracking-pill");
    this.placeholder = document.getElementById("camera-placeholder");
    this.startButton = document.getElementById("start-btn");
    this.stopButton = document.getElementById("stop-btn");
  }

  update(message, state) {
    this.status.textContent = message;
    this.indicator.dataset.state = state;
    this.pill.dataset.state = state;
    this.label.textContent = {
      ready: "READY",
      loading: "STARTING",
      searching: "SCANNING",
      found: "LOCKED",
      stopped: "OFF",
      error: "ERROR"
    }[state] || "READY";
  }

  setBusy(busy) {
    this.startButton.disabled = busy;
    this.stopButton.disabled = busy;
  }

  setActive(active) {
    this.placeholder.hidden = active;
    this.startButton.disabled = active;
    this.stopButton.disabled = !active;
  }
}

class ArExperience {
  constructor(scene, target, overlay, view, targetCompiler = new TargetCompiler()) {
    this.scene = scene;
    this.target = target;
    this.overlay = overlay;
    this.view = view;
    this.targetCompiler = targetCompiler;
    this.isRunning = false;
    this.isStarting = false;
    this.hasError = false;
    this.scene.addEventListener("arReady", () => this.onReady());
    this.scene.addEventListener("arError", () => this.onError());
    this.target.addEventListener("targetFound", () => this.onTargetFound());
    this.target.addEventListener("targetLost", () => this.onTargetLost());
  }

  async start() {
    if (this.isRunning || this.isStarting) return;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.view.update("Camera requires HTTPS and a compatible browser", "error");
      return;
    }

    this.isStarting = true;
    this.hasError = false;
    this.view.setBusy(true);
    this.view.update("Preparing image recognition…", "loading");

    try {
      await this.waitForScene();
      const system = this.scene.systems["mindar-image-system"];
      if (!system) throw new Error("Image tracking unavailable. Check the AR libraries.");

      const targetUrl = await this.targetCompiler.prepare(message => {
        this.view.update(message, "loading");
      });
      system.imageTargetSrc = targetUrl;
      this.isRunning = true;
      this.view.setActive(true);
      this.view.update("Opening camera. Grant permission when prompted…", "loading");
      system.start();
    } catch (error) {
      this.cleanupCamera();
      this.isRunning = false;
      this.view.setActive(false);
      this.view.update(error?.message || "Image tracking unavailable", "error");
    } finally {
      this.isStarting = false;
      if (!this.isRunning) this.view.setBusy(false);
    }
  }

  stop() {
    if (!this.isRunning) return;
    this.cleanupCamera();
    this.isRunning = false;
    this.view.setActive(false);
    this.view.update("Camera is off", "stopped");
  }

  cleanupCamera() {
    const system = this.scene.systems["mindar-image-system"];
    if (!system) return;
    if (system.controller && system.video?.srcObject) {
      try {
        system.stop();
        return;
      } catch {
        system.video.srcObject?.getTracks().forEach(track => track.stop());
      }
    }
    system.video?.srcObject?.getTracks().forEach(track => track.stop());
    system.video?.remove();
  }

  setOpacity(percent) {
    this.overlay.setAttribute("material", "opacity", percent / 100);
  }

  setOverlayImage(file) {
    if (!file?.type.startsWith("image/")) return;
    if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
    this.currentObjectUrl = URL.createObjectURL(file);
    this.overlay.setAttribute("material", "src", this.currentObjectUrl);
  }

  waitForScene() {
    return new Promise((resolve, reject) => {
      if (!window.AFRAME) {
        reject(new Error("AR libraries did not load. Check your internet connection."));
        return;
      }
      if (this.scene.hasLoaded) {
        resolve();
        return;
      }
      this.scene.addEventListener("loaded", resolve, { once: true });
    });
  }

  onReady() {
    if (!this.isRunning) {
      this.cleanupCamera();
      return;
    }
    this.view.update("Scanning for the Roman inscription…", "searching");
  }

  onError() {
    this.hasError = true;
    this.cleanupCamera();
    this.isRunning = false;
    this.view.setActive(false);
    this.view.update("Camera failed. Try opening in your browser.", "error");
  }

  onTargetFound() {
    if (this.isRunning) this.view.update("Inscription found — overlay anchored", "found");
  }

  onTargetLost() {
    if (this.isRunning) this.view.update("Inscription lost — keep the target in view", "searching");
  }
}

class TelegramIntegration {
  constructor() {
    this.webApp = window.Telegram?.WebApp;
    this.webApp?.ready();
    this.webApp?.expand();
  }

  openExternal() {
    const url = window.location.href;
    if (this.webApp?.openLink) {
      this.webApp.openLink(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
}

function initialize() {
  const view = new StatusView();
  const app = new ArExperience(
    document.getElementById("ar-scene"),
    document.getElementById("image-target"),
    document.getElementById("overlay-plane"),
    view
  );
  const telegram = new TelegramIntegration();
  const opacity = document.getElementById("opacity-slider");
  const opacityOutput = document.getElementById("opacity-output");

  document.getElementById("overlay-asset").src = arSettings.overlayImage;
  opacity.value = String(Math.round(arSettings.initialOpacity * 100));
  app.overlay.setAttribute("height", arSettings.targetAspectRatio);
  app.setOpacity(Number(opacity.value));
  opacityOutput.value = `${opacity.value}%`;

  document.getElementById("start-btn").addEventListener("click", () => app.start());
  document.getElementById("stop-btn").addEventListener("click", () => app.stop());
  opacity.addEventListener("input", () => {
    opacityOutput.value = `${opacity.value}%`;
    app.setOpacity(Number(opacity.value));
  });
  document.getElementById("overlay-upload").addEventListener("change", event => {
    app.setOverlayImage(event.target.files?.[0]);
  });
  document.getElementById("external-btn").addEventListener("click", () => telegram.openExternal());
  window.addEventListener("pagehide", () => app.stop());
}

initialize();

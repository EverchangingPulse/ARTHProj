export class ImmersiveFullscreen {
  constructor(stage, webApp = window.Telegram?.WebApp) {
    this.stage = stage;
    this.webApp = webApp;
  }

  onLaunch() {
    const app = this.webApp;
    try {
      app?.ready?.();
      app?.expand?.();
      app?.setHeaderColor?.("#17100e");
      app?.setBackgroundColor?.("#17100e");
      app?.unlockOrientation?.();
      app?.requestFullscreen?.();
    } catch {
      return false;
    }
    return true;
  }

  requestFromGesture() {
    const app = this.webApp;
    if (app?.isFullscreen) return;
    if (app?.requestFullscreen && app?.initData) {
      try {
        app.requestFullscreen();
        return;
      } catch {
        return;
      }
    }
    if (document.fullscreenElement || !document.fullscreenEnabled) return;
    try {
      const promise = this.stage.requestFullscreen?.({ navigationUI: "hide" });
      promise?.catch?.(() => {});
    } catch {
      return;
    }
  }
}

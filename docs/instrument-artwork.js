export class InstrumentArtwork {
  constructor(stage, onChange = () => {}) {
    this.stage = stage;
    this.onChange = onChange;
    this.images = {
      portrait: stage.querySelector("#portrait-instrument"),
      landscape: stage.querySelector("#landscape-instrument")
    };
  }

  initialize() {
    for (const [orientation, image] of Object.entries(this.images)) {
      image.addEventListener("load", () => {
        const isPhotographic = !image.dataset.fallback;
        this.stage.dataset["frame" + orientation] = isPhotographic ? "photographic" : "illustrated";
        this.onChange();
      });
      image.addEventListener("error", () => {
        if (image.dataset.fallback) return;
        image.dataset.fallback = "true";
        this.stage.dataset["frame" + orientation] = "illustrated";
        image.src = orientation === "portrait"
          ? "./assets/astrolabe-portrait.svg"
          : "./assets/astrolabe-landscape.svg";
        this.onChange();
      });
      if (image.complete && image.naturalWidth) {
        this.stage.dataset["frame" + orientation] = "photographic";
      }
    }
    this.onChange();
  }
}

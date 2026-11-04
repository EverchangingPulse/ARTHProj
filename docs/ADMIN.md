# Managing ARTHProj reference pictures and settings

ARTHProj is a static GitHub Pages website. There is no public target upload form or administrator password on the website. **Repository write access is the administrator permission.** Changes to the configuration and assets are made in GitHub and published with the next Pages deployment.

## Add an image/PNG pair

1. Upload a JPG, PNG or WebP reference picture into `docs/assets/`.
2. Upload a transparent PNG of the symbols into `docs/assets/`.
3. Use a PNG with the **same aspect ratio** as its reference image. Symbols must be drawn in the corresponding relative positions. Transparent pixels allow the original picture to remain visible.
4. Edit [`docs/config/targets.json`](../docs/config/targets.json), adding a new entry to the `targets` array:

```json
{
  "id": "temple-marker",
  "name": "Temple marker",
  "referenceImage": "./assets/temple-marker.jpg",
  "overlayImage": "./assets/temple-symbols.png",
  "trackingRevision": "temple-v1",
  "overlayRevision": "symbols-v1"
}
```

5. Commit the changes on GitHub. The site will use these pairs after deployment. The order in `targets` controls the MindAR target indices; the overlay is associated with the matching entry.

The Roman inscription remains registered in the initial configuration as `roman-inscription`.

### Versioning

- Increment `trackingRevision` whenever a reference picture is changed. This forces a new MindAR target compilation and invalidates its previous cache.
- Increment `overlayRevision` whenever a PNG is changed. This refreshes the displayed overlay without unnecessarily recompiling the recognition image.
- Use a new unique `id` for each newly registered reference picture. Do not reorder or remove targets without accounting for the resulting combined target compilation.

Currently the config accepts 1–12 targets. The first load may require substantial processing time on a phone because MindAR prepares the multi-image target data on the client. Later visits can use its browser cache. Fewer detailed reference images generally perform better than many low-detail ones.

### Android GitHub workflow

From Chrome on Android, open your repository, navigate to `docs/assets/`, select **Add file → Upload files**, and upload both images. Edit `docs/config/targets.json` using GitHub's file editor and commit. Check **Actions → Test GitHub Pages AR frontend** before testing the site.

## Configure camera and capture behavior

Edit [`docs/config/settings.json`](../docs/config/settings.json). All parameters below are loaded from the JSON file, not changed by visitors:

| JSON setting | Purpose |
| --- | --- |
| `camera.autoStart` | Requests camera access automatically on page open when `true` |
| `tracking.maxTrack` | Maximum targets tracked simultaneously (1–3) |
| `overlay.opacity` | Transparency of AR symbol planes, 0.1–1.0 |
| `scanner.enabled` | Enables or hides the scanner decoration |
| `scanner.style` | `astrolabe` (bronze instrument with animated sextant arm) or `sonar` (legacy green radar) |
| `compass.enabled` | Show or hide the independent compass rose |
| `compass.preferTrueNorth` | Correct magnetic heading to true north when location is authorized |
| `compass.requestLocation` | Request location coordinates for local WMM2025 magnetic-declination calculation |
| `compass.headingSmoothing` | Compass smoothing, from 0.05 to 1 (smaller is steadier) |
| `capture.autoFreeze` | Enables automatic stationary capture after recognition |
| `capture.freezeDelayMs` | Time in milliseconds before capture (0–5000) |
| `capture.shutterSound` | Attempts to play synthesized mechanical shutter sound |

While scanning, the Renaissance astrolabe and glass compass remain visible continuously, including while recognition is locked. Once the still image is captured, both decorative pieces disappear; the Polaroid shows only the camera photograph and its per-target PNG symbols over the original writing. A single **Save image** button appears below the captured photograph and downloads that composited image as PNG, without the decorative scanner, compass, or Polaroid border. Tapping the still photograph anywhere outside the Save image button restarts scanning. If camera access fails, tapping the instrument retries. When automatic capture is disabled, tapping an already-recognized picture freezes the frame.

The sound setting cannot override Android/Telegram browser autoplay restrictions. Some browsers require a user interaction before audio playback. Camera permission is always controlled by the browser, even when `camera.autoStart` is `true`.

## Validation and deployment

The repository workflow checks configuration syntax, allowed paths and values, presence of image files, and camera/overlay application code. Images are not uploaded to any backend by the web page.

GitHub Pages should be configured to publish `main` → `/docs`. A commit triggers deployment automatically. This project uses no server-side GitHub Pages authentication; do not put secrets in either JSON file.

```sh
node --test tests/site.test.mjs
```

Live recognition, stability, and photo capture still need validation on a physical Android phone.

## Italian brigandine astrolabe and north compass

The scanner uses separate `docs/assets/astrolabe-portrait.svg` and `docs/assets/astrolabe-landscape.svg` compositions, both derived from the original `docs/assets/astrolabe-scanner.svg`. They use walnut beams, blue riveted brigandine sections, mechanical rails, latches, brass graduations, and animated sextant arms. The alternate legacy green sonar remains available through `scanner.style`.

The separate `docs/assets/wind-rose.svg` is rotated by `docs/north-compass.js`, using mobile absolute device-orientation events when available. The compass uses WMM2025 declination calculated locally from location coordinates to convert magnetic heading into true heading. The compass now has no visible text or numbers. Without location permission the rose follows magnetic heading, where available; without orientation data it remains stationary rather than displaying an invented heading. On platforms that require a gesture for orientation permission, the first tap anywhere on the instrument requests access.

Phone compass hardware can be affected by nearby metal and electromagnetic interference. This UI is for an AR experience, not safety-critical navigation. WMM2025 model code is adapted from Darren Yeates' MIT-licensed magvar project; see `docs/vendor/WMM2025-LICENSE.txt`.

## Full-screen immersive interface

The public scanning interface intentionally contains no text, buttons, links, or navigation to other pages. The captured-image view alone displays a Save image button. Its two independent image layouts are selected by the browser using `<picture>` and `(orientation: landscape)`. Both use transparent SVG artwork and `object-fit: contain` so the camera remains visible beneath the instrument. Android and Telegram browser chrome is external to the website and cannot be removed by site code.

The compass is visually enclosed in a riveted brass housing with a hinge, a latch, and a stationary simulated convex glass lens. Only the inner `wind-rose.svg` rotates. No direction text, degrees, or sensor status is displayed.

On successful image recognition, the scanner is hidden for capture and the static photograph appears with the letters or symbols composited onto the original writing. The ornate scanner and compass stay concealed while this result is displayed. The Save image button saves the composited PNG; touching elsewhere restarts scanning. Errors can be retried by touching the instrument; permission denials must still be changed in Android browser settings. Sound can be unavailable until a user interaction due to browser restrictions.

GitHub Pages is public static hosting. Removing links from the page does **not** make the project source, URL, or downloaded assets inaccessible to visitors. Access control would require a different hosting architecture.

## Fullscreen and integrated instrument frame

The portrait and landscape frames are complete chassis artwork, not independent overlays floating above the camera. Both use riveted blue brigandine, walnut, brass, gears, ornate medallions and a transparent central viewing aperture. The inset wind rose sits behind the frame at a coordinate calculated from the exact SVG viewBox and the viewport's `object-fit: cover` transform. The ring and rivets therefore remain in registration with the rotating rose in both orientations.

`docs/config/settings.json` has `display.fullscreen`, which controls fullscreen requests. When true, Telegram Mini Apps attempt `WebApp.requestFullscreen()` as the page opens. On ordinary browsers, the first tap attempts the browser Fullscreen API where supported. Browser chrome and permission prompts cannot be removed forcibly. Installed home-screen access can use `docs/manifest.webmanifest` with display mode `fullscreen`.

The frame remains visible during camera scanning and disappears before the Polaroid result, which contains only the photo and matched letters/symbols. The sole visible button remains **Save image** on the result.

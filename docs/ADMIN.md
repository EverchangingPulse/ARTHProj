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
| `scanner.enabled` | When enabled, display the photographic instrument chassis |
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

The scanner uses separate `docs/assets/astrolabe-portrait.svg` and `docs/assets/astrolabe-landscape.svg` compositions, both derived from the original `docs/assets/astrolabe-scanner.svg`. They use walnut beams, blue riveted brigandine sections, mechanical rails, latches, brass graduations, and animated sextant arms. The alternate legacy green sonar remains available through `scanner.enabled`.

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

## Installing the photorealistic HUD artwork

Upload the two approved photo-based binaries to `docs/assets/hud-portrait.webp` and `docs/assets/hud-landscape.webp`. The files must have exactly those names. The central black opening and compass dial were cut into transparent layers before exporting the files; do not flatten or re-encode them as opaque JPEGs. The app automatically displays the photo-based version when each asset is available and falls back to the previous SVG on a missing image. Once the images are committed, no JSON settings need to change. The software already tracks each viewbox and aligns the rotating compass accordingly.

## Compass-only magnetic heading and no animated sonar

The photographic compass is centered on the transparent aperture in each native WebP image. The wind rose is enlarged concentrically by 22% under the fixed brass rim, so the enamel face fills the available opening; orientation changes preserve the artwork-aligned coordinates. The rotating radar/sonar sweep and its CSS animation were removed entirely from the public page.

The default settings are `compass.preferTrueNorth: false` and `compass.requestLocation: false`. As a result, opening the site does **not** request geographic location and does not invoke the Geolocation API. When available, `DeviceOrientationEvent` supplies an absolute magnetic heading, and the rose rotates visually without numeric direction labels. Some browsers require a motion/orientation permission gesture; compass functionality is subject to device hardware support and local magnetic interference. For optional true-north correction, set both configuration flags to `true` and grant location permission.

## Exact artwork-to-compass registration on rotation

The frame and compass now share a single `object-fit: contain` transform: `Math.min(viewportWidth / assetWidth, viewportHeight / assetHeight)`, with the resulting centered offsets. This keeps the full portrait/landscape photographic chassis visible, including the top and bottom in short browser viewports. The wood-toned side panels fill any remaining landscape margins without distorting the instrument. The compass is registered to the native transparent opening (portrait: 207×1238, radius 86; landscape: 141×234, radius 55), rather than being scaled independently against the screen. Orientation changes schedule additional layout updates after the browser has settled its viewport dimensions. Mobile browser navigation bars are outside the page and may still be present unless the host grants fullscreen.

## Photographic compass calibration (8.1)

The opaque brass ring and the transparent WebP compass cutout are not perfectly concentric. Calibrated from the photographed brass housing, the portrait wind-rose anchor is at `(210, 1253)` with radius `102` in the 941 × 1672 image; landscape uses `(152, 241)` and radius `68` in the 1200 × 650 image. The image is expanded symmetrically to 126% inside the anchored circular viewport, keeping rotation centered while making the visible rose fill more of the opening. The WebP artwork and camera aperture remain unchanged.

## Relative instrument and compass placement (9.0)

Both HUD artwork and its rotating compass now share **one DOM parent**, `#instrument-frame`. The chassis never uses pixel-based anchoring; it scales from the image's intrinsic aspect ratio to fit the actual viewport, and its configurable `frame.centerX`, `frame.centerY` and `frame.scale` are relative proportions. The compass is a child of the same frame, positioned with `compass.centerX` and `compass.centerY` (0–1 fractions of the image dimensions), with `compass.diameter` as a fraction of the **artwork width**. In CSS, these are percentages of the shared frame, so their alignment is independent of device pixels, orientation, browser chrome and fullscreen mode.

Edit `docs/config/settings.json` under `instrument.photographic.portrait`, `instrument.photographic.landscape`, `instrument.illustrated.portrait` and `instrument.illustrated.landscape` to calibrate geometry without changing JavaScript or committing new assets. The illustrated entries apply only if the corresponding photographic WebP fails to load. Adjusting a configuration ratio updates the artwork and compass together after a reload.

This replaces the earlier pixel-coordinate specifications documented above.

## Unified rotating compass face (9.1)

Both the rose and blue enamel disc are now a single centered rotor inside the compass viewport, rather than a rose enlarged independently above a stationary blue backing. The photographic HUD remains fixed while the full rotor turns under the glass overlay. The CSS rotor is exactly 100% of the compass housing in both axes, with no offsets or overflow scaling. Compass calibration uses normalized coordinates derived from each photographic asset's transparent aperture: portrait center (207/941, 1238/1672) and landscape center (141/1200, 234/650). Diameters include a small overlap underneath the stationary brass lip to avoid visible seams. These numbers live only as relative proportions in `settings.json` and scale with the same frame as the artwork.

## Calibrated compass apertures v10

The **WebP alpha masks were expanded** rather than merely enlarging the rose layer. They are geometric apertures with anti-aliased edges, verified to within ±1 native source-image pixel.

| Artwork | Native dimensions | Compass centre (px) | Aperture radius (px) | Config centre | Config diameter | Aspect ratio |
| --- | --- | --- | --- | --- | --- | --- |
| portrait | 941 × 1672 | (207, 1238) | (124, 124) | (207/941, 1238/1672) | 248/941 | 1 |
| landscape | 1200 × 650 | (141, 234) | (75, 92) | (141/1200, 234/650) | 150/1200 | 75/92 |

The photographed brass rim stays intact immediately outside each new transparent aperture. `instrument-layout.js` places the rotor as percentages of the same image frame that renders the WebP, so the position and scale remain correct through fullscreen and rotation. `compass.aspectRatio` controls the elliptical landscape aperture without resizing the whole HUD. The blue enamel backing also fills the stationary casing under the glass so the rose cannot reveal gaps as it turns. Calibration can still be adjusted in `docs/config/settings.json`, without editing JavaScript.

## Portrait bezel alignment adjustment (v10.1)

A user close-up showed that the blue compass face sat approximately seven display pixels above the physical brass bezel center. Relative to the native portrait HUD (941×1672), this requires a **4-pixel downward optical correction**, from center (207,1238) to (207,1242). The original alpha aperture remains centered at (207,1238) with radius 124 px. To prevent a visible gap at the top after shifting, the rotor's outer radius expands from 124 to 128 native pixels, giving a small overlap hidden beneath the brass rim. The portrait compass config is therefore `centerX=207/941`, `centerY=1242/1672`, `diameter=256/941`, and `aspectRatio=1`. The landscape calibration and WebP artwork remain unchanged. These are normalized artwork-relative values, never viewport-pixel positions.

## Manually calibrated portrait compass center (November 2026)

User-adjusted calibrator readings: `centerX / HUD width = 0.22831023`, `centerY / HUD width = 1.32419624`, `diameter / HUD width = 0.27205101`, `aspectRatio = 1`. Since the production CSS positions vertical coordinates relative to HUD **height**, `centerY = 1.32419624 × (941/1672) = 0.74525638`. The calibrator's JSON `centerYHeight = 2.35287579` was a conversion bug and **must not** be used. The displayed calibrator screenshot reported roughly `centerY / HUD height = 0.74525837`, consistent to a fraction of a source-image pixel. Landscape settings are unchanged. This update modifies the config and its assertions only; no WebP, compass SVG, camera code, or layout code changes.

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

Only camera actions remain available to visitors: retry, stop, manual freeze, scan again, download the Polaroid image, or open in a browser.

The sound setting cannot override Android/Telegram browser autoplay restrictions. Some browsers require a user interaction before audio playback. Camera permission is always controlled by the browser, even when `camera.autoStart` is `true`.

## Validation and deployment

The repository workflow checks configuration syntax, allowed paths and values, presence of image files, and camera/overlay application code. Images are not uploaded to any backend by the web page.

GitHub Pages should be configured to publish `main` → `/docs`. A commit triggers deployment automatically. This project uses no server-side GitHub Pages authentication; do not put secrets in either JSON file.

```sh
node --test tests/site.test.mjs
```

Live recognition, stability, and photo capture still need validation on a physical Android phone.

## Italian brigandine astrolabe and north compass

The scanner uses `docs/assets/astrolabe-scanner.svg`, an ornamental frame with walnut beams, blue riveted brigandine sections, mechanical rails, latches, brass radial graduations, and an animated sextant arm. The alternate legacy green sonar remains available through `scanner.style`.

The separate `docs/assets/wind-rose.svg` is rotated by `docs/north-compass.js`, using mobile absolute device-orientation events when available. The compass uses WMM2025 declination calculated locally from location coordinates to convert magnetic heading into true heading. It displays `TRUE N` only after obtaining a valid declination. Without location permission it displays `MAG N` if magnetic orientation is available; when sensors are blocked or unsupported, it displays its limitation instead of showing a fabricated heading. The iOS permission API may require a visitor to tap **Enable compass**.

Phone compass hardware can be affected by nearby metal and electromagnetic interference. This UI is for an AR experience, not safety-critical navigation. WMM2025 model code is adapted from Darren Yeates' MIT-licensed magvar project; see `docs/vendor/WMM2025-LICENSE.txt`.

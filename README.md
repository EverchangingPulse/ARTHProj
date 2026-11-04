# ARTHProj

Open-source Roman-inscription augmented reality treasure hunt with a Telegram group bot.

## What is implemented

- A **Telegram command handler** in `worker/` running as a Cloudflare Worker.
- `/start`, `/ar`, `/reference`, `/preview`, and `/help` in private and group chats.
- A **direct AR-launch button** in private chat and a group-safe URL button.
- Secure Telegram webhooks using the `X-Telegram-Bot-Api-Secret-Token` header.
- GitHub Actions to test the worker and manually deploy it with encrypted secrets.
- The complete GitHub Pages AR frontend in `docs/`, including the camera, target compiler, inscription images, and transparent highlights.

The original AR camera and its inscription assets have been **migrated into `docs/` in this repository**. Enable GitHub Pages to publish the complete website. GitHub Pages cannot run the Telegram bot's webhook handler; the handler still deploys to a Cloudflare Worker.

## Administrator-controlled targets and settings

The live application **does not allow visitors to add reference pictures or replace symbols**. All recognized pictures and their associated PNG overlays are declared in [`docs/config/targets.json`](docs/config/targets.json), and all camera/scan/capture settings are defined in [`docs/config/settings.json`](docs/config/settings.json).

Only contributors with GitHub repository write access can change the source assets or configuration. This makes a new picture/PNG pair available to every visitor after the site deploys. No passwords or secrets are stored in client-side JSON.

**Add another picture:** upload a reference JPG/PNG/WebP and transparent symbol PNG into `docs/assets/`, then register their paths and revision strings in the targets configuration. The Roman inscription remains the default pair. **Change behavior:** edit `camera.autoStart`, `tracking.maxTrack`, `overlay.opacity`, `scanner.enabled`, `scanner.style`, `capture.autoFreeze`, `capture.freezeDelayMs` or `capture.shutterSound` in the settings file.

See [`docs/ADMIN.md`](docs/ADMIN.md) for the complete Android/GitHub workflow and sample configuration entries.

The camera automatically asks for permission when `camera.autoStart` is enabled. An animated brass astrolabe/sextant scanner appears during searching (or the legacy green sonar if configured), and a successful stable recognition can produce a gray shutter flash, sound (subject to browser autoplay restrictions), and a static Polaroid screenshot. The visitor can scan again, manually freeze, stop, or save the image.

## Android-only deployment

### 1. Publish the complete AR website on GitHub Pages

1. Open this repository in Chrome on Android. If necessary, enable **Desktop site**.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**, branch `main`, folder `/docs`, then save.
4. GitHub will publish `https://everchangingpulse.github.io/ARTHProj/` once Pages finishes deploying.

Once enabled, open `https://everchangingpulse.github.io/ARTHProj/` to use the full camera application. The first camera launch compiles the configured tracking targets locally and caches them for later visits. External MindAR and A-Frame libraries load from public CDNs.

### 2. Create the Cloudflare Worker

You need a Cloudflare account and a Telegram bot created with [@BotFather](https://t.me/BotFather). Your existing bot is `@RomanInscriptionAR_bot`.

Create these **GitHub Actions repository secrets** under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token with Worker edit/deploy permission |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `TELEGRAM_BOT_TOKEN` | The token received privately from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | A randomly generated string, 32+ characters, using letters, digits, `_` and `-` |

**Never commit the tokens or webhook secret to this repository.**

Open **Actions → Deploy Telegram Bot Worker → Run workflow**. Set `worker_url` to the new Worker's address, which uses the Worker name in `worker/wrangler.toml`, e.g. `https://arthproj-telegram-bot.YOUR-CLOUDFLARE-SUBDOMAIN.workers.dev`. You can find the assigned URL in **Cloudflare → Workers & Pages**. The GitHub workflow deploys the Worker, installs its private secrets, registers the Telegram commands, and configures the webhook.

If the first run uses the wrong Worker URL, run the workflow again with the correct address. A successful setup writes `Commands registered. Telegram webhook configured at …` to the action logs.

### 3. Configure the Telegram app button

In BotFather, use `/setmenubutton` and enter `https://everchangingpulse.github.io/ARTHProj/` once Pages is live. You can also enable **Main Mini App** under **Bot Settings → Configure Mini App**. By default, the group `/ar` button opens the AR website directly, without requiring a Main Mini App. If your Main Mini App is configured, you can optionally add `GROUP_LAUNCH_URL = "https://t.me/RomanInscriptionAR_bot?startapp"` under `[vars]` in `worker/wrangler.toml`, then redeploy to launch it through Telegram.

### 4. Add the bot to your Telegram group

In BotFather, use `/setjoingroups` and enable group access. In your Telegram group, open **Add members** and add `@RomanInscriptionAR_bot`.

Type `/ar@RomanInscriptionAR_bot` to request the camera link, `/reference@RomanInscriptionAR_bot` to see the reference, or `/help@RomanInscriptionAR_bot` for instructions. The bot does not need administrator privileges for ordinary commands. Bot privacy mode can remain enabled.

## Configuration

Edit `worker/wrangler.toml`:

- `AR_URL`: URL of the AR application, including its trailing `/` and optional GitHub Pages repository path.
- `BOT_USERNAME`: the bot's username, without the leading `@`.
- `GROUP_LAUNCH_URL`: optional Main Mini App link for group buttons; delete it to use `AR_URL`.

`AR_URL` now points to `https://everchangingpulse.github.io/ARTHProj/` in `worker/wrangler.toml`. Enable Pages and verify that the camera loads before deploying the bot.

To test locally with Node.js 22 or newer:

```sh
cd worker
npm test
```

To run the Worker locally, copy `worker/.dev.vars.example` to `worker/.dev.vars`, add your private values, run `npm install`, then `npm run dev`. The local `/health` endpoint should return `{ "status": "ok" }`.

## AR frontend files

- `docs/index.html` and `docs/ar-app.js`: camera UI, MindAR tracking, and Telegram Mini App integration.
- `docs/target-compiler.js`: the image-target compiler and local cache.
- `docs/config/targets.json`: administrator-defined picture/PNG pairs.
- `docs/config/settings.json`: administrator-defined camera, tracking, and capture settings.
- `docs/assets/inscription-reference.jpg`: the original photograph.
- `docs/assets/inscription-tracking.png`: the recognition image.
- `docs/assets/overlay.png`: transparent green letters.
- `docs/overlay-preview.html`, `docs/reference.html`, and `docs/compile.html`: supporting tools.

The full frontend was transferred from the existing Cloudflare site with SHA-256 verification using `.github/workflows/import-ar-site.yml`. All five image assets are committed to GitHub. Live camera tracking, audio and Polaroid capture still require testing on Android inside Telegram.

## Security and limitations

- The Worker does not store images, user profiles, chat messages or API tokens.
- It only responds to registered commands and ignores commands aimed at other bots.
- The webhook rejects requests without the shared secret.
- Group buttons use a URL because Telegram's `web_app` inline keyboard button works in private chats only.
- You must enable GitHub Pages under Settings → Pages to publish the static website. The Telegram Worker still requires private GitHub Actions secrets and a manual deployment run.
- Tests cover webhook validation, group/private commands and URL behavior. Live Telegram webhook delivery and AR tracking require integration testing after deployment.

MIT licensed. See [LICENSE](LICENSE).

## Compass rose and antique scanner

The astrolabe theme now includes blue brigandine panels, aged walnut crossbars, brass rails, pins, pivot mechanisms, and a rotating sextant sight. Its standalone *rosa dei venti* follows the phone’s absolute orientation. When the user grants geolocation, a locally bundled WMM2025 model corrects magnetic north into true north; otherwise the compass identifies the magnetic heading or the lack of sensor permission. All compass behavior is controlled by `docs/config/settings.json`, and no coordinates are transmitted to a compass server. See `docs/ADMIN.md` for settings and browser limitations.

## Immersive Renaissance presentation

The site has no visible navigation, status panels, modern controls, or compass bearing text. Browser-native permission prompts still apply. The portrait and landscape instruments are `docs/assets/astrolabe-portrait.svg` and `docs/assets/astrolabe-landscape.svg`; the rose rotates beneath a fixed glass-and-brass hatch. Camera tracking and all recognition targets remain administrator-configured. A user taps the finished still photograph to scan again. The site is publicly accessible because GitHub Pages cannot hide its source or assets.

## Capturing a reference photograph

The Renaissance instrument and compass remain visible during active camera scanning. A stable image match captures the camera frame with the matched symbols PNG drawn over its inscription. The decorative instrument and compass are not part of the exported image. The stationary result presents the composite in a Polaroid-style frame with **Save image** (PNG); the downloaded file contains only the composited camera frame and symbols. Tap elsewhere on the photograph to begin scanning again.

## Unified instrument chassis and fullscreen

Both orientations use cohesive, full-viewport mechanical chassis illustrations with integrated walnut beams, blue brigandine, brass rings and rivets, gears, medallions and transparent camera apertures. The rotating compass rose is positioned under the instrument ring using `docs/instrument-layout.js` rather than floating independently. `docs/config/settings.json` controls `display.fullscreen`: Telegram requests fullscreen on launch, whereas browsers that require user activation attempt fullscreen on first touch. The `docs/manifest.webmanifest` enables fullscreen display when the site is installed as a supported standalone app. Native browser controls remain outside the website's authority.

## Photorealistic photographic HUD assets

The app now supports photographic HUD artwork in two independent files: `docs/assets/hud-portrait.webp` and `docs/assets/hud-landscape.webp`. These are full-frame transparent WebP images derived from the approved Renaissance apparatus photograph. They contain transparent cutouts for the live camera and a separate compass rose. `docs/instrument-artwork.js` detects media errors and falls back to the prior SVGs if the files have not yet been uploaded. `docs/instrument-layout.js` aligns the compass with the corresponding cutouts using each asset's native coordinate system. Once both binary images are uploaded to `docs/assets/`, GitHub Pages deploys them automatically without another code edit.

## Compass center and privacy update

The photographic compass dial now fills the inset brass aperture and remains centered under the static glass. The extra animated sonar/sweep over the camera has been removed. Absolute device-orientation data is used for magnetic heading without a geographic-location request by default (`compass.requestLocation=false`, `compass.preferTrueNorth=false`). Geographic location is needed only for optional conversion to true north, and sensor permissions can still apply. The WebP instrument frame, camera overlay and static Polaroid capture are unchanged.

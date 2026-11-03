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

## Personalized AR pictures and captured photos

The public website at https://everchangingpulse.github.io/ARTHProj/ automatically asks for camera permission as soon as the page loads. Some Android or Telegram browsers restrict unattended camera access; if the request fails, use **Retry camera** or **Open in browser**. HTTPS is required.

To add another recognized picture, open **Manage reference pictures and PNG overlays**, enter a name, select its photograph (JPEG, PNG, WebP), and select a transparent PNG containing the symbols at the exact positions they should occupy over that picture. The AR scanner recognizes the reference picture and anchors **that picture's own PNG overlay** to it. The original Roman inscription remains included as a default target. You can also replace the PNG for any target without changing its reference image.

Up to five additional image/overlay pairs are stored locally per browser in IndexedDB. The app resizes reference images to a maximum dimension of 1024 pixels and fits their transparent overlays to the matching image rectangle. The images are never uploaded to Telegram or GitHub by the web application. Clearing site data, switching devices, or using a different Telegram webview may remove access to those local custom pairs. To publish targets for **all visitors**, commit their images to the repository and register the new entries in \`docs/target-manifest.js\`.

The camera draws a moving green sonar overlay while it searches for pictures. After a target is continuously recognized for 700 milliseconds, the scanner disappears, a still frame is captured with the anchored symbols, an original mechanical shutter sound is attempted, and a neutral gray flash transitions to a static Polaroid-style photo. Use **Save picture** to download the bordered image or **Scan again** to restart live scanning. Disable **Freeze automatically** to use the manual **Freeze frame** button instead.

Browser autoplay restrictions can prevent sound before the visitor interacts with the page; the **Mechanical shutter sound** toggle and touching the page can unlock audio. The scanner and flash respect reduced-motion settings. Real device image tracking, camera permissions, sound playback, and screenshot composition must be validated in Chrome and the Telegram Android browser.

## Android-only deployment

### 1. Publish the complete AR website on GitHub Pages

1. Open this repository in Chrome on Android. If necessary, enable **Desktop site**.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**, branch `main`, folder `/docs`, then save.
4. GitHub will publish `https://everchangingpulse.github.io/ARTHProj/` once Pages finishes deploying.

Once enabled, open `https://everchangingpulse.github.io/ARTHProj/` to use the full camera application. The first camera launch compiles the tracking target locally if no precompiled `targets.mind` is available. External MindAR and A-Frame libraries load from public CDNs.

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
- `docs/assets/inscription-reference.jpg`: the original photograph.
- `docs/assets/inscription-tracking.png`: the recognition image.
- `docs/assets/overlay.png`: transparent green letters.
- `docs/overlay-preview.html`, `docs/reference.html`, and `docs/compile.html`: supporting tools.

The full frontend was transferred from the existing Cloudflare site with SHA-256 verification using `.github/workflows/import-ar-site.yml`. All five image assets are committed to GitHub. A precompiled `targets.mind` file is not yet included; live camera tracking still requires testing on Android inside Telegram.

## Security and limitations

- The Worker does not store images, user profiles, chat messages or API tokens.
- It only responds to registered commands and ignores commands aimed at other bots.
- The webhook rejects requests without the shared secret.
- Group buttons use a URL because Telegram's `web_app` inline keyboard button works in private chats only.
- You must enable GitHub Pages under Settings → Pages to publish the static website. The Telegram Worker still requires private GitHub Actions secrets and a manual deployment run.
- Tests cover webhook validation, group/private commands and URL behavior. Live Telegram webhook delivery and AR tracking require integration testing after deployment.

MIT licensed. See [LICENSE](LICENSE).

# ARTHProj

Open-source Roman-inscription augmented reality treasure hunt with a Telegram group bot.

## What is implemented

- A **Telegram command handler** in `worker/` running as a Cloudflare Worker.
- `/start`, `/ar`, `/reference`, `/preview`, and `/help` in private and group chats.
- A **direct AR-launch button** in private chat and a group-safe URL button.
- Secure Telegram webhooks using the `X-Telegram-Bot-Api-Secret-Token` header.
- GitHub Actions to test the worker and manually deploy it with encrypted secrets.
- A GitHub Pages navigation page in `docs/` that links to the existing working AR camera.

The AR camera and inscription assets are currently deployed separately at `https://jolly-lab-cef2.daviedeiana5.workers.dev/`. They are not yet migrated into this repository. GitHub Pages hosts the navigation page, **not the camera engine**, until that migration is completed.

## Android-only deployment

### 1. Connect GitHub Pages navigation

1. Open this repository in Chrome on Android. If necessary, enable **Desktop site**.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**, branch `main`, folder `/docs`, then save.
4. GitHub will publish `https://everchangingpulse.github.io/ARTHProj/` once Pages finishes deploying.

You can use the existing Cloudflare AR application immediately without enabling Pages.

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

In BotFather, use `/setmenubutton` and enter your working AR website's URL. You can also enable **Main Mini App** under **Bot Settings → Configure Mini App**. The group's `/ar` response uses the direct `https://t.me/RomanInscriptionAR_bot?startapp` link, which requires the Main Mini App to be configured.

If you do **not** configure the Main Mini App, remove the `GROUP_LAUNCH_URL` line in `worker/wrangler.toml` and redeploy. The group `/ar` button will then point directly to the website.

### 4. Add the bot to your Telegram group

In BotFather, use `/setjoingroups` and enable group access. In your Telegram group, open **Add members** and add `@RomanInscriptionAR_bot`.

Type `/ar@RomanInscriptionAR_bot` to request the camera link, `/reference@RomanInscriptionAR_bot` to see the reference, or `/help@RomanInscriptionAR_bot` for instructions. The bot does not need administrator privileges for ordinary commands. Bot privacy mode can remain enabled.

## Configuration

Edit `worker/wrangler.toml`:

- `AR_URL`: URL of the AR application, including its trailing `/` and optional GitHub Pages repository path.
- `BOT_USERNAME`: the bot's username, without the leading `@`.
- `GROUP_LAUNCH_URL`: optional Main Mini App link for group buttons; delete it to use `AR_URL`.

When you eventually migrate the full AR website and image files to GitHub Pages, set `AR_URL` to `https://everchangingpulse.github.io/ARTHProj/` **only after** the camera application is served at that address. The present Pages navigation page is not the camera engine.

To test locally with Node.js 22 or newer:

```sh
cd worker
npm test
```

To run the Worker locally, copy `worker/.dev.vars.example` to `worker/.dev.vars`, add your private values, run `npm install`, then `npm run dev`. The local `/health` endpoint should return `{ "status": "ok" }`.

## Security and limitations

- The Worker does not store images, user profiles, chat messages or API tokens.
- It only responds to registered commands and ignores commands aimed at other bots.
- The webhook rejects requests without the shared secret.
- Group buttons use a URL because Telegram's `web_app` inline keyboard button works in private chats only.
- The public repository does not automatically deploy anything until you configure GitHub Actions secrets and manually run the deployment workflow.
- Tests cover webhook validation, group/private commands and URL behavior. Live Telegram webhook delivery and AR tracking require integration testing after deployment.

MIT licensed. See [LICENSE](LICENSE).

# Speculum Arcana Telegram Mini App frontend

The application is deployed from `docs/` as static assets to the original
Cloudflare Workers hostname:

https://ar.daviedeiana5.workers.dev/

The Cloudflare deployment is independent from the bot webhook Worker
(`worker/wrangler.toml`, name `arthproj-telegram-bot`).

The GitHub workflow `.github/workflows/deploy-ar-miniapp.yml` publishes the
frontend whenever files in `docs/` change. It uses the existing repository
secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The workflow then
updates the bot's `AR_URL` variable and, when `TELEGRAM_BOT_TOKEN` is
configured, sets the bot's chat menu button to this Cloudflare URL.

GitHub Pages remains a browser-accessible mirror, not the default Telegram
launch URL. Changes to the Main Mini App URL configured in BotFather may
need to be made separately; the Bot API can set the chat menu button but not
the Main Mini App's BotFather configuration.

The application still relies on Telegram Android WebView allowing WebRTC
camera access; hosting on the previously working origin cannot override
device-level permission restrictions.

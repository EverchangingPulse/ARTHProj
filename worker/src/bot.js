const COMMANDS = new Set(["start", "ar", "reference", "preview", "help"]);

function readCommand(text, username) {
  const match = /^\/([a-z][a-z0-9_]*)(?:@([a-z0-9_]+))?(?=\s|$)/i.exec(text?.trimStart() ?? "");
  if (!match) return null;
  if (match[2] && match[2].toLowerCase() !== username.toLowerCase()) return null;
  const command = match[1].toLowerCase();
  return COMMANDS.has(command) ? command : null;
}

function resourceUrl(baseUrl, file) {
  const base = new URL(baseUrl);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(file, base).toString();
}

function button(text, url) {
  return { text, url };
}

function cameraButton(chatType, appUrl, groupLaunchUrl) {
  return chatType === "private"
    ? { text: "Open AR Camera", web_app: { url: appUrl } }
    : button("Open AR Camera", groupLaunchUrl || appUrl);
}

export function createReply(message, config) {
  const command = readCommand(message.text, config.botUsername);
  if (!command || !message.chat?.id) return null;

  const appUrl = resourceUrl(config.arUrl, "");
  const chatType = message.chat.type;
  const camera = cameraButton(chatType, appUrl, config.groupLaunchUrl);
  const reference = button("Reference image", resourceUrl(appUrl, "reference.html"));
  const preview = button("Highlighted letters", resourceUrl(appUrl, "overlay-preview.html"));

  const messages = {
    start: {
      text: "Roman Inscription AR\n\nScan the stone inscription to reveal nine green letters. Use /ar to launch the camera or /help for instructions.",
      keyboard: [[camera], [reference, preview]]
    },
    ar: {
      text: "Point your camera at the original Roman inscription. The green letters will appear when the image is recognized.",
      keyboard: [[camera]]
    },
    reference: {
      text: "Open the original, unmarked inscription for comparison.",
      keyboard: [[reference]]
    },
    preview: {
      text: "Open the image showing the nine highlighted letters.",
      keyboard: [[preview]]
    },
    help: {
      text: "Commands:\n/ar — launch the camera\n/reference — original inscription\n/preview — highlighted letters\n/help — this guide\n\nAllow camera access, use good lighting and hold the phone steady. If Telegram cannot access the camera, open the website in Chrome.",
      keyboard: [[camera], [reference, preview]]
    }
  };

  const { text, keyboard } = messages[command];
  return {
    chat_id: message.chat.id,
    text,
    reply_markup: { inline_keyboard: keyboard },
    reply_parameters: {
      message_id: message.message_id,
      allow_sending_without_reply: true
    }
  };
}

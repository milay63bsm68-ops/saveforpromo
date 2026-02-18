import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  GITHUB_TOKEN,
  GITHUB_REPO,
  GITHUB_FILE_PATH,
  TELEGRAM_BOT_TOKEN,
  ADMIN_ID
} = process.env;

// Function to send Telegram messages
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

// Get the file content from GitHub
async function getGitHubFile() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

// Update the file in GitHub
async function updateGitHubFile(newContent, sha) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { 
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Update promo list`,
      content: Buffer.from(newContent).toString("base64"),
      sha
    })
  });
  return res.json();
}

// Serve admin.html
app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Admin route to add a promo ID
app.post("/admin/add-promo", async (req, res) => {
  const { promoId } = req.body;
  if (!promoId) return res.status(400).send("Promo ID is required");

  try {
    const { content, sha } = await getGitHubFile();

    // Make sure the promo isn't already added
    if (content.includes(`"${promoId}"`)) return res.status(400).send("Promo already exists");

    // Append the new promo ID at the end of the array
    const newContent = content.replace(
      /(const PROMO_LIST = \[[\s\S]*?\])/,
      (match) => {
        let trimmed = match.trim();
        // Remove the closing bracket
        trimmed = trimmed.slice(0, -1);
        return `${trimmed}, "${promoId}"]`;
      }
    );

    await updateGitHubFile(newContent, sha);

    // Notify admin and promo owner
    await sendTelegramMessage(ADMIN_ID, `New promo added: ${promoId}`);
    await sendTelegramMessage(promoId, `Your promo ID has been added successfully.`);

    res.send("Promo added successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating promo list");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const Parser = require('rss-parser');
const fs = require('fs');

const parser = new Parser();
const RSS_URL = "https://www.adaderana.lk/rss.php";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const STATE_FILE = "last_news.txt";

// Helper function to send messages to Telegram
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: CHANNEL_ID,
            text: text,
            parse_mode: "HTML",
            disable_web_page_preview: false
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to send message: ${errorText}`);
    }
}

// Main bot logic
async function main() {
    try {
        // 1. Parse the RSS feed
        const feed = await parser.parseURL(RSS_URL);
        if (feed.items.length === 0) {
            console.log("No entries found in the RSS feed.");
            return;
        }

        // 2. Read the last sent news identifier
        let lastIdentifier = "";
        if (fs.existsSync(STATE_FILE)) {
            lastIdentifier = fs.readFileSync(STATE_FILE, "utf-8").trim();
        }

        // 3. Find all new entries
        const newEntries = [];
        for (const item of feed.items) {
            const identifier = item.guid || item.link;
            if (identifier === lastIdentifier) {
                break; // Stop when we hit news we've already sent
            }
            newEntries.push(item);
        }

        if (newEntries.length === 0) {
            console.log("No new news to send.");
            return;
        }

        // 4. Reverse array to send the oldest "new" news first
        newEntries.reverse();

        // 5. Send new entries to Telegram
        for (const item of newEntries) {
            const title = item.title;
            const link = item.link;
            const pubDate = item.pubDate || '';

            const message = `📰 <b>${title}</b>\n\n🕒 ${pubDate}\n\n🔗 <a href='${link}'>Read Full Story</a>`;
            
            await sendTelegramMessage(message);
            console.log(`Sent: ${title}`);
            
            // Wait 1 second between messages to prevent hitting Telegram rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 6. Save the newest identifier to the state file
        const latestEntry = feed.items[0];
        const latestIdentifier = latestEntry.guid || latestEntry.link;
        fs.writeFileSync(STATE_FILE, latestIdentifier);
        console.log("State file updated successfully.");

    } catch (error) {
        console.error("An error occurred:", error);
    }
}

main();

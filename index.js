const fs = require('fs');

// The free JSON API URL for Adaderana
const API_URL = "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.adaderana.lk%2Frss.php";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const STATE_FILE = "last_news.txt";

async function sendTelegramMessage(text) {
    if (!BOT_TOKEN || !CHANNEL_ID) return;
    
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHANNEL_ID,
                text: text,
                parse_mode: "HTML",
                disable_web_page_preview: false
            })
        });
    } catch (e) {
        console.error("Telegram Error:", e);
    }
}

async function main() {
    try {
        console.log("Fetching news from RSS2JSON API...");

        // 1. Fetch the JSON data
        const response = await fetch(API_URL);
        const data = await response.json();

        // Check if the API returned an error (common if the feed is blocked)
        if (data.status !== 'ok') {
            console.error("API Error:", data.message);
            return;
        }

        const items = data.items;
        if (!items || items.length === 0) {
            console.log("No news items found.");
            return;
        }

        console.log(`Received ${items.length} articles from API.`);

        // 2. Read the last sent news link to avoid duplicates
        let lastLink = "";
        if (fs.existsSync(STATE_FILE)) {
            lastLink = fs.readFileSync(STATE_FILE, "utf-8").trim();
        }

        // 3. Filter for NEW articles only
        const newEntries = [];
        for (const item of items) {
            // The API returns 'link' and 'guid'. We use 'link' as the unique ID.
            if (item.link === lastLink) {
                break; // Stop once we reach a story we've already sent
            }
            newEntries.push(item);
        }

        if (newEntries.length === 0) {
            console.log("No new news to send.");
            return;
        }

        // 4. Reverse the list (so we send the oldest of the new items first)
        newEntries.reverse();

        // 5. Send to Telegram
        for (const item of newEntries) {
            const title = item.title;
            const link = item.link;
            const pubDate = item.pubDate;

            // Construct Message
            const message = `📰 <b>${title}</b>\n\n🕒 ${pubDate}\n\n🔗 <a href='${link}'>Read Full Story</a>`;
            
            await sendTelegramMessage(message);
            console.log(`Sent: ${title}`);

            // Wait 2 seconds between messages to be safe
            await new Promise(r => setTimeout(r, 2000));
        }

        // 6. Save the latest link to our state file
        // The first item in the original 'items' array is always the newest
        fs.writeFileSync(STATE_FILE, items[0].link);
        console.log("State updated successfully.");

    } catch (error) {
        console.error("Critical Error:", error);
        process.exit(1);
    }
}

main();

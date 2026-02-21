const Parser = require('rss-parser');
const fs = require('fs');

const parser = new Parser(); // We don't need headers here anymore
const RSS_URL = "https://www.adaderana.lk/rss.php";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const STATE_FILE = "last_news.txt";

async function sendTelegramMessage(text) {
    if (!BOT_TOKEN || !CHANNEL_ID) {
        console.error("Missing Bot Token or Channel ID");
        return;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHANNEL_ID,
                text: text,
                parse_mode: "HTML",
                disable_web_page_preview: false
            })
        });
        if (!response.ok) {
            console.error(`Telegram Error: ${await response.text()}`);
        }
    } catch (e) {
        console.error("Network error sending to Telegram:", e);
    }
}

async function main() {
    try {
        console.log("Downloading RSS feed manually...");

        // 1. Manually fetch the content using native fetch to bypass 403
        const response = await fetch(RSS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
        }

        const xmlData = await response.text();

        // 2. Parse the XML string we just downloaded
        const feed = await parser.parseString(xmlData);

        if (!feed.items || feed.items.length === 0) {
            console.log("No entries found.");
            return;
        }

        console.log(`Successfully parsed ${feed.items.length} items.`);

        // 3. Read last sent ID
        let lastIdentifier = "";
        if (fs.existsSync(STATE_FILE)) {
            lastIdentifier = fs.readFileSync(STATE_FILE, "utf-8").trim();
        }

        // 4. Find new entries
        const newEntries = [];
        for (const item of feed.items) {
            const identifier = item.guid || item.link;
            if (identifier === lastIdentifier) break;
            newEntries.push(item);
        }

        if (newEntries.length === 0) {
            console.log("No new news.");
            return;
        }

        // 5. Send oldest to newest
        newEntries.reverse();

        for (const item of newEntries) {
            const title = item.title;
            const link = item.link;
            const pubDate = item.pubDate || '';
            
            // Cleanup title (sometimes RSS has html entities)
            const cleanTitle = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

            const message = `📰 <b>${cleanTitle}</b>\n\n🕒 ${pubDate}\n\n🔗 <a href='${link}'>Read Full Story</a>`;
            
            await sendTelegramMessage(message);
            console.log(`Sent: ${cleanTitle}`);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 6. Save state
        const latestEntry = feed.items[0];
        const latestIdentifier = latestEntry.guid || latestEntry.link;
        fs.writeFileSync(STATE_FILE, latestIdentifier);
        console.log("State updated.");

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        process.exit(1);
    }
}

main();

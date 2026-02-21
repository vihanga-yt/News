const Parser = require('rss-parser');
const fs = require('fs');

// WE ADD HEADERS HERE TO FAKE A BROWSER
const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml'
    }
});

const RSS_URL = "https://www.adaderana.lk/rss.php";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const STATE_FILE = "last_news.txt";

// Helper function to send messages to Telegram
async function sendTelegramMessage(text) {
    // If these are missing, don't crash, just log it (useful for local testing)
    if (!BOT_TOKEN || !CHANNEL_ID) {
        console.error("Missing Bot Token or Channel ID");
        return;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
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
    } catch (e) {
        console.error("Network error sending to Telegram:", e);
    }
}

// Main bot logic
async function main() {
    try {
        console.log("Fetching RSS feed...");
        
        // 1. Parse the RSS feed with the new headers
        const feed = await parser.parseURL(RSS_URL);
        
        if (!feed.items || feed.items.length === 0) {
            console.log("No entries found in the RSS feed.");
            return;
        }

        console.log(`Successfully fetched ${feed.items.length} items.`);

        // 2. Read the last sent news identifier
        let lastIdentifier = "";
        if (fs.existsSync(STATE_FILE)) {
            lastIdentifier = fs.readFileSync(STATE_FILE, "utf-8").trim();
        }

        // 3. Find all new entries
        const newEntries = [];
        for (const item of feed.items) {
            // Use guid if available, otherwise fallback to link
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

        console.log(`Found ${newEntries.length} new articles.`);

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
            
            // Wait 2 seconds between messages to be safe with rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 6. Save the newest identifier to the state file
        const latestEntry = feed.items[0];
        const latestIdentifier = latestEntry.guid || latestEntry.link;
        fs.writeFileSync(STATE_FILE, latestIdentifier);
        console.log("State file updated successfully.");

    } catch (error) {
        console.error("An error occurred:", error);
        // Force the action to fail so you see a red X in GitHub if it breaks
        process.exit(1); 
    }
}

main();

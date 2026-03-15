// ============================================================
// telegram.js
// Sends Telegram messages when a purchase or debt is added.
//
// No server needed — calls the Telegram Bot API directly
// from the browser using fetch().
//
// ── SETUP ─────────────────────────────────────────────────────
// 1. Create a bot via @BotFather on Telegram → get BOT_TOKEN
// 2. Each roommate messages the bot once → get their CHAT_ID
// 3. Fill in BOT_TOKEN and CHAT_IDS below
// See README_TELEGRAM.md for full instructions.
// ============================================================

// ── CONFIG — fill these in after setup ────────────────────────

const BOT_TOKEN = "8171107956:AAEWnR44YK9Zf8OK35S-UTzId7Nuu9Ta2TI";

// Each person's Telegram chat ID (found during setup)
const CHAT_IDS = {
    David:  "8757424376",
    Julius: "JULIUS_CHAT_ID_HERE",
    Alvin:  "ALVIN_CHAT_ID_HERE"
};

// ─────────────────────────────────────────────────────────────

const ALL_USERS = Object.keys(CHAT_IDS);

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Sends a Telegram message to a single user.
 * Uses MarkdownV2 formatting for bold/italic support.
 *
 * @param {string} userName  - "David", "Julius", or "Alvin"
 * @param {string} message   - Plain text message to send
 */
async function sendMessage(userName, message) {
    const chatId = CHAT_IDS[userName];

    if (!chatId || chatId.includes("CHAT_ID_HERE")) {
        console.warn(`[Telegram] No chat ID configured for ${userName}, skipping.`);
        return;
    }

    if (!BOT_TOKEN || BOT_TOKEN.includes("BOT_TOKEN_HERE")) {
        console.warn("[Telegram] BOT_TOKEN not configured.");
        return;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(url, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id:    chatId,
                text:       message,
                parse_mode: "HTML"   // supports <b>, <i>, <code>
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error(`[Telegram] Failed to send to ${userName}:`, err.description);
        } else {
            console.log(`[Telegram] Message sent to ${userName}.`);
        }
    } catch (err) {
        console.error(`[Telegram] Network error sending to ${userName}:`, err.message);
    }
}

/**
 * Sends a message to multiple users in parallel.
 *
 * @param {string[]} recipients - Array of user names to notify
 * @param {string}   message    - Message text
 */
async function sendToMany(recipients, message) {
    await Promise.all(recipients.map(name => sendMessage(name, message)));
}

// ── PUBLIC API ────────────────────────────────────────────────

/**
 * Called when a new purchase is added.
 * Notifies everyone except the person who paid.
 *
 * @param {object} entry      - The new purchase entry from Firestore
 * @param {string} addedBy    - Name of the logged-in user who added it
 */
export async function notifyPurchaseAdded(entry, addedBy) {
    const item   = entry.Type     || "ett köp";
    const total  = formatAmount(entry.TotalCost);

    const message =
        `💸 <b>Nytt köp registrerat</b>\n\n` +
        `<b>${addedBy}</b> lade till:\n` +
        `📦 ${item}\n` +
        `💰 Totalt: ${total} kr\n`;

    const recipients = ALL_USERS.filter(u => u !== addedBy);
    await sendToMany(recipients, message);
}

/**
 * Called when a new debt is added.
 * Notifies only the person who owes the money.
 *
 * @param {object} entry   - The new debt entry from Firestore
 *                           { from, to, amount, message }
 * @param {string} addedBy - Name of the logged-in user who added it
 */
export async function notifyDebtAdded(entry, addedBy) {
    const amount  = formatAmount(entry.amount);
    const message = entry.message ? ` — ${entry.message}` : "";

    const text =
        `<b>${addedBy}</b> registrerade att du är skyldig:\n` +
        `💰 ${amount} kr${message}`;

    // "from" is the person who owes — notify them
    await sendMessage(entry.from, text);
}

// ── INTERNAL ──────────────────────────────────────────────────

function formatAmount(value) {
    if (typeof value !== "number" || isNaN(value)) return "?";
    return value.toLocaleString("sv-SE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
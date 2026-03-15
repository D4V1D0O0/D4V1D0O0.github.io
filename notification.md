# Telegram Notifications — Setup Guide

Completely free. No servers. No Firebase billing.

---

## What you need

- Telegram installed on your phone (free — telegram.org)
- 5 minutes

---

## Step 1 — Everyone downloads Telegram

All three of you (David, Julius, Alvin) need Telegram.
Download it from the App Store or Google Play and create an account.

---

## Step 2 — Create a bot (one person does this)

1. Open Telegram and search for **@BotFather**
2. Start a chat and send: `/newbot`
3. Follow the prompts — pick any name and username for the bot
   (e.g. name: "BΩNG house", username: "bonghouse_bot")
4. BotFather will reply with your **Bot Token** — it looks like:
   `7123456789:AAFexampleTokenXYZabcdef`
5. **Copy and save this token** — you'll need it in Step 5

---

## Step 3 — Each person gets their Chat ID

Every person needs to do this on their own phone:

1. Open Telegram and search for the bot you just created
   (search for the username you picked, e.g. `@bonghouse_bot`)
2. Tap **Start** or send any message (e.g. "hej")
3. Now open this URL in your browser — replace `YOUR_BOT_TOKEN`
   with the actual token from Step 2:

   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```

4. You'll see a JSON response. Find the `"id"` field inside `"chat"`:

   ```json
   {
     "message": {
       "chat": {
         "id": 123456789,   ← THIS is your Chat ID
         "first_name": "David"
       }
     }
   }
   ```

5. **Each person copies their own Chat ID** and shares it with
   whoever is doing the setup (Step 5)

---

## Step 4 — Fill in telegram.js

Open `telegram.js` and replace the placeholders at the top:

```js
const BOT_TOKEN = "7123456789:AAFexampleTokenXYZabcdef";  // from Step 2

const CHAT_IDS = {
    David:  "123456789",   // David's chat ID from Step 3
    Julius: "987654321",   // Julius's chat ID from Step 3
    Alvin:  "456789123"    // Alvin's chat ID from Step 3
};
```

---

## Step 5 — Add two import lines to script.js

Open `script.js` and add this import at the very top of the file,
alongside the existing Firebase imports:

```js
import { notifyPurchaseAdded, notifyDebtAdded } from './telegram.js';
```

Then find the expense form submit handler — it ends with `saveData()`.
Add one line after `saveData()`:

```js
// After purchases.push(newEntry); saveData(); etc.
notifyPurchaseAdded(newEntry, payer);
```

Then find the debt form submit handler — it ends with `updateDoc(...)`.
Add one line after the `await updateDoc(...)` call:

```js
// After await updateDoc(debtsRef, { entries: arrayUnion(entry) });
notifyDebtAdded(entry, localStorage.getItem('saldo_user'));
```

---

## Step 6 — Deploy

Upload `telegram.js` to your site alongside the other JS files.
That's it — no other deployment needed.

---

## How it works

```
User adds a purchase or debt in the app
        ↓
script.js calls notifyPurchaseAdded() or notifyDebtAdded()
        ↓
telegram.js sends a fetch() request to api.telegram.org
        ↓
Telegram delivers a message to the right person(s)
        ↓
Recipient sees a Telegram notification on their phone
```

---

## Notification examples

**New purchase:**
```
💸 Nytt köp registrerat

David lade till:
📦 Matvaror
💰 Totalt: 450,00 kr
```
*(Julius and Alvin both receive this)*

**New debt:**
```
Julius registrerade att du är skyldig:
💰 320,00 kr — el för mars
```
*(Only David receives this, since he's the one who owes)*

---

## Troubleshooting

**No message received:**
- Make sure you sent a message to the bot first (Step 3)
- Double-check the Chat ID — it must be a number, not a username
- Check the browser console for `[Telegram]` error messages

**"BOT_TOKEN not configured" in console:**
- You forgot to replace the placeholder in `telegram.js`

**getUpdates returns an empty array:**
- The person hasn't messaged the bot yet — go back to Step 3

**Works for some people but not others:**
- Each person has a different Chat ID — make sure you have all three
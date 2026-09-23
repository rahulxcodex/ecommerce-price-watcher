# 📱 Telegram Bot Setup Guide (100% Free)

Get instant mobile notifications when your tracked products hit an all-time lowest price.

---

## Step 1: Create Your Free Bot with @BotFather
1. Open the **Telegram** app on your phone or desktop.
2. In the search bar, search for `@BotFather` (verified blue tick).
3. Tap **Start** or send the command:
   ```
   /newbot
   ```
4. Follow the prompt to give your bot a name (e.g., `My Price Watcher`).
5. Choose a username ending in `bot` (e.g., `my_price_watcher_bot`).
6. BotFather will reply with your **HTTP API Token** looking like:
   ```
   1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ
   ```
   *Save this token! This will be your `TELEGRAM_BOT_TOKEN` in GitHub Secrets and `.env`.*

---

## Step 2: Get Your Personal Chat ID
1. Search Telegram for `@userinfobot` or open your newly created bot.
2. Tap **Start** or send `/start`.
3. `@userinfobot` will instantly reply with your details:
   ```
   Id: 987654321
   First: Your Name
   ```
   *The number next to `Id` is your `chat_id`.*

---

## Step 3: Connect to PriceWatcher
1. Open the **PriceWatcher** website.
2. Navigate to **Alert Settings** (`/settings`).
3. Paste your `chat_id` in the input field.
4. Click **Save Settings**.
5. Click **Send Test Notification** to confirm you receive an immediate ping on Telegram!

---

## Step 4: Configure GitHub Secrets (For Automated Cron)
When deploying your project to GitHub:
1. In your GitHub repository, go to **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Secret Key
   - `TELEGRAM_BOT_TOKEN`: The bot token from Step 1

Your GitHub Action scraper will now automatically dispatch Telegram alerts every 6 hours whenever an all-time lowest price is detected!

# Google Apps Script Email API Setup (100% Free)

This service allows the price tracker to send instant, beautifully formatted email alerts directly through your personal Gmail account without needing third-party email providers (like SendGrid or Resend).

**Free Quota**: 
- Personal `@gmail.com` accounts: **100 emails / day** (free forever)
- Google Workspace accounts: **1,500 emails / day**

---

## 1. Create the Google Apps Script Project (2 Minutes)

1. Open [script.google.com](https://script.google.com) and click **+ New project**.
2. Rename the project to `PriceWatcher Email Dispatcher`.
3. In the script editor, delete any existing code in `Code.gs`.
4. Copy and paste the entire code from [`google-apps-script/Code.gs`](../google-apps-script/Code.gs) into `Code.gs`.

---

## 2. (Recommended) Set a Secret API Key

To prevent unauthorized parties from using your Apps Script Web App to send emails:
1. In the Apps Script sidebar, click the gear icon ⚙️ (**Project Settings**).
2. Scroll down to **Script Properties** and click **Add script property**.
   - **Property**: `API_KEY`
   - **Value**: Any random secret string (e.g., `pw_secret_alert_key_999`)
3. Click **Save script properties**.

---

## 3. Deploy as a Web App

1. In the top-right corner, click **Deploy** -> **New deployment**.
2. Click the gear icon ⚙️ next to *Select type* and select **Web app**.
3. Fill in the fields:
   - **Description**: `v1 Price Alert Dispatcher`
   - **Execute as**: `Me (your_email@gmail.com)`
   - **Who has access**: `Anyone` *(Note: Since you set an API key, only requests providing the correct `apiKey` will be permitted)*
4. Click **Deploy**.
5. When prompted with **Authorization required**, click **Authorize access**.
   - Choose your Google Account.
   - If you see *"Google hasn't verified this app"*, click **Advanced** -> **Go to PriceWatcher Email Dispatcher (unsafe)**.
   - Click **Allow**.
6. Copy the generated **Web app URL** (it ends with `/exec`).

---

## 4. Add Environment Variables to Vercel & GitHub Actions

Add these two variables to your Vercel Project Settings and GitHub Repository Secrets:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `APPSCRIPT_EMAIL_URL` | `https://script.google.com/macros/s/AKfycb.../exec` | Your deployed Apps Script Web App URL |
| `APPSCRIPT_API_KEY` | `pw_secret_alert_key_999` | The secret key configured in Step 2 |

---

## 5. Testing the Endpoint

### Via cURL:
```bash
curl -X POST "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "pw_secret_alert_key_999",
    "to": "your_email@gmail.com",
    "type": "price_drop",
    "productTitle": "Apple iPhone 15 (128 GB) - Black",
    "productUrl": "https://www.amazon.in/dp/B0CHX1W1XY",
    "previousPrice": 79900,
    "newPrice": 65999,
    "isAllTimeLow": true,
    "platform": "Amazon"
  }'
```

### Health Check:
Open `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec` directly in your browser. It will return:
```json
{
  "status": "active",
  "service": "Ecommerce Price Watcher Email API",
  "quotaRemaining": 100
}
```

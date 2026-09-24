/**
 * ====================================================================
 * Google Apps Script Email Dispatch API
 * E-Commerce Price Watcher Alert Service (100% Free)
 * ====================================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com and click "New project".
 * 2. Paste this entire file into Code.gs.
 * 3. (Optional) Set your API key in Project Settings > Script Properties:
 *      Key: API_KEY
 *      Value: your-secret-api-key-here
 *    Or edit the DEFAULT_API_KEY below.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Set:
 *      - Execute as: "Me" (your Google account)
 *      - Who has access: "Anyone"
 * 7. Click "Deploy" and authorize the requested Gmail/MailApp permissions.
 * 8. Copy the Web App URL (ends with /exec).
 */

const DEFAULT_API_KEY = 'change-this-to-a-secure-random-token';

function getApiKey() {
  const prop = PropertiesService.getScriptProperties().getProperty('API_KEY');
  return prop || DEFAULT_API_KEY;
}

/**
 * Health check endpoint
 */
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'active',
      service: 'Ecommerce Price Watcher Email API',
      timestamp: new Date().toISOString(),
      quotaRemaining: MailApp.getRemainingDailyQuota()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Main Web App POST handler
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'Empty request body' }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const configuredApiKey = getApiKey();

    // 1. Authenticate Request
    const clientKey = payload.apiKey || (e.parameter && e.parameter.apiKey);
    if (configuredApiKey !== 'change-this-to-a-secure-random-token' && clientKey !== configuredApiKey) {
      return jsonResponse({ success: false, error: 'Unauthorized: Invalid API key' }, 401);
    }

    // 2. Validate Recipient
    const recipient = payload.to;
    if (!recipient || !isValidEmail(recipient)) {
      return jsonResponse({ success: false, error: 'Invalid or missing "to" email address' }, 400);
    }

    // 3. Process Price Drop Alert or Generic Email
    let subject = payload.subject;
    let htmlBody = payload.htmlBody;
    let textBody = payload.textBody;

    if (payload.type === 'price_drop') {
      const dropData = payload;
      const formattedOld = '₹' + Number(dropData.previousPrice || 0).toLocaleString('en-IN');
      const formattedNew = '₹' + Number(dropData.newPrice || 0).toLocaleString('en-IN');
      const discount = dropData.previousPrice > dropData.newPrice
        ? Math.round(((dropData.previousPrice - dropData.newPrice) / dropData.previousPrice) * 100)
        : 0;

      subject = dropData.isAllTimeLow
        ? `🔥 ALL-TIME LOW: ${dropData.productTitle.slice(0, 50)}...`
        : `📉 Price Drop Alert: ${dropData.productTitle.slice(0, 50)}...`;

      htmlBody = renderPriceDropEmail({
        title: dropData.productTitle,
        url: dropData.productUrl,
        oldPrice: formattedOld,
        newPrice: formattedNew,
        discount: discount,
        imageUrl: dropData.imageUrl,
        isAllTimeLow: dropData.isAllTimeLow,
        platform: dropData.platform || 'Ecommerce'
      });

      textBody = [
        `PRICE DROP ALERT!`,
        ``,
        `${dropData.productTitle}`,
        `Current Price: ${formattedNew} (Was: ${formattedOld}, Save ${discount}%)`,
        dropData.isAllTimeLow ? `🏆 ALL-TIME LOWEST PRICE RECORDED!` : ``,
        `Buy now: ${dropData.productUrl}`
      ].filter(Boolean).join('\n');
    } else if (payload.type === 'scraper_failure') {
      subject = subject || `⚠️ [Scraper Failure] ${(payload.platform || 'Ecommerce').toUpperCase()} - ${(payload.productTitle || 'Product').slice(0, 45)}`;
    } else if (payload.type === 'scraper_stale') {
      subject = subject || `🚨 [Watchdog Alert] Price Watcher has not scraped for ${payload.hoursSinceLastScrape || 3} hours!`;
    }

    if (!subject) {
      return jsonResponse({ success: false, error: 'Missing email subject' }, 400);
    }

    // 4. Dispatch Email via Google MailApp
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: textBody || 'Please view this email in an HTML-compatible client.',
      htmlBody: htmlBody || textBody,
      name: 'PriceWatcher Alerts'
    });

    return jsonResponse({
      success: true,
      message: 'Email dispatched successfully',
      recipient: recipient,
      quotaRemaining: MailApp.getRemainingDailyQuota()
    }, 200);

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message || String(err)
    }, 500);
  }
}

/**
 * Email format validation
 */
function isValidEmail(email) {
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return typeof email === 'string' && regex.test(email.trim());
}

/**
 * Standard JSON Response Helper
 */
function jsonResponse(obj, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Modern Responsive Dark-Slate HTML Email Template
 */
function renderPriceDropEmail(data) {
  const badgeColor = data.isAllTimeLow ? '#10b981' : '#38bdf8';
  const badgeLabel = data.isAllTimeLow ? '🔥 ALL-TIME LOW PRICE' : '📉 PRICE DROP DETECTED';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${badgeLabel}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #020617; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 24px 30px; background-color: #090d16; border-bottom: 1px solid #1e293b; text-align: left;">
              <span style="font-size: 18px; font-weight: 800; color: #f8fafc; letter-spacing: -0.5px;">
                Price<span style="color: #10b981;">Watcher</span>
              </span>
              <span style="float: right; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-top: 4px;">
                ${data.platform}
              </span>
            </td>
          </tr>

          <!-- Banner -->
          <tr>
            <td style="padding: 20px 30px 10px 30px; text-align: left;">
              <span style="display: inline-block; background-color: rgba(16, 185, 129, 0.1); border: 1px solid ${badgeColor}; color: ${badgeColor}; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px;">
                ${badgeLabel}
              </span>
            </td>
          </tr>

          <!-- Product Details -->
          <tr>
            <td style="padding: 10px 30px 20px 30px;">
              ${data.imageUrl ? `
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${data.imageUrl}" alt="${data.title}" style="max-height: 180px; max-width: 100%; border-radius: 12px; object-fit: contain; background: #ffffff; padding: 10px;" />
              </div>
              ` : ''}

              <h2 style="font-size: 17px; font-weight: 700; color: #f1f5f9; line-height: 1.4; margin: 0 0 16px 0;">
                ${data.title}
              </h2>

              <!-- Price Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1e293b; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; display: block; margin-bottom: 4px;">Current Price</span>
                    <span style="font-size: 26px; font-weight: 800; color: #10b981;">${data.newPrice}</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; display: block; margin-bottom: 4px;">Previous</span>
                    <span style="font-size: 16px; font-weight: 600; color: #64748b; text-decoration: line-through;">${data.oldPrice}</span>
                    ${data.discount > 0 ? `
                    <span style="display: block; font-size: 12px; font-weight: 700; color: #38bdf8; margin-top: 2px;">-${data.discount}% OFF</span>
                    ` : ''}
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${data.url}" target="_blank" style="display: block; background-color: #10b981; color: #020617; font-weight: 700; font-size: 14px; text-decoration: none; text-align: center; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                      Open Product on ${data.platform} →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #090d16; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
              You received this alert because you are tracking this product on PriceWatcher.<br/>
              Free Automated Serverless Price Tracker • Powered by GitHub Actions & Supabase
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

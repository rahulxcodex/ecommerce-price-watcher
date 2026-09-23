/**
 * Google Apps Script Email Dispatch Client
 * Communicates with the Apps Script Web App API to send free email notifications
 */

export interface EmailAlertPayload {
  to: string;
  productTitle: string;
  productUrl: string;
  previousPrice: number;
  newPrice: number;
  currency?: string;
  isAllTimeLow?: boolean;
  imageUrl?: string;
  platform?: string;
}

export interface GenericEmailPayload {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
}

export async function sendEmailViaAppsScript(
  payload: EmailAlertPayload | GenericEmailPayload
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = process.env.APPSCRIPT_EMAIL_URL;
  const apiKey = process.env.APPSCRIPT_API_KEY;

  if (!apiUrl) {
    return {
      success: false,
      error: 'APPSCRIPT_EMAIL_URL is not configured in environment variables.',
    };
  }

  try {
    const isPriceDrop = 'productTitle' in payload;
    const body = isPriceDrop
      ? {
          type: 'price_drop',
          apiKey,
          ...payload,
        }
      : {
          apiKey,
          ...payload,
        };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      redirect: 'follow', // Google Apps Script redirects Web App POST requests
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `HTTP error ${res.status} from Apps Script API`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

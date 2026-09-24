let currentUrl = '';
let extractedInfo = null;

function detectStore(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('amazon.')) return 'Amazon';
  if (lower.includes('flipkart.com')) return 'Flipkart';
  if (lower.includes('myntra.com')) return 'Myntra';
  if (lower.includes('ajio.com')) return 'Ajio';
  if (lower.includes('meesho.com')) return 'Meesho';
  if (lower.includes('westside.com')) return 'Westside';
  return null;
}

// Function injected into the active tab to extract product details from DOM
function extractProductFromPage() {
  let price = null;
  let title = document.title || '';
  let imageUrl = null;

  // 1. JSON-LD Schema.org check
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      if (!s.textContent) continue;
      const data = JSON.parse(s.textContent);
      const items = Array.isArray(data) ? data : data['@graph'] || [data];
      for (const item of items) {
        if (item && (item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product')))) {
          if (item.name) title = item.name;
          if (item.image) imageUrl = Array.isArray(item.image) ? item.image[0] : item.image;
          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            const p = offer?.price ?? offer?.lowPrice;
            if (p) {
              const parsed = parseInt(String(p).replace(/[^0-9]/g, ''), 10);
              if (parsed > 0) price = parsed;
            }
          }
          break;
        }
      }
      if (price) break;
    }
  } catch {}

  // 1b. Check Ajio preloaded state or Myntra window objects
  try {
    if (typeof window !== 'undefined') {
      if (window.__myx && window.__myx.pdpData) {
        const pdp = window.__myx.pdpData;
        const p = pdp.price?.discounted || pdp.price?.mrp;
        if (p && parseInt(p, 10) > 0) price = parseInt(p, 10);
        if (pdp.name) title = `${pdp.brand?.name ? pdp.brand.name + ' ' : ''}${pdp.name}`;
        if (pdp.media?.albums?.[0]?.images?.[0]?.src) {
          imageUrl = pdp.media.albums[0].images[0].src;
        }
      }
      if (window.__PRELOADED_STATE__ && window.__PRELOADED_STATE__.product) {
        const pdp = window.__PRELOADED_STATE__.product.productDetails;
        if (pdp) {
          const p = pdp.price?.value ?? pdp.price?.discountedPrice ?? pdp.price?.mrp;
          if (p && parseInt(p, 10) > 0) price = parseInt(p, 10);
          if (pdp.name) title = `${pdp.brandName ? pdp.brandName + ' ' : ''}${pdp.name}`;
          if (pdp.images?.[0]?.url) imageUrl = pdp.images[0].url;
        }
      }
    }
  } catch {}

  // 2. Store specific DOM selectors
  if (!price) {
    const selectors = [
      // Amazon
      '.apexPriceToPay .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price-whole',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      // Flipkart
      'div.Nx9bqj.CxhGGd',
      'div._30jeq3._16Jk6d',
      'div.Nx9bqj',
      'div._30jeq3',
      // Myntra
      'span.pdp-price strong',
      'span.pdp-price',
      'div.pdp-price-info span.pdp-price',
      '[data-testid="pdp-price"]',
      '.pdp-offers-price',
      'span.pdp-mrp',
      // Ajio
      'span.prod-sp',
      'div.prod-price-section span.prod-sp',
      'span.price-value',
      'div.discounted-price',
      'span.fnl-price',
      '[data-testid="pdp-sp"]',
      // Meesho
      'h4[class*="Text__StyledText"]',
      // Westside
      '.price__regular .price-item--regular',
      'span.price-item--sale',
      '.product-price',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        const cleaned = el.textContent.replace(/[^0-9]/g, '');
        const val = parseInt(cleaned, 10);
        if (val > 0) {
          price = val;
          break;
        }
      }
    }
  }

  // 3. Fallback Titles & Images
  const titleEl = document.querySelector(
    '#productTitle, h1.pdp-title, h1.pdp-name, h1.prod-title, span.B_NuCI, h1'
  );
  if (titleEl && titleEl.textContent) {
    title = titleEl.textContent.trim();
  }

  const imgEl = document.querySelector(
    '#landingImage, img.q6DClP, img.prod-main-img, img.image-grid-image, img[class*="product-image"]'
  );
  if (imgEl && imgEl.src) {
    imageUrl = imgEl.src;
  }

  return { price, title, imageUrl };
}

// Load active tab URL and extract DOM
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const storeBadge = document.getElementById('store-badge');
  const detectedDiv = document.getElementById('detected-info');

  if (tabs && tabs[0] && tabs[0].url) {
    currentUrl = tabs[0].url;
    document.getElementById('url-box').innerText = currentUrl;

    const detected = detectStore(currentUrl);
    if (detected) {
      storeBadge.innerText = `✓ ${detected}`;
      storeBadge.className = 'badge detected';

      // Execute extraction on the active tab
      if (chrome.scripting && tabs[0].id) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: extractProductFromPage,
          },
          (results) => {
            if (results && results[0] && results[0].result) {
              extractedInfo = results[0].result;
              if (extractedInfo.price) {
                detectedDiv.style.display = 'block';
                const shortTitle = extractedInfo.title ? extractedInfo.title.slice(0, 38) + '...' : '';
                detectedDiv.innerHTML = `✨ <strong>Live Tab Detected:</strong> ₹${extractedInfo.price.toLocaleString('en-IN')}<br/><span style="color:#94a3b8;">${shortTitle}</span>`;
                // Suggest target price if empty
                const targetInput = document.getElementById('targetPrice');
                if (!targetInput.value) {
                  const suggested = Math.floor(extractedInfo.price * 0.9);
                  targetInput.placeholder = `e.g. ₹${suggested.toLocaleString('en-IN')} (10% drop)`;
                }
              }
            }
          }
        );
      }
    } else {
      storeBadge.innerText = 'Unsupported Store';
      storeBadge.className = 'badge';
    }
  } else {
    document.getElementById('url-box').innerText = 'No active tab URL detected';
    storeBadge.innerText = 'No Tab';
  }
});

// Load saved tracker URL if any
const savedAppUrl = localStorage.getItem('pw_ext_app_url');
if (savedAppUrl) {
  document.getElementById('appUrl').value = savedAppUrl;
}

document.getElementById('trackBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const trackBtn = document.getElementById('trackBtn');
  const targetPrice = document.getElementById('targetPrice').value;
  const appUrl = document.getElementById('appUrl').value.replace(/\/+$/, '');

  localStorage.setItem('pw_ext_app_url', appUrl);

  if (!currentUrl || !currentUrl.startsWith('http')) {
    showStatus('Please navigate to an Amazon, Flipkart, Myntra, Ajio, Meesho, or Westside product page.', 'error');
    return;
  }

  trackBtn.disabled = true;
  trackBtn.innerText = 'Extracting & Tracking...';
  statusDiv.style.display = 'none';

  try {
    const payload = {
      url: currentUrl,
      targetPrice: targetPrice ? Number(targetPrice) : null,
    };

    if (extractedInfo && extractedInfo.price) {
      payload.clientPrice = extractedInfo.price;
      payload.clientTitle = extractedInfo.title;
      payload.clientImageUrl = extractedInfo.imageUrl;
    }

    const res = await fetch(`${appUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to track product');
    }

    const title = data.product?.title ? data.product.title.slice(0, 32) + '...' : 'Product';
    const price = data.product?.current_price ? `₹${data.product.current_price.toLocaleString('en-IN')}` : '';
    showStatus(`✅ Tracking "${title}" ${price ? `at ${price}` : ''}!`, 'success');
    trackBtn.innerText = '✓ Tracked!';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showStatus(msg || 'Error connecting to tracker API', 'error');
    trackBtn.disabled = false;
    trackBtn.innerText = '🚀 Track This Product';
  }
});

document.getElementById('openDashboard').addEventListener('click', () => {
  const appUrl = document.getElementById('appUrl').value.replace(/\/+$/, '');
  chrome.tabs.create({ url: `${appUrl}/dashboard` });
});

function showStatus(text, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.className = type;
  statusDiv.innerText = text;
  statusDiv.style.display = 'block';
}

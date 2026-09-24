let currentUrl = '';

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

// Load active tab URL
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const storeBadge = document.getElementById('store-badge');
  if (tabs && tabs[0] && tabs[0].url) {
    currentUrl = tabs[0].url;
    document.getElementById('url-box').innerText = currentUrl;

    const detected = detectStore(currentUrl);
    if (detected) {
      storeBadge.innerText = `✓ ${detected}`;
      storeBadge.className = 'badge detected';
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
    const res = await fetch(`${appUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: currentUrl,
        targetPrice: targetPrice ? Number(targetPrice) : null,
      }),
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

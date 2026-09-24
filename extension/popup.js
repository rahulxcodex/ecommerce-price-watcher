let currentUrl = '';

// Load active tab URL
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  if (tabs && tabs[0] && tabs[0].url) {
    currentUrl = tabs[0].url;
    document.getElementById('url-box').innerText = currentUrl;
  } else {
    document.getElementById('url-box').innerText = 'No active tab URL detected';
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
    showStatus('Please navigate to an Amazon, Flipkart, Myntra, Ajio, or Westside product page.', 'error');
    return;
  }

  trackBtn.disabled = true;
  trackBtn.innerText = 'Extracting & Tracking...';
  statusDiv.style.display = 'none';

  try {
    const res = await fetch(`${appUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: currentUrl,
        targetPrice: targetPrice ? Number(targetPrice) : null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to track product');
    }

    showStatus(`✅ Tracking "${data.product.title.slice(0, 35)}..." at ₹${data.product.current_price}!`, 'success');
    trackBtn.innerText = '✓ Tracked!';
  } catch (err) {
    showStatus(err.message || 'Error connecting to tracker API', 'error');
    trackBtn.disabled = false;
    trackBtn.innerText = '🚀 Track This Product';
  }
});

function showStatus(text, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.className = type;
  statusDiv.innerText = text;
  statusDiv.style.display = 'block';
}

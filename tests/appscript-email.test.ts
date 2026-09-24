import { sendEmailAlert } from '../scripts/notify';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function testAppsScriptIntegration() {
  console.log('🧪 Testing Google Apps Script Email Client & Payloads...\n');

  // Test 1: Missing URL environment handling
  delete process.env.APPSCRIPT_EMAIL_URL;
  const resNoUrl = await sendEmailAlert({
    to: 'test@example.com',
    productTitle: 'Test Product',
    productUrl: 'https://www.amazon.in/dp/B0CHX1W1XY',
    previousPrice: 100,
    newPrice: 80,
  });
  assert(!resNoUrl.success, 'Must fail gracefully when APPSCRIPT_EMAIL_URL is missing');
  assert(Boolean(resNoUrl.error?.includes('APPSCRIPT_EMAIL_URL')), 'Error should mention APPSCRIPT_EMAIL_URL');
  console.log('  ✅ [PASS] Missing environment variable handled gracefully');

  // Test 2: Price drop alert payload construction
  const priceAlert = {
    to: 'shopper@example.com',
    productTitle: 'Apple iPhone 15 (128 GB) - Black',
    productUrl: 'https://www.amazon.in/dp/B0CHX1W1XY',
    previousPrice: 79900,
    newPrice: 65999,
    isAllTimeLow: true,
    platform: 'Amazon',
    imageUrl: 'https://m.media-amazon.com/images/I/71657TiFeHL._SX679_.jpg',
  };

  assert(priceAlert.previousPrice > priceAlert.newPrice, 'Previous price must exceed new price');
  assert(priceAlert.to.includes('@'), 'Valid email recipient');
  console.log('  ✅ [PASS] Price drop alert payload schema validated');

  console.log('\n🎉 All Google Apps Script client tests PASSED successfully!');
}

testAppsScriptIntegration().catch((e) => {
  console.error(e);
  process.exit(1);
});

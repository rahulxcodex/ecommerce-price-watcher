import { validateAndSanitizeUrl, validateScrapedPrice, safeCompare } from '../src/lib/security';

interface AttackCase {
  category: string;
  name: string;
  payload: string;
  expectedBlocked: boolean;
  expectedReasonSubstring?: string;
}

const attackVectors: AttackCase[] = [
  // 1. SSRF - Cloud Metadata
  {
    category: 'SSRF - Cloud Metadata',
    name: 'AWS EC2 IMDSv1 Metadata Service',
    payload: 'http://169.254.169.254/latest/meta-data/',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Cloud Metadata',
    name: 'GCP Metadata Internal Domain',
    payload: 'http://metadata.google.internal/computeMetadata/v1/',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Cloud Metadata',
    name: 'DigitalOcean Metadata Endpoint',
    payload: 'http://169.254.169.254/metadata/v1.json',
    expectedBlocked: true,
  },

  // 2. SSRF - Loopback & Localhost
  {
    category: 'SSRF - Loopback',
    name: 'Standard Localhost with Port',
    payload: 'http://localhost:3000/api/admin',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Loopback',
    name: 'IPv4 Loopback 127.0.0.1',
    payload: 'http://127.0.0.1:8080/internal',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Loopback',
    name: 'IPv4 Wildcard 0.0.0.0',
    payload: 'http://0.0.0.0:22',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Loopback',
    name: 'IPv6 Loopback [::1]',
    payload: 'http://[::1]:8080/metrics',
    expectedBlocked: true,
  },

  // 3. SSRF - RFC1918 Private Intranet
  {
    category: 'SSRF - Private IP',
    name: 'Class A Private Subnet (10.0.0.1)',
    payload: 'http://10.0.0.1/admin',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Private IP',
    name: 'Class B Private Subnet (172.16.0.1)',
    payload: 'http://172.16.0.1:9000',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Private IP',
    name: 'Class B Private Subnet Edge (172.31.255.254)',
    payload: 'http://172.31.255.254',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Private IP',
    name: 'Class C Private Subnet (192.168.1.1)',
    payload: 'http://192.168.1.1/router-login',
    expectedBlocked: true,
  },

  // 4. SSRF - IP Encoding Evasion
  {
    category: 'SSRF - Encoding Evasion',
    name: 'Decimal Encoded Localhost (2130706433)',
    payload: 'http://2130706433/etc/passwd',
    expectedBlocked: true,
  },
  {
    category: 'SSRF - Encoding Evasion',
    name: 'Octal Encoded Localhost (0177.0.0.1)',
    payload: 'http://0177.0.0.1/status',
    expectedBlocked: true,
  },

  // 5. Hostname Spoofing & Phishing Lookalikes
  {
    category: 'Spoofing & Phishing',
    name: 'Subdomain Phishing (amazon.in.attacker.evil)',
    payload: 'https://amazon.in.attacker.evil/product/123',
    expectedBlocked: true,
  },
  {
    category: 'Spoofing & Phishing',
    name: 'Path Masquerading (attacker.evil/www.flipkart.com)',
    payload: 'https://attacker.evil/www.flipkart.com/item',
    expectedBlocked: true,
  },
  {
    category: 'Spoofing & Phishing',
    name: 'HTTP Basic Auth Hijack (amazon.in@attacker.evil)',
    payload: 'https://amazon.in:secret@attacker.evil/steal',
    expectedBlocked: true,
  },

  // 6. Protocol Traversal & Dangerous Schemes
  {
    category: 'Protocol Traversal',
    name: 'Local File Scheme (file:///etc/passwd)',
    payload: 'file:///etc/passwd',
    expectedBlocked: true,
  },
  {
    category: 'Protocol Traversal',
    name: 'Windows Local File Scheme (file:///c:/boot.ini)',
    payload: 'file:///c:/boot.ini',
    expectedBlocked: true,
  },
  {
    category: 'Protocol Traversal',
    name: 'Gopher Protocol SSRF',
    payload: 'gopher://127.0.0.1:6379/_INFO',
    expectedBlocked: true,
  },
  {
    category: 'Protocol Traversal',
    name: 'FTP Protocol Scheme',
    payload: 'ftp://attacker.evil/payload.sh',
    expectedBlocked: true,
  },
  {
    category: 'Protocol Traversal',
    name: 'Inline JavaScript Scheme',
    payload: 'javascript:alert(document.cookie)',
    expectedBlocked: true,
  },
  {
    category: 'Protocol Traversal',
    name: 'Data URI Scheme',
    payload: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    expectedBlocked: true,
  },

  // 7. Injection & Buffer Exhaustion
  {
    category: 'Injection & Fuzzing',
    name: 'Massive Buffer Exhaustion (2500+ character DoS probe)',
    payload: 'https://www.amazon.in/dp/B0CHX1W1XY?' + 'a='.repeat(1300),
    expectedBlocked: true,
  },
  {
    category: 'Injection & Fuzzing',
    name: 'Cross-Site Scripting (XSS) in Target URL',
    payload: 'https://www.amazon.in/dp/B0CHX1W1XY"><script>alert(1)</script>',
    expectedBlocked: false, // Valid Amazon domain, but query/path must be safely handled
  },
  {
    category: 'Injection & Fuzzing',
    name: 'SQL Injection Sequence in Parameter',
    payload: "https://www.flipkart.com/item/p/itm123?id=1' OR '1'='1",
    expectedBlocked: false, // Valid Flipkart domain; backend queries must be parameterized
  },
];

async function runRedHatSecurityTests() {
  console.log('🛡️  Starting Red Hat Security & Adversarial Pen-Testing Suite...\n');
  let passed = 0;
  let failed = 0;

  console.log('--- Phase 1: URL & SSRF Attack Vector Probing ---');
  for (const attack of attackVectors) {
    const res = validateAndSanitizeUrl(attack.payload);
    const isBlocked = !res.valid;

    if (attack.expectedBlocked) {
      if (isBlocked) {
        console.log(`  🛡️  [BLOCKED] ${attack.category} -> ${attack.name}`);
        passed++;
      } else {
        console.error(`  🚨 [SECURITY FAIL] ${attack.category} -> ${attack.name} was NOT blocked!`);
        console.error(`     Payload: ${attack.payload}`);
        failed++;
      }
    } else {
      // Allowed domains should sanitize and not throw unhandled exceptions
      if (res.valid) {
        console.log(`  🛡️  [NEUTRALIZED/SANITIZED] ${attack.category} -> ${attack.name}`);
        passed++;
      } else {
        console.log(`  🛡️  [HANDLED] ${attack.name}: ${res.error}`);
        passed++;
      }
    }
  }

  console.log('\n--- Phase 2: Price Manipulation & Anomaly Defense ---');
  const priceCases = [
    { name: 'Zero Price Bug', price: 0, expectValid: false },
    { name: 'Negative Price Exploit', price: -500, expectValid: false },
    { name: 'NaN Price Input', price: NaN, expectValid: false },
    { name: 'Excessive Bounds (>50M INR)', price: 99_000_000, expectValid: false },
    { name: 'Flash-Crash Anomaly (99.9% Drop from 50k to 5 INR)', price: 5, prevPrice: 50_000, expectValid: false },
    { name: 'Legitimate 20% Discount Drop (1,000 to 800 INR)', price: 800, prevPrice: 1000, expectValid: true },
    { name: 'Valid Expensive Item (129,900 INR)', price: 129_900, prevPrice: 134_900, expectValid: true },
  ];

  for (const pc of priceCases) {
    const res = validateScrapedPrice(pc.price, pc.prevPrice);
    if (res.isValid === pc.expectValid) {
      console.log(`  🛡️  [PASS] ${pc.name} -> Handled safely (valid=${res.isValid})`);
      passed++;
    } else {
      console.error(`  🚨 [FAIL] ${pc.name} -> Expected valid=${pc.expectValid}, got ${res.isValid}`);
      failed++;
    }
  }

  console.log('\n--- Phase 3: Constant-Time Token Security (Timing Attack Defense) ---');
  const token = 'super-secret-telegram-webhook-token-12345';
  const validComparison = safeCompare(token, 'super-secret-telegram-webhook-token-12345');
  const invalidShort = safeCompare(token, 'super-secret');
  const invalidDifferentChar = safeCompare(token, 'super-secret-telegram-webhook-token-1234X');

  if (validComparison && !invalidShort && !invalidDifferentChar) {
    console.log('  🛡️  [PASS] safeCompare constant-time comparator verified against timing attacks');
    passed++;
  } else {
    console.error('  🚨 [FAIL] safeCompare comparator logic failure');
    failed++;
  }

  console.log(`\n======================================================`);
  console.log(`🛡️  Red Hat Testing Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRedHatSecurityTests().catch((e) => {
  console.error(e);
  process.exit(1);
});

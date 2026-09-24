import {
  hashPin,
  verifyPin,
  generateSalt,
  isCombinedAccount,
  createSessionToken,
  verifySessionToken,
} from '../src/lib/auth';
import {
  createUser,
  authenticateByPin,
  isPinTaken,
} from '../src/lib/auth-db';

async function runAuthTests() {
  console.log('🧪 Starting PIN Authentication & Combined Access Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Test 1: PIN Hashing & Constant-time Verification
  console.log('1. Testing PIN Hashing & Verification');
  const salt = generateSalt();
  const pin = '4892';
  const hash = hashPin(pin, salt);
  assert(verifyPin('4892', salt, hash) === true, 'Matching 4-digit PIN returns true');
  assert(verifyPin('1234', salt, hash) === false, 'Wrong 4-digit PIN returns false');
  assert(verifyPin('489', salt, hash) === false, 'Incomplete 3-digit PIN returns false');

  // Test 2: Combined Access Identification
  console.log('\n2. Testing Combined Access Account Identification');
  assert(isCombinedAccount('Rahul') === true, 'Exact "Rahul" is combined');
  assert(isCombinedAccount('rahul') === true, 'Lowercase "rahul" is combined');
  assert(isCombinedAccount('Rahul Gupta') === true, '"Rahul Gupta" is combined');
  assert(isCombinedAccount('Nishaa') === true, 'Exact "Nishaa" is combined');
  assert(isCombinedAccount('Nisha') === true, '"Nisha" is combined');
  assert(isCombinedAccount('nishaa') === true, 'Lowercase "nishaa" is combined');
  assert(isCombinedAccount('me') === true, '"me" is combined');
  assert(isCombinedAccount('John Doe') === false, '"John Doe" is regular account');
  assert(isCombinedAccount('Guest') === false, '"Guest" is regular account');

  // Test 3: Session Token Signing & Tamper Verification
  console.log('\n3. Testing Session Token Signing (Stateless / No Local Session)');
  const dummyUser = {
    id: 'user_test_1',
    name: 'Rahul',
    isCombined: true,
    role: 'combined' as const,
  };
  const token = createSessionToken(dummyUser);
  assert(typeof token === 'string' && token.includes('.'), 'Session token generated in <payload>.<sig> format');

  const verified = verifySessionToken(token);
  assert(verified !== null && verified.name === 'Rahul', 'Session token decodes correctly');
  assert(verified !== null && verified.isCombined === true, 'Session token preserves combined access flag');

  // Tampering test: change 1 character of signature
  const tampered = token.slice(0, -3) + 'xyz';
  assert(verifySessionToken(tampered) === null, 'Tampered session token signature rejected');

  // Test 4: User Signup and PIN-Only Signin
  console.log('\n4. Testing Signup and PIN-Only Signin');
  const rahulPin = '7711';
  const nishaaPin = '8822';
  const regularPin = '3344';

  const userRahul = await createUser({ name: 'Rahul', pin: rahulPin });
  assert(userRahul.isCombined === true, 'Rahul receives isCombined = true on signup');
  assert(userRahul.role === 'combined', 'Rahul receives role = "combined" on signup');

  const userNishaa = await createUser({ name: 'Nishaa', pin: nishaaPin });
  assert(userNishaa.isCombined === true, 'Nishaa receives isCombined = true on signup');
  assert(userNishaa.role === 'combined', 'Nishaa receives role = "combined" on signup');

  const userRegular = await createUser({ name: 'Bob', pin: regularPin });
  assert(userRegular.isCombined === false, 'Bob receives isCombined = false on signup');
  assert(userRegular.role === 'user', 'Bob receives role = "user" on signup');

  // Test 5: Sign in with ONLY PIN
  console.log('\n5. Testing Signin with ONLY PIN');
  const authRahul = await authenticateByPin(rahulPin);
  assert(authRahul !== null && authRahul.name === 'Rahul', 'Signing in with PIN 7711 returns Rahul');

  const authNishaa = await authenticateByPin(nishaaPin);
  assert(authNishaa !== null && authNishaa.name === 'Nishaa', 'Signing in with PIN 8822 returns Nishaa');

  const authRegular = await authenticateByPin(regularPin);
  assert(authRegular !== null && authRegular.name === 'Bob', 'Signing in with PIN 3344 returns Bob');

  const authInvalid = await authenticateByPin('0000');
  assert(authInvalid === null, 'Signing in with unassigned PIN 0000 returns null');

  // Test 6: Duplicate PIN Protection
  console.log('\n6. Testing Duplicate PIN Prevention');
  assert(await isPinTaken(rahulPin) === true, 'Existing PIN is correctly identified as taken');
  assert(await isPinTaken('9988') === false, 'Unregistered PIN is available');

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

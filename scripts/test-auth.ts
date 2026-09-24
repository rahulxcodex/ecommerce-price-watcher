// Ensure test environment has a secret configured
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-key-32-chars-long-minimum';

import {
  hashPin,
  verifyPin,
  generateSalt,
  isCombinedAccount,
  resolveUserRole,
  createSessionToken,
  verifySessionToken,
} from '../src/lib/auth';
import {
  createUser,
  authenticateByEmailAndPin,
  authenticateByPin,
  isEmailTaken,
  isPinTaken,
} from '../src/lib/auth-db';

async function runAuthTests() {
  console.log('🧪 Starting Email + PIN Authentication & Combined Access Test Suite...\n');

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

  // Test 1: PIN Hashing & Verification
  console.log('1. Testing PIN Hashing and Constant-time Verification');
  const salt = generateSalt();
  const pin = '4321';
  const hashed = hashPin(pin, salt);
  assert(hashed.length === 64, 'Hashed PIN is a 64-char hex string (SHA-256)');
  assert(verifyPin(pin, salt, hashed) === true, 'Valid PIN verifies successfully');
  assert(verifyPin('9999', salt, hashed) === false, 'Invalid PIN verification is rejected');

  // Test 2: Combined Account Rules
  console.log('\n2. Testing Special Combined Access Email Rules');
  assert(isCombinedAccount('Rahul') === false, 'Name "Rahul" without qualifying email does NOT trigger combined access');
  assert(isCombinedAccount('Rahul Gupta') === false, 'Name "Rahul Gupta" does NOT trigger combined access');
  assert(isCombinedAccount('Nishaa') === false, 'Name "Nishaa" does NOT trigger combined access');
  assert(isCombinedAccount('Nisha') === false, 'Name "Nisha" does NOT trigger combined access');
  assert(isCombinedAccount('me') === false, 'Name "me" does NOT trigger combined access');
  assert(isCombinedAccount('Random User') === false, 'Other users do not trigger combined access');
  assert(isCombinedAccount('rahul@other.com') === false, 'Other email does not trigger combined access');
  assert(isCombinedAccount('nishaa@price.watch') === false, 'Nisha email does not trigger combined access');
  assert(isCombinedAccount('rahulr24g@gmail.com') === true, 'Strict email rahulr24g@gmail.com triggers combined access');
  assert(isCombinedAccount('Rahul', 'rahulr24g@gmail.com') === true, 'Rahul with rahulr24g@gmail.com triggers combined access');
  assert(isCombinedAccount('RAHULR24G@GMAIL.COM') === true, 'Case-insensitive rahulr24g@gmail.com triggers combined access');

  // Test 3: Session Tokens (Creation & Timing-Safe Verification)
  console.log('\n3. Testing Session Token Minting & Verification');
  const mockUser = {
    id: 'user_test_uuid_123',
    name: 'Rahul',
    email: 'rahulr24g@gmail.com',
    isCombined: true,
    role: 'combined' as const,
  };
  const token = createSessionToken(mockUser);
  assert(typeof token === 'string' && token.includes('.'), 'Session token is dot-delimited HMAC string');

  const verified = verifySessionToken(token);
  assert(verified !== null, 'Session token parses and verifies cleanly');
  assert(verified?.userId === 'user_test_uuid_123', 'Verified payload has matching userId');
  assert(verified?.name === 'Rahul', 'Verified payload has matching name');
  assert(verified?.email === 'rahulr24g@gmail.com', 'Verified payload has matching email');
  assert(verified?.isCombined === true, 'Verified payload has isCombined = true');

  // Test 4: User Signup and Email + PIN Signin
  console.log('\n4. Testing Signup and Email + PIN Signin');
  const rahulPin = '7711';
  const nishaaPin = '8822';
  const regularPin = '3344';

  const userRahulCombined = await createUser({ name: 'Rahul', email: 'rahulr24g@gmail.com', pin: rahulPin });
  assert(userRahulCombined.isCombined === true, 'rahulr24g@gmail.com receives isCombined = true on signup');
  assert(userRahulCombined.role === 'combined', 'rahulr24g@gmail.com receives role = "combined" on signup');

  const userNishaa = await createUser({ name: 'Nishaa', email: 'nishaa@price.watch', pin: nishaaPin });
  assert(userNishaa.isCombined === false, 'Nishaa receives isCombined = false on signup');
  assert(userNishaa.role === 'user', 'Nishaa receives role = "user" on signup');

  const userRegular = await createUser({ name: 'Bob', email: 'bob@price.watch', pin: regularPin });
  assert(userRegular.isCombined === false, 'Bob receives isCombined = false on signup');
  assert(userRegular.role === 'user', 'Bob receives role = "user" on signup');

  // Test 5: Sign in with Email and PIN
  console.log('\n5. Testing Signin with Email and PIN');
  const authRahulCombined = await authenticateByEmailAndPin('rahulr24g@gmail.com', rahulPin);
  assert(authRahulCombined.user !== null && authRahulCombined.user.name === 'Rahul', 'Signing in with rahulr24g@gmail.com + 7711 returns Rahul');
  assert(authRahulCombined.user?.isCombined === true, 'rahulr24g@gmail.com user session has isCombined = true');

  const authRahulLegacy = await authenticateByEmailAndPin('rahul@price.watch', rahulPin);
  assert(authRahulLegacy.user !== null && authRahulLegacy.user.name === 'Rahul', 'Signing in with rahul@price.watch + 7711 returns Rahul');
  assert(authRahulLegacy.user?.isCombined === false, 'Legacy Rahul account has isCombined = false');

  const authNishaa = await authenticateByEmailAndPin('nishaa@price.watch', nishaaPin);
  assert(authNishaa.user !== null && authNishaa.user.name === 'Nishaa', 'Signing in with nishaa@price.watch + 8822 returns Nishaa');
  assert(authNishaa.user?.isCombined === false, 'Nishaa user session has isCombined = false');

  const authRegular = await authenticateByEmailAndPin('bob@price.watch', regularPin);
  assert(authRegular.user !== null && authRegular.user.name === 'Bob', 'Signing in with bob@price.watch + 3344 returns Bob');
  assert(authRegular.user?.isCombined === false, 'Bob user session has isCombined = false');

  const authWrongPin = await authenticateByEmailAndPin('rahul@price.watch', '0000');
  assert(authWrongPin.user === null && Boolean(authWrongPin.error), 'Signing in with incorrect PIN returns error');

  const authUnknownEmail = await authenticateByEmailAndPin('unknown@price.watch', '1234');
  assert(authUnknownEmail.user === null && Boolean(authUnknownEmail.error), 'Signing in with unregistered email returns error');

  // Test 6: Duplicate Email Prevention
  console.log('\n6. Testing Duplicate Email Detection');
  assert(await isEmailTaken('rahulr24g@gmail.com') === true, 'Existing email rahulr24g@gmail.com is correctly identified as taken');
  assert(await isEmailTaken('RAHULR24G@GMAIL.COM') === true, 'Case-insensitive email is correctly identified as taken');
  assert(await isEmailTaken('newuser@price.watch') === false, 'Unregistered email is available');

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

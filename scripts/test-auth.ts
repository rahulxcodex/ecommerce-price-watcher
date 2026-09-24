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
  console.log('\n2. Testing Special Combined Access Name Matching');
  assert(isCombinedAccount('Rahul') === true, 'Name "Rahul" triggers combined access');
  assert(isCombinedAccount('Rahul Gupta') === true, 'Name "Rahul Gupta" triggers combined access');
  assert(isCombinedAccount('Nishaa') === true, 'Name "Nishaa" triggers combined access');
  assert(isCombinedAccount('Nisha') === true, 'Name "Nisha" triggers combined access');
  assert(isCombinedAccount('me') === true, 'Name "me" triggers combined access');
  assert(isCombinedAccount('Random User') === false, 'Other users do not trigger combined access');

  // Test 3: Session Tokens (Creation & Timing-Safe Verification)
  console.log('\n3. Testing Session Token Minting & Verification');
  const mockUser = {
    id: 'user_test_uuid_123',
    name: 'Rahul',
    email: 'rahul@test.com',
    isCombined: true,
    role: 'combined' as const,
  };
  const token = createSessionToken(mockUser);
  assert(typeof token === 'string' && token.includes('.'), 'Session token is dot-delimited HMAC string');

  const verified = verifySessionToken(token);
  assert(verified !== null, 'Session token parses and verifies cleanly');
  assert(verified?.userId === 'user_test_uuid_123', 'Verified payload has matching userId');
  assert(verified?.name === 'Rahul', 'Verified payload has matching name');
  assert(verified?.email === 'rahul@test.com', 'Verified payload has matching email');
  assert(verified?.isCombined === true, 'Verified payload has isCombined = true');

  // Test 4: User Signup and Email + PIN Signin
  console.log('\n4. Testing Signup and Email + PIN Signin');
  const rahulPin = '7711';
  const nishaaPin = '8822';
  const regularPin = '3344';

  const userRahul = await createUser({ name: 'Rahul', email: 'rahul@price.watch', pin: rahulPin });
  assert(userRahul.isCombined === true, 'Rahul receives isCombined = true on signup');
  assert(userRahul.role === 'combined', 'Rahul receives role = "combined" on signup');

  const userNishaa = await createUser({ name: 'Nishaa', email: 'nishaa@price.watch', pin: nishaaPin });
  assert(userNishaa.isCombined === true, 'Nishaa receives isCombined = true on signup');
  assert(userNishaa.role === 'combined', 'Nishaa receives role = "combined" on signup');

  const userRegular = await createUser({ name: 'Bob', email: 'bob@price.watch', pin: regularPin });
  assert(userRegular.isCombined === false, 'Bob receives isCombined = false on signup');
  assert(userRegular.role === 'user', 'Bob receives role = "user" on signup');

  // Test 5: Sign in with Email and PIN
  console.log('\n5. Testing Signin with Email and PIN');
  const authRahul = await authenticateByEmailAndPin('rahul@price.watch', rahulPin);
  assert(authRahul.user !== null && authRahul.user.name === 'Rahul', 'Signing in with rahul@price.watch + 7711 returns Rahul');

  const authNishaa = await authenticateByEmailAndPin('nishaa@price.watch', nishaaPin);
  assert(authNishaa.user !== null && authNishaa.user.name === 'Nishaa', 'Signing in with nishaa@price.watch + 8822 returns Nishaa');

  const authRegular = await authenticateByEmailAndPin('bob@price.watch', regularPin);
  assert(authRegular.user !== null && authRegular.user.name === 'Bob', 'Signing in with bob@price.watch + 3344 returns Bob');

  const authWrongPin = await authenticateByEmailAndPin('rahul@price.watch', '0000');
  assert(authWrongPin.user === null && Boolean(authWrongPin.error), 'Signing in with incorrect PIN returns error');

  const authUnknownEmail = await authenticateByEmailAndPin('unknown@price.watch', '1234');
  assert(authUnknownEmail.user === null && Boolean(authUnknownEmail.error), 'Signing in with unregistered email returns error');

  // Test 6: Duplicate Email Prevention
  console.log('\n6. Testing Duplicate Email Detection');
  assert(await isEmailTaken('rahul@price.watch') === true, 'Existing email is correctly identified as taken');
  assert(await isEmailTaken('RAHUL@PRICE.WATCH') === true, 'Case-insensitive email is correctly identified as taken');
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

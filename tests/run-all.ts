import { spawnSync } from 'child_process';
import path from 'path';

const testSuites = [
  'tests/security-and-utils.test.ts',
  'tests/red-hat-security.test.ts',
  'tests/dsa-and-prediction.test.ts',
  'tests/ecommerce-urls.test.ts',
  'tests/discovery-and-smart-filtering.test.ts',
  'tests/hardening-audit.test.ts',
  'tests/production-hardening.test.ts',
];

console.log('🚀 Running Complete Automated Test Suite Orchestrator...\n');
let failedSuites = 0;

for (const suite of testSuites) {
  console.log(`▶️ Executing [${suite}]...`);
  const result = spawnSync('npx', ['tsx', `"${suite}"`], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`❌ Suite failed: ${suite} (exit code: ${result.status})`);
    failedSuites++;
  } else {
    console.log(`✔️ Completed: ${suite}\n`);
  }
}

if (failedSuites > 0) {
  console.error(`\n💥 Automated Test Run Failed: ${failedSuites} of ${testSuites.length} suites failed.`);
  process.exit(1);
} else {
  console.log(`\n🎉 ALL ${testSuites.length} TEST SUITES PASSED CLEANLY! Ready for production deployment.`);
  process.exit(0);
}

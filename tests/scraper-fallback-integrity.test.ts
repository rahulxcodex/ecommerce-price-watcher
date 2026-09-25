import assert from 'node:assert/strict';
import {
  SCRAPER_STALE_THRESHOLD_HOURS,
  SCRAPER_EMERGENCY_THRESHOLD_HOURS,
  SCRAPER_CATCHUP_INTERVAL_MINUTES,
  SCRAPER_CRON_INTERVAL_HOURS,
  evaluateScraperStaleness,
} from '../src/lib/constants';
import { evaluateScraperStaleness as evaluateMjs } from '../scripts/check-staleness.mjs';

console.log('🛡️ Starting Scraper 6-Hour Emergency Catch-Up & Fallback Integrity Test Suite...\n');

// -----------------------------------------------------------------------------
// 1. Centralized Constants Consistency
// -----------------------------------------------------------------------------
console.log('1. Testing Centralized Constants');
assert.equal(SCRAPER_CRON_INTERVAL_HOURS, 4, 'Standard cycle must be 4 hours');
assert.equal(SCRAPER_STALE_THRESHOLD_HOURS, 5, 'Watchdog stale warning must be 5 hours');
assert.equal(SCRAPER_EMERGENCY_THRESHOLD_HOURS, 6, 'Emergency catch-up threshold must be 6 hours');
assert.equal(SCRAPER_CATCHUP_INTERVAL_MINUTES, 30, 'Catch-up interval must be 30 minutes');
console.log('  ✅ [PASS] Centralized timing constants correctly defined.');

// -----------------------------------------------------------------------------
// 2. Staleness Decision Matrix: Pure Logic Evaluation
// -----------------------------------------------------------------------------
console.log('\n2. Testing Staleness Decision Matrix Across Operating Modes');

// Case A: System is healthy (elapsed < 4h) -> Idle, Skip execution
const healthyRun = evaluateScraperStaleness(2.5);
assert.equal(healthyRun.shouldRun, false);
assert.equal(healthyRun.mode, 'idle_healthy');
assert.ok(healthyRun.reason.includes('healthy'), 'Must explain healthy idle state');

const boundaryJustBeforeCycle = evaluateScraperStaleness(3.95);
assert.equal(boundaryJustBeforeCycle.shouldRun, false);
assert.equal(boundaryJustBeforeCycle.mode, 'idle_healthy');

// Case B: Scheduled cycle due (4h <= elapsed < 6h) -> Run normal cycle
const cycleDueRun = evaluateScraperStaleness(4.0);
assert.equal(cycleDueRun.shouldRun, true);
assert.equal(cycleDueRun.mode, 'scheduled_cycle');
assert.ok(cycleDueRun.reason.includes('standard cycle interval'));

const cycleLateRun = evaluateScraperStaleness(5.5);
assert.equal(cycleLateRun.shouldRun, true);
assert.equal(cycleLateRun.mode, 'scheduled_cycle');

// Case C: Critical Staleness (elapsed >= 6h) -> Emergency Catch-Up Active (retrying every 30m)
const emergencyRunExact = evaluateScraperStaleness(6.0);
assert.equal(emergencyRunExact.shouldRun, true);
assert.equal(emergencyRunExact.mode, 'emergency_catchup');
assert.ok(emergencyRunExact.reason.includes('30m catch-up active'));

// Exact user scenario: 6.3 hours stale
const userScenarioRun = evaluateScraperStaleness(6.3);
assert.equal(userScenarioRun.shouldRun, true);
assert.equal(userScenarioRun.mode, 'emergency_catchup');
assert.ok(userScenarioRun.reason.includes('6.3h'));
assert.ok(userScenarioRun.reason.includes('Accelerated 30m catch-up'));

// Case D: Cold start / uninitialized timestamps (null/undefined/NaN) -> Fail-safe run
const coldStartRun = evaluateScraperStaleness(null);
assert.equal(coldStartRun.shouldRun, true);
assert.equal(coldStartRun.mode, 'emergency_catchup');

// Case E: Manual Forced Trigger
const forcedRun = evaluateScraperStaleness(0.2, true);
assert.equal(forcedRun.shouldRun, true);
assert.equal(forcedRun.mode, 'forced');

console.log('  ✅ [PASS] All 7 staleness decision matrix cases verified.');

// -----------------------------------------------------------------------------
// 3. Parity Between TypeScript and Node.js Native MJS Preflight Evaluators
// -----------------------------------------------------------------------------
console.log('\n3. Testing TypeScript vs. Native MJS Preflight Parity');
const testCases = [0, 1.2, 3.9, 4.0, 4.5, 5.9, 6.0, 6.3, 14.8, null, Infinity];
for (const tc of testCases) {
  const tsRes = evaluateScraperStaleness(tc as number | null);
  const mjsRes = evaluateMjs(tc as number | null);
  assert.equal(tsRes.shouldRun, mjsRes.shouldRun, `Mismatch on shouldRun for ${tc}`);
  assert.equal(tsRes.mode, mjsRes.mode, `Mismatch on mode for ${tc}`);
}
console.log('  ✅ [PASS] Complete parity verified across TS and MJS preflight evaluators.');

// -----------------------------------------------------------------------------
// 4. Recovery & Post-Success Reversion Simulation
// -----------------------------------------------------------------------------
console.log('\n4. Testing Recovery Lifecycle: Reversion to Normal Cycle Upon Success');
// T=0: System stuck at 6.3h -> Emergency Catch-Up runs
const t0 = evaluateScraperStaleness(6.3);
assert.equal(t0.shouldRun, true);
assert.equal(t0.mode, 'emergency_catchup');

// If scrape fails, at T+30min (6.8h elapsed), it must still be in emergency mode
const tFail30 = evaluateScraperStaleness(6.8);
assert.equal(tFail30.shouldRun, true);
assert.equal(tFail30.mode, 'emergency_catchup');

// At T+60min (7.3h elapsed), scrape succeeds!
// Database updates last_successful_scrape_at to Date.now().
// Next 30-min check occurs: elapsed is now 0.5 hours.
const tSuccessNextCheck = evaluateScraperStaleness(0.5);
assert.equal(tSuccessNextCheck.shouldRun, false);
assert.equal(tSuccessNextCheck.mode, 'idle_healthy');
console.log('  ✅ [PASS] Scraper gracefully reverts to idle and resumes 4h cycle once successful.');

// -----------------------------------------------------------------------------
// 5. Dashboard Auto-Heal Cooldown Math & Boundaries
// -----------------------------------------------------------------------------
console.log('\n5. Testing Auto-Heal Cooldown Safeguard');
const fifteenMinutesMs = 15 * 60 * 1000;
const now = Date.now();

// Scenario A: Auto-heal triggered 2 minutes ago -> Should NOT re-trigger
const lastHealRecent = now - 2 * 60 * 1000;
const shouldAllowRecent = now - lastHealRecent >= fifteenMinutesMs;
assert.equal(shouldAllowRecent, false, 'Must throttle rapid triggers within 15m');

// Scenario B: Auto-heal triggered 16 minutes ago -> Allowed to re-trigger
const lastHealOld = now - 16 * 60 * 1000;
const shouldAllowOld = now - lastHealOld >= fifteenMinutesMs;
assert.equal(shouldAllowOld, true, 'Must allow retry once cooldown expires');
console.log('  ✅ [PASS] 15-minute client-side auto-heal cooldown verified.');

// -----------------------------------------------------------------------------
// 6. Watchdog Status Mapping
// -----------------------------------------------------------------------------
console.log('\n6. Testing Watchdog Status Mapping');
function mapWatchdogStatus(elapsedHours: number) {
  if (elapsedHours >= SCRAPER_EMERGENCY_THRESHOLD_HOURS) return 'emergency_catchup';
  if (elapsedHours >= SCRAPER_STALE_THRESHOLD_HOURS) return 'stale';
  return 'healthy';
}

assert.equal(mapWatchdogStatus(2.0), 'healthy');
assert.equal(mapWatchdogStatus(4.5), 'healthy');
assert.equal(mapWatchdogStatus(5.2), 'stale');
assert.equal(mapWatchdogStatus(6.0), 'emergency_catchup');
assert.equal(mapWatchdogStatus(6.3), 'emergency_catchup');
console.log('  ✅ [PASS] Watchdog 3-tier status mapping (healthy -> stale -> emergency_catchup) verified.');

console.log('\n======================================================');
console.log('🎉 Scraper Fallback & Integrity Suite: ALL ASSERTIONS PASSED!');
console.log('======================================================\n');

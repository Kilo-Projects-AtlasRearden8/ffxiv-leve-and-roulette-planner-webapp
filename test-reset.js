import assert from 'node:assert';
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  validateConfig,
  gameDayOfWeek,
  startOfGameDay,
  gameDateKey,
  nextDailyReset,
  nextWeeklyReset,
  msUntilDailyReset,
  msUntilWeeklyReset,
  dailyResetsToday,
  countdown,
  formatCountdown,
  TIMEZONE_PRESETS,
  WEEKDAYS,
} from './reset.js';

// A fixed moment: Tuesday 2026-10-27T12:40:40Z.
// With offset +540 (JST) the game wall-clock is Tuesday 2026-10-27T21:40:40 JST.
const NOW = new Date('2026-10-27T12:40:40Z');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

// --- validateConfig / normalizeConfig ---
check('normalizeConfig keeps defaults', () => {
  const c = normalizeConfig(DEFAULT_CONFIG);
  assert.strictEqual(c.dailyResetHour, 0);
  assert.strictEqual(c.dailyResetMinute, 0);
  assert.strictEqual(c.weeklyResetDay, 2);
  assert.strictEqual(c.weeklyResetHour, 11);
  assert.strictEqual(c.weeklyResetMinute, 0);
  assert.strictEqual(c.gameOffsetMinutes, 540);
});

check('validateConfig accepts valid config', () => {
  const r = validateConfig(DEFAULT_CONFIG);
  assert.ok(r.ok, `expected valid: ${JSON.stringify(r.errors)}`);
});

check('validateConfig rejects bad daily hour', () => {
  const r = validateConfig({ ...DEFAULT_CONFIG, dailyResetHour: 24 });
  assert.ok(!r.ok && r.errors.some((e) => /Daily reset hour/.test(e)));
});

check('validateConfig rejects bad weekly day', () => {
  const r = validateConfig({ ...DEFAULT_CONFIG, weeklyResetDay: 7 });
  assert.ok(!r.ok && r.errors.some((e) => /Weekly reset day/.test(e)));
});

check('validateConfig rejects bad offset', () => {
  const r = validateConfig({ ...DEFAULT_CONFIG, gameOffsetMinutes: 900 });
  assert.ok(!r.ok && r.errors.some((e) => /offset/.test(e)));
});

// --- gameDateKey / gameDayOfWeek ---
check('gameDateKey is YYYY-MM-DD in game time', () => {
  assert.strictEqual(gameDateKey(NOW, 540), '2026-10-27');
});

check('gameDateKey shifts date when offset crosses midnight', () => {
  // UTC 2026-10-27T05:00Z = 2026-10-27T14:00 JST same day
  const a = new Date('2026-10-27T05:00:00Z');
  assert.strictEqual(gameDateKey(a, 540), '2026-10-27');
  // UTC 2026-10-27T05:00Z in UTC-5 = 2026-10-27T00:00 same day
  assert.strictEqual(gameDateKey(a, -300), '2026-10-27');
});

check('gameDayOfWeek Tuesday', () => {
  assert.strictEqual(gameDayOfWeek(NOW, 540), 2);
});

check('startOfGameDay is game midnight', () => {
  const s = startOfGameDay(NOW, 540);
  // 2026-10-27T21:40 JST → game midnight 2026-10-27T00:00 JST = 2026-10-26T15:00Z
  assert.strictEqual(s.getTime(), new Date('2026-10-26T15:00:00Z').getTime());
});

// --- nextDailyReset ---
check('nextDailyReset after reset today -> tomorrow', () => {
  const next = nextDailyReset(NOW, DEFAULT_CONFIG);
  // Daily reset 00:00 JST already passed at 21:40 JST → tomorrow 00:00 JST
  assert.strictEqual(next.getTime(), new Date('2026-10-27T15:00:00Z').getTime());
});

check('nextDailyReset before reset today -> today', () => {
  const cfg18 = { ...DEFAULT_CONFIG, dailyResetHour: 18, dailyResetMinute: 0 };
  const morning = new Date('2026-10-27T06:00:00Z'); // 15:00 JST, before 18:00 reset
  const next = nextDailyReset(morning, cfg18);
  assert.strictEqual(next.getTime(), new Date('2026-10-27T09:00:00Z').getTime()); // today 18:00 JST
});

// --- nextWeeklyReset ---
check('nextWeeklyReset after weekly reset today -> next week same day', () => {
  const next = nextWeeklyReset(NOW, DEFAULT_CONFIG);
  // Today Tuesday 21:40 JST, reset was Tuesday 11:00 JST → next Tuesday 11:00 JST
  assert.strictEqual(next.getTime(), new Date('2026-11-03T02:00:00Z').getTime());
});

check('nextWeeklyReset before weekly reset today -> today', () => {
  const morning = new Date('2026-10-27T00:00:00Z'); // 09:00 JST, before 11:00 JST Tuesday
  const next = nextWeeklyReset(morning, DEFAULT_CONFIG);
  assert.strictEqual(next.getTime(), new Date('2026-10-27T02:00:00Z').getTime()); // today 11:00 JST
});

check('nextWeeklyReset on non-target day moves forward', () => {
  // Monday 2026-11-02T00:00Z (09:00 JST Monday). Next Tuesday 11:00 JST = 2026-11-03T02:00Z
  const monday = new Date('2026-11-02T00:00:00Z');
  const next = nextWeeklyReset(monday, DEFAULT_CONFIG);
  assert.strictEqual(next.getTime(), new Date('2026-11-03T02:00:00Z').getTime());
});

// --- msUntil* ---
check('msUntilDailyReset is positive', () => {
  assert.ok(msUntilDailyReset(NOW, DEFAULT_CONFIG) > 0);
});

check('msUntilWeeklyReset is positive', () => {
  assert.ok(msUntilWeeklyReset(NOW, DEFAULT_CONFIG) > 0);
});

// --- dailyResetsToday ---
check('dailyResetsToday false after reset passed', () => {
  const cfg18 = { ...DEFAULT_CONFIG, dailyResetHour: 18, dailyResetMinute: 0 };
  // NOW = 21:40 JST, after the 18:00 JST reset → reset is tomorrow
  assert.strictEqual(dailyResetsToday(NOW, cfg18), false);
});

check('dailyResetsToday true before reset', () => {
  const cfg18 = { ...DEFAULT_CONFIG, dailyResetHour: 18, dailyResetMinute: 0 };
  const morning = new Date('2026-10-27T06:00:00Z'); // 15:00 JST, before 18:00 reset
  assert.strictEqual(dailyResetsToday(morning, cfg18), true);
});

// --- countdown / formatCountdown ---
check('countdown zero days for same-day reset', () => {
  const c = countdown(msUntilDailyReset(morning('2026-10-27T06:00:00Z'), DEFAULT_CONFIG));
  assert.strictEqual(c.days, 0);
  assert.strictEqual(c.hours, 9); // 15:00 JST → 00:00 JST next = 9 hours
});

check('formatCountdown includes days when present', () => {
  assert.strictEqual(formatCountdown(90000000), '1d 1h 0m'); // 25 hours
});

check('formatCountdown small value shows seconds', () => {
  assert.strictEqual(formatCountdown(42000), '42s');
});

check('formatCountdown caps at zero', () => {
  assert.strictEqual(formatCountdown(-999999), '0s');
});

// --- presets / weeks ---
check('TIMEZONE_PRESETS includes JST default', () => {
  const jst = TIMEZONE_PRESETS.find((p) => p.label.includes('Japan'));
  assert.ok(jst);
  assert.strictEqual(jst.offset, 540);
});

check('WEEKDAYS covers all seven days', () => {
  assert.strictEqual(WEEKDAYS.length, 7);
  assert.strictEqual(WEEKDAYS[2].label, 'Tuesday');
});

function morning(iso) {
  return new Date(iso);
}

process.exit(failures > 0 ? 1 : 0);

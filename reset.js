// reset.js — Pure, deterministic game-reset time logic.
//
// FFXIV runs on a fixed server time (Japan Standard Time, UTC+9, no daylight
// saving). This module models the daily and weekly resets as wall-clock times
// in a fixed-offset timezone, so every function is deterministic: pass a
// `now` Date and get a predictable result back. That makes the logic trivial
// to test without depending on the real clock.

export const MS_DAY = 86400000;

// Default schedule matches FFXIV: daily reset 00:00 JST, weekly reset
// (Tuesday) 11:00 JST.
export const DEFAULT_CONFIG = {
  dailyResetHour: 0,
  dailyResetMinute: 0,
  weeklyResetDay: 2, // 0 = Sunday; FFXIV weekly reset is Tuesday
  weeklyResetHour: 11,
  weeklyResetMinute: 0,
  gameOffsetMinutes: 540, // UTC+9
};

export const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const TIMEZONE_PRESETS = [
  { label: 'Japan Standard Time (UTC+09:00)', offset: 540 },
  { label: 'US Eastern (UTC−05:00)', offset: -300 },
  { label: 'US Central (UTC−06:00)', offset: -360 },
  { label: 'US Mountain (UTC−07:00)', offset: -420 },
  { label: 'US Pacific (UTC−08:00)', offset: -480 },
  { label: 'UK / GMT (UTC+00:00)', offset: 0 },
  { label: 'Central European (UTC+01:00)', offset: 60 },
  { label: 'Custom offset…', offset: null },
];

// Normalize config to plain numbers.
export function normalizeConfig(config) {
  return {
    dailyResetHour: Number(config.dailyResetHour),
    dailyResetMinute: Number(config.dailyResetMinute),
    weeklyResetDay: Number(config.weeklyResetDay),
    weeklyResetHour: Number(config.weeklyResetHour),
    weeklyResetMinute: Number(config.weeklyResetMinute),
    gameOffsetMinutes: Number(config.gameOffsetMinutes),
  };
}

// Validate a config object.
export function validateConfig(config) {
  const c = normalizeConfig(config);
  const errors = [];
  if (!Number.isInteger(c.dailyResetHour) || c.dailyResetHour < 0 || c.dailyResetHour > 23)
    errors.push('Daily reset hour must be 0–23.');
  if (!Number.isInteger(c.dailyResetMinute) || c.dailyResetMinute < 0 || c.dailyResetMinute > 59)
    errors.push('Daily reset minute must be 0–59.');
  if (!Number.isInteger(c.weeklyResetDay) || c.weeklyResetDay < 0 || c.weeklyResetDay > 6)
    errors.push('Weekly reset day must be 0–6 (Sunday = 0).');
  if (!Number.isInteger(c.weeklyResetHour) || c.weeklyResetHour < 0 || c.weeklyResetHour > 23)
    errors.push('Weekly reset hour must be 0–23.');
  if (!Number.isInteger(c.weeklyResetMinute) || c.weeklyResetMinute < 0 || c.weeklyResetMinute > 59)
    errors.push('Weekly reset minute must be 0–59.');
  if (!Number.isInteger(c.gameOffsetMinutes) || c.gameOffsetMinutes < -720 || c.gameOffsetMinutes > 840)
    errors.push('Timezone offset must be between −12:00 and +14:00.');
  return { ok: errors.length === 0, errors, config: c };
}

// Day-of-week (0 = Sunday) of the game date that contains `now`.
export function gameDayOfWeek(now, offsetMinutes) {
  const dayStart = startOfGameDay(now, offsetMinutes).getTime();
  return new Date(dayStart + offsetMinutes * 60000).getUTCDay();
}

// UTC instant of game-midnight (00:00 game time) for the game day that
// contains `now`.
export function startOfGameDay(now, offsetMinutes) {
  const gameMs = now.getTime() + offsetMinutes * 60000;
  return new Date(Math.floor(gameMs / MS_DAY) * MS_DAY - offsetMinutes * 60000);
}

// Game-date string (YYYY-MM-DD) for the game day containing `now`.
export function gameDateKey(now, offsetMinutes) {
  const dayStart = startOfGameDay(now, offsetMinutes);
  const asUtc = new Date(dayStart.getTime() + offsetMinutes * 60000);
  const y = asUtc.getUTCFullYear();
  const m = String(asUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(asUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Next occurrence of the daily reset, on or after `now`.
export function nextDailyReset(now, config) {
  const c = normalizeConfig(config);
  const dayStart = startOfGameDay(now, c.gameOffsetMinutes).getTime();
  const resetMs = c.dailyResetHour * 3600000 + c.dailyResetMinute * 60000;
  const nowGameMs = now.getTime() + c.gameOffsetMinutes * 60000;
  let gameReset = dayStart + c.gameOffsetMinutes * 60000 + resetMs;
  if (gameReset < nowGameMs) gameReset += MS_DAY;
  return new Date(gameReset - c.gameOffsetMinutes * 60000);
}

// Next occurrence of the weekly reset, on or after `now`.
export function nextWeeklyReset(now, config) {
  const c = normalizeConfig(config);
  const dayStartUtc = startOfGameDay(now, c.gameOffsetMinutes).getTime();
  const resetMs = c.weeklyResetHour * 3600000 + c.weeklyResetMinute * 60000;
  const dow = gameDayOfWeek(now, c.gameOffsetMinutes);
  const daysUntil = (c.weeklyResetDay - dow + 7) % 7;
  const nowGameMs = now.getTime() + c.gameOffsetMinutes * 60000;
  let gameReset =
    dayStartUtc + c.gameOffsetMinutes * 60000 + daysUntil * MS_DAY + resetMs;
  if (gameReset < nowGameMs) gameReset += 7 * MS_DAY;
  return new Date(gameReset - c.gameOffsetMinutes * 60000);
}

// Milliseconds until the next daily reset.
export function msUntilDailyReset(now, config) {
  return nextDailyReset(now, config).getTime() - now.getTime();
}

// Milliseconds until the next weekly reset.
export function msUntilWeeklyReset(now, config) {
  return nextWeeklyReset(now, config).getTime() - now.getTime();
}

// Is the daily reset later today (in game time)?
export function dailyResetsToday(now, config) {
  const c = normalizeConfig(config);
  const dayStart = startOfGameDay(now, c.gameOffsetMinutes).getTime();
  return nextDailyReset(now, config).getTime() < dayStart + MS_DAY;
}

// Humanized countdown: { days, hours, minutes, seconds }.
export function countdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const DAY_SEC = 86400;
  return {
    days: Math.floor(total / DAY_SEC),
    hours: Math.floor((total % DAY_SEC) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

// Formatted countdown string.
export function formatCountdown(ms) {
  const c = countdown(ms);
  if (c.days > 0) return `${c.days}d ${c.hours}h ${c.minutes}m`;
  if (c.hours > 0) return `${c.hours}h ${c.minutes}m ${c.seconds}s`;
  if (c.minutes > 0) return `${c.minutes}m ${c.seconds}s`;
  return `${c.seconds}s`;
}

import {
  DEFAULT_CONFIG,
  validateConfig,
  gameDateKey,
  nextDailyReset,
  nextWeeklyReset,
  msUntilDailyReset,
  msUntilWeeklyReset,
  formatCountdown,
  WEEKDAYS,
  TIMEZONE_PRESETS,
} from './reset.js';
import { load, save, clear } from './storage.js';

const STORAGE_VERSION = 1;
const TICK_MS = 1000;

const DEFAULT_STATE = {
  version: STORAGE_VERSION,
  config: { ...DEFAULT_CONFIG },
  lastDailyKey: null,
  lastWeeklyKey: null,
  items: [
    { id: 'r1', kind: 'daily', text: 'Duty Roulette: Daily', done: false, doneDate: null },
    { id: 'r2', kind: 'daily', text: 'Duty Roulette: Expert', done: false, doneDate: null },
    { id: 'r3', kind: 'daily', text: 'Duty Roulette: Leveling', done: false, doneDate: null },
    { id: 'r4', kind: 'daily', text: 'Duty Roulette: Trial', done: false, doneDate: null },
    { id: 'r5', kind: 'daily', text: 'Duty Roulette: Alliance Raid', done: false, doneDate: null },
    { id: 'r6', kind: 'daily', text: 'Duty Roulette: Main Scenario', done: false, doneDate: null },
  ],
  leves: { used: 0, total: 12 },
};

let state = null;
let tickTimer = null;

// ---------- DOM refs (filled in init) ----------
let els = {};

// ---------- State helpers ----------

function emptyState() {
  return {
    version: STORAGE_VERSION,
    config: { ...DEFAULT_CONFIG },
    lastDailyKey: null,
    lastWeeklyKey: null,
    items: [...DEFAULT_STATE.items].map((i) => ({ ...i, done: false, doneDate: null })),
    leves: { used: 0, total: 12 },
  };
}

function loadState() {
  const saved = load();
  if (saved && saved.version === STORAGE_VERSION) {
    const config = validateConfig(saved.config).ok ? saved.config : DEFAULT_CONFIG;
    return {
      version: STORAGE_VERSION,
      config,
      lastDailyKey: saved.lastDailyKey || null,
      lastWeeklyKey: saved.lastWeeklyKey || null,
      items: Array.isArray(saved.items) ? saved.items : [...DEFAULT_STATE.items],
      leves: saved.leves && typeof saved.leves.used === 'number'
        ? { used: saved.leves.used, total: saved.leves.total || 12 }
        : { used: 0, total: 12 },
    };
  }
  return emptyState();
}

function persist() {
  save(state);
}

// Most recent weekly reset instant (<= now) as epoch ms.
function mostRecentWeeklyResetInstant(now) {
  let e = nextWeeklyReset(now, state.config).getTime();
  while (e > now.getTime()) e -= 7 * 86400000;
  return e;
}

function weeklyCycleKey(now) {
  const instant = mostRecentWeeklyResetInstant(now);
  return gameDateKey(new Date(instant), state.config.gameOffsetMinutes);
}

// Apply automatic resets when game time has passed a reset boundary.
// Mutates state and returns true if anything changed (needs save).
function maybeReset(now) {
  let changed = false;
  const todayKey = gameDateKey(now, state.config.gameOffsetMinutes);
  const weekKey = weeklyCycleKey(now);

  if (state.lastDailyKey !== todayKey) {
    state.items
      .filter((i) => i.kind === 'daily')
      .forEach((i) => {
        i.done = false;
        i.doneDate = null;
      });
    state.leves.used = 0;
    state.lastDailyKey = todayKey;
    changed = true;
  }

  if (state.lastWeeklyKey !== weekKey) {
    state.items
      .filter((i) => i.kind === 'weekly')
      .forEach((i) => {
        i.done = false;
        i.doneDate = null;
      });
    state.lastWeeklyKey = weekKey;
    changed = true;
  }

  return changed;
}

function nextId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toggleItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  const now = new Date();
  const key = gameDateKey(now, state.config.gameOffsetMinutes);
  item.done = !item.done;
  item.doneDate = item.done ? key : null;
  persist();
  render();
}

function deleteItem(id) {
  state.items = state.items.filter((i) => i.id !== id);
  persist();
  render();
}

function addItem(kind, text) {
  const trimmed = String(text).trim();
  if (!trimmed) return;
  state.items.push({
    id: nextId(),
    kind,
    text: trimmed,
    done: false,
    doneDate: null,
  });
  persist();
  render();
  focusInput(kind);
}

function focusInput(kind) {
  const id = kind === 'weekly' ? 'weekly-input' : 'daily-input';
  const input = document.getElementById(id);
  if (input) input.focus();
}

function setLeves(delta) {
  const now = new Date();
  const key = gameDateKey(now, state.config.gameOffsetMinutes);
  if (state.lastDailyKey !== key) {
    // ensure daily reset applied before editing
    maybeReset(now);
  }
  let used = state.leves.used + delta;
  used = Math.max(0, Math.min(used, state.leves.total));
  state.leves.used = used;
  persist();
  render();
}

function setLevesTotal(value) {
  const total = Math.max(1, Math.min(999, Number(value) || 1));
  state.leves.total = total;
  if (state.leves.used > total) state.leves.used = total;
  persist();
  render();
}

function updateConfig(patch) {
  const candidate = { ...state.config, ...patch };
  const result = validateConfig(candidate);
  if (!result.ok) return;
  state.config = result.config;
  // Re-anchor reset keys to the new schedule without forcing a data wipe.
  state.lastDailyKey = gameDateKey(new Date(), state.config.gameOffsetMinutes);
  state.lastWeeklyKey = weeklyCycleKey(new Date());
  persist();
  render();
}

// ---------- Rendering ----------

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function renderCountdowns() {
  const now = new Date();
  const daily = formatCountdown(msUntilDailyReset(now, state.config));
  const weekly = formatCountdown(msUntilWeeklyReset(now, state.config));
  const dailyDate = nextDailyReset(now, state.config).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const weeklyDate = nextWeeklyReset(now, state.config).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  els.dailyCountdown.textContent = `Daily reset in ${daily} (${dailyDate})`;
  els.weeklyCountdown.textContent = `Weekly reset in ${weekly} (${weeklyDate})`;
}

function renderList(kind) {
  const container = kind === 'daily' ? els.dailyList : els.weeklyList;
  container.innerHTML = '';
  const items = state.items.filter((i) => i.kind === kind);
  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = kind === 'daily' ? 'No daily items yet.' : 'No weekly goals yet.';
    container.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'checklist-item';
    li.dataset.id = item.id;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = item.done;
    input.id = `cb-${item.id}`;
    input.setAttribute('aria-label', `Mark "${esc(item.text)}" ${item.done ? 'incomplete' : 'complete'}`);

    const text = document.createElement('span');
    text.className = 'item-text';
    text.textContent = item.text;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete';
    del.setAttribute('aria-label', `Remove "${esc(item.text)}"`);
    del.textContent = 'Remove';

    const label = document.createElement('label');
    label.className = 'item-label';
    label.appendChild(input);
    label.appendChild(text);
    label.appendChild(del);

    li.appendChild(label);
    container.appendChild(li);
  });
}

function renderLeves() {
  const remaining = state.leves.total - state.leves.used;
  els.levesUsed.textContent = state.leves.used;
  els.levesTotal.textContent = state.leves.total;
  els.levesRemaining.textContent = remaining;
  els.levesProgress.style.width = `${Math.round((state.leves.used / state.leves.total) * 100)}%`;
  els.levesProgress.setAttribute('aria-valuenow', state.leves.used);
  els.levesProgress.setAttribute('aria-valuemin', '0');
  els.levesProgress.setAttribute('aria-valuemax', state.leves.total);
}

function renderSettings() {
  const cfg = state.config;
  els.dailyTime.value = String(cfg.dailyResetHour).padStart(2, '0') + ':' + String(cfg.dailyResetMinute).padStart(2, '0');
  els.weeklyDay.value = String(cfg.weeklyResetDay);
  els.weeklyTime.value = String(cfg.weeklyResetHour).padStart(2, '0') + ':' + String(cfg.weeklyResetMinute).padStart(2, '0');

  // timezone preset
  const preset = TIMEZONE_PRESETS.find((p) => p.offset === cfg.gameOffsetMinutes);
  if (preset) {
    els.tzPreset.value = preset.label;
  } else {
    els.tzPreset.value = TIMEZONE_PRESETS[TIMEZONE_PRESETS.length - 1].label; // Custom
    els.tzCustom.value = String(cfg.gameOffsetMinutes);
    els.tzCustom.disabled = false;
  }

  els.levesTotalInput.value = String(state.leves.total);

  // daily add input value cleared by caller
}

function render() {
  renderCountdowns();
  renderList('daily');
  renderList('weekly');
  renderLeves();
  renderSettings();
}

// ---------- Event wiring ----------

function wireEvents() {
  // Checklist toggles & deletes via delegation on both lists.
  [els.dailyList, els.weeklyList].forEach((container) => {
    container.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        toggleItem(e.target.closest('[data-id]').dataset.id);
      }
    });
    container.addEventListener('click', (e) => {
      const del = e.target.closest('.delete');
      if (del) deleteItem(del.closest('[data-id]').dataset.id);
    });
  });

  // Leves controls.
  els.levesMinus.addEventListener('click', () => setLeves(-1));
  els.levesPlus.addEventListener('click', () => setLeves(1));
  els.levesTotalInput.addEventListener('change', (e) => setLevesTotal(e.target.value));

  // Add item forms.
  els.dailyAddForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem('daily', els.dailyInput.value);
    els.dailyInput.value = '';
  });
  els.weeklyAddForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem('weekly', els.weeklyInput.value);
    els.weeklyInput.value = '';
  });

  // Settings form.
  els.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const daily = els.dailyTime.value.split(':').map(Number);
    const weeklyDay = Number(els.weeklyDay.value);
    const weekly = els.weeklyTime.value.split(':').map(Number);
    let offset = state.config.gameOffsetMinutes;
    const presetLabel = els.tzPreset.value;
    const preset = TIMEZONE_PRESETS.find((p) => p.label === presetLabel);
    if (preset && preset.offset !== null) {
      offset = preset.offset;
    } else {
      offset = Number(els.tzCustom.value) || 0;
    }
    updateConfig({
      dailyResetHour: daily[0],
      dailyResetMinute: daily[1],
      weeklyResetDay: weeklyDay,
      weeklyResetHour: weekly[0],
      weeklyResetMinute: weekly[1],
      gameOffsetMinutes: offset,
    });
  });

  els.tzPreset.addEventListener('change', (e) => {
    const custom = TIMEZONE_PRESETS.find((p) => p.label === e.target.value);
    els.tzCustom.disabled = !(custom && custom.offset === null);
    if (!els.tzCustom.disabled) els.tzCustom.focus();
  });

  els.resetData.addEventListener('click', () => {
    if (!confirm('Reset all planner data? This cannot be undone.')) return;
    clear();
    state = emptyState();
    render();
  });
}

function buildSettingsForm() {
  const form = els.settingsForm;
  form.innerHTML = '';

  const field = (labelText, input) => {
    const div = document.createElement('div');
    div.className = 'field';
    const label = document.createElement('label');
    label.textContent = labelText;
    label.appendChild(input);
    div.appendChild(label);
    return div;
  };

  const dailyTime = document.createElement('input');
  dailyTime.type = 'time';
  dailyTime.id = 'daily-time';
  els.dailyTime = dailyTime;
  form.appendChild(field('Daily reset time', dailyTime));

  const weeklyDay = document.createElement('select');
  weeklyDay.id = 'weekly-day';
  els.weeklyDay = weeklyDay;
  WEEKDAYS.forEach((d) => {
    const o = document.createElement('option');
    o.value = d.value;
    o.textContent = d.label;
    weeklyDay.appendChild(o);
  });
  form.appendChild(field('Weekly reset day', weeklyDay));

  const weeklyTime = document.createElement('input');
  weeklyTime.type = 'time';
  weeklyTime.id = 'weekly-time';
  els.weeklyTime = weeklyTime;
  form.appendChild(field('Weekly reset time', weeklyTime));

  const tzPreset = document.createElement('select');
  tzPreset.id = 'tz-preset';
  els.tzPreset = tzPreset;
  TIMEZONE_PRESETS.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.label;
    o.textContent = p.label;
    tzPreset.appendChild(o);
  });
  form.appendChild(field('Timezone preset', tzPreset));

  const tzCustom = document.createElement('input');
  tzCustom.type = 'number';
  tzCustom.min = '-720';
  tzCustom.max = '840';
  tzCustom.step = '30';
  tzCustom.id = 'tz-custom';
  tzCustom.disabled = true;
  els.tzCustom = tzCustom;
  const customDiv = document.createElement('div');
  customDiv.className = 'field';
  const customLabel = document.createElement('label');
  customLabel.textContent = 'Custom offset (minutes from UTC)';
  customLabel.appendChild(tzCustom);
  customDiv.appendChild(customLabel);
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'FFXIV uses a fixed server time with no daylight saving, so a fixed offset matches the game exactly.';
  customDiv.appendChild(hint);
  form.appendChild(customDiv);

  const levesTotal = document.createElement('input');
  levesTotal.type = 'number';
  levesTotal.min = '1';
  levesTotal.max = '999';
  levesTotal.id = 'leves-total';
  els.levesTotalInput = levesTotal;
  form.appendChild(field('Leve allowance total (per day)', levesTotal));

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'button';
  btn.textContent = 'Save settings';
  form.appendChild(btn);
}

function buildAddForm(kind) {
  const container = kind === 'daily' ? els.dailyAdd : els.weeklyAdd;
  container.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'item-add-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = kind === 'daily' ? 'daily-input' : 'weekly-input';
  input.placeholder = `Add a ${kind} item…`;
  input.maxLength = 120;
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'button button-small';
  btn.textContent = 'Add';
  form.appendChild(input);
  form.appendChild(btn);
  container.appendChild(form);
  if (kind === 'daily') {
    els.dailyAddForm = form;
    els.dailyInput = input;
  } else {
    els.weeklyAddForm = form;
    els.weeklyInput = input;
  }
}

function buildLevesControl() {
  const container = els.levesControl;
  container.innerHTML = '';
  const used = document.createElement('span');
  used.id = 'leves-used';
  els.levesUsed = used;
  const total = document.createElement('span');
  total.id = 'leves-total';
  els.levesTotal = total;
  const remaining = document.createElement('span');
  remaining.id = 'leves-remaining';
  els.levesRemaining = remaining;

  const line = document.createElement('p');
  line.className = 'leves-line';
  line.innerHTML = `Leves used: <span id="leves-used"></span> / <span id="leves-total"></span> &nbsp;·&nbsp; Remaining: <strong id="leves-remaining"></strong>`;
  // Re-query the spans we just created inside line.innerHTML replacement — simpler to rebuild:
  container.appendChild(line);

  // Re-refs after innerHTML set
  els.levesUsed = line.querySelector('#leves-used');
  els.levesTotal = line.querySelector('#leves-total');
  els.levesRemaining = line.querySelector('#leves-remaining');

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.id = 'leves-minus';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Decrease leves used');
  els.levesMinus = minus;

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.id = 'leves-plus';
  plus.textContent = '＋';
  plus.setAttribute('aria-label', 'Increase leves used');
  els.levesPlus = plus;

  const progress = document.createElement('div');
  progress.className = 'progress';
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.id = 'leves-progress';
  bar.role = 'progressbar';
  els.levesProgress = bar;
  progress.appendChild(bar);

  const controls = document.createElement('div');
  controls.className = 'leves-controls';
  controls.appendChild(minus);
  controls.appendChild(plus);
  controls.appendChild(progress);

  container.appendChild(line);
  container.appendChild(controls);
}

function buildCountdowns() {
  els.dailyCountdown = document.createElement('div');
  els.weeklyCountdown = document.createElement('div');
  els.countdowns.appendChild(els.dailyCountdown);
  els.countdowns.appendChild(els.weeklyCountdown);
}

function init() {
  // Gather shell refs.
  els = {
    countdowns: document.getElementById('countdowns'),
    dailyList: document.getElementById('daily-list'),
    weeklyList: document.getElementById('weekly-list'),
    dailyAdd: document.getElementById('daily-add'),
    weeklyAdd: document.getElementById('weekly-add'),
    levesControl: document.getElementById('leves-control'),
    settingsForm: document.getElementById('settings-form'),
    resetData: document.getElementById('reset-data'),
  };

  buildCountdowns();
  buildAddForm('daily');
  buildAddForm('weekly');
  buildLevesControl();
  buildSettingsForm();

  state = loadState();

  wireEvents();
  render();

  tickTimer = setInterval(() => {
    const now = new Date();
    const changed = maybeReset(now);
    renderCountdowns();
    renderLeves();
    if (changed) {
      renderList('daily');
      renderList('weekly');
      persist();
    }
  }, TICK_MS);
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}

export { toggleItem, deleteItem, addItem, setLeves, setLevesTotal, updateConfig, loadState, emptyState };

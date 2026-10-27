// storage.js — Tiny localStorage wrapper with graceful degradation.
// If localStorage is unavailable (private mode, quota exceeded, etc.) the app
// still works; data simply won't persist across reloads.

const STORE_KEY = 'ffxiv-planner:v1';

export function load() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function save(state) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.removeItem(STORE_KEY);
    return true;
  } catch {
    return false;
  }
}

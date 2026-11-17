// localStorage-backed save + settings. Saves are intentionally small:
// mission state, flags, inventory, position, doors opened and world toggles.
const SAVE_KEY = 'ward13.save.v1';
const SETTINGS_KEY = 'ward13.settings.v1';

export const Save = {
  exists() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  write(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
  },
  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  },
};

const SETTINGS_DEFAULTS = {
  sensitivity: 1,
  volume: 0.8,
  fov: 74,
  invertY: false,
  grain: true,
  quality: 'medium',
};

export const Settings = {
  defaults: SETTINGS_DEFAULTS,
  data: { ...SETTINGS_DEFAULTS },
  load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch { /* ignore */ }
    return this.data;
  },
  save() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  },
  reset() {
    Object.assign(this.data, SETTINGS_DEFAULTS);
  },
};

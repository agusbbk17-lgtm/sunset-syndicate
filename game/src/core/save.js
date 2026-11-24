export const SAVE_KEY = 'sunset-syndicate-v1';
export const DEFAULT_SETTINGS = { quality: 'med', cameraPreset: 1, fov: 60, sensitivity: 1, volume: .5, engineVolume: .65, reduceMotion: false, autoQuality: true };
export function normalizeSettings(value = {}) {
  const settings = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== 'object') return settings;
  if (['low', 'med', 'high', 'ultra'].includes(value.quality)) settings.quality = value.quality;
  for (const [key, min, max] of [['cameraPreset', 0, 2], ['fov', 50, 80], ['sensitivity', .25, 2], ['volume', 0, 1], ['engineVolume', 0, 1]]) {
    if (Number.isFinite(value[key])) settings[key] = Math.max(min, Math.min(max, value[key]));
  }
  settings.cameraPreset = Math.round(settings.cameraPreset);
  for (const key of ['reduceMotion', 'autoQuality']) if (typeof value[key] === 'boolean') settings[key] = value[key];
  return settings;
}
export function encodeSave(data) { return JSON.stringify({ version: 1, data }); }
export function decodeSave(payload) {
  try {
    const save = JSON.parse(payload);
    if (save?.version !== 1 || !save.data || typeof save.data !== 'object' || Array.isArray(save.data)) return null;
    return save.data;
  } catch { return null; }
}
export function loadSave(storage) {
  try { return decodeSave(storage.getItem(SAVE_KEY)); } catch { return null; }
}
export function storeSave(storage, data) {
  try { storage.setItem(SAVE_KEY, encodeSave(data)); return true; } catch { return false; }
}

export const SAVE_KEY = 'sunset-syndicate-v1';
export const DEFAULT_SETTINGS = { quality: 'med', cameraPreset: 1, fov: 60, sensitivity: 1, volume: .5, engineVolume: .65, reduceMotion: false };
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

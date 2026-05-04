const SAVE_KEY = "terrible-ghost-save-v1";

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      day: game.day,
      points: game.points,
      weaponId: game.weaponId,
      ownedWeapons: game.ownedWeapons,
      ammo: game.ammo,
    }));
  } catch {
    // localStorage may be unavailable in private or restricted browser contexts.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore storage failures; the game can still run without persistence.
  }
}

import { CONFIG, MAX_AMMO, MAZE_TILE } from "../config.js";
import { weapons } from "../data/weapons.js";
import { clamp, dist, rand } from "../utils/math.js";
import { addAmmo, getCurrentAmmo, getCurrentWeapon, medkitHeal } from "./loadout.js";

export function collectPickupItems({ game, onAmmo, onChest, onKey, onMedkit }) {
  const spawnedPickups = [];
  game.pickups = game.pickups.filter((item) => {
    if (dist(item, game.player) >= item.r + game.player.r) return true;

    switch (item.type) {
      case "ammo":
        if (item.level !== getCurrentWeapon(game).level || getCurrentAmmo(game) >= MAX_AMMO) return true;
        addAmmo(game, item.level, item.amount);
        onAmmo?.(item);
        return false;
      case "medkit":
        useMedkit(game, item.level);
        onMedkit?.(item);
        return false;
      case "chest": {
        const reward = openChest(game, item);
        if (reward.medkit) spawnedPickups.push(reward.medkit);
        onChest?.(item, reward);
        return false;
      }
      case "key":
        game.foundKeys += 1;
        onKey?.(item);
        return false;
      default:
        return true;
    }
  });
  game.pickups.push(...spawnedPickups);
}

export function openChest(game, chest) {
  const weapon = chooseChestWeapon(game);
  const previousWeaponId = game.weaponId;
  if (!game.ownedWeapons.includes(weapon.id)) game.ownedWeapons.push(weapon.id);
  game.weaponId = weapon.id;
  if (previousWeaponId !== weapon.id) game.weaponSwitchTimer = 0.48;
  const ammoAmount = Math.round(rand(CONFIG.chest.ammoMin, CONFIG.chest.ammoMax));
  addAmmo(game, weapon.level, ammoAmount);
  const reward = { weapon, ammoAmount, pointsAmount: 0, medkit: null };
  if (Math.random() < 0.55) {
    const dayMultiplier = 1 + Math.max(0, game.day - 1) * 0.04;
    reward.pointsAmount = Math.round(rand(CONFIG.chest.pointsMin, CONFIG.chest.pointsMax) * dayMultiplier);
    game.points += reward.pointsAmount;
  } else {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(44, 68);
    reward.medkit = {
      type: "medkit",
      level: Math.max(1, Math.ceil(rand(0.2, 5))),
      x: chest.x + Math.cos(angle) * distance,
      y: chest.y + Math.sin(angle) * distance,
      r: 15,
    };
  }
  return reward;
}

export function useMedkit(game, level) {
  const medLevel = clamp(level, 1, 5);
  game.player.hp = Math.min(100, game.player.hp + medkitHeal(medLevel));
  game.healingTimer = CONFIG.medkit.useSeconds;
  game.healingLevel = medLevel;
  game.hidden = false;
}

function chooseChestWeapon(game) {
  const current = getCurrentWeapon(game);
  const maxLevel = clamp(3 + game.day * 2 + Math.floor(game.danger / 2), 2, 24);
  const newWeapons = weapons.filter((weapon) => !game.ownedWeapons.includes(weapon.id) && weapon.level <= maxLevel);
  if (newWeapons.length > 0 && Math.random() < 0.72) {
    const nearCurrent = newWeapons.filter((weapon) => weapon.level <= current.level + 4);
    const pool = nearCurrent.length > 0 ? nearCurrent : newWeapons;
    return pool[Math.floor(rand(0, pool.length))] || current;
  }
  const owned = weapons.filter((weapon) => game.ownedWeapons.includes(weapon.id));
  return owned[Math.floor(rand(0, owned.length))] || current;
}

export function randomAmmoLevel(game) {
  if (!game) return Math.floor(rand(1, 25));
  const current = getCurrentWeapon(game);
  const owned = weapons.filter((weapon) => game.ownedWeapons.includes(weapon.id));
  if (Math.random() < 0.78) return current.level;
  if (owned.length > 0 && Math.random() < 0.72) {
    const weapon = owned[Math.floor(rand(0, owned.length))] || current;
    return weapon.level;
  }
  const maxLevel = clamp(current.level + 3 + Math.floor(game.day / 2), 1, 24);
  return Math.floor(rand(1, maxLevel + 1));
}

export function spawnAmmoPickup({ game, hitsForestRock, hitsWall }) {
  if (game.driving) return;
  const ammoPickups = game.pickups.filter((item) => item.type === "ammo").length;
  if (ammoPickups >= CONFIG.ammo.maxPickups) return;

  if (game.phase === "maze") {
    const spots = [
      { x: MAZE_TILE * 8.5, y: MAZE_TILE * 2.5 },
      { x: MAZE_TILE * 24.5, y: MAZE_TILE * 10.5 },
      { x: MAZE_TILE * 42.5, y: MAZE_TILE * 16.5 },
      { x: MAZE_TILE * 44.5, y: MAZE_TILE * 4.5 },
      { x: MAZE_TILE * 5.5, y: MAZE_TILE * 25.5 },
      { x: MAZE_TILE * 12.5, y: MAZE_TILE * 19.5 },
      { x: MAZE_TILE * 32.5, y: MAZE_TILE * 6.5 },
    ];
    const spot = spots[Math.floor(rand(0, spots.length))];
    const item = {
      type: "ammo",
      level: randomAmmoLevel(game),
      amount: Math.round(rand(6, 13)),
      x: spot.x + rand(-18, 18),
      y: spot.y + rand(-18, 18),
      r: 13,
    };
    if (!hitsWall(item) && !game.pickups.some((pickup) => dist(pickup, item) < 80)) game.pickups.push(item);
    return;
  }

  if (game.phase !== "forest") return;
  for (let i = 0; i < 16; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(260, 720);
    const item = {
      type: "ammo",
      level: randomAmmoLevel(game),
      amount: Math.round(rand(6, 13)),
      x: game.player.x + Math.cos(angle) * distance,
      y: game.player.y + Math.sin(angle) * distance,
      r: 13,
    };
    if (!hitsForestRock(item) && !game.pickups.some((pickup) => dist(pickup, item) < 90)) {
      game.pickups.push(item);
      return;
    }
  }
}

export function spawnForestMedkit({ game, hitsForestRock }) {
  if (game.phase !== "forest" || game.driving) return;
  const medkits = game.pickups.filter((item) => item.type === "medkit").length;
  if (medkits >= 4) return;
  for (let i = 0; i < 18; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(360, 980);
    const maxLevel = clamp(1 + Math.floor(game.danger / 3), 1, 5);
    const item = {
      type: "medkit",
      level: Math.max(1, Math.ceil(rand(0.2, maxLevel))),
      x: game.player.x + Math.cos(angle) * distance,
      y: game.player.y + Math.sin(angle) * distance,
      r: 15,
    };
    if (!hitsForestRock(item) && !game.pickups.some((pickup) => dist(pickup, item) < 100)) {
      game.pickups.push(item);
      return;
    }
  }
}

export function spawnChestPickup({ game, hitsForestRock, hitsWall }) {
  if (game.driving) return;
  const chests = game.pickups.filter((item) => item.type === "chest").length;
  if (chests >= CONFIG.chest.maxPickups) return;

  if (game.phase === "maze") {
    const spots = [
      { x: MAZE_TILE * 8.5, y: MAZE_TILE * 2.5 },
      { x: MAZE_TILE * 24.5, y: MAZE_TILE * 10.5 },
      { x: MAZE_TILE * 42.5, y: MAZE_TILE * 16.5 },
      { x: MAZE_TILE * 5.5, y: MAZE_TILE * 25.5 },
      { x: MAZE_TILE * 12.5, y: MAZE_TILE * 19.5 },
      { x: MAZE_TILE * 32.5, y: MAZE_TILE * 6.5 },
    ];
    const spot = spots[Math.floor(rand(0, spots.length))];
    const item = {
      type: "chest",
      x: spot.x + rand(-20, 20),
      y: spot.y + rand(-20, 20),
      r: 18,
    };
    if (!hitsWall(item) && !game.pickups.some((pickup) => dist(pickup, item) < 110)) game.pickups.push(item);
    return;
  }

  if (game.phase !== "forest") return;
  for (let i = 0; i < 16; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(430, 1100);
    const item = {
      type: "chest",
      x: game.player.x + Math.cos(angle) * distance,
      y: game.player.y + Math.sin(angle) * distance,
      r: 18,
    };
    if (!hitsForestRock(item) && !game.pickups.some((pickup) => dist(pickup, item) < 130)) {
      game.pickups.push(item);
      return;
    }
  }
}

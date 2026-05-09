import { MAX_AMMO } from "../config.js";
import { weapons } from "../data/weapons.js";
import { clamp } from "../utils/math.js";

export function getCurrentWeapon(game) {
  return weapons.find((weapon) => weapon.id === game.weaponId) || weapons[0];
}

export function ammoPrice(level) {
  return Math.round(10 + level * 7 + level * level * 1.1);
}

export function ammoPackSize(level) {
  return level <= 3 ? 12 : 10;
}

export function medkitHeal(level) {
  return Math.round(10 + clamp(level, 1, 5) * 14);
}

export function getCurrentAmmo(game) {
  const weapon = getCurrentWeapon(game);
  return game.ammo[String(weapon.level)] || 0;
}

export function addAmmo(game, level, amount) {
  const key = String(clamp(level, 1, 24));
  game.ammo[key] = Math.min(MAX_AMMO, (game.ammo[key] || 0) + amount);
}

export function weaponStats(weapon) {
  const traits = {
    pistol: "稳定单发",
    rifle: "高速连射",
    crossbow: "破石穿刺",
    shotgun: "近距散射",
    flame: "灼烧爆裂",
    ice: "冻结减速",
    laser: "直线贯穿",
    cannon: "范围震爆",
    storm: "连锁电弧",
  };
  return {
    damage: weapon.damage,
    fireRate: Math.round(60 / weapon.fireDelay) / 10,
    speed: Math.round(weapon.bulletSpeed),
    range: Math.round((weapon.bulletSpeed * weapon.bulletLife) / 10),
    rock: weapon.level >= 3 ? "可破石" : "不可破石",
    trait: traits[weapon.type] || "强化火力",
  };
}

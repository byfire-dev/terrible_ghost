const baseWeapons = [
  { id: "pistol", type: "pistol", level: 1, name: "一级手枪", price: 0, damage: 1, fireDelay: 0.18, bulletSpeed: 560, bulletLife: 1.1, color: "#fff7a6" },
  { id: "rifle", type: "rifle", level: 2, name: "二级步枪", price: 45, damage: 2, fireDelay: 0.14, bulletSpeed: 640, bulletLife: 1.05, color: "#9fe6ff" },
  { id: "crossbow", type: "crossbow", level: 3, name: "三级弩枪", price: 90, damage: 3, fireDelay: 0.2, bulletSpeed: 700, bulletLife: 1.2, color: "#b8ff9f" },
  { id: "shotgun", type: "shotgun", level: 4, name: "四级霰弹枪", price: 140, damage: 5, fireDelay: 0.28, bulletSpeed: 590, bulletLife: 0.9, color: "#72b9ff" },
  { id: "flame", type: "flame", level: 5, name: "五级火焰枪", price: 230, damage: 7, fireDelay: 0.16, bulletSpeed: 610, bulletLife: 0.82, color: "#ff8a3d" },
  { id: "ice", type: "ice", level: 6, name: "六级冰冻枪", price: 340, damage: 9, fireDelay: 0.18, bulletSpeed: 690, bulletLife: 1.08, color: "#7ee9ff" },
  { id: "laser", type: "laser", level: 7, name: "七级能量枪", price: 480, damage: 12, fireDelay: 0.11, bulletSpeed: 780, bulletLife: 1.0, color: "#5cc7ff" },
  { id: "cannon", type: "cannon", level: 8, name: "八级重炮", price: 680, damage: 16, fireDelay: 0.34, bulletSpeed: 640, bulletLife: 1.35, color: "#f0c453" },
  { id: "storm", type: "storm", level: 9, name: "九级风暴炮", price: 920, damage: 22, fireDelay: 0.2, bulletSpeed: 840, bulletLife: 1.25, color: "#76f7ff" },
];

const weaponTypes = ["pistol", "rifle", "crossbow", "shotgun", "flame", "ice", "laser", "cannon", "storm"];
const weaponNames = ["影刃", "猎手", "穿云", "裂骨", "赤焰", "寒霜", "脉冲", "山崩", "雷暴"];

export const weapons = [...baseWeapons];

for (let level = 10; level <= 24; level += 1) {
  const type = weaponTypes[(level - 1) % weaponTypes.length];
  const color = ["#ff5d73", "#8effc1", "#9f8cff", "#ffe071", "#5cf0ff"][level % 5];
  weapons.push({
    id: `weapon-${level}`,
    type,
    level,
    name: `${level}级${weaponNames[(level - 1) % weaponNames.length]}武器`,
    price: Math.round(920 + (level - 9) * (level - 5) * 34),
    damage: Math.round(22 + (level - 9) * 4.5),
    fireDelay: Math.max(0.08, 0.2 - (level - 9) * 0.004),
    bulletSpeed: 850 + level * 12,
    bulletLife: 1.15 + level * 0.012,
    color,
  });
}

weapons.forEach((weapon) => {
  if (weapon.price > 0) {
    weapon.price = Math.round(weapon.price * 1.35 + weapon.level * 18);
  }
});

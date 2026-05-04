export function updateAmmoHud(ui, currentAmmo, maxAmmo) {
  ui.ammo.textContent = `${currentAmmo} / ${maxAmmo}`;
}

export function updateHud(ui, game, weapon, currentAmmo, maxAmmo) {
  const forestName = game.scene?.name ? `森林·${game.scene.name}` : "神秘森林";
  ui.place.textContent = game.phase === "maze" ? "迷宫" : game.driving ? `驾驶逃生车·${game.scene?.name || "森林"}` : game.escapeOnFoot ? `徒步逃生·${game.scene?.name || "森林"}` : game.healingTimer > 0 ? `治疗中 ${Math.ceil(game.healingTimer)}秒` : game.hidden ? `${forestName}（草丛隐藏）` : forestName;
  ui.health.textContent = game.driving ? `车 ${Math.max(0, Math.ceil(game.vehicleHp))}` : String(Math.max(0, Math.ceil(game.player.hp)));
  ui.keys.textContent = `${game.foundKeys} / 2`;
  ui.danger.textContent = String(Math.max(1, Math.floor(game.danger)));
  ui.points.textContent = String(game.points);
  ui.weaponName.textContent = game.driving ? "驾驶中禁用" : weapon.name;
  updateAmmoHud(ui, currentAmmo, maxAmmo);
  ui.day.textContent = `第 ${game.day} 天`;
}

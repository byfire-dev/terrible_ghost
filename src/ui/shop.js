export function renderShop({
  ammoArt,
  ammoPackSize,
  ammoPrice,
  game,
  maxAmmo,
  ui,
  weaponArt,
  weapons,
  weaponStats,
}) {
  ui.shopPoints.textContent = `${game.points} 积分`;
  ui.weaponTab.classList.toggle("active", game.shopTab === "weapons");
  ui.ammoTab.classList.toggle("active", game.shopTab === "ammo");
  ui.weaponList.innerHTML = "";
  if (game.shopTab === "ammo") {
    weapons.forEach((weapon) => {
      const level = weapon.level;
      const amount = ammoPackSize(level);
      const stock = game.ammo[level] || 0;
      const price = ammoPrice(level);
      const full = stock >= maxAmmo;
      const affordable = !full && game.points >= price;
      const card = document.createElement("article");
      card.className = `weapon-card ammo-card ${affordable ? "affordable" : ""} ${full ? "full" : ""} ${!affordable && !full ? "locked" : ""}`;
      card.innerHTML = `
        <img class="weapon-image" src="${ammoArt(level)}" alt="${level}级子弹">
        <div class="weapon-info ${affordable ? "ready" : ""}">
          <strong class="weapon-title">${level}级子弹</strong>
          <span class="weapon-meta">对应武器：${weapon.name}</span>
          <span class="weapon-meta">购买积分：${price}</span>
          <span class="weapon-meta">购买数量：+${amount} 发</span>
          <span class="weapon-meta">当前库存：${stock} / ${maxAmmo}</span>
          <span class="weapon-meta">容量上限：${maxAmmo} 发</span>
        </div>
        <button class="ammo-buy" type="button" data-ammo-level="${level}" ${!affordable ? "disabled" : ""}>
          ${full ? "已满" : "购买"}
        </button>
      `;
      ui.weaponList.appendChild(card);
    });
    return;
  }
  weapons.forEach((weapon) => {
    const owned = game.ownedWeapons.includes(weapon.id);
    const equipped = game.weaponId === weapon.id;
    const affordable = !owned && game.points >= weapon.price;
    const stats = weaponStats(weapon);
    const card = document.createElement("article");
    card.className = `weapon-card ${affordable ? "affordable" : ""} ${equipped ? "equipped" : ""} ${!owned && !affordable ? "locked" : ""}`;
    card.innerHTML = `
      <img class="weapon-image" src="${weaponArt(weapon)}" alt="${weapon.name}">
      <div class="weapon-info ${affordable ? "ready" : ""}">
        <strong class="weapon-title">${weapon.name}</strong>
        <span class="weapon-meta">购买积分：${weapon.price}</span>
        <span class="weapon-meta">武器等级：${weapon.level} 级</span>
        <span class="weapon-meta">伤害等级：${weapon.damage}</span>
        <span class="weapon-meta">射速：${stats.fireRate} 发/秒</span>
        <span class="weapon-meta">弹速：${stats.speed}</span>
        <span class="weapon-meta">射程：${stats.range} 米</span>
        <span class="weapon-meta">弹容量：${game.ammo[String(weapon.level)] || 0} / ${maxAmmo}</span>
        <span class="weapon-meta">破石：${stats.rock}</span>
      </div>
      <button class="weapon-buy" type="button" data-weapon="${weapon.id}" ${!owned && !affordable ? "disabled" : ""}>
        ${equipped ? "使用中" : owned ? "装备" : "购买"}
      </button>
    `;
    ui.weaponList.appendChild(card);
  });
}

export function renderQuickbar({ game, ui, weaponArt, weapons }) {
  const owned = weapons.filter((weapon) => game.ownedWeapons.includes(weapon.id));
  ui.weaponQuickbar.classList.toggle("hidden", owned.length <= 1);
  ui.weaponQuickbar.innerHTML = "";
  owned.forEach((weapon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `quick-weapon ${game.weaponId === weapon.id ? "active" : ""}`;
    button.dataset.weapon = weapon.id;
    button.innerHTML = `
      <img src="${weaponArt(weapon)}" alt="${weapon.name}">
      <span>${weapon.level}级</span>
    `;
    ui.weaponQuickbar.appendChild(button);
  });
}

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
  const weaponStatus = (owned, equipped, affordable) => {
    if (equipped) return { key: "equipped", label: "已装备", action: "使用中" };
    if (owned) return { key: "owned", label: "已解锁", action: "装备" };
    if (affordable) return { key: "ready", label: "可采购", action: "购买" };
    return { key: "locked", label: "积分不足", action: "购买" };
  };
  const tierLabel = (level) => {
    if (level >= 18) return "RELIC";
    if (level >= 10) return "NIGHTMARE";
    if (level >= 5) return "RARE";
    return "FIELD";
  };
  const statPercent = (value, max) => Math.max(8, Math.min(100, Math.round((value / max) * 100)));
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
      const status = full
        ? { key: "full", label: "库存已满", action: "已满" }
        : affordable
          ? { key: "ready", label: "可补给", action: "购买" }
          : { key: "locked", label: "积分不足", action: "购买" };
      const stockPct = statPercent(stock, maxAmmo);
      const card = document.createElement("article");
      card.className = `weapon-card ammo-card ${affordable ? "affordable" : ""} ${full ? "full" : ""} ${!affordable && !full ? "locked" : ""}`;
      card.dataset.status = status.key;
      card.innerHTML = `
        <div class="weapon-media">
          <img class="weapon-image" src="${ammoArt(level)}" alt="${level}级子弹">
          <span class="weapon-tier">${tierLabel(level)}</span>
          <span class="weapon-state">${status.label}</span>
        </div>
        <div class="weapon-info ${affordable ? "ready" : ""}">
          <div class="weapon-title-row">
            <strong class="weapon-title">${level}级子弹</strong>
            <span class="weapon-rank">AMMO ${level}</span>
          </div>
          <span class="weapon-meta">${weapon.name} 专用弹药包</span>
          <div class="shop-stat-grid">
            <span><b>${price}</b><em>积分</em></span>
            <span><b>+${amount}</b><em>补给</em></span>
            <span><b>${stock}</b><em>库存</em></span>
            <span><b>${maxAmmo}</b><em>上限</em></span>
          </div>
          <div class="shop-meter" aria-hidden="true"><i style="width: ${stockPct}%"></i></div>
        </div>
        <button class="ammo-buy" type="button" data-ammo-level="${level}" ${!affordable ? "disabled" : ""}>
          ${status.action}
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
    const status = weaponStatus(owned, equipped, affordable);
    const damagePct = statPercent(weapon.damage, 90);
    const firePct = statPercent(stats.fireRate, 8);
    const card = document.createElement("article");
    card.className = `weapon-card ${affordable ? "affordable" : ""} ${equipped ? "equipped" : ""} ${!owned && !affordable ? "locked" : ""}`;
    card.dataset.status = status.key;
    card.innerHTML = `
      <div class="weapon-media">
        <img class="weapon-image" src="${weaponArt(weapon)}" alt="${weapon.name}">
        <span class="weapon-tier">${tierLabel(weapon.level)}</span>
        <span class="weapon-state">${status.label}</span>
      </div>
      <div class="weapon-info ${affordable ? "ready" : ""}">
        <div class="weapon-title-row">
          <strong class="weapon-title">${weapon.name}</strong>
          <span class="weapon-rank">LV ${weapon.level}</span>
        </div>
        <span class="weapon-meta">${stats.rock} · 弹容 ${game.ammo[String(weapon.level)] || 0} / ${maxAmmo}</span>
        <div class="shop-stat-grid">
          <span><b>${weapon.price}</b><em>积分</em></span>
          <span><b>${weapon.damage}</b><em>伤害</em></span>
          <span><b>${stats.fireRate}</b><em>射速</em></span>
          <span><b>${stats.range}</b><em>射程</em></span>
        </div>
        <div class="shop-meter weapon-power" aria-hidden="true">
          <i style="width: ${damagePct}%"></i>
          <i style="width: ${firePct}%"></i>
        </div>
      </div>
      <button class="weapon-buy" type="button" data-weapon="${weapon.id}" ${!owned && !affordable ? "disabled" : ""}>
        ${status.action}
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

import {
  CONFIG,
  FOREST_FEATURE_CELL,
  MAX_AMMO,
  MAZE_COLS,
  MAZE_H,
  MAZE_ROWS,
  MAZE_START,
  MAZE_TILE,
  MAZE_W,
  MODE,
} from "./config.js";
import { sceneForDay } from "./data/scenes.js";
import { weapons } from "./data/weapons.js";
import { ammoArt, weaponArt } from "./render/art.js";
import { drawAllHorrorMonsters } from "./render/horrorMonsters.js";
import { createInitialGameState } from "./state.js";
import {
  addAmmo as addAmmoToGame,
  ammoPackSize,
  ammoPrice,
  getCurrentAmmo,
  getCurrentWeapon,
  weaponStats,
} from "./systems/loadout.js";
import { clearSave, readSave, writeSave } from "./systems/save.js";
import { playSound, setSoundEnabled, startIntroAmbience, stopIntroSounds } from "./systems/sound.js";
import {
  collectPickupItems,
  spawnAmmoPickup as spawnAmmoPickupItem,
  spawnChestPickup as spawnChestPickupItem,
  spawnForestMedkit as spawnForestMedkitItem,
} from "./systems/pickups.js";
import { getUi } from "./ui/dom.js";
import { updateAmmoHud as renderAmmoHud, updateHud as renderHud } from "./ui/hud.js";
import { renderQuickbar as renderQuickbarView, renderShop as renderShopView } from "./ui/shop.js";
import { clamp, dist, rand } from "./utils/math.js";

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("game"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));

const ui = getUi();

let W = canvas.width;
let H = canvas.height;

function syncCanvasSize() {
  const width = Math.max(480, Math.floor(window.innerWidth));
  const height = Math.max(320, Math.floor(window.innerHeight));
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  W = width;
  H = height;
}

syncCanvasSize();

const keysDown = new Set();
const mouse = { screenX: W / 2, screenY: H / 2, x: 0, y: 0 };
const joystick = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0 };

let lastTime = 0;
let running = false;
let shootHeld = false;

const game = createInitialGameState();

function loadVisualAsset(src) {
  const image = new Image();
  image.decoding = "async";
  image.dataset.src = src;
  return image;
}

const visualAssets = {
  forestGround: loadVisualAsset("assets/images/forest-ground-horror-texture.webp"),
  mazeStone: loadVisualAsset("assets/images/maze-stone-horror-texture.webp"),
  worldProps: loadVisualAsset("assets/images/world-props-atlas.webp"),
  objectiveIcons: loadVisualAsset("assets/images/objective-icons-atlas.webp"),
};

const WORLD_PROP = {
  deadTree: [0, 0],
  bush: [1, 0],
  rock: [2, 0],
  rubble: [3, 0],
  tent: [0, 1],
  collapsedTent: [1, 1],
  log: [2, 1],
  sign: [3, 1],
  crate: [0, 2],
  chest: [1, 2],
  medkit: [2, 2],
  bones: [3, 2],
  entrance: [0, 3],
  door: [1, 3],
  car: [2, 3],
  wreckCar: [3, 3],
};

const OBJECTIVE_ICON = {
  key: [0, 0],
  watchtower: [1, 0],
  parking: [2, 0],
  lockedDoor: [0, 1],
  unlockedDoor: [1, 1],
  portal: [2, 1],
  radio: [0, 2],
  shopCrate: [1, 2],
  bossSigil: [2, 2],
};

const STORY_TENT_KEY = "story-tent";
const STORY_WATCHTOWER_KEY = "story-watchtower";

function imageReady(image) {
  return image.complete && image.naturalWidth > 0;
}

function ensureVisualAsset(image) {
  if (!image.src && image.dataset.src) image.src = image.dataset.src;
  return image;
}

function ensureVisualAssetsLoaded() {
  Object.values(visualAssets).forEach(ensureVisualAsset);
}

/**
 * @param {GlobalCompositeOperation} [blend]
 */
function drawTiledVisual(image, left, top, width, height, tileSize, alpha, blend = "source-over") {
  if (!imageReady(image)) return false;
  const startX = Math.floor(left / tileSize) * tileSize;
  const startY = Math.floor(top / tileSize) * tileSize;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = blend;
  for (let x = startX; x < left + width + tileSize; x += tileSize) {
    for (let y = startY; y < top + height + tileSize; y += tileSize) {
      ctx.drawImage(image, x, y, tileSize, tileSize);
    }
  }
  ctx.restore();
  return true;
}

function drawAtlasSprite(image, columns, rows, cell, x, y, width, height, rotation = 0, alpha = 1) {
  if (!imageReady(image)) return false;
  const [col, row] = cell;
  const cellW = image.naturalWidth / columns;
  const cellH = image.naturalHeight / rows;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
}

function drawWorldPulse(x, y, radius, tone = "#f0c453", strength = 1) {
  if (game.mode !== MODE.PLAYING) return;
  const time = performance.now();
  const pulse = 0.5 + Math.sin(time / 220 + x * 0.008 + y * 0.006) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 22 * strength;
  ctx.shadowColor = tone;
  ctx.strokeStyle = tone;
  ctx.lineWidth = 2;
  ctx.globalAlpha = (0.28 + pulse * 0.26) * strength;
  ctx.beginPath();
  ctx.arc(x, y, radius + pulse * 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = (0.08 + pulse * 0.12) * strength;
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.72 + pulse * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([8, 10]);
  ctx.globalAlpha = (0.24 + pulse * 0.2) * strength;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.22 + pulse * 6, -time / 900, Math.PI * 1.45 - time / 900);
  ctx.stroke();
  ctx.restore();
}

function rectCenter(rect) {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  };
}

function distanceToRectCenter(rect) {
  const center = rectCenter(rect);
  return Math.hypot(center.x - game.player.x, center.y - game.player.y);
}

function currentWeapon() {
  return getCurrentWeapon(game);
}

function currentAmmo() {
  return getCurrentAmmo(game);
}

function lowLevelWeaponIds() {
  return weapons.filter((weapon) => weapon.level <= 3).map((weapon) => weapon.id);
}

function lowLevelAmmo(ammo) {
  return {
    1: ammo["1"] || ammo[1] || CONFIG.ammo.initial,
    2: ammo["2"] || ammo[2] || 0,
    3: ammo["3"] || ammo[3] || 0,
  };
}

function applySave(data) {
  if (!data) return false;
  game.day = Math.max(1, Number(data.day) || 1);
  game.points = Math.max(0, Number(data.points) || 0);
  game.ownedWeapons = Array.isArray(data.ownedWeapons) && data.ownedWeapons.length > 0 ? data.ownedWeapons : ["pistol"];
  game.weaponId = game.ownedWeapons.includes(data.weaponId) ? data.weaponId : game.ownedWeapons[0];
  game.ammo = data.ammo && typeof data.ammo === "object" ? { ...data.ammo } : { 1: CONFIG.ammo.initial };
  return true;
}

function addAmmo(level, amount) {
  addAmmoToGame(game, level, amount);
}

function updateAmmoHud() {
  renderAmmoHud(ui, currentAmmo(), MAX_AMMO);
}

function plannedStoryEntrance(day = game.day) {
  return {
    x: 820 + day * 70,
    y: -420 - day * 35,
    w: 106,
    h: 82,
  };
}

function setupForestQuest(day = game.day) {
  game.questStage = 0;
  game.storyTent = {
    type: "tent",
    x: 360 + day * 18,
    y: -160 - day * 10,
    r: 34,
    seed: 0.36,
    key: STORY_TENT_KEY,
  };
  game.storyWatchtower = {
    type: "watchtower",
    x: 760 + day * 36,
    y: -420 - day * 22,
    r: 34,
    seed: 0.68,
    key: STORY_WATCHTOWER_KEY,
  };
  game.storyEntrance = plannedStoryEntrance(day);
  game.nightmareEntrance = null;
}

function isOpeningForestQuestActive() {
  return game.phase === "forest" && !game.forestReturn && !game.car && !game.driving && !game.escapeOnFoot;
}

function revealNightmareEntrance() {
  if (!isOpeningForestQuestActive()) return;
  game.questStage = Math.max(game.questStage || 0, 2);
  game.nightmareEntrance = game.storyEntrance || plannedStoryEntrance();
  burst(game.nightmareEntrance.x + game.nightmareEntrance.w / 2, game.nightmareEntrance.y + game.nightmareEntrance.h / 2, "#a048ff", 36);
  burst(game.nightmareEntrance.x + game.nightmareEntrance.w / 2, game.nightmareEntrance.y + game.nightmareEntrance.h / 2, "#f0c453", 18);
  playSound("open");
  setTask(2);
}

function currentObjectiveTarget() {
  if (game.phase === "maze") {
    if (game.foundKeys >= 2 && game.door) {
      return {
        x: game.door.x + game.door.w / 2,
        y: game.door.y + game.door.h / 2,
        label: "大门",
      };
    }
    const keys = game.pickups.filter((item) => item.type === "key");
    if (keys.length > 0) {
      return keys.reduce((nearest, item) => (dist(game.player, item) < dist(game.player, nearest) ? item : nearest), keys[0]);
    }
    return null;
  }
  if (game.phase !== "forest") return null;
  if ((game.driving || game.escapeOnFoot) && game.parkingLot) {
    return {
      x: game.parkingLot.x + game.parkingLot.w / 2,
      y: game.parkingLot.y + game.parkingLot.h / 2,
      label: "停车场",
    };
  }
  if (game.car) {
    return {
      x: game.car.x + game.car.w / 2,
      y: game.car.y + game.car.h / 2,
      label: "逃生车",
    };
  }
  if (isOpeningForestQuestActive() && (game.questStage || 0) <= 0 && game.storyTent) {
    return {
      x: game.storyTent.x,
      y: game.storyTent.y,
      label: "线索帐篷",
    };
  }
  if (isOpeningForestQuestActive() && game.questStage === 1 && game.storyWatchtower) {
    return {
      x: game.storyWatchtower.x,
      y: game.storyWatchtower.y,
      label: "瞭望塔",
    };
  }
  if (game.nightmareEntrance) {
    return {
      x: game.nightmareEntrance.x + game.nightmareEntrance.w / 2,
      y: game.nightmareEntrance.y + game.nightmareEntrance.h / 2,
      label: "地下入口",
    };
  }
  return null;
}

function currentObjectiveCopy() {
  if (game.phase === "maze") {
    if (game.foundKeys >= 2) return ["打开大门", "穿过迷宫出口，回到森林继续逃亡。"];
    return ["收集钥匙", `还需要 ${Math.max(0, 2 - game.foundKeys)} 把钥匙，优先绕开怪物。`];
  }
  if (game.driving) return ["冲向停车场", "车辆无法射击，利用走位甩开追击。"];
  if (game.escapeOnFoot) return ["徒步抵达停车场", "车已损坏，保持距离，别被围住。"];
  if (game.car) return ["找到逃生车", "跟随信标靠近车辆，准备进入最终逃亡。"];
  if (isOpeningForestQuestActive() && (game.questStage || 0) <= 0) return ["搜寻帐篷", "找到入口线索，再去瞭望塔确认方向。"];
  if (isOpeningForestQuestActive() && game.questStage === 1) return ["登上瞭望塔", "在高处定位地下入口，入口才会显现。"];
  if (game.nightmareEntrance) return ["寻找地下入口", "进入噩梦迷宫，拿到逃生所需钥匙。"];
  return ["活下去", "击败怪物、搜刮补给，等待新的逃生线索。"];
}

function updateObjectiveHud() {
  if (!(ui.objectiveToast instanceof HTMLElement) || !(ui.threatMeter instanceof HTMLElement)) return;
  const visible = game.mode === MODE.PLAYING;
  ui.objectiveToast.classList.toggle("hidden", !visible);
  ui.threatMeter.classList.toggle("hidden", !visible);
  if (!visible) return;

  const [title, detail] = currentObjectiveCopy();
  ui.objectiveTitle.textContent = title;
  ui.objectiveDetail.textContent = detail;

  const threat = monsterThreatAlpha();
  const level = threat > 0.42 ? "high" : threat > 0.18 ? "medium" : "low";
  ui.threatMeter.dataset.level = level;
  ui.threatLevel.textContent = level === "high" ? "高" : level === "medium" ? "中" : "低";
}

function seededNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function circleCircle(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
}

function forestBushLimit() {
  const dayFactor = clamp(1 - (game.day - 1) * 0.09, 0.18, 1);
  return 0.31 + 0.27 * dayFactor;
}

function forestFeatureForCell(gx, gy) {
  const roll = seededNoise(gx + 19, gy - 23);
  if (roll < 0.16) return null;
  const x = gx * FOREST_FEATURE_CELL + 36 + seededNoise(gx + 31, gy) * 108;
  const y = gy * FOREST_FEATURE_CELL + 36 + seededNoise(gx, gy + 41) * 108;
  const key = `${gx},${gy}`;
  if (Math.hypot(x, y) < 220) return null;
  if (game.car && circleRect({ x, y, r: 95 }, game.car)) return null;
  if (roll < 0.31) {
    return {
      key,
      type: "rock",
      x,
      y,
      r: 30 + seededNoise(gx - 7, gy + 9) * 20,
      seed: seededNoise(gx + 5, gy + 5),
    };
  }
  if (roll < forestBushLimit()) {
    return {
      key,
      type: "bush",
      x,
      y,
      r: 42 + seededNoise(gx + 13, gy - 11) * 28,
      seed: seededNoise(gx - 17, gy + 29),
    };
  }
  return null;
}

function forestFeaturesNear(x, y, radius) {
  const features = [];
  const startX = Math.floor((x - radius) / FOREST_FEATURE_CELL) - 1;
  const endX = Math.ceil((x + radius) / FOREST_FEATURE_CELL) + 1;
  const startY = Math.floor((y - radius) / FOREST_FEATURE_CELL) - 1;
  const endY = Math.ceil((y + radius) / FOREST_FEATURE_CELL) + 1;
  for (let gx = startX; gx <= endX; gx += 1) {
    for (let gy = startY; gy <= endY; gy += 1) {
      const feature = forestFeatureForCell(gx, gy);
      if (!feature) continue;
      if (feature.type === "bush" && game.removedBushes.has(feature.key)) continue;
      if (Math.hypot(feature.x - x, feature.y - y) < radius + feature.r) {
        features.push(feature);
      }
    }
  }
  return features;
}

function forestDecorForCell(gx, gy) {
  const roll = seededNoise(gx + 101, gy - 71);
  if (roll < 0.78) return null;
  const x = gx * 320 + 60 + seededNoise(gx + 103, gy) * 200;
  const y = gy * 320 + 60 + seededNoise(gx, gy + 107) * 200;
  if (Math.hypot(x, y) < 260) return null;
  const variants = ["tent", "log", "bones", "crate", "sign", "campfire", "watchtower", "watchtower"];
  return {
    type: variants[Math.floor(seededNoise(gx - 43, gy + 61) * variants.length) % variants.length],
    x,
    y,
    r: 34,
    seed: seededNoise(gx + 13, gy + 17),
    key: `${gx},${gy}`,
  };
}

function hitsForestRock(circle) {
  if (game.phase !== "forest") return false;
  return forestFeaturesNear(circle.x, circle.y, circle.r + 80)
    .some((feature) => feature.type === "rock" && !game.brokenRocks.has(feature.key) && circleCircle(circle, feature));
}

function isInBush(circle) {
  if (game.phase !== "forest") return false;
  return Boolean(bushContaining(circle));
}

function bushContaining(circle) {
  if (game.phase !== "forest") return null;
  return forestFeaturesNear(circle.x, circle.y, circle.r + 90)
    .find((feature) => feature.type === "bush" && Math.hypot(circle.x - feature.x, circle.y - feature.y) < feature.r * 0.72) || null;
}

function upgradeForestMonsters(levels) {
  game.danger += levels;
  game.monsters.forEach((monster) => {
    monster.level = (monster.level || 1) + levels;
    monster.day = Math.max(monster.day || 1, game.day);
    const hpGain = Math.ceil(levels * 2.2);
    monster.maxHp += hpGain;
    monster.hp += hpGain;
    monster.speed += levels * 8;
    monster.r += levels * 1.2;
    monster.bite = monsterDamage(monster);
    burst(monster.x, monster.y, "#5cc7ff", 10);
  });
}

function updateBushHiding(dt) {
  if (game.phase !== "forest" || game.driving) {
    game.hidden = false;
    game.bushHideKey = null;
    game.bushHideTime = 0;
    return;
  }
  const bush = bushContaining(game.player);
  game.hidden = Boolean(bush);
  if (!bush) {
    game.bushHideKey = null;
    game.bushHideTime = 0;
    return;
  }
  if (game.bushHideKey !== bush.key) {
    game.bushHideKey = bush.key;
    game.bushHideTime = 0;
  }
  game.bushHideTime += dt;
  if (game.bushHideTime >= 10) {
    game.removedBushes.add(bush.key);
    game.hidden = false;
    game.bushHideKey = null;
    game.bushHideTime = 0;
    burst(bush.x, bush.y, "#3d7445", 34);
    upgradeForestMonsters(2);
  }
}

function updateTentSearching(dt) {
  if (game.phase !== "forest" || game.driving) {
    game.nearTent = null;
    return;
  }
  game.tentSearchCooldown = Math.max(0, game.tentSearchCooldown - dt);
  // 找到最近的帐篷（包括已搜刮的，用于显示提示）
  let nearest = null;
  let nearestDist = Infinity;
  const px = game.player.x;
  const py = game.player.y;
  if (isOpeningForestQuestActive() && game.storyTent) {
    const d = Math.hypot(px - game.storyTent.x, py - game.storyTent.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = game.storyTent;
    }
  }
  const searchRadius = 200; // 搜索范围
  const startX = Math.floor((px - searchRadius) / 320) - 1;
  const endX = Math.ceil((px + searchRadius) / 320) + 1;
  const startY = Math.floor((py - searchRadius) / 320) - 1;
  const endY = Math.ceil((py + searchRadius) / 320) + 1;
  for (let gx = startX; gx <= endX; gx += 1) {
    for (let gy = startY; gy <= endY; gy += 1) {
      const decor = forestDecorForCell(gx, gy);
      if (!decor || decor.type !== "tent") continue;
      const dx = px - decor.x;
      const dy = py - decor.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = decor;
      }
    }
  }
  // 距离小于80像素时显示提示
  if (nearest && nearestDist < 80) {
    game.nearTent = nearest;
  } else {
    game.nearTent = null;
  }
}

function searchTent(tent) {
  if (game.tentSearchCooldown > 0) return;
  if (game.searchedTents.has(tent.key)) return;
  game.tentSearchCooldown = 0.5;
  game.searchedTents.add(tent.key);
  if (isOpeningForestQuestActive() && (game.questStage || 0) <= 0) {
    game.questStage = 1;
    setTask(1);
    burst(tent.x, tent.y - 36, "#f0c453", 22);
    playSound("pickup");
    if (game.storyWatchtower?.key && game.searchedWatchtowers.has(game.storyWatchtower.key)) revealNightmareEntrance();
  }
  // 奖励：50% 医疗包，50% 积分
  if (Math.random() < 0.5) {
    const level = Math.floor(Math.random() * 3) + 1;
    game.pickups.push({
      x: tent.x,
      y: tent.y,
      type: "medkit",
      level: level,
      r: 12,
      life: 9999,
    });
    burst(tent.x, tent.y - 20, "#ff4444", 8);
  } else {
    const points = Math.floor(Math.random() * 100) + 50;
    game.points += points;
    burst(tent.x, tent.y - 20, "#ffd700", 8);
  }
  // 视觉效果
  burst(tent.x, tent.y, "#4b392f", 20);
  burst(tent.x, tent.y, "#8b7355", 10);
  writeSave(game);
}

function isOnRockDebris(circle) {
  if (game.phase !== "forest") return false;
  return forestFeaturesNear(circle.x, circle.y, circle.r + 90)
    .some((feature) => feature.type === "rock" && game.brokenRocks.has(feature.key) && Math.hypot(circle.x - feature.x, circle.y - feature.y) < feature.r * 0.86);
}

// ========== 瞭望塔系统 ==========

function watchtowerContaining(circle) {
  if (game.phase !== "forest") return null;
  const px = circle.x;
  const py = circle.y;
  if (isOpeningForestQuestActive() && game.storyWatchtower) {
    const d = Math.hypot(px - game.storyWatchtower.x, py - game.storyWatchtower.y);
    if (d < 55) return game.storyWatchtower;
  }
  const searchRadius = 200;
  const startX = Math.floor((px - searchRadius) / 320) - 1;
  const endX = Math.ceil((px + searchRadius) / 320) + 1;
  const startY = Math.floor((py - searchRadius) / 320) - 1;
  const endY = Math.ceil((py + searchRadius) / 320) + 1;
  for (let gx = startX; gx <= endX; gx += 1) {
    for (let gy = startY; gy <= endY; gy += 1) {
      const decor = forestDecorForCell(gx, gy);
      if (!decor || decor.type !== "watchtower") continue;
      const d = Math.hypot(px - decor.x, py - decor.y);
      if (d < 55) return decor;
    }
  }
  return null;
}

function updateWatchtowerHiding(dt) {
  if (game.phase !== "forest" || game.driving) {
    game.inWatchtower = false;
    game.nearWatchtower = null;
    game.watchtowerSearchCooldown = Math.max(0, game.watchtowerSearchCooldown - dt);
    return;
  }
  game.watchtowerSearchCooldown = Math.max(0, game.watchtowerSearchCooldown - dt);
  const tower = watchtowerContaining(game.player);
  game.inWatchtower = Boolean(tower);
  if (tower) {
    game.nearWatchtower = tower;
  } else {
    // 检查附近是否有未搜刮的瞭望塔（显示提示）
    let nearest = null;
    let nearestDist = Infinity;
    const px = game.player.x;
    const py = game.player.y;
    if (isOpeningForestQuestActive() && game.storyWatchtower) {
      const d = Math.hypot(px - game.storyWatchtower.x, py - game.storyWatchtower.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = game.storyWatchtower;
      }
    }
    const startX = Math.floor((px - 200) / 320) - 1;
    const endX = Math.ceil((px + 200) / 320) + 1;
    const startY = Math.floor((py - 200) / 320) - 1;
    const endY = Math.ceil((py + 200) / 320) + 1;
    for (let gx = startX; gx <= endX; gx += 1) {
      for (let gy = startY; gy <= endY; gy += 1) {
        const decor = forestDecorForCell(gx, gy);
        if (!decor || decor.type !== "watchtower") continue;
        const d = Math.hypot(px - decor.x, py - decor.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = decor;
        }
      }
    }
    if (nearest && nearestDist < 90) {
      game.nearWatchtower = nearest;
    } else {
      game.nearWatchtower = null;
    }
  }
}

function searchWatchtower(tower) {
  if (game.watchtowerSearchCooldown > 0) return;
  if (game.searchedWatchtowers.has(tower.key)) return;
  game.watchtowerSearchCooldown = 0.5;
  game.searchedWatchtowers.add(tower.key);
  const shouldRevealEntrance = isOpeningForestQuestActive() && game.questStage === 1;
  // 奖励池：武器、子弹、医疗包、积分
  const roll = Math.random();
  if (roll < 0.25) {
    // 25% 概率：随机武器（玩家尚未拥有的低等级武器，或当前武器等级的子弹）
    const availableWeapons = weapons.filter((w) => !game.ownedWeapons.includes(w.id) && w.level <= Math.min(24, game.day * 3 + 2));
    if (availableWeapons.length > 0) {
      const weapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
      game.ownedWeapons.push(weapon.id);
      game.weaponId = weapon.id;
      addAmmoToGame(game, weapon.level, ammoPackSize(weapon.level) * 2);
      game.weaponSwitchTimer = 0.48;
      burst(tower.x, tower.y - 30, weapon.color || "#ffd700", 12);
      playSound("buy");
    } else {
      // 如果已有所有武器，给子弹
      const weapon = getCurrentWeapon(game);
      const ammoLevel = weapon.level;
      const amount = ammoPackSize(ammoLevel) * 2;
      addAmmoToGame(game, ammoLevel, amount);
      burst(tower.x, tower.y - 30, "#9fe6ff", 10);
      playSound("pickup");
    }
  } else if (roll < 0.5) {
    // 25% 概率：子弹包
    const weapon = getCurrentWeapon(game);
    const ammoLevel = weapon.level;
    const amount = ammoPackSize(ammoLevel) * 3;
    addAmmoToGame(game, ammoLevel, amount);
    burst(tower.x, tower.y - 30, "#9fe6ff", 10);
    playSound("pickup");
  } else if (roll < 0.75) {
    // 25% 概率：医疗包
    const level = Math.floor(Math.random() * 3) + 1;
    game.pickups.push({
      x: tower.x,
      y: tower.y,
      type: "medkit",
      level: level,
      r: 12,
      life: 9999,
    });
    burst(tower.x, tower.y - 30, "#ff4444", 8);
    playSound("pickup");
  } else {
    // 25% 概率：积分
    const points = Math.floor(Math.random() * 150) + 100;
    game.points += points;
    burst(tower.x, tower.y - 30, "#ffd700", 10);
    playSound("pickup");
  }
  // 视觉效果
  burst(tower.x, tower.y, "#5a4a3a", 20);
  burst(tower.x, tower.y, "#8b7355", 10);
  writeSave(game);
  renderQuickbar();
  updateAmmoHud();
  if (game.shopOpen) renderShop();
  if (shouldRevealEntrance) revealNightmareEntrance();
}

function hitRockWithBullet(bullet) {
  if (game.phase !== "forest") return false;
  const rock = forestFeaturesNear(bullet.x, bullet.y, bullet.r + 80)
    .find((feature) => feature.type === "rock" && !game.brokenRocks.has(feature.key) && circleCircle(bullet, feature));
  if (!rock) return false;
  if ((bullet.weaponLevel || 1) >= 3) {
    game.rockHits[rock.key] = (game.rockHits[rock.key] || 0) + 1;
    burst(bullet.x, bullet.y, "#b8b6a8", 6);
    if (game.rockHits[rock.key] >= 10) {
      game.brokenRocks.add(rock.key);
      burst(rock.x, rock.y, "#9a988f", 34);
    }
  }
  return true;
}

function setTask(index) {
  ui.tasks.forEach((item, i) => item.classList.toggle("active", i === index));
}

function renderShop() {
  renderShopView({
    ammoArt,
    ammoPackSize,
    ammoPrice,
    game,
    maxAmmo: MAX_AMMO,
    ui,
    weaponArt,
    weapons,
    weaponStats,
  });
}

function renderQuickbar() {
  renderQuickbarView({ game, ui, weaponArt, weapons });
}

function setShopOpen(open) {
  if (open && (game.driving || game.escapeOnFoot)) return;
  game.shopOpen = open;
  game.mode = open ? MODE.SHOP : running ? MODE.PLAYING : MODE.MENU;
  if (open) shootHeld = false;
  ui.shopPanel.classList.toggle("hidden", !open);
  if (open) renderShop();
}

function setShopTab(tab) {
  game.shopTab = tab === "ammo" ? "ammo" : "weapons";
  renderShop();
}

function buyOrEquipWeapon(id) {
  const weapon = weapons.find((item) => item.id === id);
  if (!weapon) return;
  const previousWeapon = game.weaponId;
  if (!game.ownedWeapons.includes(id)) {
    if (game.points < weapon.price) return;
    game.points -= weapon.price;
    game.ownedWeapons.push(id);
  }
  game.weaponId = id;
  if (previousWeapon !== id) game.weaponSwitchTimer = 0.48;
  writeSave(game);
  playSound(previousWeapon !== id ? "buy" : "pickup");
  if (game.shopOpen) renderShop();
  renderQuickbar();
  updateAmmoHud();
}

function buyAmmo(level) {
  const ammoLevel = clamp(Number(level), 1, 24);
  const stock = game.ammo[String(ammoLevel)] || 0;
  if (stock >= MAX_AMMO) return;
  const price = ammoPrice(ammoLevel);
  if (game.points < price) return;
  game.points -= price;
  addAmmo(ammoLevel, ammoPackSize(ammoLevel));
  writeSave(game);
  playSound("buy");
  renderShop();
  updateAmmoHud();
}

function resetGame(options = {}) {
  const preserveProgress = Boolean(options.preserveProgress);
  const failureRestart = Boolean(options.failureRestart);
  const loadedSave = !preserveProgress && options.loadSave ? readSave() : null;
  const nextDay = options.day || loadedSave?.day || 1;
  const fallbackWeapons = lowLevelWeaponIds();
  const saved = {
    points: failureRestart ? 0 : loadedSave?.points ?? game.points,
    weaponId: failureRestart && !fallbackWeapons.includes(game.weaponId) ? "pistol" : loadedSave?.weaponId ?? game.weaponId,
    ownedWeapons: failureRestart ? game.ownedWeapons.filter((id) => fallbackWeapons.includes(id)) : loadedSave?.ownedWeapons ?? [...game.ownedWeapons],
    ammo: failureRestart ? lowLevelAmmo(game.ammo) : loadedSave?.ammo ?? { ...game.ammo },
  };
  if (!Array.isArray(saved.ownedWeapons) || saved.ownedWeapons.length === 0) saved.ownedWeapons = ["pistol"];
  if (!saved.ownedWeapons.includes(saved.weaponId)) saved.weaponId = saved.ownedWeapons[0] || "pistol";
  if (failureRestart && saved.ownedWeapons.length === 0) saved.ownedWeapons = ["pistol"];
  game.phase = "forest";
  game.player = { x: 0, y: 0, r: 15, hp: 100, speed: 205, angle: 0, damageCooldown: 0 };
  game.bullets = [];
  game.muzzleFlashes = [];
  game.monsters = [];
  game.particles = [];
  game.pickups = [];
  game.walls = [];
  game.door = null;
  game.car = null;
  game.nightmareEntrance = null;
  game.wreckCar = null;
  game.parkingLot = null;
  game.camera = { x: -W / 2, y: -H / 2 };
  game.screenShake = 0;
  game.hidden = false;
  game.rockHits = {};
  game.brokenRocks = new Set();
  game.removedBushes = new Set();
  game.bushHideKey = null;
  game.bushHideTime = 0;
  const restoreProgress = preserveProgress || Boolean(loadedSave);
  game.points = restoreProgress ? saved.points : 0;
  game.weaponId = restoreProgress ? saved.weaponId : "pistol";
  game.ownedWeapons = restoreProgress ? saved.ownedWeapons : ["pistol"];
  game.ammo = restoreProgress ? saved.ammo : { 1: CONFIG.ammo.initial };
  game.ammoSpawnTimer = rand(6, 12);
  game.medkitSpawnTimer = rand(8, 16);
  game.chestSpawnTimer = rand(10, 18);
  game.driveChaseTimer = 0;
  game.vehicleHp = CONFIG.vehicle.hp;
  game.vehicleDamageCooldown = 0;
  game.healingTimer = 0;
  game.healingLevel = 0;
  game.shopTab = "weapons";
  game.shopOpen = false;
  game.mode = running ? MODE.PLAYING : MODE.MENU;
  ui.shopPanel.classList.add("hidden");
  game.foundKeys = 0;
  game.day = nextDay;
  game.scene = sceneForDay(game.day);
  game.driving = false;
  game.escapeOnFoot = false;
  game.danger = Math.max(1, 1 + (game.day - 1) * 0.55);
  game.spawnTimer = 6.2;
  game.shootCooldown = 0;
  game.forestReturn = false;
  game.won = false;
  game.searchedTents = new Set();
  game.tentSearchCooldown = 0;
  game.searchedWatchtowers = new Set();
  game.inWatchtower = false;
  game.nearWatchtower = null;
  game.watchtowerSearchCooldown = 0;
  setupForestQuest(game.day);
  updateMouseWorld();
  renderShop();
  renderQuickbar();
  updateAmmoHud();
  setTask(0);
  spawnForestMonsters(2 + game.day);
}

function start() {
  stopIntroAtmosphere();
  ensureVisualAssetsLoaded();
  resetGame({ loadSave: true });
  running = true;
  game.mode = MODE.PLAYING;
  ui.banner.classList.add("hidden");
  playSound("open");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function startIntroAtmosphere() {
  startIntroAmbience();
}

function stopIntroAtmosphere() {
  stopIntroSounds();
}

function showIntro() {
  game.mode = MODE.MENU;
  shootHeld = false;
  startIntroAtmosphere();
  ensureVisualAssetsLoaded();
  ui.banner.classList.remove("result-screen", "result-success", "result-failure");
  ui.banner.classList.remove("home-menu");
  ui.banner.innerHTML = `
    <div class="intro-scene intro-premium" aria-label="开场剧情">
      <div class="intro-cinema-bg"></div>
      <div class="intro-grain"></div>
      <div class="intro-scanline"></div>
      <div class="intro-glass-rain"></div>
      <div class="intro-danger-pulse"></div>

      <div class="intro-chapter">
        <span class="intro-chapter-label">CASE FILE 07</span>
        <strong>失联后的第七夜</strong>
      </div>

      <div class="intro-story intro-dossier">
        <span class="intro-dossier-kicker">最后一段车载记录</span>
        <p class="intro-line intro-line-1">老板跟我说，来这片森林打猎，四天后派车来接我。</p>
        <p class="intro-line intro-line-2">第四天，车没有来。第五天，也没有。</p>
        <p class="intro-line intro-line-3">食物吃光了。夜里，窗外有东西在走动。</p>
        <p class="intro-line intro-line-4">我不知道那是什么。</p>
        <p class="intro-line intro-line-5">但我知道，<em>我必须离开这里。</em></p>
      </div>

      <div class="intro-bottom">
        <div class="intro-day-counter">目标：搜寻线索，定位地下入口</div>
        <button id="introStartBtn" class="intro-start" type="button">开始逃亡</button>
      </div>
    </div>

    <style>
      .intro-scene {
        position: absolute; inset: 0;
        background: #080608;
        overflow: hidden;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: inherit;
      }
      /* 底层噪点纹理 */
      .intro-bg-noise {
        position: absolute; inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
        opacity: 0.18;
        mix-blend-mode: overlay;
        pointer-events: none;
      }
      /* 雾气层 1 */
      .intro-fog-layer {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse 120% 60% at 50% 110%, rgba(18,22,15,0.92) 0%, transparent 70%);
        animation: introFogDrift 18s ease-in-out infinite alternate;
        pointer-events: none;
      }
      /* 雾气层 2（反向漂移，更有深度） */
      .intro-fog-layer-2 {
        background: radial-gradient(ellipse 80% 40% at 30% 80%, rgba(10,14,10,0.7) 0%, transparent 65%);
        animation: introFogDrift2 24s ease-in-out infinite alternate;
        opacity: 0.7;
      }
      @keyframes introFogDrift {
        from { transform: translateX(-4%) scaleY(1); }
        to   { transform: translateX(4%) scaleY(1.08); }
      }
      @keyframes introFogDrift2 {
        from { transform: translateX(5%) translateY(0); }
        to   { transform: translateX(-3%) translateY(-4%); }
      }
      /* 四周暗角 */
      .intro-vignette {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse 90% 90% at 50% 50%, transparent 38%, rgba(0,0,0,0.82) 100%);
        pointer-events: none;
      }
      /* 底部血红色微光（压抑、危险感） */
      .intro-blood-glow {
        position: absolute; bottom: 0; left: 0; right: 0; height: 38%;
        background: radial-gradient(ellipse 70% 100% at 50% 100%, rgba(90,8,8,0.28) 0%, transparent 70%);
        animation: introBloodPulse 4.2s ease-in-out infinite alternate;
        pointer-events: none;
      }
      @keyframes introBloodPulse {
        from { opacity: 0.6; }
        to   { opacity: 1; }
      }
      /* 雨线 */
      .intro-rain {
        position: absolute; inset: 0;
        background-image: repeating-linear-gradient(
          97deg,
          transparent 0px, transparent 3px,
          rgba(140,160,155,0.055) 3px, rgba(140,160,155,0.055) 4px
        );
        background-size: 6px 100%;
        animation: introRainFall 0.18s linear infinite;
        pointer-events: none;
      }
      @keyframes introRainFall {
        from { background-position: 0 0; }
        to   { background-position: 0 28px; }
      }
      /* 道路 */
      .intro-road {
        position: absolute; bottom: 0; left: 0; right: 0; height: 28%;
        background: linear-gradient(to top, #0e0e0e 0%, #111310 60%, transparent 100%);
      }
      .intro-lane {
        position: absolute; left: 50%; top: 30%; transform: translateX(-50%);
        width: 6px; height: 60%; background: rgba(180,170,130,0.12);
        animation: introLaneDash 1.1s linear infinite;
      }
      @keyframes introLaneDash {
        from { background-position: 0 0; }
        to   { background-position: 0 40px; }
      }
      .intro-car {
        position: absolute; left: 50%; bottom: 32%; transform: translateX(-50%);
        width: 52px; height: 26px;
        background: #1a1a1a; border-radius: 4px 4px 2px 2px;
        box-shadow: 0 0 8px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .intro-car-top {
        position: absolute; top: -14px; left: 8px; right: 8px; height: 15px;
        background: #161616; border-radius: 4px 4px 0 0;
      }
      .intro-wheel {
        position: absolute; bottom: -7px; width: 13px; height: 13px;
        background: #111; border-radius: 50%;
        border: 2px solid #2a2a2a;
        animation: introWheelSpin 0.6s linear infinite;
      }
      .intro-wheel-a { left: 5px; }
      .intro-wheel-b { right: 5px; }
      @keyframes introWheelSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      /* 故事文字 */
      .intro-story {
        position: relative; z-index: 10;
        text-align: center;
        max-width: 520px;
        padding: 0 24px;
        margin-bottom: 8px;
      }
      .intro-line {
        display: block;
        font-size: 15px;
        line-height: 1.9;
        color: rgba(195,185,165,0);
        letter-spacing: 0.06em;
        font-weight: 300;
        opacity: 0;
        transform: translateY(6px);
        animation: introLineFade 1.2s ease forwards;
        text-shadow: 0 0 18px rgba(80,60,40,0.6);
      }
      .intro-line em {
        color: rgba(210,100,80,0.92);
        font-style: normal;
        font-weight: 500;
      }
      .intro-line-1 { animation-delay: 0.8s; }
      .intro-line-2 { animation-delay: 2.6s; }
      .intro-line-3 { animation-delay: 4.8s; }
      .intro-line-4 { animation-delay: 7.2s; }
      .intro-line-5 { animation-delay: 9.0s; }
      @keyframes introLineFade {
        from { opacity: 0; transform: translateY(8px); color: rgba(195,185,165,0); }
        to   { opacity: 1; transform: translateY(0);   color: rgba(195,185,165,0.82); }
      }
      /* 底部区域 */
      .intro-bottom {
        position: relative; z-index: 10;
        display: flex; flex-direction: column; align-items: center; gap: 14px;
        margin-top: 24px;
        opacity: 0;
        animation: introLineFade 1.4s ease forwards;
        animation-delay: 11.5s;
      }
      .intro-day-counter {
        font-size: 12px;
        letter-spacing: 0.18em;
        color: rgba(160,140,120,0.5);
        text-transform: uppercase;
      }
      .intro-day-num {
        color: rgba(200,80,60,0.7);
        font-weight: 600;
      }
      /* 开始按钮 */
      .intro-start {
        padding: 11px 38px;
        background: transparent;
        border: 1px solid rgba(160,60,50,0.55);
        color: rgba(210,170,150,0.85);
        font-size: 14px;
        letter-spacing: 0.2em;
        cursor: pointer;
        transition: background 0.3s, border-color 0.3s, color 0.3s, box-shadow 0.3s;
        text-transform: uppercase;
      }
      .intro-start:hover {
        background: rgba(120,20,18,0.35);
        border-color: rgba(200,80,60,0.8);
        color: rgba(230,190,170,1);
        box-shadow: 0 0 18px rgba(160,40,30,0.4);
      }
      .intro-scene.intro-premium {
        justify-content: flex-start;
        align-items: stretch;
        background:
          linear-gradient(90deg, rgba(2, 5, 7, 0.9) 0%, rgba(3, 7, 9, 0.68) 36%, rgba(5, 7, 8, 0.24) 66%, rgba(0, 0, 0, 0.74) 100%),
          linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.74)),
          url("assets/images/intro-story-cockpit.webp") center / cover no-repeat;
      }
      .intro-cinema-bg {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 68% 44%, rgba(239, 199, 116, 0.12), transparent 18%),
          radial-gradient(circle at 28% 82%, rgba(148, 19, 20, 0.28), transparent 24%),
          linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.76));
        pointer-events: none;
      }
      .intro-grain,
      .intro-scanline,
      .intro-glass-rain,
      .intro-danger-pulse {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .intro-grain {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.16'/%3E%3C/svg%3E");
        opacity: 0.25;
        mix-blend-mode: overlay;
      }
      .intro-scanline {
        background: repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 8px);
        opacity: 0.22;
      }
      .intro-glass-rain {
        background:
          repeating-linear-gradient(102deg, transparent 0 11px, rgba(165, 195, 200, 0.07) 11px 12px),
          radial-gradient(ellipse at 52% 22%, rgba(205, 232, 235, 0.12), transparent 26%);
        animation: introRainFall 0.32s linear infinite;
        opacity: 0.56;
      }
      .intro-danger-pulse {
        background: radial-gradient(ellipse at 23% 88%, rgba(175, 20, 22, 0.28), transparent 30%);
        animation: introBloodPulse 2.8s ease-in-out infinite alternate;
      }
      .intro-chapter {
        position: absolute;
        top: clamp(28px, 5vw, 72px);
        right: clamp(24px, 5vw, 76px);
        z-index: 10;
        width: min(250px, 42vw);
        padding: 14px 16px;
        border: 1px solid rgba(240, 196, 83, 0.22);
        border-radius: 8px;
        background: rgba(2, 7, 8, 0.56);
        backdrop-filter: blur(12px);
        box-shadow: 0 18px 58px rgba(0, 0, 0, 0.45);
      }
      .intro-chapter-label,
      .intro-chapter strong {
        display: block;
      }
      .intro-chapter-label {
        color: rgba(240, 196, 83, 0.68);
        font-size: 11px;
        letter-spacing: 0.18em;
      }
      .intro-chapter strong {
        margin-top: 5px;
        color: rgba(246, 237, 219, 0.9);
        font-size: 18px;
      }
      .intro-story.intro-dossier {
        position: absolute;
        left: clamp(28px, 7vw, 92px);
        top: 50%;
        z-index: 10;
        width: min(620px, 86vw);
        max-width: none;
        padding: 0;
        margin: 0;
        transform: translateY(-48%);
        text-align: left;
      }
      .intro-dossier-kicker {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        color: rgba(238, 246, 238, 0.58);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
      }
      .intro-dossier-kicker::before {
        content: "";
        width: 26px;
        height: 1px;
        background: rgba(228, 91, 79, 0.78);
        box-shadow: 0 0 14px rgba(228, 91, 79, 0.48);
      }
      .intro-premium .intro-line {
        margin: 0 0 10px;
        color: rgba(229, 219, 198, 0.82);
        font-size: clamp(17px, 2vw, 27px);
        line-height: 1.65;
        letter-spacing: 0.02em;
        opacity: 0;
        transform: translateY(10px);
        animation: introPremiumLineFade 0.78s ease forwards;
        text-shadow: 0 4px 30px rgba(0, 0, 0, 0.84);
      }
      .intro-premium .intro-line em {
        color: #ff6b67;
        text-shadow: 0 0 24px rgba(228, 91, 79, 0.52);
      }
      .intro-premium .intro-line-1 { animation-delay: 0.35s; }
      .intro-premium .intro-line-2 { animation-delay: 1.55s; }
      .intro-premium .intro-line-3 { animation-delay: 2.9s; }
      .intro-premium .intro-line-4 { animation-delay: 4.2s; }
      .intro-premium .intro-line-5 { animation-delay: 5.2s; }
      @keyframes introPremiumLineFade {
        from { opacity: 0; transform: translateY(10px); filter: blur(2px); }
        to { opacity: 1; transform: translateY(0); filter: blur(0); }
      }
      .intro-premium .intro-bottom {
        position: absolute;
        left: clamp(28px, 7vw, 92px);
        bottom: clamp(30px, 7vh, 72px);
        z-index: 10;
        align-items: flex-start;
        margin: 0;
        gap: 16px;
        opacity: 0;
        animation: introLineFade 1s ease forwards;
        animation-delay: 3.2s;
      }
      .intro-premium .intro-day-counter {
        color: rgba(229, 219, 198, 0.6);
        font-size: 12px;
        letter-spacing: 0.08em;
      }
      .intro-premium .intro-start {
        position: relative;
        left: auto;
        right: auto;
        bottom: auto;
        transform: none;
        min-width: 210px;
        min-height: 56px;
        padding: 0 34px;
        border-color: rgba(240, 196, 83, 0.68);
        border-radius: 8px;
        color: #fff7dc;
        background:
          linear-gradient(180deg, rgba(240, 196, 83, 0.3), rgba(81, 27, 22, 0.78)),
          linear-gradient(90deg, #55191a, #9d3825 58%, #d0a04b);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.1) inset,
          0 0 34px rgba(188, 42, 35, 0.46),
          0 20px 54px rgba(0, 0, 0, 0.6);
        font-weight: 900;
        letter-spacing: 0.16em;
        animation: home-start-breathe 2.2s ease-in-out infinite;
      }
      .banner .intro-scene.intro-premium .intro-start {
        position: relative;
        left: auto;
        right: auto;
        bottom: auto;
        opacity: 1;
        transform: none;
        animation: home-start-breathe 2.2s ease-in-out infinite;
      }
      .intro-premium .intro-start:hover {
        border-color: rgba(255, 224, 133, 0.95);
        background:
          linear-gradient(180deg, rgba(255, 216, 119, 0.42), rgba(106, 31, 24, 0.82)),
          linear-gradient(90deg, #6a1f20, #b1442d 58%, #e2b85f);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.14) inset,
          0 0 46px rgba(206, 54, 42, 0.62),
          0 24px 62px rgba(0, 0, 0, 0.64);
      }
      @media (max-width: 900px) {
        .intro-scene.intro-premium {
          background-position: 62% center;
        }
        .intro-chapter {
          top: 18px;
          right: 18px;
          width: 180px;
          padding: 10px 12px;
        }
        .intro-chapter-label {
          font-size: 9px;
        }
        .intro-chapter strong {
          font-size: 14px;
        }
        .intro-story.intro-dossier {
          left: 22px;
          right: 22px;
          top: auto;
          bottom: 176px;
          width: auto;
          transform: none;
        }
        .intro-dossier-kicker {
          margin-bottom: 12px;
          font-size: 10px;
        }
        .intro-premium .intro-line {
          margin-bottom: 8px;
          font-size: 16px;
          line-height: 1.58;
        }
        .intro-premium .intro-bottom {
          left: 22px;
          bottom: 32px;
          right: 22px;
        }
        .intro-premium .intro-start {
          width: 100%;
          min-height: 54px;
        }
      }
    </style>
  `;
  ui.banner.classList.remove("hidden");
}

function startNextDay() {
  resetGame({ day: game.day + 1, preserveProgress: true });
  running = true;
  game.mode = MODE.PLAYING;
  ui.banner.classList.add("hidden");
  writeSave(game);
  playSound("open");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function restartFailedDay() {
  resetGame({ day: game.day, preserveProgress: true, failureRestart: true });
  running = true;
  game.mode = MODE.PLAYING;
  ui.banner.classList.add("hidden");
  writeSave(game);
  playSound("open");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function showMainMenu() {
  running = false;
  clearSave();
  resetGame();
  game.mode = MODE.MENU;
  ui.banner.classList.remove("result-screen", "result-success", "result-failure");
  ui.banner.classList.add("home-menu");
  ui.banner.innerHTML = `
    <div class="home-copy">
      <span class="home-kicker">DAY 7 · SURVIVAL HORROR</span>
      <h1>迷雾森林逃生</h1>
      <p>车灯还亮着，森林深处的门已经打开。带上最后的子弹，别回头。</p>
      <div class="home-actions">
        <button id="startBtn" class="primary-start" type="button">开始游戏</button>
        <span class="home-note">第七夜记录</span>
      </div>
    </div>
    <div class="home-status" aria-hidden="true">
      <span>入口线索残缺</span>
      <strong>待定位</strong>
    </div>
  `;
  ui.banner.classList.remove("hidden");
  draw();
}

function enterMaze() {
  game.phase = "maze";
  game.nightmareEntrance = null;
  game.questStage = Math.max(game.questStage || 0, 3);
  game.player.x = MAZE_START.x;
  game.player.y = MAZE_START.y;
  game.player.hp = 100;
  game.player.damageCooldown = 0;
  game.healingTimer = 0;
  game.healingLevel = 0;
  game.bullets = [];
  game.muzzleFlashes = [];
  game.monsters = [];
  resetMazeKeys();
  game.door = { x: MAZE_TILE * 45.8, y: MAZE_TILE * 29.8, w: 76, h: 76 };
  game.walls = buildMaze();
  game.hidden = false;
  updateCamera();
  game.spawnTimer = 10;
  game.ammoSpawnTimer = rand(CONFIG.ammo.mazeSpawnMin, CONFIG.ammo.mazeSpawnMax);
  game.chestSpawnTimer = rand(CONFIG.chest.mazeSpawnMin, CONFIG.chest.mazeSpawnMax);
  setTask(3);
}

function resetMazeKeys() {
  game.foundKeys = 0;
  const weapon = currentWeapon();
  game.pickups = [
    { type: "ammo", level: weapon.level, amount: Math.max(18, ammoPackSize(weapon.level) * 2), x: MAZE_TILE * 8.5, y: MAZE_TILE * 2.5, r: 13 },
    { type: "medkit", level: 2, x: MAZE_TILE * 24.5, y: MAZE_TILE * 3.5, r: 15 },
    { type: "key", x: MAZE_TILE * 44.5, y: MAZE_TILE * 4.5, r: 20 },
    { type: "key", x: MAZE_TILE * 5.5, y: MAZE_TILE * 30.5, r: 20 },
  ];
}

function resetMazeRun() {
  game.player.x = MAZE_START.x;
  game.player.y = MAZE_START.y;
  game.player.hp = 100;
  game.player.damageCooldown = 1;
  game.healingTimer = 0;
  game.healingLevel = 0;
  game.bullets = [];
  game.muzzleFlashes = [];
  game.monsters = [];
  resetMazeKeys();
  game.walls = buildMaze();
  game.spawnTimer = 10;
  game.ammoSpawnTimer = rand(CONFIG.ammo.mazeSpawnMin, CONFIG.ammo.mazeSpawnMax);
  game.chestSpawnTimer = rand(CONFIG.chest.mazeSpawnMin, CONFIG.chest.mazeSpawnMax);
  setTask(3);
  updateCamera();
  burst(game.player.x, game.player.y, "#7bc5ee", 20);
}

function returnToForest() {
  game.phase = "forest";
  game.forestReturn = true;
  game.player.x = 0;
  game.player.y = 0;
  game.player.hp = 100;
  game.player.damageCooldown = 0;
  game.healingTimer = 0;
  game.healingLevel = 0;
  game.bullets = [];
  game.muzzleFlashes = [];
  game.monsters = [];
  game.pickups = [];
  game.walls = [];
  game.nightmareEntrance = null;
  game.car = { x: 1850, y: -920, w: 82, h: 46 };
  game.wreckCar = null;
  game.parkingLot = null;
  game.driving = false;
  game.escapeOnFoot = false;
  game.driveChaseTimer = 0;
  game.vehicleHp = CONFIG.vehicle.hp;
  game.vehicleDamageCooldown = 0;
  updateCamera();
  game.spawnTimer = 2.8;
  game.danger = 2 + (game.day - 1) * 0.75;
  game.chestSpawnTimer = rand(CONFIG.chest.forestSpawnMin, CONFIG.chest.forestSpawnMax);
  spawnForestMonsters(5 + game.day);
  if (game.day % CONFIG.boss.dayInterval === 0) spawnBossMonster();
  setTask(5);
}

function boardEscapeCar() {
  if (game.driving) return;
  game.driving = true;
  game.escapeOnFoot = false;
  game.vehicleHp = CONFIG.vehicle.hp;
  game.vehicleDamageCooldown = 0;
  game.player.speed = 340;
  game.player.r = 24;
  game.car = null;
  game.monsters = [];
  game.parkingLot = {
    x: game.player.x + CONFIG.vehicle.parkingBaseX + game.day * CONFIG.vehicle.parkingDayX,
    y: game.player.y + CONFIG.vehicle.parkingBaseY + game.day * CONFIG.vehicle.parkingDayY,
    w: 170,
    h: 120,
  };
  game.bullets = [];
  game.muzzleFlashes = [];
  game.driveChaseTimer = 0;
  shootHeld = false;
  setShopOpen(false);
  ui.weaponQuickbar.classList.add("hidden");
  spawnDrivingMonsters(CONFIG.vehicle.chaseCount + 1);
  setTask(6);
}

function destroyEscapeCar() {
  if (!game.driving) return;
  game.driving = false;
  game.escapeOnFoot = true;
  game.vehicleHp = 0;
  game.vehicleDamageCooldown = 0;
  game.player.hp = 50;
  game.player.speed = 205;
  game.player.r = 15;
  game.player.damageCooldown = 1;
  game.wreckCar = { x: game.player.x, y: game.player.y, angle: game.player.angle };
  shootHeld = false;
  setShopOpen(false);
  renderQuickbar();
  burst(game.player.x, game.player.y, "#e45b4f", 46);
  setTask(7);
}

function completeDay() {
  running = false;
  game.mode = MODE.DAY_COMPLETE;
  game.won = true;
  const weapon = currentWeapon();
  const ammoKey = String(weapon.level);
  const resupplyFloor = Math.max(ammoPackSize(weapon.level) * 2, weapon.level <= 3 ? 28 : 20);
  game.ammo[ammoKey] = Math.min(MAX_AMMO, Math.max(game.ammo[ammoKey] || 0, resupplyFloor));
  game.ammo["1"] = Math.min(MAX_AMMO, Math.max(game.ammo["1"] || 0, 30));
  updateAmmoHud();
  writeSave(game);
  playSound("win");
  const nextDay = game.day + 1;
  ui.banner.classList.remove("home-menu");
  ui.banner.classList.add("result-screen", "result-success");
  ui.banner.classList.remove("result-failure");
  ui.banner.innerHTML = `
    <div class="result-copy">
      <span class="result-kicker">SURVIVED · DAY ${game.day}</span>
      <h1>第 ${game.day} 天完成</h1>
      <p>车停进了雨夜停车场。雾还没有散，下一天的怪物强度会继续上升。</p>
      <div class="result-stats">
        <span><b>${game.points}</b><em>剩余积分</em></span>
        <span><b>${game.ownedWeapons.length}</b><em>已解锁武器</em></span>
        <span><b>${nextDay}</b><em>下一天</em></span>
      </div>
      <div class="banner-actions">
        <button id="nextDayBtn" type="button">进入第 ${nextDay} 天</button>
        <button id="mainMenuBtn" type="button">返回首页</button>
      </div>
    </div>
  `;
  ui.banner.classList.remove("hidden");
}

function showFailure() {
  running = false;
  shootHeld = false;
  setShopOpen(false);
  game.mode = MODE.GAME_OVER;
  playSound("fail");
  ui.banner.classList.remove("home-menu");
  ui.banner.classList.add("result-screen", "result-failure");
  ui.banner.classList.remove("result-success");
  ui.banner.innerHTML = `
    <div class="result-copy">
      <span class="result-kicker">SIGNAL LOST · DAY ${game.day}</span>
      <h1>逃生失败</h1>
      <p>你在第 ${game.day} 天倒下了。重来会保留低阶装备，高阶装备和积分会丢失。</p>
      <div class="result-stats danger">
        <span><b>低阶</b><em>装备保留</em></span>
        <span><b>高阶</b><em>装备丢失</em></span>
        <span><b>0</b><em>积分重置</em></span>
      </div>
      <div class="banner-actions">
        <button id="retryDayBtn" type="button">重来当天</button>
        <button id="mainMenuBtn" type="button">退出</button>
      </div>
    </div>
  `;
  ui.banner.classList.remove("hidden");
}

function buildMaze() {
  const open = Array.from({ length: MAZE_ROWS }, () => Array(MAZE_COLS).fill(false));
  const carveCell = (c, r) => {
    for (let y = r - 1; y <= r + 1; y += 1) {
      for (let x = c - 1; x <= c + 1; x += 1) {
        if (x > 0 && x < MAZE_COLS - 1 && y > 0 && y < MAZE_ROWS - 1) open[y][x] = true;
      }
    }
  };
  const carveLine = (from, to) => {
    let [c, r] = from;
    const [tc, tr] = to;
    carveCell(c, r);
    while (c !== tc) {
      c += Math.sign(tc - c);
      carveCell(c, r);
    }
    while (r !== tr) {
      r += Math.sign(tr - r);
      carveCell(c, r);
    }
  };
  const carveRoute = (points) => {
    for (let i = 0; i < points.length - 1; i += 1) carveLine(points[i], points[i + 1]);
  };

  carveRoute([[2, 2], [8, 2], [8, 7], [15, 7], [15, 3], [24, 3], [24, 10], [32, 10], [32, 6], [42, 6], [42, 16], [46, 16], [46, 30]]);
  carveRoute([[24, 3], [32, 3], [32, 1], [44, 1], [44, 4]]);
  carveRoute([[15, 7], [12, 13], [6, 13], [6, 19], [12, 19], [12, 25], [5, 25], [5, 30]]);

  const walls = [];
  for (let r = 0; r < MAZE_ROWS; r += 1) {
    for (let c = 0; c < MAZE_COLS; c += 1) {
      if (!open[r][c]) walls.push({ x: c * MAZE_TILE, y: r * MAZE_TILE, w: MAZE_TILE, h: MAZE_TILE });
    }
  }
  return walls;
}

function spawnForestMonsters(count) {
  const p = game.player;
  const level = Math.max(1, Math.floor(game.danger));
  for (let i = 0; i < count; i += 1) {
    let spawn = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = rand(0, Math.PI * 2);
      const distance = rand(520, 760);
      const candidate = {
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
        r: 22,
      };
      if (!hitsForestRock(candidate)) {
        spawn = candidate;
        break;
      }
    }
    if (!spawn) continue;
    const hp = Math.ceil(1 + level * 1.8);
    game.monsters.push({
      level,
      day: game.day,
      x: spawn.x,
      y: spawn.y,
      r: rand(15, 21) + Math.min(12, level * 1.15),
      hp,
      maxHp: hp,
      speed: rand(54, 82) + game.danger * 5,
      bite: monsterDamage({ level }),
      wanderAngle: rand(0, Math.PI * 2),
      wanderTimer: rand(0.4, 1.2),
    });
  }
}

function spawnBossMonster() {
  if (game.phase !== "forest" || game.monsters.some((monster) => monster.kind === "boss")) return;
  const p = game.player;
  const level = Math.max(6, Math.floor(game.danger + game.day));
  const angle = rand(0, Math.PI * 2);
  const distance = rand(700, 900);
  const hp = Math.ceil(45 + level * 8);
  game.monsters.push({
    kind: "boss",
    level,
    day: game.day,
    x: p.x + Math.cos(angle) * distance,
    y: p.y + Math.sin(angle) * distance,
    r: 42 + Math.min(22, level * 1.2),
    hp,
    maxHp: hp,
    speed: 62 + Math.min(55, level * 2.4),
    bite: monsterDamage({ level, kind: "boss" }),
    wanderAngle: rand(0, Math.PI * 2),
    wanderTimer: rand(0.4, 1.2),
  });
  playSound("open");
}

function spawnDrivingMonsters(count) {
  const p = game.player;
  const activeChasers = game.monsters.filter((monster) => monster.kind === "chaser").length;
  const remaining = Math.min(count, CONFIG.vehicle.chaseMaxActive - activeChasers);
  if (remaining <= 0) return;
  const level = Math.max(2, Math.floor(game.danger + game.day * 0.15));
  const parkingCenter = game.parkingLot
    ? { x: game.parkingLot.x + game.parkingLot.w / 2, y: game.parkingLot.y + game.parkingLot.h / 2 }
    : null;
  const chaseOriginAngle = parkingCenter
    ? Math.atan2(p.y - parkingCenter.y, p.x - parkingCenter.x)
    : p.angle + Math.PI;
  for (let i = 0; i < remaining; i += 1) {
    let spawn = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const angle = chaseOriginAngle + rand(-0.95, 0.95);
      const distance = rand(540, 840);
      const candidate = {
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
        r: 22,
      };
      if (!hitsForestRock(candidate)) {
        spawn = candidate;
        break;
      }
    }
    if (!spawn) continue;
    const hp = Math.ceil(5 + level * 2.2);
    game.monsters.push({
      kind: "chaser",
      level,
      day: game.day,
      x: spawn.x,
      y: spawn.y,
      r: rand(17, 24) + Math.min(10, level * 0.9),
      hp,
      maxHp: hp,
      speed: rand(230, 285) + Math.min(55, game.day * 2),
      bite: monsterDamage({ level }),
      wanderAngle: rand(0, Math.PI * 2),
      wanderTimer: rand(0.4, 1.2),
    });
  }
}

function spawnMazeMonster() {
  if (game.monsters.length >= CONFIG.mazeMonsters.maxActive) return;
  const spots = [
    { x: MAZE_TILE * 8.5, y: MAZE_TILE * 2.5 },
    { x: MAZE_TILE * 24.5, y: MAZE_TILE * 10.5 },
    { x: MAZE_TILE * 42.5, y: MAZE_TILE * 16.5 },
    { x: MAZE_TILE * 44.5, y: MAZE_TILE * 4.5 },
    { x: MAZE_TILE * 5.5, y: MAZE_TILE * 25.5 },
    { x: MAZE_TILE * 12.5, y: MAZE_TILE * 19.5 },
  ];
  const spot = spots[Math.floor(rand(0, spots.length))];
  const big = Math.random() < 0.34;
  const level = big ? 2 : Math.floor(rand(1, 3));
  const hp = big ? Math.ceil(5 + level * 2.4) : 1;
  game.monsters.push({
    kind: big ? "mazeBig" : "small",
    level,
    day: game.day,
    x: spot.x,
    y: spot.y,
    r: big ? 18 + Math.min(8, level * 0.9) : 10,
    hp,
    maxHp: hp,
    speed: big ? 78 + level * 3 : 112,
    bite: monsterDamage({ level, kind: big ? "mazeBig" : "small" }),
    wanderAngle: rand(0, Math.PI * 2),
    wanderTimer: rand(0.4, 1.2),
  });
}

function shoot() {
  if (game.mode !== MODE.PLAYING || game.driving) return;
  if (game.shootCooldown > 0) return;
  if (game.healingTimer > 0) {
    game.shootCooldown = 0.12;
    return;
  }
  const p = game.player;
  const weapon = currentWeapon();
  const ammoKey = String(weapon.level);
  if ((game.ammo[ammoKey] || 0) <= 0) {
    game.shootCooldown = Math.max(0.12, weapon.fireDelay);
    return;
  }
  const angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  const muzzleX = p.x + Math.cos(angle) * 38;
  const muzzleY = p.y + Math.sin(angle) * 38;
  game.ammo[ammoKey] -= 1;
  updateAmmoHud();
  playSound("shoot");
  game.muzzleFlashes.push({
    x: muzzleX,
    y: muzzleY,
    angle,
    color: weapon.color,
    life: 0.11,
    maxLife: 0.11,
    size: 28 + weapon.level * 2.8,
    level: weapon.level,
  });
  muzzleBurst(muzzleX, muzzleY, angle, weapon);
  game.screenShake = Math.max(game.screenShake, clamp(2.2 + weapon.level * 0.32, 2.6, 8.5));
  game.bullets.push({
    x: p.x + Math.cos(angle) * 22,
    y: p.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * weapon.bulletSpeed,
    vy: Math.sin(angle) * weapon.bulletSpeed,
    r: 3.5 + weapon.level * 0.8,
    damage: weapon.damage,
    weaponLevel: weapon.level,
    color: weapon.color,
    life: weapon.bulletLife,
    maxLife: weapon.bulletLife,
    angle,
    trail: clamp(34 + weapon.level * 6, 42, 128),
  });
  game.shootCooldown = weapon.fireDelay;
}

function movePlayer(dt) {
  const p = game.player;
  let dx = 0;
  let dy = 0;
  p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  if (keysDown.has("w") || keysDown.has("arrowup")) dy -= 1;
  if (keysDown.has("s") || keysDown.has("arrowdown")) dy += 1;
  if (keysDown.has("a") || keysDown.has("arrowleft")) dx -= 1;
  if (keysDown.has("d") || keysDown.has("arrowright")) dx += 1;
  dx += joystick.dx;
  dy += joystick.dy;
  const len = Math.hypot(dx, dy) || 1;
  const speed = p.speed * (game.healingTimer > 0 ? CONFIG.medkit.speedMultiplier : 1);
  const next = { x: p.x + (dx / len) * speed * dt, y: p.y + (dy / len) * speed * dt };

  if (game.phase === "maze") {
    const old = { x: p.x, y: p.y };
    p.x = clamp(next.x, p.r + 26, MAZE_W - p.r - 26);
    if (hitsWall(p) || hitsBlockingMonster(p)) {
      p.x = old.x;
      const blocker = blockingMonsterAt({ ...p, x: next.x });
      if (blocker) damagePlayer(blocker.bite || monsterDamage(blocker));
    }
    p.y = clamp(next.y, p.r + 26, MAZE_H - p.r - 26);
    if (hitsWall(p) || hitsBlockingMonster(p)) {
      p.y = old.y;
      const blocker = blockingMonsterAt({ ...p, y: next.y });
      if (blocker) damagePlayer(blocker.bite || monsterDamage(blocker));
    }
  } else {
    const old = { x: p.x, y: p.y };
    p.x = next.x;
    if (hitsForestRock(p)) p.x = old.x;
    p.y = next.y;
    if (hitsForestRock(p)) p.y = old.y;
  }
}

function hitsWall(circle) {
  return game.walls.some((wall) => circleRect(circle, wall));
}

function circleRect(circle, rect) {
  const x = clamp(circle.x, rect.x, rect.x + rect.w);
  const y = clamp(circle.y, rect.y, rect.y + rect.h);
  return Math.hypot(circle.x - x, circle.y - y) < circle.r;
}

function monsterDamage(monster) {
  const level = Math.max(1, monster.level || 1);
  const base = monster.kind === "boss" ? 14 : monster.kind === "mazeBig" ? 8 : 5;
  const growth = monster.kind === "boss" ? 2.2 : monster.kind === "small" ? 1.15 : monster.kind === "mazeBig" ? 1.75 : 1.55;
  return Math.min(45, Math.round(base + (level - 1) * growth));
}

function blockingMonsterAt(circle) {
  if (game.phase !== "maze") return null;
  return null;
}

function hitsBlockingMonster(circle) {
  return Boolean(blockingMonsterAt(circle));
}

function updateBullets(dt) {
  game.bullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitRockWithBullet(b)) b.life = 0;
  });
  game.bullets = game.bullets.filter((b) => (
    b.life > 0 &&
    !hitsWall(b) &&
    !hitsForestRock(b)
  ));
}

function damageVehicle(amount) {
  if (game.vehicleDamageCooldown > 0) return;
  game.vehicleHp = Math.max(0, game.vehicleHp - amount);
  game.vehicleDamageCooldown = 0.38;
  game.screenShake = Math.max(game.screenShake, 11);
  playSound("hit");
  burst(game.player.x, game.player.y, "#f0c453", 12);
  if (game.vehicleHp <= 0) destroyEscapeCar();
}

function damagePlayer(amount) {
  const p = game.player;
  if (p.damageCooldown > 0) return;
  if (game.inWatchtower) return; // 瞭望塔内无敌
  p.hp = Math.max(0, p.hp - amount);
  p.damageCooldown = 0.55;
  game.screenShake = Math.max(game.screenShake, 13);
  playSound("hit");
  burst(p.x, p.y, "#e45b4f", 12);
  if (p.hp > 0) return;
  if (game.escapeOnFoot) {
    showFailure();
    return;
  }
  if (game.phase === "maze") {
    resetMazeRun();
  } else {
    showFailure();
  }
}

function updateMonsters(dt) {
  const p = game.player;
  game.monsters.forEach((m) => {
    const prevX = m.x;
    const prevY = m.y;
    let angle = Math.atan2(p.y - m.y, p.x - m.x);
    let speed = m.speed;
    if (game.phase === "forest" && game.hidden && game.healingTimer <= 0) {
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.wanderAngle += rand(-1.2, 1.2);
        m.wanderTimer = rand(0.5, 1.4);
      }
      angle = m.wanderAngle;
      speed *= 0.42;
    }
    const next = { x: m.x + Math.cos(angle) * speed * dt, y: m.y + Math.sin(angle) * speed * dt, r: m.r };
    if (game.phase === "maze") {
      const old = { x: m.x, y: m.y };
      m.x = next.x;
      if (hitsWall(m)) m.x = old.x;
      m.y = next.y;
      if (hitsWall(m)) m.y = old.y;
      if (m.kind === "small" && circleCircle(m, p)) {
        m.x = old.x;
        m.y = old.y;
      }
    } else {
      const old = { x: m.x, y: m.y };
      m.x = next.x;
      if (hitsForestRock(m)) {
        m.x = old.x;
        m.wanderAngle += rand(1.4, 2.4);
      }
      m.y = next.y;
      if (hitsForestRock(m)) {
        m.y = old.y;
        m.wanderAngle += rand(1.4, 2.4);
      }
    }

    const protectedByBush = game.phase === "forest" && game.hidden && game.healingTimer <= 0;
    const protectedByTower = game.phase === "forest" && game.inWatchtower;
    if (dist(m, p) < m.r + p.r && !protectedByBush && !protectedByTower) {
      const damage = m.bite || monsterDamage(m);
      if (game.driving) damageVehicle(damage);
      else damagePlayer(damage);
    }
    m.vx = m.x - prevX;
    m.vy = m.y - prevY;
  });
}

function updateHits() {
  game.bullets.forEach((b) => {
    game.monsters.forEach((m) => {
      if (!m.dead && dist(b, m) < b.r + m.r) {
        b.life = 0;
        m.hp -= b.damage;
        burst(m.x, m.y, b.color || "#e45b4f", Math.min(24, 8 + Math.ceil(b.damage / 4)));
        burst(m.x, m.y, "#fff7d1", Math.min(12, 3 + Math.ceil((b.weaponLevel || 1) / 2)));
        game.screenShake = Math.max(game.screenShake, clamp(3 + (b.weaponLevel || 1) * 0.36, 3, 9));
        if (m.hp <= 0) {
          m.dead = true;
          const reward = m.kind === "boss"
            ? Math.max(120, (m.level || 1) * CONFIG.boss.rewardMultiplier)
            : Math.max(8, Math.round((m.level || 1) * 6 + (m.kind === "chaser" ? 4 : 0)));
          game.points += reward;
          writeSave(game);
          if (m.kind === "boss") playSound("win");
          burst(m.x, m.y, "#5cc7ff", Math.min(34, 8 + reward));
          burst(m.x, m.y, b.color || "#f0c453", Math.min(32, 10 + (b.weaponLevel || 1) * 2));
          if (game.shopOpen) renderShop();
          renderQuickbar();
        }
      }
    });
  });
  game.monsters = game.monsters.filter((m) => m.hp > 0);
}

function updateCamera() {
  const targetX = game.player.x - W / 2;
  const targetY = game.player.y - H / 2;
  if (game.phase === "maze") {
    game.camera.x = clamp(targetX, 0, MAZE_W - W);
    game.camera.y = clamp(targetY, 0, MAZE_H - H);
  } else {
    game.camera.x = targetX;
    game.camera.y = targetY;
  }
}

function updateMouseWorld() {
  mouse.x = mouse.screenX + game.camera.x;
  mouse.y = mouse.screenY + game.camera.y;
}

function updatePickups() {
  collectPickupItems({
    game,
    onAmmo: (item) => {
      burst(item.x, item.y, "#5cc7ff", 14);
      writeSave(game);
      playSound("pickup");
      updateAmmoHud();
    },
    onMedkit: (item) => {
      burst(item.x, item.y, "#7ae0a6", 18);
      playSound("pickup");
    },
    onChest: (item, reward) => {
      burst(item.x, item.y, "#f0c453", 28);
      if (reward?.pointsAmount > 0) burst(item.x, item.y, "#5cc7ff", 18);
      if (reward?.medkit) burst(reward.medkit.x, reward.medkit.y, "#7ae0a6", 16);
      writeSave(game);
      playSound("open");
      renderQuickbar();
      updateAmmoHud();
      if (game.shopOpen) renderShop();
    },
    onKey: (item) => {
      burst(item.x, item.y, "#f0c453", 16);
      playSound("pickup");
      if (game.foundKeys >= 2) setTask(4);
    },
  });

  if (game.phase === "maze" && game.door && game.foundKeys >= 2 && circleRect(game.player, game.door)) {
    returnToForest();
  }

  if (game.phase === "forest" && game.nightmareEntrance && (game.questStage || 0) >= 2) {
    const entranceCenter = {
      x: game.nightmareEntrance.x + game.nightmareEntrance.w / 2,
      y: game.nightmareEntrance.y + game.nightmareEntrance.h / 2,
    };
    if (circleRect(game.player, game.nightmareEntrance) || dist(game.player, entranceCenter) < 105) {
      enterMaze();
    }
  }

  if (game.phase === "forest" && game.car && circleRect(game.player, game.car)) {
    boardEscapeCar();
  }

  if (game.phase === "forest" && game.parkingLot && (game.driving || game.escapeOnFoot) && circleRect(game.player, game.parkingLot)) {
    completeDay();
  }
}

function spawnAmmoPickup() {
  spawnAmmoPickupItem({ game, hitsForestRock, hitsWall });
}

function spawnForestMedkit() {
  spawnForestMedkitItem({ game, hitsForestRock });
}

function spawnChestPickup() {
  spawnChestPickupItem({ game, hitsForestRock, hitsWall });
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, Math.PI * 2);
    game.particles.push({
      x,
      y,
      vx: Math.cos(a) * rand(30, 150),
      vy: Math.sin(a) * rand(30, 150),
      life: rand(0.22, 0.55),
      color,
      size: rand(2, 5.4),
      angle: a,
      spin: rand(-5.4, 5.4),
    });
  }
}

function muzzleBurst(x, y, angle, weapon) {
  const count = clamp(7 + weapon.level * 1.2, 8, 24);
  for (let i = 0; i < count; i += 1) {
    const a = angle + rand(-0.58, 0.58);
    const speed = rand(120, 310 + weapon.level * 14);
    game.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed + rand(-22, 22),
      vy: Math.sin(a) * speed + rand(-22, 22),
      life: rand(0.12, 0.34),
      color: i % 3 === 0 ? "#fff7d1" : weapon.color || "#f0c453",
      size: rand(2.4, 7.2),
      angle: a,
      spin: rand(-9, 9),
    });
  }
}

function updateParticles(dt) {
  game.muzzleFlashes.forEach((flash) => {
    flash.life -= dt;
  });
  game.muzzleFlashes = game.muzzleFlashes.filter((flash) => flash.life > 0);
  game.particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle = (p.angle || 0) + (p.spin || 0) * dt;
    p.life -= dt;
  });
  game.particles = game.particles.filter((p) => p.life > 0);
}

function updateHud() {
  renderHud(ui, game, currentWeapon(), currentAmmo(), MAX_AMMO);
  updateObjectiveHud();
}

function update(dt) {
  if (game.mode !== MODE.PLAYING) {
    updateMouseWorld();
    updateHud();
    return;
  }

  game.shootCooldown -= dt;
  game.weaponSwitchTimer = Math.max(0, game.weaponSwitchTimer - dt);
  game.healingTimer = Math.max(0, game.healingTimer - dt);
  if (game.healingTimer <= 0) game.healingLevel = 0;
  game.player.damageCooldown = Math.max(0, game.player.damageCooldown - dt);
  game.vehicleDamageCooldown = Math.max(0, game.vehicleDamageCooldown - dt);
  game.screenShake = Math.max(0, game.screenShake - dt * 38);
  updateMouseWorld();
  if (!game.driving && (shootHeld || keysDown.has(" "))) shoot();
  movePlayer(dt);
  updateBushHiding(dt);
  updateTentSearching(dt);
  updateWatchtowerHiding(dt);
  if (!game.driving && isOnRockDebris(game.player)) damagePlayer(CONFIG.damage.rockDebris);
  updateBullets(dt);
  updateMonsters(dt);
  updateHits();
  updatePickups();
  updateParticles(dt);
  if ((game.phase === "forest" || game.phase === "maze") && !game.driving) {
    game.ammoSpawnTimer -= dt;
    if (game.ammoSpawnTimer <= 0) {
      spawnAmmoPickup();
      game.ammoSpawnTimer = game.phase === "maze"
        ? rand(CONFIG.ammo.mazeSpawnMin, CONFIG.ammo.mazeSpawnMax)
        : rand(CONFIG.ammo.forestSpawnMin, CONFIG.ammo.forestSpawnMax);
    }
    game.chestSpawnTimer -= dt;
    if (game.chestSpawnTimer <= 0) {
      spawnChestPickup();
      game.chestSpawnTimer = game.phase === "maze"
        ? rand(CONFIG.chest.mazeSpawnMin, CONFIG.chest.mazeSpawnMax)
        : rand(CONFIG.chest.forestSpawnMin, CONFIG.chest.forestSpawnMax);
    }
  }
  if (game.phase === "forest" && !game.driving) {
    game.medkitSpawnTimer -= dt;
    if (game.medkitSpawnTimer <= 0) {
      spawnForestMedkit();
      game.medkitSpawnTimer = rand(CONFIG.medkit.forestSpawnMin, CONFIG.medkit.forestSpawnMax);
    }
  }
  updateCamera();
  updateMouseWorld();

  if (game.driving) {
    game.driveChaseTimer -= dt;
    if (game.driveChaseTimer <= 0) {
      spawnDrivingMonsters(CONFIG.vehicle.chaseCount + Math.floor(game.day / 12));
      game.driveChaseTimer = rand(CONFIG.vehicle.chaseSpawnMin, CONFIG.vehicle.chaseSpawnMax);
    }
  } else {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      if (game.phase === "forest") {
        game.danger += (game.forestReturn ? 0.32 : 0.18) + (game.day - 1) * 0.04;
        spawnForestMonsters((game.forestReturn ? 2 : 1) + Math.floor(game.day / 2));
        game.spawnTimer = Math.max(1.25, (game.forestReturn ? 2.9 : 4.2) - (game.day - 1) * 0.16);
      } else {
        spawnMazeMonster();
        game.spawnTimer = rand(CONFIG.mazeMonsters.spawnMin, CONFIG.mazeMonsters.spawnMax);
      }
    }
  }

  updateHud();
}

function drawForestTree(x, y, size, density, scene, seed) {
  if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.deadTree, x, y, size * 3.4, size * 4.4, (seed - 0.5) * 0.45, 0.72 + density * 0.16)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((seed - 0.5) * 0.7);
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.42, size * 0.82, size * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  const trunkGradient = ctx.createLinearGradient(0, -size * 0.35, 0, size * 0.72);
  trunkGradient.addColorStop(0, scene.trunk);
  trunkGradient.addColorStop(1, "#050807");
  ctx.fillStyle = trunkGradient;
  ctx.beginPath();
  ctx.moveTo(-size * 0.12, size * 0.7);
  ctx.lineTo(size * 0.1, size * 0.68);
  ctx.lineTo(size * 0.07, -size * 0.38);
  ctx.lineTo(-size * 0.08, -size * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(5, 8, 7, 0.72)";
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i += 1) {
    const branchAngle = -1.65 + i * 0.82 + seed * 0.35;
    const branchLength = size * (0.34 + seededNoise(seed + i, i) * 0.34);
    const baseY = -size * (0.08 + i * 0.065);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(Math.cos(branchAngle) * branchLength, baseY + Math.sin(branchAngle) * branchLength * 0.72);
    ctx.stroke();
  }
  const crownColor = density > 0.72 ? "rgba(38, 55, 48, 0.78)" : "rgba(18, 28, 25, 0.82)";
  const crownAccent = scene.weather === "redmoon" || scene.weather === "embers" ? "rgba(95, 24, 27, 0.52)" : "rgba(38, 72, 62, 0.48)";
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8 + seed * 3;
    const leafX = Math.cos(angle) * size * 0.2;
    const leafY = Math.sin(angle) * size * 0.18 - size * 0.22;
    ctx.fillStyle = i % 3 === 0 ? crownAccent : crownColor;
    ctx.globalAlpha = 0.44 + density * 0.18;
    ctx.beginPath();
    ctx.ellipse(leafX, leafY, size * 0.24, size * 0.48, angle + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(140, 16, 24, 0.24)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -size * 0.12, size * 0.82, 0.18, Math.PI * 1.08);
  ctx.stroke();
  ctx.restore();
}

function drawForest() {
  const scene = game.scene || sceneForDay(game.day);
  ctx.fillStyle = scene.ground;
  ctx.fillRect(game.camera.x, game.camera.y, W, H);
  drawTiledVisual(visualAssets.forestGround, game.camera.x - 160, game.camera.y - 160, W + 320, H + 320, 720, 0.54, "source-over");
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(game.camera.x, game.camera.y, W, H);
  const left = game.camera.x - 120;
  const top = game.camera.y - 120;
  const startX = Math.floor(left / 96) - 1;
  const endX = Math.ceil((game.camera.x + W + 120) / 96) + 1;
  const startY = Math.floor(top / 96) - 1;
  const endY = Math.ceil((game.camera.y + H + 120) / 96) + 1;
  for (let gx = startX; gx <= endX; gx += 1) {
    for (let gy = startY; gy <= endY; gy += 1) {
      const density = seededNoise(gx, gy);
      if (density < 0.34) continue;
      const x = gx * 96 + seededNoise(gx + 3, gy) * 76;
      const y = gy * 96 + seededNoise(gx, gy + 7) * 76;
      const size = 18 + seededNoise(gx + 9, gy + 11) * 18;
      drawForestTree(x, y, size, density, scene, seededNoise(gx - 17, gy + 23));
    }
  }
  ctx.fillStyle = scene.light;
  ctx.beginPath();
  ctx.ellipse(game.player.x, game.player.y, 310, 190, -0.2, 0, Math.PI * 2);
  ctx.fill();
  drawForestFeatures("base");
  drawForestDecor();
}

function drawForestDecor() {
  const left = game.camera.x - 180;
  const top = game.camera.y - 180;
  const startX = Math.floor(left / 320) - 1;
  const endX = Math.ceil((game.camera.x + W + 180) / 320) + 1;
  const startY = Math.floor(top / 320) - 1;
  const endY = Math.ceil((game.camera.y + H + 180) / 320) + 1;
  for (let gx = startX; gx <= endX; gx += 1) {
    for (let gy = startY; gy <= endY; gy += 1) {
      const decor = forestDecorForCell(gx, gy);
      if (!decor) continue;
      drawDecorItem(decor);
    }
  }
  if (isOpeningForestQuestActive()) {
    if (game.storyTent) drawDecorItem(game.storyTent);
    if (game.storyWatchtower) drawDecorItem(game.storyWatchtower);
  }
}

function drawDecorItem(item) {
  const isStoryTentTarget = isOpeningForestQuestActive() && item.type === "tent" && item.key === game.storyTent?.key && (game.questStage || 0) <= 0;
  const isStoryTowerTarget = isOpeningForestQuestActive() && item.type === "watchtower" && item.key === game.storyWatchtower?.key && game.questStage === 1;
  const isNearbyTent = item.type === "tent" && item.key && item.key === game.nearTent?.key && !game.searchedTents?.has(item.key);
  const isNearbyTower = item.type === "watchtower" && item.key && item.key === game.nearWatchtower?.key && !game.searchedWatchtowers?.has(item.key);
  if (isStoryTentTarget || isNearbyTent) drawWorldPulse(item.x, item.y, 58, "#f0c453", isStoryTentTarget ? 1 : 0.74);
  if (isStoryTowerTarget || isNearbyTower) drawWorldPulse(item.x, item.y - 10, 72, "#6ce4ff", isStoryTowerTarget ? 1 : 0.76);
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate((item.seed - 0.5) * Math.PI);
  ctx.globalAlpha = 0.9;
  if (item.type === "tent") {
    const searched = item.key && game.searchedTents?.has(item.key);
    if (drawAtlasSprite(visualAssets.worldProps, 4, 4, searched ? WORLD_PROP.collapsedTent : WORLD_PROP.tent, 0, 0, 112, 112, 0, 1)) {
      ctx.restore();
      return;
    }
    if (searched) {
      // 搜刮后的帐篷：倒塌、破旧
      ctx.fillStyle = "#2a1f18";
      ctx.beginPath();
      ctx.moveTo(-40, 22);
      ctx.lineTo(-8, 8);
      ctx.lineTo(0, -5);
      ctx.lineTo(8, 8);
      ctx.lineTo(36, 22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1a110d";
      ctx.lineWidth = 3;
      ctx.stroke();
      // 破洞
      ctx.fillStyle = "#0d0907";
      ctx.beginPath();
      ctx.moveTo(-12, 14);
      ctx.lineTo(-2, 6);
      ctx.lineTo(8, 16);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "#4b392f";
      ctx.beginPath();
      ctx.moveTo(-34, 20);
      ctx.lineTo(0, -30);
      ctx.lineTo(38, 20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#221713";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = "#19110f";
      ctx.beginPath();
      ctx.moveTo(-5, 18);
      ctx.lineTo(5, -6);
      ctx.lineTo(16, 18);
      ctx.closePath();
      ctx.fill();
      // 未搜刮帐篷的微弱发光提示
      const tentGlow = 0.15 + Math.sin(performance.now() / 400) * 0.1;
      ctx.fillStyle = `rgba(255, 200, 100, ${tentGlow})`;
      ctx.beginPath();
      ctx.arc(0, -5, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (item.type === "log") {
    if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.log, 0, 0, 108, 82, 0, 1)) {
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#3b2418";
    ctx.fillRect(-42, -9, 84, 18);
    ctx.fillStyle = "#6b4327";
    ctx.beginPath();
    ctx.ellipse(-43, 0, 9, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(43, 0, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === "bones") {
    if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.bones, 0, 0, 96, 86, 0, 1)) {
      ctx.restore();
      return;
    }
    ctx.strokeStyle = "#d8d3bd";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-24, -10);
    ctx.lineTo(24, 12);
    ctx.moveTo(-18, 18);
    ctx.lineTo(21, -16);
    ctx.stroke();
    ctx.fillStyle = "#d8d3bd";
    [-28, 28].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, -12, 5, 0, Math.PI * 2);
      ctx.arc(x, 12, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (item.type === "crate") {
    if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.crate, 0, 0, 88, 76, 0, 1)) {
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#5b3b22";
    ctx.fillRect(-24, -22, 48, 44);
    ctx.strokeStyle = "#27180e";
    ctx.lineWidth = 4;
    ctx.strokeRect(-24, -22, 48, 44);
    ctx.beginPath();
    ctx.moveTo(-22, -20);
    ctx.lineTo(22, 20);
    ctx.moveTo(22, -20);
    ctx.lineTo(-22, 20);
    ctx.stroke();
  } else if (item.type === "sign") {
    if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.sign, 0, 0, 82, 100, 0, 1)) {
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#2a1b12";
    ctx.fillRect(-4, -5, 8, 44);
    ctx.fillStyle = "#6f4a2a";
    ctx.fillRect(-30, -24, 60, 24);
    ctx.strokeStyle = "#1a0f09";
    ctx.lineWidth = 3;
    ctx.strokeRect(-30, -24, 60, 24);
  } else if (item.type === "watchtower") {
    const searched = item.key && game.searchedWatchtowers?.has(item.key);
    if (drawAtlasSprite(visualAssets.objectiveIcons, 3, 3, OBJECTIVE_ICON.watchtower, 0, -8, 118, 118, 0, searched ? 0.68 : 1)) {
      if (!searched) {
        const glowIntensity = 0.18 + Math.sin(performance.now() / 300) * 0.08;
        ctx.fillStyle = `rgba(255, 220, 100, ${glowIntensity})`;
        ctx.beginPath();
        ctx.arc(0, -12, 44, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (searched) {
      // 搜刮后的瞭望塔：破旧、倾斜
      ctx.fillStyle = "#3a3028";
      // 倾斜的塔身
      ctx.beginPath();
      ctx.moveTo(-18, 50);
      ctx.lineTo(-12, -30);
      ctx.lineTo(8, -25);
      ctx.lineTo(14, 50);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1a1510";
      ctx.lineWidth = 3;
      ctx.stroke();
      // 破损的瞭望台
      ctx.fillStyle = "#2a2018";
      ctx.beginPath();
      ctx.moveTo(-16, -25);
      ctx.lineTo(-10, -55);
      ctx.lineTo(6, -50);
      ctx.lineTo(12, -25);
      ctx.closePath();
      ctx.fill();
      // 破洞
      ctx.fillStyle = "#0d0907";
      ctx.beginPath();
      ctx.moveTo(-8, -40);
      ctx.lineTo(2, -35);
      ctx.lineTo(4, -45);
      ctx.closePath();
      ctx.fill();
    } else {
      // 未搜刮的瞭望塔
      ctx.fillStyle = "#4a3f35";
      // 塔身
      ctx.fillRect(-16, -10, 32, 60);
      // 瞭望台
      ctx.fillStyle = "#5a4a3a";
      ctx.beginPath();
      ctx.moveTo(-20, -10);
      ctx.lineTo(-16, -50);
      ctx.lineTo(16, -50);
      ctx.lineTo(20, -10);
      ctx.closePath();
      ctx.fill();
      // 屋顶
      ctx.fillStyle = "#3a3028";
      ctx.beginPath();
      ctx.moveTo(-22, -50);
      ctx.lineTo(0, -75);
      ctx.lineTo(22, -50);
      ctx.closePath();
      ctx.fill();
      // 窗户（发光，脉冲效果）
      const glowIntensity = 0.4 + Math.sin(performance.now() / 300) * 0.3;
      ctx.fillStyle = `rgba(255, 220, 100, ${glowIntensity})`;
      ctx.fillRect(-8, -40, 16, 12);
      // 梯子横档
      ctx.strokeStyle = "#2a2018";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-14, 5 + i * 10);
        ctx.lineTo(14, 5 + i * 10);
        ctx.stroke();
      }
      // 边框
      ctx.strokeStyle = "#1a1510";
      ctx.lineWidth = 2;
      ctx.strokeRect(-16, -10, 32, 60);
    }
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      ctx.fillStyle = "#5a5a54";
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 22, Math.sin(a) * 14, 7, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 108, 60, 0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawForestFeatures(layer) {
  const features = forestFeaturesNear(game.camera.x + W / 2, game.camera.y + H / 2, Math.max(W, H) * 0.72);
  features.forEach((feature) => {
    if (feature.type === "rock" && layer === "base") {
      if (game.brokenRocks.has(feature.key)) {
        if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.rubble, feature.x, feature.y, feature.r * 2.8, feature.r * 2.25, feature.seed * Math.PI, 0.95)) return;
        ctx.save();
        ctx.translate(feature.x, feature.y);
        ctx.rotate(feature.seed * Math.PI);
        for (let i = 0; i < 11; i += 1) {
          const angle = (Math.PI * 2 * i) / 11 + feature.seed;
          const distance = feature.r * (0.18 + seededNoise(feature.seed + i, i) * 0.62);
          const size = 5 + seededNoise(i, feature.seed + 2) * 10;
          ctx.fillStyle = i % 2 === 0 ? "#77766f" : "#55554f";
          ctx.beginPath();
          ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance, size, size * 0.6, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }
      const rockHits = game.rockHits[feature.key] || 0;
      if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.rock, feature.x, feature.y, feature.r * 2.4, feature.r * 2.05, feature.seed * Math.PI, 0.96)) {
        if (rockHits > 0) {
          ctx.save();
          ctx.translate(feature.x, feature.y);
          ctx.rotate(feature.seed * Math.PI);
          ctx.strokeStyle = "rgba(255, 210, 154, 0.34)";
          ctx.lineWidth = 2;
          for (let i = 0; i < Math.min(5, Math.ceil(rockHits / 2)); i += 1) {
            const crackAngle = -0.8 + i * 0.4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(crackAngle) * feature.r * 0.1, Math.sin(crackAngle) * feature.r * 0.1);
            ctx.lineTo(Math.cos(crackAngle) * feature.r * (0.35 + i * 0.08), Math.sin(crackAngle) * feature.r * (0.45 + i * 0.04));
            ctx.stroke();
          }
          ctx.restore();
        }
        return;
      }
      ctx.save();
      ctx.translate(feature.x, feature.y);
      ctx.rotate(feature.seed * Math.PI);
      ctx.fillStyle = "#515752";
      ctx.beginPath();
      ctx.ellipse(0, 0, feature.r * 1.12, feature.r * 0.82, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6d756f";
      ctx.beginPath();
      ctx.ellipse(-feature.r * 0.18, -feature.r * 0.18, feature.r * 0.52, feature.r * 0.24, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, feature.r * 1.12, feature.r * 0.82, 0.25, 0, Math.PI * 2);
      ctx.stroke();
      if (rockHits > 0) {
        ctx.strokeStyle = "rgba(20, 22, 20, 0.5)";
        ctx.lineWidth = 2;
        for (let i = 0; i < Math.min(5, Math.ceil(rockHits / 2)); i += 1) {
          const crackAngle = -0.8 + i * 0.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(crackAngle) * feature.r * 0.1, Math.sin(crackAngle) * feature.r * 0.1);
          ctx.lineTo(Math.cos(crackAngle) * feature.r * (0.35 + i * 0.08), Math.sin(crackAngle) * feature.r * (0.45 + i * 0.04));
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    if (feature.type === "bush" && (layer === "base" || layer === "cover")) {
      const alpha = layer === "cover" ? 0.68 : 0.82;
      const radius = layer === "cover" ? feature.r * 0.94 : feature.r;
      if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.bush, feature.x, feature.y, radius * 2.25, radius * 2.05, feature.seed * Math.PI, alpha)) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(feature.x, feature.y);
      for (let i = 0; i < 9; i += 1) {
        const angle = (Math.PI * 2 * i) / 9 + feature.seed;
        const leafX = Math.cos(angle) * radius * 0.32;
        const leafY = Math.sin(angle) * radius * 0.23;
        ctx.fillStyle = i % 2 === 0 ? "#315f39" : "#3d7445";
        ctx.beginPath();
        ctx.ellipse(leafX, leafY, radius * 0.42, radius * 0.25, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(74, 139, 76, 0.48)";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawMaze() {
  ctx.fillStyle = "#171818";
  ctx.fillRect(game.camera.x, game.camera.y, W, H);
  drawTiledVisual(visualAssets.mazeStone, game.camera.x - 96, game.camera.y - 96, W + 192, H + 192, 640, 0.5, "source-over");
  ctx.fillStyle = "rgba(3, 5, 6, 0.24)";
  ctx.fillRect(game.camera.x, game.camera.y, W, H);
  ctx.strokeStyle = "rgba(151, 199, 207, 0.045)";
  const startX = Math.floor(game.camera.x / 32) * 32;
  const startY = Math.floor(game.camera.y / 32) * 32;
  for (let x = startX; x < game.camera.x + W + 32; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, game.camera.y);
    ctx.lineTo(x, game.camera.y + H);
    ctx.stroke();
  }
  for (let y = startY; y < game.camera.y + H + 32; y += 32) {
    ctx.beginPath();
    ctx.moveTo(game.camera.x, y);
    ctx.lineTo(game.camera.x + W, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#353735";
  game.walls.forEach((wall) => {
    if (wall.x + wall.w < game.camera.x - 80 || wall.x > game.camera.x + W + 80 || wall.y + wall.h < game.camera.y - 80 || wall.y > game.camera.y + H + 80) return;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(wall.x + 5, wall.y + 7, wall.w, wall.h);
    const wallGradient = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
    wallGradient.addColorStop(0, "#46504c");
    wallGradient.addColorStop(0.48, "#242a29");
    wallGradient.addColorStop(1, "#111516");
    ctx.fillStyle = wallGradient;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = "rgba(130, 158, 152, 0.12)";
    ctx.fillRect(wall.x + 3, wall.y + 3, Math.max(0, wall.w - 6), Math.max(0, wall.h - 6));
    ctx.strokeStyle = "rgba(3, 5, 5, 0.7)";
    ctx.lineWidth = 2;
    const brickH = 12;
    for (let y = wall.y + brickH; y < wall.y + wall.h; y += brickH) {
      ctx.beginPath();
      ctx.moveTo(wall.x + 4, y);
      ctx.lineTo(wall.x + wall.w - 4, y);
      ctx.stroke();
    }
    for (let row = 0; row < 4; row += 1) {
      const offset = row % 2 === 0 ? 0 : 14;
      for (let x = wall.x + offset + 18; x < wall.x + wall.w; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, wall.y + row * brickH + 4);
        ctx.lineTo(x, wall.y + Math.min(wall.h - 4, (row + 1) * brickH));
        ctx.stroke();
      }
    }
    const crack = seededNoise(Math.floor(wall.x / MAZE_TILE) + 401, Math.floor(wall.y / MAZE_TILE) - 313);
    if (crack > 0.84) {
      ctx.strokeStyle = "rgba(5, 6, 6, 0.72)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wall.x + 12, wall.y + 9);
      ctx.lineTo(wall.x + 25, wall.y + 21);
      ctx.lineTo(wall.x + 17, wall.y + 34);
      ctx.stroke();
      ctx.strokeStyle = "rgba(165, 32, 31, 0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wall.x + 11, wall.y + 9);
      ctx.lineTo(wall.x + 24, wall.y + 22);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(226, 194, 121, 0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
    ctx.restore();
    ctx.fillStyle = "#353735";
  });
}

function drawPlayer() {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (game.driving) {
    const vehicleRatio = clamp(game.vehicleHp / CONFIG.vehicle.hp, 0, 1);
    if (drawAtlasSprite(visualAssets.worldProps, 4, 4, vehicleRatio > 0.24 ? WORLD_PROP.car : WORLD_PROP.wreckCar, 0, 0, 90, 116, Math.PI / 2, 1)) {
      ctx.fillStyle = "rgba(255, 240, 178, 0.72)";
      ctx.beginPath();
      ctx.moveTo(30, -12);
      ctx.lineTo(70, -30);
      ctx.lineTo(70, -12);
      ctx.closePath();
      ctx.moveTo(30, 12);
      ctx.lineTo(70, 30);
      ctx.lineTo(70, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(-32, -38, 64, 6);
      ctx.fillStyle = vehicleRatio > 0.45 ? "#7ae0a6" : "#e45b4f";
      ctx.fillRect(-32, -38, 64 * vehicleRatio, 6);
      ctx.restore();
      return;
    }
    ctx.shadowBlur = vehicleRatio > 0.45 ? 18 : 26;
    ctx.shadowColor = vehicleRatio > 0.45 ? "#5cc7ff" : "#e45b4f";
    const body = ctx.createLinearGradient(-34, -22, 34, 22);
    body.addColorStop(0, vehicleRatio > 0.45 ? "#1b536d" : "#4c1d1a");
    body.addColorStop(0.48, "#101719");
    body.addColorStop(1, vehicleRatio > 0.45 ? "#4aa3df" : "#8d3a35");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-34, -18, 68, 36, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(215, 239, 255, 0.78)";
    ctx.beginPath();
    ctx.roundRect(-12, -24, 28, 48, 5);
    ctx.fill();
    ctx.fillStyle = "#080b0c";
    ctx.beginPath();
    ctx.arc(-22, -20, 7, 0, Math.PI * 2);
    ctx.arc(-22, 20, 7, 0, Math.PI * 2);
    ctx.arc(22, -20, 7, 0, Math.PI * 2);
    ctx.arc(22, 20, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 240, 178, 0.72)";
    ctx.beginPath();
    ctx.moveTo(30, -12);
    ctx.lineTo(66, -30);
    ctx.lineTo(66, -12);
    ctx.closePath();
    ctx.moveTo(30, 12);
    ctx.lineTo(66, 30);
    ctx.lineTo(66, 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(-32, -34, 64, 6);
    ctx.fillStyle = vehicleRatio > 0.45 ? "#7ae0a6" : "#e45b4f";
    ctx.fillRect(-32, -34, 64 * vehicleRatio, 6);
    ctx.restore();
    return;
  }
  if (game.hidden) ctx.globalAlpha = 0.58;
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.beginPath();
  ctx.ellipse(0, 9, p.r * 1.18, p.r * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  const coat = ctx.createLinearGradient(-p.r, -p.r, p.r, p.r);
  coat.addColorStop(0, "#9fd7ef");
  coat.addColorStop(0.45, "#355766");
  coat.addColorStop(1, "#121b21");
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(-1, 1, p.r * 0.72, p.r * 1.02, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(240, 196, 83, 0.34)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "#e9c59b";
  ctx.beginPath();
  ctx.arc(6, -2, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
  ctx.fillRect(1, -9, 12, 5);
  if (game.healingTimer > 0) {
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#7ae0a6";
    ctx.fillStyle = "#e8f6ee";
    ctx.beginPath();
    ctx.roundRect(12, -10, 24, 20, 4);
    ctx.fill();
    ctx.fillStyle = "#7ae0a6";
    ctx.fillRect(20, -13, 6, 26);
    ctx.fillRect(10, -3, 26, 6);
    ctx.restore();
    return;
  }
  ctx.shadowBlur = 14;
  ctx.shadowColor = currentWeapon().color || "#f0c453";
  ctx.fillStyle = "#d7d2c1";
  ctx.beginPath();
  ctx.roundRect(11, -4.5, 26, 9, 3);
  ctx.fill();
  ctx.fillStyle = "#1b2028";
  ctx.fillRect(31, -3.2, 15, 6.4);
  ctx.fillStyle = currentWeapon().color || "#f0c453";
  ctx.fillRect(45, -2, 6, 4);
  ctx.restore();
}

function drawMonsters() {
  drawAllHorrorMonsters(ctx, game.monsters, performance.now());
}

function drawMonstersOld() {
  game.monsters.forEach((m) => {
    const hurt = m.hp / m.maxHp;
    const level = m.level || 1;
    const pulse = 1 + Math.sin(performance.now() / 140 + m.x * 0.02) * 0.05;
    const horn = m.kind === "small" ? m.r * 0.55 : m.kind === "boss" ? m.r * 1.25 : m.kind === "mazeBig" ? m.r : m.r * 0.8;
    const bodyColor = m.kind === "small" ? "#7d3cff" : m.kind === "boss" ? "#230007" : m.kind === "mazeBig" ? "#4b0710" : level > 6 ? "#581315" : level > 3 ? "#7f1918" : "#9f201f";
    const shadowColor = m.kind === "small" ? "#3f1c85" : m.kind === "boss" ? "#050001" : m.kind === "mazeBig" ? "#120104" : level > 6 ? "#170203" : "#3a0c0b";
    const spikes = Math.min(38, (m.kind === "boss" ? 24 : m.kind === "mazeBig" ? 16 : 12) + level * 2);
    const trailSpeed = Math.hypot(m.vx || 0, m.vy || 0);
    if ((level >= 3 || m.kind === "mazeBig" || m.kind === "chaser") && trailSpeed > 0.2) {
      const trailAngle = Math.atan2(m.vy || 0, m.vx || 0);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 1; i <= 3; i += 1) {
        const alpha = (0.16 / i) + Math.min(0.08, level * 0.006);
        const distance = i * (m.r * 0.48 + 8);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#7c1018";
        ctx.beginPath();
        ctx.ellipse(
          m.x - Math.cos(trailAngle) * distance,
          m.y - Math.sin(trailAngle) * distance,
          m.r * (1.1 - i * 0.12),
          m.r * (0.72 - i * 0.08),
          trailAngle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, m.r * 0.72, m.r * 1.1, m.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.moveTo(-m.r * 0.75, -m.r * 0.65);
    ctx.lineTo(-m.r * 0.35, -m.r * 1.05 - horn * 0.2);
    ctx.lineTo(-m.r * 0.08, -m.r * 0.62);
    ctx.lineTo(m.r * 0.08, -m.r * 0.62);
    ctx.lineTo(m.r * 0.35, -m.r * 1.05 - horn * 0.2);
    ctx.lineTo(m.r * 0.75, -m.r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    for (let i = 0; i < spikes; i += 1) {
      const a = (Math.PI * 2 * i) / spikes - Math.PI / 2;
      const spike = i % 2 === 0 ? 1.24 + Math.min(0.38, level * 0.035) : 0.84;
      const x = Math.cos(a) * m.r * spike;
      const y = Math.sin(a) * m.r * spike;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#190605";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.shadowBlur = 16 + Math.min(20, level * 2);
    ctx.shadowColor = "#ff2e2e";
    ctx.fillStyle = "rgba(255, 35, 35, 0.92)";
    ctx.beginPath();
    ctx.ellipse(-m.r * 0.34, -m.r * 0.2, Math.max(3, m.r * 0.24), Math.max(2, m.r * 0.14), -0.35, 0, Math.PI * 2);
    ctx.ellipse(m.r * 0.34, -m.r * 0.2, Math.max(3, m.r * 0.24), Math.max(2, m.r * 0.14), 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff1bf";
    ctx.beginPath();
    ctx.ellipse(-m.r * 0.34, -m.r * 0.2, Math.max(2, m.r * 0.2), Math.max(2, m.r * 0.13), -0.35, 0, Math.PI * 2);
    ctx.ellipse(m.r * 0.34, -m.r * 0.2, Math.max(2, m.r * 0.2), Math.max(2, m.r * 0.13), 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#120303";
    ctx.beginPath();
    ctx.arc(-m.r * 0.34, -m.r * 0.2, Math.max(1, m.r * 0.07), 0, Math.PI * 2);
    ctx.arc(m.r * 0.34, -m.r * 0.2, Math.max(1, m.r * 0.07), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f4d8c4";
    ctx.lineWidth = Math.max(1.5, m.r * 0.08);
    ctx.beginPath();
    ctx.moveTo(-m.r * 0.34, m.r * 0.28);
    ctx.lineTo(-m.r * 0.15, m.r * 0.48);
    ctx.lineTo(0, m.r * 0.24);
    ctx.lineTo(m.r * 0.15, m.r * 0.48);
    ctx.lineTo(m.r * 0.34, m.r * 0.28);
    ctx.stroke();
    if (m.kind !== "small") {
      ctx.fillStyle = m.kind === "boss" ? "#ff4b57" : "#f0c453";
      ctx.font = `800 ${Math.max(10, m.r * 0.55)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(m.kind === "boss" ? "BOSS" : String(level), 0, m.r * 0.12);
    }
    ctx.restore();
    if (m.maxHp > 1) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(m.x - 16, m.y - m.r - 13, 32, 5);
      ctx.fillStyle = "#f0c453";
      ctx.fillRect(m.x - 16, m.y - m.r - 13, 32 * hurt, 5);
    }
  });
}

function drawItems() {
  game.pickups.forEach((item) => {
    const playerDistance = dist(item, game.player);
    if (item.type === "key") {
      drawWorldPulse(item.x, item.y, playerDistance < 150 ? 52 : 42, "#f0c453", playerDistance < 150 ? 1 : 0.82);
    } else if (playerDistance < 140) {
      const tone = item.type === "ammo" ? "#5cc7ff" : item.type === "medkit" ? "#7ae0a6" : "#f0c453";
      drawWorldPulse(item.x, item.y, item.type === "chest" ? 42 : 34, tone, 0.72);
    }
    ctx.save();
    ctx.translate(item.x, item.y);
    if (item.type === "ammo") {
      const pulse = 0.55 + Math.sin(performance.now() / 180 + item.level) * 0.2;
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#5cc7ff";
      ctx.strokeStyle = `rgba(92, 199, 255, ${0.42 + pulse * 0.32})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 29 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(92, 199, 255, 0.18)";
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.fill();
      [-12, 0, 12].forEach((offset, index) => {
        ctx.save();
        ctx.translate(offset, index === 1 ? -5 : 0);
        ctx.rotate((index - 1) * 0.12);
        const casing = ctx.createLinearGradient(-7, -15, 8, 14);
        casing.addColorStop(0, "#fff7d1");
        casing.addColorStop(0.42, "#f0c453");
        casing.addColorStop(1, "#9b5c20");
        ctx.fillStyle = casing;
        ctx.strokeStyle = item.level >= 6 ? "#7ee9ff" : "#f0c453";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-6, -7, 12, 22 + index * 3, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#eef6ee";
        ctx.beginPath();
        ctx.moveTo(-6, -7);
        ctx.lineTo(0, -18 - index * 3);
        ctx.lineTo(6, -7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = "#5cc7ff";
      ctx.font = "900 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`L${item.level}`, 0, 23);
      ctx.restore();
      return;
    }
    if (item.type === "medkit") {
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#7ae0a6";
      ctx.fillStyle = "rgba(122, 224, 166, 0.22)";
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();
      if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.medkit, 0, 0, 58, 50, 0, 1)) {
        ctx.fillStyle = "#7ae0a6";
        ctx.font = "900 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`L${item.level}`, 0, 31);
        ctx.restore();
        return;
      }
      ctx.fillStyle = "#e8f6ee";
      ctx.fillRect(-15, -13, 30, 26);
      ctx.fillStyle = "#7ae0a6";
      ctx.fillRect(-4, -18, 8, 36);
      ctx.fillRect(-18, -4, 36, 8);
      ctx.strokeStyle = "#1e5c43";
      ctx.lineWidth = 3;
      ctx.strokeRect(-15, -13, 30, 26);
      ctx.fillStyle = "#7ae0a6";
      ctx.font = "900 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`L${item.level}`, 0, 28);
      ctx.restore();
      return;
    }
    if (item.type === "chest") {
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#f0c453";
      ctx.fillStyle = "rgba(240, 196, 83, 0.24)";
      ctx.beginPath();
      ctx.arc(0, 0, 29, 0, Math.PI * 2);
      ctx.fill();
      if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.chest, 0, -2, 68, 58, 0, 1)) {
        ctx.restore();
        return;
      }
      ctx.fillStyle = "#6b3f24";
      ctx.fillRect(-20, -12, 40, 28);
      ctx.fillStyle = "#9a5c2e";
      ctx.fillRect(-18, -19, 36, 16);
      ctx.strokeStyle = "#f0c453";
      ctx.lineWidth = 3;
      ctx.strokeRect(-20, -12, 40, 28);
      ctx.beginPath();
      ctx.moveTo(-18, -11);
      ctx.quadraticCurveTo(0, -28, 18, -11);
      ctx.stroke();
      ctx.fillStyle = "#f0c453";
      ctx.fillRect(-4, -3, 8, 10);
      ctx.fillStyle = "#fff3b0";
      ctx.font = "900 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("箱", 0, 31);
      ctx.restore();
      return;
    }
    const pulse = 0.65 + Math.sin(performance.now() / 220 + item.x * 0.01) * 0.18;
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#f0c453";
    ctx.strokeStyle = `rgba(240, 196, 83, ${0.34 + pulse * 0.24})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 25 + pulse * 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(240, 196, 83, 0.12)";
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.fill();
    if (drawAtlasSprite(visualAssets.objectiveIcons, 3, 3, OBJECTIVE_ICON.key, 0, 0, 62, 62, -0.18, 1)) {
      ctx.restore();
      return;
    }
    const keyGradient = ctx.createLinearGradient(-12, -10, 28, 12);
    keyGradient.addColorStop(0, "#fff7d1");
    keyGradient.addColorStop(0.45, "#f0c453");
    keyGradient.addColorStop(1, "#8c4f1c");
    ctx.fillStyle = keyGradient;
    ctx.beginPath();
    ctx.arc(-4, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(2, -3, 24, 6);
    ctx.fillRect(17, 1, 4, 9);
    ctx.fillRect(24, 1, 4, 9);
    ctx.strokeStyle = "rgba(255, 247, 209, 0.72)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-4, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  if (game.door) {
    const doorCenter = rectCenter(game.door);
    if (game.foundKeys >= 2 || distanceToRectCenter(game.door) < 190) {
      drawWorldPulse(doorCenter.x, doorCenter.y, game.door.w * 0.88, game.foundKeys >= 2 ? "#7ae0a6" : "#f0c453", game.foundKeys >= 2 ? 0.95 : 0.62);
    }
    ctx.save();
    const unlocked = game.foundKeys >= 2;
    const doorCenterX = game.door.x + game.door.w / 2;
    const doorCenterY = game.door.y + game.door.h / 2;
    ctx.shadowBlur = unlocked ? 28 : 14;
    ctx.shadowColor = unlocked ? "#7ae0a6" : "#f0c453";
    if (drawAtlasSprite(
      visualAssets.objectiveIcons,
      3,
      3,
      unlocked ? OBJECTIVE_ICON.unlockedDoor : OBJECTIVE_ICON.lockedDoor,
      doorCenterX,
      doorCenterY,
      game.door.w * 1.55,
      game.door.h * 1.55,
      0,
      1,
    )) {
      ctx.strokeStyle = unlocked ? "rgba(122, 224, 166, 0.78)" : "rgba(240, 196, 83, 0.62)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(doorCenterX, doorCenterY, game.door.w * 0.74, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = unlocked ? "#5a9b74" : "#5c3c2f";
      ctx.fillRect(game.door.x, game.door.y, game.door.w, game.door.h);
      ctx.strokeStyle = unlocked ? "#7ae0a6" : "#2a1710";
      ctx.lineWidth = 5;
      ctx.strokeRect(game.door.x, game.door.y, game.door.w, game.door.h);
      ctx.fillStyle = "#f0c453";
      ctx.beginPath();
      ctx.arc(game.door.x + 47, game.door.y + 32, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (game.nightmareEntrance) {
    const gate = game.nightmareEntrance;
    const gateCenter = rectCenter(gate);
    drawWorldPulse(gateCenter.x, gateCenter.y, gate.w * 0.72, "#a048ff", distanceToRectCenter(gate) < 190 ? 1 : 0.82);
    ctx.save();
    const centerX = gate.x + gate.w / 2;
    const centerY = gate.y + gate.h / 2;
    const pulse = 0.55 + Math.sin(performance.now() / 280) * 0.16;
    const glow = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, 128);
    glow.addColorStop(0, `rgba(160, 72, 255, ${0.26 + pulse * 0.18})`);
    glow.addColorStop(1, "rgba(160, 72, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 128, 0, Math.PI * 2);
    ctx.fill();
    if (drawAtlasSprite(visualAssets.objectiveIcons, 3, 3, OBJECTIVE_ICON.portal, centerX, centerY, gate.w * 1.7, gate.h * 1.7, 0, 0.98)) {
      ctx.strokeStyle = `rgba(213, 169, 255, ${0.36 + pulse * 0.28})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, gate.w * 0.64, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.translate(centerX, centerY);
      ctx.fillStyle = "#171018";
      ctx.beginPath();
      ctx.ellipse(0, 12, gate.w * 0.48, gate.h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8f58ff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 4, gate.w * 0.32, Math.PI * 0.1, Math.PI * 0.9, true);
      ctx.lineTo(-gate.w * 0.3, 28);
      ctx.lineTo(gate.w * 0.3, 28);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "rgba(213, 169, 255, 0.82)";
      ctx.font = "900 13px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("入口", 0, 54);
    }
    ctx.restore();
  }

  if (game.car) {
    const carCenter = rectCenter(game.car);
    drawWorldPulse(carCenter.x, carCenter.y, 72, "#5cc7ff", distanceToRectCenter(game.car) < 210 ? 1 : 0.72);
    ctx.save();
    const carX = game.car.x;
    const carY = game.car.y;
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#5cc7ff";
    if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.car, carX + game.car.w / 2, carY + game.car.h / 2, 124, 90, Math.PI / 2, 1)) {
      ctx.fillStyle = "rgba(255, 236, 154, 0.6)";
      ctx.beginPath();
      ctx.moveTo(carX + game.car.w - 4, carY + 17);
      ctx.lineTo(carX + game.car.w + 50, carY + 0);
      ctx.lineTo(carX + game.car.w + 50, carY + 20);
      ctx.closePath();
      ctx.moveTo(carX + game.car.w - 4, carY + 35);
      ctx.lineTo(carX + game.car.w + 50, carY + 52);
      ctx.lineTo(carX + game.car.w + 50, carY + 32);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      const carBody = ctx.createLinearGradient(carX, carY, carX + game.car.w, carY + game.car.h);
      carBody.addColorStop(0, "#173344");
      carBody.addColorStop(0.52, "#0c1114");
      carBody.addColorStop(1, "#4aa3df");
      ctx.fillStyle = carBody;
      ctx.beginPath();
      ctx.roundRect(carX, carY + 9, game.car.w, game.car.h - 8, 8);
      ctx.fill();
      ctx.fillStyle = "rgba(215, 239, 255, 0.72)";
      ctx.beginPath();
      ctx.roundRect(carX + 17, carY, 46, 24, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 236, 154, 0.72)";
      ctx.beginPath();
      ctx.moveTo(carX + game.car.w - 4, carY + 18);
      ctx.lineTo(carX + game.car.w + 46, carY + 4);
      ctx.lineTo(carX + game.car.w + 46, carY + 20);
      ctx.closePath();
      ctx.moveTo(carX + game.car.w - 4, carY + 36);
      ctx.lineTo(carX + game.car.w + 46, carY + 50);
      ctx.lineTo(carX + game.car.w + 46, carY + 34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0d1111";
      ctx.beginPath();
      ctx.arc(carX + 18, carY + 46, 8, 0, Math.PI * 2);
      ctx.arc(carX + 64, carY + 46, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(240, 196, 83, 0.52)";
      ctx.lineWidth = 2;
      ctx.strokeRect(carX + 3, carY + 12, game.car.w - 6, game.car.h - 15);
      ctx.restore();
    }
  }

  if (game.wreckCar) {
    ctx.save();
    ctx.translate(game.wreckCar.x, game.wreckCar.y);
    ctx.rotate(game.wreckCar.angle || 0);
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#e45b4f";
    if (drawAtlasSprite(visualAssets.worldProps, 4, 4, WORLD_PROP.wreckCar, 0, 0, 94, 116, Math.PI / 2, 1)) {
      ctx.fillStyle = "rgba(255, 118, 80, 0.28)";
      ctx.beginPath();
      ctx.arc(26, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const wreck = ctx.createLinearGradient(-36, -24, 36, 24);
      wreck.addColorStop(0, "#4a1d1b");
      wreck.addColorStop(0.55, "#161d20");
      wreck.addColorStop(1, "#30383c");
      ctx.fillStyle = wreck;
      ctx.beginPath();
      ctx.roundRect(-36, -20, 72, 40, 7);
      ctx.fill();
      ctx.fillStyle = "#0d1112";
      ctx.beginPath();
      ctx.roundRect(-12, -26, 32, 52, 4);
      ctx.fill();
      ctx.strokeStyle = "#e45b4f";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-26, -14);
      ctx.lineTo(8, 10);
      ctx.moveTo(-3, -17);
      ctx.lineTo(30, 15);
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.48)";
      ctx.beginPath();
      ctx.arc(-21, -20, 8, 0, Math.PI * 2);
      ctx.arc(-21, 20, 8, 0, Math.PI * 2);
      ctx.arc(23, -20, 8, 0, Math.PI * 2);
      ctx.arc(23, 20, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 118, 80, 0.28)";
      ctx.beginPath();
      ctx.arc(26, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (game.parkingLot) {
    const lotCenter = rectCenter(game.parkingLot);
    drawWorldPulse(lotCenter.x, lotCenter.y, Math.max(game.parkingLot.w, game.parkingLot.h) * 0.62, "#f0c453", distanceToRectCenter(game.parkingLot) < 260 ? 1 : 0.72);
    ctx.save();
    const lot = game.parkingLot;
    const lotCenterX = lot.x + lot.w / 2;
    const lotCenterY = lot.y + lot.h / 2;
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#f0c453";
    if (drawAtlasSprite(visualAssets.objectiveIcons, 3, 3, OBJECTIVE_ICON.parking, lotCenterX, lotCenterY, lot.w * 1.22, lot.h * 1.18, 0, 0.98)) {
      ctx.strokeStyle = "rgba(240, 196, 83, 0.64)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(lot.x - 8, lot.y - 8, lot.w + 16, lot.h + 16, 10);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const lampX = lot.x + lot.w + 46;
    const lampY = lot.y - 28;
    const lampGlow = ctx.createRadialGradient(lampX, lampY, 10, lampX, lampY, 190);
    lampGlow.addColorStop(0, "rgba(255, 236, 154, 0.28)");
    lampGlow.addColorStop(1, "rgba(255, 236, 154, 0)");
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(lampX, lampY, 190, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(32, 34, 32, 0.86)";
    ctx.strokeStyle = "#f0c453";
    ctx.lineWidth = 4;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = "rgba(245, 245, 220, 0.72)";
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i += 1) {
      const x = lot.x + (lot.w / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, lot.y + 12);
      ctx.lineTo(x - 18, lot.y + lot.h - 12);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(lot.x + 14, lot.y + lot.h - 16);
    ctx.lineTo(lot.x + lot.w - 14, lot.y + lot.h - 16);
    ctx.stroke();
    ctx.strokeStyle = "#3b3932";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lampX, lampY);
    ctx.lineTo(lampX, lot.y + lot.h + 18);
    ctx.stroke();
    ctx.fillStyle = "#ffe58a";
    ctx.beginPath();
    ctx.arc(lampX, lampY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0c453";
    ctx.font = "900 56px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", lot.x + lot.w / 2, lot.y + lot.h / 2);
    ctx.restore();
  }
}

function drawObjectiveBeacon() {
  if (game.mode !== MODE.PLAYING) return;
  const target = currentObjectiveTarget();
  if (!target) return;
  const distance = Math.hypot(target.x - game.player.x, target.y - game.player.y);
  const pulse = 0.5 + Math.sin(performance.now() / 210) * 0.5;
  const radius = clamp(38 + distance / 42, 42, 96) + pulse * 10;
  ctx.save();
  ctx.globalAlpha = 0.74;
  ctx.strokeStyle = game.phase === "maze" ? "rgba(213, 169, 255, 0.88)" : "rgba(240, 196, 83, 0.88)";
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 22;
  ctx.shadowColor = game.phase === "maze" ? "#a048ff" : "#f0c453";
  if (distance > 160) {
    const angle = Math.atan2(target.y - game.player.y, target.x - game.player.x);
    const start = clamp(distance * 0.18, 74, 170);
    const end = Math.min(distance - 58, start + clamp(distance * 0.28, 120, 280));
    ctx.save();
    ctx.globalAlpha = 0.18 + pulse * 0.18;
    ctx.strokeStyle = game.phase === "maze" ? "rgba(213, 169, 255, 0.72)" : "rgba(240, 196, 83, 0.72)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 18]);
    ctx.beginPath();
    ctx.moveTo(game.player.x + Math.cos(angle) * start, game.player.y + Math.sin(angle) * start);
    ctx.lineTo(game.player.x + Math.cos(angle) * end, game.player.y + Math.sin(angle) * end);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 3; i += 1) {
      const d = start + (end - start) * (i + 0.35 + pulse * 0.3) / 3;
      const x = game.player.x + Math.cos(angle) * d;
      const y = game.player.y + Math.sin(angle) * d;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = game.phase === "maze" ? "rgba(213, 169, 255, 0.8)" : "rgba(240, 196, 83, 0.8)";
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.3 + pulse * 0.24;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = game.phase === "maze" ? "#d5a9ff" : "#fff3bd";
  ctx.font = "900 13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(target.label || "目标", target.x, target.y - radius - 12);
  ctx.restore();
}

function drawEffects() {
  game.muzzleFlashes.forEach((flash) => {
    const alpha = clamp(flash.life / flash.maxLife, 0, 1);
    const hot = flash.level >= 8 ? "#fff1a8" : "#fff7d1";
    ctx.save();
    ctx.translate(flash.x, flash.y);
    ctx.rotate(flash.angle);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 28;
    ctx.shadowColor = flash.color || "#fff7a6";
    ctx.strokeStyle = `rgba(255, 247, 209, ${0.26 * alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, flash.size * (1.25 - alpha * 0.4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = flash.color || "#fff7a6";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(flash.size * 1.35, -flash.size * 0.34);
    ctx.lineTo(flash.size * 0.72, 0);
    ctx.lineTo(flash.size * 1.35, flash.size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(0, 0, flash.size * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  game.bullets.forEach((b) => {
    const angle = b.angle ?? Math.atan2(b.vy, b.vx);
    const tailX = b.x - Math.cos(angle) * (b.trail || 56);
    const tailY = b.y - Math.sin(angle) * (b.trail || 56);
    const trail = ctx.createLinearGradient(tailX, tailY, b.x, b.y);
    trail.addColorStop(0, "rgba(255, 255, 255, 0)");
    trail.addColorStop(0.35, `${b.color || "#fff7a6"}55`);
    trail.addColorStop(1, "#fff7d1");
    ctx.save();
    ctx.lineCap = "round";
    ctx.shadowBlur = 18;
    ctx.shadowColor = b.color || "#fff7a6";
    ctx.strokeStyle = trail;
    ctx.lineWidth = clamp(b.r * 1.4, 4, 14);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = `${b.color || "#fff7a6"}99`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = b.color || "#fff7a6";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7d1";
    ctx.beginPath();
    ctx.arc(b.x + Math.cos(angle) * b.r * 0.32, b.y + Math.sin(angle) * b.r * 0.32, Math.max(1.8, b.r * 0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  game.particles.forEach((p) => {
    const alpha = clamp(p.life * 3, 0, 1);
    const size = p.size || 4;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillRect(-size * 0.5, -size * 0.18, size, size * 0.36);
    ctx.restore();
  });
}

function drawWeatherEffects() {
  if (game.phase !== "forest") return;
  const scene = game.scene || sceneForDay(game.day);
  const time = performance.now() / 1000;
  ctx.save();
  if (scene.weather === "rain") {
    ctx.strokeStyle = "rgba(160, 205, 230, 0.32)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 90; i += 1) {
      const x = (seededNoise(i, game.day) * W + time * 220 + i * 37) % (W + 120) - 80;
      const y = (seededNoise(game.day, i) * H + time * 460 + i * 19) % (H + 90) - 60;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 22, y + 52);
      ctx.stroke();
    }
  } else if (scene.weather === "snow" || scene.weather === "ash") {
    const color = scene.weather === "snow" ? "rgba(235, 255, 255, 0.55)" : "rgba(210, 205, 190, 0.32)";
    ctx.fillStyle = color;
    for (let i = 0; i < 80; i += 1) {
      const x = (seededNoise(i + 7, game.day) * W + Math.sin(time + i) * 22) % W;
      const y = (seededNoise(game.day + 11, i) * H + time * (scene.weather === "snow" ? 28 : 46) + i * 13) % H;
      ctx.beginPath();
      ctx.arc(x, y, scene.weather === "snow" ? 1.8 : 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (scene.weather === "fog") {
    ctx.fillStyle = "rgba(220, 235, 225, 0.055)";
    for (let i = 0; i < 9; i += 1) {
      const x = ((seededNoise(i, game.day + 21) * W) + time * (16 + i * 2)) % (W + 260) - 130;
      const y = seededNoise(game.day - 9, i) * H;
      ctx.beginPath();
      ctx.ellipse(x, y, 180 + i * 22, 32 + i * 3, 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (scene.weather === "toxic") {
    ctx.fillStyle = "rgba(178, 255, 83, 0.09)";
    for (let i = 0; i < 18; i += 1) {
      const wx = Math.floor((game.camera.x + i * 173) / 120);
      const wy = Math.floor((game.camera.y + i * 91) / 120);
      const x = ((seededNoise(wx, i) * W) + i * 61) % W;
      const y = ((seededNoise(i, wy) * H) + i * 43) % H;
      ctx.beginPath();
      ctx.arc(x, y, 26 + seededNoise(i, wx) * 28, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (scene.weather === "redmoon") {
    ctx.fillStyle = "rgba(120, 10, 18, 0.16)";
    ctx.fillRect(0, 0, W, H);
  } else if (scene.weather === "embers") {
    ctx.fillStyle = "rgba(255, 128, 68, 0.42)";
    for (let i = 0; i < 38; i += 1) {
      const x = (seededNoise(i, game.day + 51) * W + Math.sin(time * 1.8 + i) * 34) % W;
      const y = (seededNoise(game.day + 31, i) * H - time * 34 + i * 29) % H;
      ctx.fillRect(x, y < 0 ? y + H : y, 2, 5);
    }
  }
  ctx.restore();
}

function drawVisionMask() {
  const screenX = game.player.x - game.camera.x;
  const screenY = game.player.y - game.camera.y;
  const radius = CONFIG.vision.radiusMeters * CONFIG.vision.pixelsPerMeter;
  const angle = game.player.angle;
  ctx.save();
  ctx.globalAlpha = game.driving ? 0.12 : 0.18;
  ctx.fillStyle = "rgba(255, 238, 168, 0.45)";
  ctx.beginPath();
  ctx.moveTo(screenX, screenY);
  ctx.arc(screenX, screenY, radius * 0.95, angle - 0.45, angle + 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.72, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function monsterThreatAlpha() {
  if (game.monsters.length === 0) return 0;
  const nearest = game.monsters.reduce((best, monster) => {
    const edgeDistance = dist(game.player, monster) - game.player.r - monster.r;
    return Math.min(best, edgeDistance);
  }, Infinity);
  return clamp((260 - nearest) / 260, 0, 0.62);
}

function drawDamageOverlay() {
  const playerHit = clamp(game.player.damageCooldown / 0.55, 0, 1);
  const vehicleHit = clamp(game.vehicleDamageCooldown / 0.38, 0, 1);
  const lowHealth = game.driving ? clamp((45 - game.vehicleHp) / 45, 0, 0.55) : clamp((35 - game.player.hp) / 35, 0, 0.55);
  const threat = monsterThreatAlpha();
  const pulse = 0.72 + Math.sin(performance.now() / 120) * 0.18;
  const alpha = Math.max(playerHit * 0.55, vehicleHit * 0.45, lowHealth, threat * pulse);
  if (alpha <= 0) return;
  const gradient = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.24, W / 2, H / 2, Math.max(W, H) * 0.68);
  gradient.addColorStop(0, "rgba(228, 91, 79, 0)");
  gradient.addColorStop(1, `rgba(228, 91, 79, ${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function drawAimReticle() {
  if (game.mode !== MODE.PLAYING || game.driving) return;
  const spread = currentWeapon().spread || 0;
  const size = clamp(13 + spread * 210, 13, 30);
  const pulse = game.shootCooldown > 0 ? 1 + game.shootCooldown * 2.4 : 1;
  ctx.save();
  ctx.translate(mouse.screenX, mouse.screenY);
  ctx.globalAlpha = 0.86;
  ctx.strokeStyle = game.phase === "maze" ? "rgba(213, 169, 255, 0.92)" : "rgba(240, 196, 83, 0.92)";
  ctx.lineWidth = 1.6;
  ctx.shadowBlur = 10;
  ctx.shadowColor = game.phase === "maze" ? "#a048ff" : "#f0c453";
  ctx.beginPath();
  ctx.arc(0, 0, size * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-size - 10, 0);
  ctx.lineTo(-size - 3, 0);
  ctx.moveTo(size + 3, 0);
  ctx.lineTo(size + 10, 0);
  ctx.moveTo(0, -size - 10);
  ctx.lineTo(0, -size - 3);
  ctx.moveTo(0, size + 3);
  ctx.lineTo(0, size + 10);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function updateCarPointerDom() {
  if (game.phase !== "forest") {
    ui.carPointer.classList.add("hidden");
    return;
  }
  const target = currentObjectiveTarget();
  if (!target) {
    ui.carPointer.classList.add("hidden");
    return;
  }
  const dx = target.x - game.player.x;
  const dy = target.y - game.player.y;
  ui.carPointer.classList.remove("hidden");
  ui.carPointerLabel.textContent = target.label;
  ui.carDistance.textContent = `${Math.max(0, Math.round(Math.hypot(dx, dy) / 10))} 米`;
  if (ui.carArrow instanceof HTMLElement) {
    ui.carArrow.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI}rad)`;
  }
}

function drawWorldHint(screenX, screenY, text, tone = "#f0c453") {
  const pulse = 0.7 + Math.sin(performance.now() / 200) * 0.3;
  ctx.save();
  ctx.globalAlpha = 0.84 + pulse * 0.12;
  ctx.font = "900 14px Inter, sans-serif";
  ctx.textAlign = "center";
  const metrics = ctx.measureText(text);
  const width = Math.max(112, metrics.width + 34);
  const height = 34;
  const x = screenX - width / 2;
  const y = screenY - height / 2;
  ctx.shadowBlur = 18;
  ctx.shadowColor = tone;
  ctx.fillStyle = "rgba(4, 8, 9, 0.82)";
  ctx.strokeStyle = tone;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.arc(x + 16, y + height / 2, 4 + pulse * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff4d3";
  ctx.shadowBlur = 0;
  ctx.fillText(text, screenX + 8, y + 22);
  ctx.restore();
}

function drawWorldHintAt(worldX, worldY, text, tone = "#f0c453", offsetY = 58) {
  drawWorldHint(worldX - game.camera.x, worldY - game.camera.y - offsetY, text, tone);
}

function nearestPickupForHint() {
  let best = null;
  let bestDistance = Infinity;
  game.pickups.forEach((item) => {
    const maxDistance = item.type === "key" ? 150 : item.type === "chest" ? 105 : 86;
    const itemDistance = dist(game.player, item);
    if (itemDistance < maxDistance && itemDistance < bestDistance) {
      best = item;
      bestDistance = itemDistance;
    }
  });
  return best;
}

function drawProximityHint() {
  if (game.mode !== MODE.PLAYING) return;
  if (game.phase === "forest") {
    if (game.nearTent || game.nearWatchtower) return;
    if (game.nightmareEntrance && distanceToRectCenter(game.nightmareEntrance) < 170) {
      const center = rectCenter(game.nightmareEntrance);
      drawWorldHintAt(center.x, center.y, "靠近进入地下入口", "#a048ff", 78);
      return;
    }
    if (game.car && distanceToRectCenter(game.car) < 180) {
      const center = rectCenter(game.car);
      drawWorldHintAt(center.x, center.y, "靠近上车逃亡", "#6ce4ff", 76);
      return;
    }
    if (game.parkingLot && (game.driving || game.escapeOnFoot) && distanceToRectCenter(game.parkingLot) < 240) {
      const center = rectCenter(game.parkingLot);
      drawWorldHintAt(center.x, center.y, "进入停车场完成逃生", "#f0c453", 86);
      return;
    }
  }

  if (game.phase === "maze") {
    const item = nearestPickupForHint();
    if (item) {
      const text = item.type === "key"
        ? `拾取钥匙 ${game.foundKeys + 1} / 2`
        : item.type === "ammo"
          ? "拾取弹药"
          : item.type === "medkit"
            ? "使用医疗包"
            : "打开补给箱";
      const tone = item.type === "key" || item.type === "chest" ? "#f0c453" : item.type === "ammo" ? "#5cc7ff" : "#7ae0a6";
      drawWorldHintAt(item.x, item.y, text, tone, item.type === "key" ? 66 : 58);
      return;
    }
    if (game.door && distanceToRectCenter(game.door) < 165) {
      const center = rectCenter(game.door);
      drawWorldHintAt(
        center.x,
        center.y,
        game.foundKeys >= 2 ? "进入大门回到森林" : `还需要 ${2 - game.foundKeys} 把钥匙`,
        game.foundKeys >= 2 ? "#7ae0a6" : "#f0c453",
        82,
      );
    }
  }
}

function drawTentHint() {
  if (!game.nearTent || game.phase !== "forest" || game.driving) return;
  const tent = game.nearTent;
  const screenX = tent.x - game.camera.x;
  const screenY = tent.y - game.camera.y;
  if (game.searchedTents.has(tent.key)) {
    drawWorldHint(screenX, screenY - 42, "帐篷已搜刮", "#8fa59f");
  } else if (isOpeningForestQuestActive() && (game.questStage || 0) <= 0) {
    drawWorldHint(screenX, screenY - 42, "按 E 搜寻线索", "#f0c453");
  } else {
    drawWorldHint(screenX, screenY - 42, "按 E 搜刮", "#f0c453");
  }
}

function drawWatchtowerHint() {
  if (!game.nearWatchtower || game.phase !== "forest" || game.driving) return;
  const tower = game.nearWatchtower;
  const screenX = tower.x - game.camera.x;
  const screenY = tower.y - game.camera.y;
  if (game.inWatchtower) {
    if (game.searchedWatchtowers.has(tower.key)) {
      drawWorldHint(screenX, screenY - 70, "瞭望塔已搜刮", "#8fa59f");
    } else if (isOpeningForestQuestActive() && game.questStage === 1) {
      drawWorldHint(screenX, screenY - 70, "按 E 定位入口", "#f0c453");
    } else {
      drawWorldHint(screenX, screenY - 70, "按 E 搜刮", "#f0c453");
    }
  } else {
    drawWorldHint(screenX, screenY - 70, "进入瞭望塔", "#6ce4ff");
  }
}

function draw() {
  ui.carPointer.classList.add("hidden");
  ctx.clearRect(0, 0, W, H);
  const closeThreat = monsterThreatAlpha();
  const shake = game.screenShake + Math.max(0, closeThreat - 0.45) * 7;
  const shakeX = shake > 0 ? rand(-shake, shake) : 0;
  const shakeY = shake > 0 ? rand(-shake, shake) : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.translate(-game.camera.x, -game.camera.y);
  if (game.phase === "maze") drawMaze();
  else drawForest();
  drawItems();
  drawObjectiveBeacon();
  drawEffects();
  if (game.mode === MODE.PLAYING) drawMonsters();
  drawPlayer();
  if (game.phase === "forest") drawForestFeatures("cover");
  ctx.restore();
  drawWeatherEffects();
  drawVisionMask();
  drawDamageOverlay();
  drawAimReticle();
  updateCarPointerDom();
  drawTentHint();
  drawWatchtowerHint();
  drawProximityHint();
}

function loop(time) {
  if (!running) return;
  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    screenX: ((event.clientX - rect.left) / rect.width) * W,
    screenY: ((event.clientY - rect.top) / rect.height) * H,
  };
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
  }
  keysDown.add(key);
  // E 键搜刮帐篷
  if (key === "e" && game.nearTent && game.phase === "forest" && !game.driving) {
    if (!game.searchedTents.has(game.nearTent.key)) {
      searchTent(game.nearTent);
    }
  }
  // E 键进入/搜刮瞭望塔
  if (key === "e" && game.nearWatchtower && game.phase === "forest" && !game.driving) {
    if (game.inWatchtower && !game.searchedWatchtowers.has(game.nearWatchtower.key)) {
      searchWatchtower(game.nearWatchtower);
    }
  }
});

window.addEventListener("keyup", (event) => {
  keysDown.delete(event.key.toLowerCase());
});

window.addEventListener("resize", () => {
  syncCanvasSize();
  mouse.screenX = clamp(mouse.screenX, 0, W);
  mouse.screenY = clamp(mouse.screenY, 0, H);
  updateCamera();
  updateMouseWorld();
  draw();
});

canvas.addEventListener("mousemove", (event) => {
  Object.assign(mouse, canvasPoint(event));
  updateMouseWorld();
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse") return;
  Object.assign(mouse, canvasPoint(event));
  updateMouseWorld();
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") return;
  Object.assign(mouse, canvasPoint(event));
  updateMouseWorld();
});

canvas.addEventListener("mousedown", (event) => {
  if (event.target !== canvas) return;
  Object.assign(mouse, canvasPoint(event));
  updateMouseWorld();
  shootHeld = true;
  shoot();
});

window.addEventListener("mouseup", () => {
  shootHeld = false;
});

function updateJoystickKnob() {
  const travel = Math.max(28, (ui.joystick.clientWidth - ui.joystickKnob.clientWidth) / 2 - 4);
  ui.joystickKnob.style.transform = `translate(calc(-50% + ${joystick.dx * travel}px), calc(-50% + ${joystick.dy * travel}px))`;
}

ui.joystick.addEventListener("pointerdown", (event) => {
  joystick.active = true;
  joystick.id = event.pointerId;
  joystick.startX = event.clientX;
  joystick.startY = event.clientY;
  ui.joystick.classList.add("is-active");
  ui.joystick.setPointerCapture(event.pointerId);
});

ui.joystick.addEventListener("pointermove", (event) => {
  if (!joystick.active || event.pointerId !== joystick.id) return;
  const dx = event.clientX - joystick.startX;
  const dy = event.clientY - joystick.startY;
  const len = Math.hypot(dx, dy);
  const limit = 44;
  joystick.dx = len > 0 ? clamp(dx / limit, -1, 1) : 0;
  joystick.dy = len > 0 ? clamp(dy / limit, -1, 1) : 0;
  if (len > limit) {
    joystick.dx = dx / len;
    joystick.dy = dy / len;
  }
  updateJoystickKnob();
});

function resetJoystick(event) {
  if (event && event.pointerId !== joystick.id) return;
  joystick.active = false;
  joystick.id = null;
  joystick.dx = 0;
  joystick.dy = 0;
  ui.joystick.classList.remove("is-active");
  updateJoystickKnob();
}

ui.joystick.addEventListener("pointerup", resetJoystick);
ui.joystick.addEventListener("pointercancel", resetJoystick);

if (ui.fireButton) {
  ui.fireButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    shootHeld = true;
    ui.fireButton.classList.add("is-pressed");
    ui.fireButton.setPointerCapture(event.pointerId);
    shoot();
  });
  const stopFire = (event) => {
    if (event) event.preventDefault();
    shootHeld = false;
    ui.fireButton.classList.remove("is-pressed");
  };
  ui.fireButton.addEventListener("pointerup", stopFire);
  ui.fireButton.addEventListener("pointercancel", stopFire);
}

ui.banner.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.id === "startBtn") {
    showIntro();
  }
  if (target?.id === "introStartBtn") {
    stopIntroAtmosphere();
    start();
  }
  if (target?.id === "nextDayBtn") startNextDay();
  if (target?.id === "retryDayBtn") restartFailedDay();
  if (target?.id === "mainMenuBtn") showMainMenu();
});
ui.shopBtn.addEventListener("click", () => {
  if (game.driving || game.escapeOnFoot) return;
  setShopOpen(!game.shopOpen);
});
ui.shopClose.addEventListener("click", () => {
  setShopOpen(false);
});
ui.weaponTab.addEventListener("click", () => {
  setShopTab("weapons");
});
ui.ammoTab.addEventListener("click", () => {
  setShopTab("ammo");
});
ui.weaponList.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const weaponButton = /** @type {HTMLElement | null | undefined} */ (target?.closest(".weapon-buy"));
  if (weaponButton) {
    buyOrEquipWeapon(weaponButton.dataset.weapon);
    return;
  }
  const ammoButton = /** @type {HTMLElement | null | undefined} */ (target?.closest(".ammo-buy"));
  if (ammoButton) buyAmmo(ammoButton.dataset.ammoLevel);
});
ui.weaponQuickbar.addEventListener("click", (event) => {
  if (game.driving) return;
  const target = event.target instanceof Element ? event.target : null;
  const button = /** @type {HTMLElement | null | undefined} */ (target?.closest(".quick-weapon"));
  if (!button) return;
  buyOrEquipWeapon(button.dataset.weapon);
});
ui.taskToggle.addEventListener("click", () => {
  const collapsed = ui.taskPanel.classList.toggle("collapsed");
  ui.taskToggle.textContent = collapsed ? "展开" : "收起";
  ui.taskToggle.setAttribute("aria-expanded", String(!collapsed));
});
resetGame();
showMainMenu();

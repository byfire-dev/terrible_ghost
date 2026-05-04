export const MAZE_TILE = 48;
export const MAZE_COLS = 50;
export const MAZE_ROWS = 34;
export const MAZE_W = MAZE_TILE * MAZE_COLS;
export const MAZE_H = MAZE_TILE * MAZE_ROWS;
export const MAZE_START = { x: MAZE_TILE * 2.5, y: MAZE_TILE * 2.5 };
export const FOREST_FEATURE_CELL = 180;

export const CONFIG = {
  ammo: {
    max: 50,
    initial: 50,
    forestSpawnMin: 14,
    forestSpawnMax: 28,
    mazeSpawnMin: 10,
    mazeSpawnMax: 22,
    maxPickups: 7,
  },
  medkit: {
    useSeconds: 5,
    speedMultiplier: 0.8,
    forestSpawnMin: 18,
    forestSpawnMax: 34,
  },
  chest: {
    forestSpawnMin: 24,
    forestSpawnMax: 42,
    mazeSpawnMin: 18,
    mazeSpawnMax: 34,
    maxPickups: 3,
    ammoMin: 14,
    ammoMax: 26,
    pointsMin: 20,
    pointsMax: 95,
  },
  damage: {
    rockDebris: 2,
  },
  vision: {
    pixelsPerMeter: 10,
    radiusMeters: 25,
  },
  mazeMonsters: {
    spawnMin: 5.5,
    spawnMax: 8.5,
    maxActive: 5,
  },
  vehicle: {
    hp: 100,
    parkingBaseX: 5200,
    parkingBaseY: 3600,
    parkingDayX: 420,
    parkingDayY: 260,
    chaseSpawnMin: 2.4,
    chaseSpawnMax: 4.2,
    chaseCount: 2,
    chaseMaxActive: 14,
  },
  boss: {
    dayInterval: 5,
    rewardMultiplier: 35,
  },
};

export const MAX_AMMO = CONFIG.ammo.max;

export const MODE = {
  MENU: "menu",
  PLAYING: "playing",
  SHOP: "shop",
  DAY_COMPLETE: "dayComplete",
  GAME_OVER: "gameOver",
};

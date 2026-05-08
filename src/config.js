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
    forestSpawnMin: 12,
    forestSpawnMax: 22,
    mazeSpawnMin: 9,
    mazeSpawnMax: 18,
    maxPickups: 8,
  },
  medkit: {
    useSeconds: 5,
    speedMultiplier: 0.8,
    forestSpawnMin: 16,
    forestSpawnMax: 30,
  },
  chest: {
    forestSpawnMin: 20,
    forestSpawnMax: 34,
    mazeSpawnMin: 16,
    mazeSpawnMax: 28,
    maxPickups: 4,
    ammoMin: 16,
    ammoMax: 30,
    pointsMin: 35,
    pointsMax: 125,
  },
  damage: {
    rockDebris: 2,
  },
  vision: {
    pixelsPerMeter: 10,
    radiusMeters: 25,
  },
  mazeMonsters: {
    spawnMin: 8.5,
    spawnMax: 12.5,
    maxActive: 3,
  },
  vehicle: {
    hp: 125,
    parkingBaseX: 4200,
    parkingBaseY: 3000,
    parkingDayX: 300,
    parkingDayY: 200,
    chaseSpawnMin: 3.2,
    chaseSpawnMax: 5.2,
    chaseCount: 2,
    chaseMaxActive: 10,
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

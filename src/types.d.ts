export type GameMode = "menu" | "playing" | "shop" | "dayComplete" | "gameOver";

export type Circle = {
  x: number;
  y: number;
  r: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WeaponSave = {
  day: number;
  points: number;
  weaponId: string;
  ownedWeapons: string[];
  ammo: Record<string, number>;
};

export type MonsterKind = "small" | "mazeBig" | "chaser" | "boss";

export type LevelObject = {
  version: 1;
  name: string;
  objects: Array<{
    type: "wall" | "monster" | "chest" | "ammo" | "medkit" | "car" | "parking";
    x: number;
    y: number;
    level?: number;
  }>;
};

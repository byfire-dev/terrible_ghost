export function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const CACHE_VERSION = "terrible-ghost-2026-05-09-1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./src/config.js",
  "./src/data/scenes.js",
  "./src/data/weapons.js",
  "./src/main.js",
  "./src/render/art.js",
  "./src/render/horrorMonsters.js",
  "./src/state.js",
  "./src/systems/loadout.js",
  "./src/systems/pickups.js",
  "./src/systems/save.js",
  "./src/systems/sound.js",
  "./src/ui/dom.js",
  "./src/ui/hud.js",
  "./src/ui/shop.js",
  "./src/utils/math.js",
];

const IMAGE_ASSETS = [
  "./assets/images/forest-ground-horror-texture.webp",
  "./assets/images/gameplay-atmosphere-overlay.webp",
  "./assets/images/home-hero-horror.webp",
  "./assets/images/intro-story-cockpit.webp",
  "./assets/images/maze-stone-horror-texture.webp",
  "./assets/images/monster-atlas.webp",
  "./assets/images/objective-icons-atlas.webp",
  "./assets/images/result-failure-cracked-windshield.webp",
  "./assets/images/result-success-parking-lot.webp",
  "./assets/images/shop-armory-horror-bg.webp",
  "./assets/images/weapon-ammo-burst-bg.webp",
  "./assets/images/world-props-atlas.webp",
];

async function cacheAssets(cacheName, assets) {
  const cache = await caches.open(cacheName);
  await cache.addAll(assets);
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([
    cacheAssets(STATIC_CACHE, STATIC_ASSETS),
    cacheAssets(IMAGE_CACHE, IMAGE_ASSETS),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("terrible-ghost-") && !key.startsWith(CACHE_VERSION))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return cache.match("./index.html");
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.endsWith(".webp")) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

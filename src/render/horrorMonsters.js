// Horror monster drawing system - inspired by body-horror pixel art
// Three progressive stages: Mourner -> Scream -> Beast
// Each stage gets progressively more monstrous and disturbing

const HORROR_PALETTE = {
  // Skin tones (desaturated, corpse-like)
  skinLight: "#a0a0a0",
  skinMid: "#6a6a6a",
  skinDark: "#3a3a3a",
  skinShadow: "#1a0f14",
  
  // Corruption / body horror
  corruption: "#4a2635",
  corruptionDark: "#2a1520",
  corruptionLight: "#6b3a52",
  
  // Blood (muted, brownish crimson)
  blood: "#6b1a1a",
  bloodBright: "#8b2323",
  bloodDark: "#3a0f0f",
  
  // Hair / void
  hair: "#0d070a",
  hairHighlight: "#1a1018",
  
  // Eyes (glowing, hollow)
  eyeGlow: "#ff2e2e",
  eyeGlowBright: "#ff6b6b",
  eyeVoid: "#0a0505",
  
  // Highlights
  highlight: "#8a8a94",
  bone: "#c4c4c4",
};

const MONSTER_ATLAS = new Image();
MONSTER_ATLAS.decoding = "async";
MONSTER_ATLAS.dataset.src = "assets/images/monster-atlas.webp";

const MONSTER_SPRITE = {
  mourner: [0, 0],
  stalker: [1, 0],
  chaser: [2, 0],
  mazeCrawler: [3, 0],
  mazeBrute: [0, 1],
  hornedBeast: [1, 1],
  boss: [2, 1],
  bossSigil: [3, 1],
};

// Stage configurations
const HORROR_STAGES = {
  // Stage 1: "The Mourner" - tall, faceless, emaciated
  mourner: {
    bodyShape: "elongated",
    hasFace: false,
    limbCount: 2,
    hasHair: true,
    hasHorns: false,
    hasBlood: false,
    hasSpikes: false,
    glowIntensity: 0.3,
    twitchSpeed: 200,
    trailColor: "#3a1f2a",
  },
  
  // Stage 2: "The Scream" - exposed face, multiple limbs, screaming
  scream: {
    bodyShape: "chaotic",
    hasFace: true,
    limbCount: 6,
    hasHair: true,
    hasHorns: true,
    hasBlood: true,
    hasSpikes: true,
    glowIntensity: 0.6,
    twitchSpeed: 120,
    trailColor: "#6b1a1a",
  },
  
  // Stage 3: "The Beast" - quadrupedal, spiked, bestial
  beast: {
    bodyShape: "quadruped",
    hasFace: true,
    limbCount: 4,
    hasHair: false,
    hasHorns: true,
    hasBlood: true,
    hasSpikes: true,
    glowIntensity: 0.9,
    twitchSpeed: 80,
    trailColor: "#8b2323",
  },
};

/**
 * Get horror stage based on monster level and game day
 */
export function getHorrorStage(level, day, kind) {
  if (kind === "boss") return "beast";
  if (kind === "chaser") return "scream";
  const combined = level + Math.floor(day / 3);
  if (combined >= 10) return "beast";
  if (combined >= 5) return "scream";
  return "mourner";
}

/**
 * Draw a horror monster with body-horror aesthetic
 */
export function drawHorrorMonster(ctx, m, time) {
  const stage = m.horrorStage || getHorrorStage(m.level || 1, m.day || 1, m.kind);
  const config = HORROR_STAGES[stage] || HORROR_STAGES.mourner;
  const hurt = m.hp / m.maxHp;
  const r = m.r;
  
  // Twitch/jitter based on stage
  const twitchX = Math.sin(time / config.twitchSpeed + m.x) * (stage === "beast" ? 2 : stage === "scream" ? 1.5 : 0.5);
  const twitchY = Math.cos(time / (config.twitchSpeed * 0.7) + m.y) * (stage === "beast" ? 1.5 : stage === "scream" ? 1 : 0.3);
  
  ctx.save();
  ctx.translate(m.x + twitchX, m.y + twitchY);
  
  // Draw shadow
  drawHorrorShadow(ctx, r, config);
  
  // Draw trail/afterimage for fast movers
  if (config.trailColor && Math.hypot(m.vx || 0, m.vy || 0) > 0.3) {
    drawHorrorTrail(ctx, m, r, config, time);
  }

  if (drawMonsterSprite(ctx, m, r, hurt, stage, config, time)) {
    ctx.restore();
    if (m.maxHp > 1) drawHorrorHealthBar(ctx, m, hurt);
    return;
  }
  
  // Draw body based on stage
  switch (stage) {
    case "beast":
      drawBeastBody(ctx, r, hurt, config, time, m);
      break;
    case "scream":
      drawScreamBody(ctx, r, hurt, config, time, m);
      break;
    case "mourner":
    default:
      drawMournerBody(ctx, r, hurt, config, time, m);
      break;
  }
  
  ctx.restore();
  if (m.maxHp > 1) drawHorrorHealthBar(ctx, m, hurt);
}

function imageReady(image) {
  return image.complete && image.naturalWidth > 0;
}

function ensureMonsterAtlas() {
  if (!MONSTER_ATLAS.src && MONSTER_ATLAS.dataset.src) MONSTER_ATLAS.src = MONSTER_ATLAS.dataset.src;
}

function monsterSpriteCell(m, stage) {
  if (m.kind === "boss") return MONSTER_SPRITE.boss;
  if (m.kind === "chaser") return MONSTER_SPRITE.chaser;
  if (m.kind === "mazeBig") return MONSTER_SPRITE.mazeBrute;
  if (m.kind === "small") return MONSTER_SPRITE.mazeCrawler;
  if (stage === "beast") return MONSTER_SPRITE.hornedBeast;
  if (stage === "scream") return MONSTER_SPRITE.stalker;
  return MONSTER_SPRITE.mourner;
}

function drawAtlasCell(ctx, image, columns, rows, cell, x, y, width, height, rotation = 0, alpha = 1, flipX = false) {
  if (!imageReady(image)) return false;
  const [col, row] = cell;
  const cellW = image.naturalWidth / columns;
  const cellH = image.naturalHeight / rows;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(flipX ? -1 : 1, 1);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
}

function monsterSpriteSize(m, r, stage) {
  if (m.kind === "boss") return { width: r * 4.7, height: r * 3.45, y: -r * 0.08 };
  if (m.kind === "mazeBig") return { width: r * 4.15, height: r * 3.85, y: -r * 0.18 };
  if (m.kind === "small") return { width: r * 4.6, height: r * 3.15, y: -r * 0.08 };
  if (m.kind === "chaser") return { width: r * 4.55, height: r * 3.45, y: -r * 0.08 };
  if (stage === "beast") return { width: r * 4.55, height: r * 3.35, y: -r * 0.08 };
  if (stage === "scream") return { width: r * 4.35, height: r * 3.55, y: -r * 0.16 };
  return { width: r * 4.75, height: r * 3.2, y: -r * 0.08 };
}

function drawMonsterSprite(ctx, m, r, hurt, stage, config, time) {
  ensureMonsterAtlas();
  if (!imageReady(MONSTER_ATLAS)) return false;
  const cell = monsterSpriteCell(m, stage);
  const size = monsterSpriteSize(m, r, stage);
  const velocityX = m.vx || 0;
  const flipX = velocityX < -0.02;
  const speed = Math.hypot(m.vx || 0, m.vy || 0);
  const lunge = Math.min(r * 0.18, speed * 0.16);
  const lungeX = Math.sign(velocityX || 1) * lunge;
  const bob = Math.sin(time / (m.kind === "chaser" ? 70 : 130) + m.x * 0.025) * r * 0.04;
  const damaged = hurt < 0.35;

  drawSpriteAura(ctx, m, r, hurt, stage, config, time);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = m.kind === "boss" ? 0.34 : m.kind === "chaser" ? 0.2 : 0.12;
  ctx.fillStyle = m.kind === "small" || m.kind === "mazeBig" ? "#a048ff" : "#e45b4f";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.65, size.width * 0.34, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.shadowBlur = m.kind === "boss" ? 30 : stage === "mourner" ? 14 : 20;
  ctx.shadowColor = m.kind === "small" || m.kind === "mazeBig" ? "#a048ff" : "#e45b4f";
  drawAtlasCell(ctx, MONSTER_ATLAS, 4, 2, cell, lungeX, size.y + bob, size.width, size.height, 0, damaged ? 0.82 : 1, flipX);

  if (damaged) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.24 + Math.sin(time / 55) * 0.08;
    ctx.fillStyle = "#ff4b57";
    ctx.beginPath();
    ctx.ellipse(0, 0, size.width * 0.34, size.height * 0.31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return true;
}

function drawSpriteAura(ctx, m, r, hurt, stage, config, time) {
  const boss = m.kind === "boss";
  const maze = m.kind === "small" || m.kind === "mazeBig";
  const pulse = 0.55 + Math.sin(time / (boss ? 140 : 210) + m.x * 0.015) * 0.25;
  const color = boss ? "#ff2638" : maze ? "#a048ff" : stage === "mourner" ? "#5cc7ff" : "#e45b4f";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = boss ? 0.48 : 0.22 + pulse * 0.14;
  const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * (boss ? 3.1 : 2.25));
  glow.addColorStop(0, color);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * (boss ? 3.1 : 2.25), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (boss) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.rotate(time / 1100);
    drawAtlasCell(ctx, MONSTER_ATLAS, 4, 2, MONSTER_SPRITE.bossSigil, 0, r * 0.78, r * 4.5, r * 4.5, 0, 0.38 + pulse * 0.16, false);
    ctx.restore();
  }

  if (m.kind === "chaser") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255, 75, 87, ${0.28 + pulse * 0.18})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.55 + pulse * 0.18), -Math.PI * 0.2, Math.PI * 1.22);
    ctx.stroke();
    ctx.restore();
  }

  if (hurt < 0.45) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255, 247, 209, ${0.16 + (1 - hurt) * 0.2})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.15 + pulse * 0.15), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHorrorShadow(ctx, r, config) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.75, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHorrorTrail(ctx, m, r, config, time) {
  const trailAngle = Math.atan2(m.vy || 0, m.vx || 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 1; i <= 3; i += 1) {
    const alpha = (0.12 / i);
    const distance = i * r * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = config.trailColor;
    ctx.beginPath();
    ctx.ellipse(
      -Math.cos(trailAngle) * distance,
      -Math.sin(trailAngle) * distance,
      r * (0.9 - i * 0.1),
      r * (0.6 - i * 0.06),
      trailAngle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

// ========== MOURNER (Stage 1) ==========
function drawMournerBody(ctx, r, hurt, config, time, m) {
  const pulse = 1 + Math.sin(time / 300 + m.x * 0.02) * 0.03;
  const elongation = 1.4; // Tall and thin
  
  ctx.save();
  ctx.scale(pulse, pulse * elongation);
  
  // Tattered shroud / burial gown
  ctx.fillStyle = hurt < 0.5 ? "#2a1a1a" : "#3a2a2a";
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.3);
  ctx.lineTo(-r * 0.4, -r * 0.9);
  ctx.lineTo(-r * 0.1, -r * 0.5);
  ctx.lineTo(r * 0.1, -r * 0.5);
  ctx.lineTo(r * 0.4, -r * 0.9);
  ctx.lineTo(r * 0.6, -r * 0.3);
  ctx.lineTo(r * 0.5, r * 0.8);
  ctx.lineTo(-r * 0.5, r * 0.8);
  ctx.closePath();
  ctx.fill();
  
  // Tattered strips at bottom
  ctx.strokeStyle = "#2a1a1a";
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) {
    const x = i * r * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, r * 0.6);
    ctx.lineTo(x + r * 0.05, r * 0.9 + Math.sin(time / 150 + i) * r * 0.1);
    ctx.stroke();
  }
  
  // Hair - solid black mass covering face
  ctx.fillStyle = HORROR_PALETTE.hair;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.4, r * 0.55, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Hair strands
  ctx.strokeStyle = HORROR_PALETTE.hairHighlight;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r * 0.3, -r * 0.4 + Math.sin(angle) * r * 0.5);
    ctx.lineTo(
      Math.cos(angle) * r * 0.5 + Math.sin(time / 200 + i) * 2,
      -r * 0.4 + Math.sin(angle) * r * 0.8 + r * 0.3
    );
    ctx.stroke();
  }
  
  // Elongated arms
  ctx.strokeStyle = hurt < 0.5 ? "#1a0f14" : "#2a1a1a";
  ctx.lineWidth = 3;
  // Left arm
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.1);
  ctx.lineTo(-r * 0.8, r * 0.4 + Math.sin(time / 180) * r * 0.1);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(r * 0.5, -r * 0.1);
  ctx.lineTo(r * 0.8, r * 0.4 + Math.cos(time / 180) * r * 0.1);
  ctx.stroke();
  
  // Oversized hands
  ctx.fillStyle = "#1a0f14";
  ctx.beginPath();
  ctx.arc(-r * 0.8, r * 0.4 + Math.sin(time / 180) * r * 0.1, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.8, r * 0.4 + Math.cos(time / 180) * r * 0.1, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

// ========== SCREAM (Stage 2) ==========
function drawScreamBody(ctx, r, hurt, config, time, m) {
  const pulse = 1 + Math.sin(time / 120 + m.x * 0.03) * 0.06;
  const rotation = Math.sin(time / 100 + m.x) * 0.08;
  
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.rotate(rotation);
  
  // Multiple tentacle-like limbs radiating outward
  const limbCount = 6;
  for (let i = 0; i < limbCount; i++) {
    const angle = (i / limbCount) * Math.PI * 2 + time / 150 + m.x * 0.01;
    const limbLength = r * (1.2 + Math.sin(time / 80 + i) * 0.2);
    const limbWidth = r * 0.15;
    
    ctx.save();
    ctx.rotate(angle);
    
    // Limb gradient from dark to blood-red
    const gradient = ctx.createLinearGradient(0, 0, limbLength, 0);
    gradient.addColorStop(0, hurt < 0.5 ? "#2a1520" : "#4a2635");
    gradient.addColorStop(1, hurt < 0.5 ? "#3a0f0f" : "#6b1a1a");
    ctx.fillStyle = gradient;
    
    ctx.beginPath();
    ctx.moveTo(-limbWidth, 0);
    ctx.quadraticCurveTo(limbLength * 0.5, -limbWidth * 2, limbLength, -limbWidth * 0.5);
    ctx.quadraticCurveTo(limbLength * 0.7, 0, limbLength, limbWidth * 0.5);
    ctx.quadraticCurveTo(limbLength * 0.5, limbWidth * 2, -limbWidth, 0);
    ctx.fill();
    
    // Small grasping hand at end of some limbs
    if (i % 2 === 0) {
      ctx.fillStyle = "#1a0f14";
      ctx.beginPath();
      ctx.arc(limbLength, 0, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      // Fingers
      ctx.strokeStyle = "#1a0f14";
      ctx.lineWidth = 2;
      for (let f = 0; f < 3; f++) {
        const fAngle = (f - 1) * 0.5;
        ctx.beginPath();
        ctx.moveTo(limbLength, 0);
        ctx.lineTo(
          limbLength + Math.cos(fAngle) * r * 0.2,
          Math.sin(fAngle) * r * 0.2
        );
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }
  
  // Central body
  ctx.fillStyle = hurt < 0.5 ? "#2a1520" : "#4a2635";
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spike = i % 2 === 0 ? 1.1 : 0.75;
    const x = Math.cos(a) * r * spike;
    const y = Math.sin(a) * r * spike;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#1a0f14";
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // The face - exposed, screaming
  ctx.fillStyle = "#c4c4c4";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.15, r * 0.45, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Hollow eyes
  ctx.fillStyle = HORROR_PALETTE.eyeVoid;
  ctx.beginPath();
  ctx.ellipse(-r * 0.18, -r * 0.25, r * 0.12, r * 0.15, -0.2, 0, Math.PI * 2);
  ctx.ellipse(r * 0.18, -r * 0.25, r * 0.12, r * 0.15, 0.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Eye glow
  ctx.shadowBlur = 12;
  ctx.shadowColor = HORROR_PALETTE.eyeGlow;
  ctx.fillStyle = HORROR_PALETTE.eyeGlow;
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.25, r * 0.06, 0, Math.PI * 2);
  ctx.arc(r * 0.18, -r * 0.25, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  
  // Screaming mouth - wide open
  ctx.fillStyle = "#1a0a0a";
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, r * 0.05);
  ctx.quadraticCurveTo(0, r * 0.35 + Math.sin(time / 50) * r * 0.05, r * 0.25, r * 0.05);
  ctx.quadraticCurveTo(0, r * 0.15, -r * 0.25, r * 0.05);
  ctx.fill();
  
  // Blood pouring from mouth
  ctx.fillStyle = HORROR_PALETTE.blood;
  ctx.globalAlpha = 0.8 + Math.sin(time / 80) * 0.2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.05, r * 0.2);
  ctx.quadraticCurveTo(0, r * 0.5 + Math.sin(time / 60) * r * 0.1, r * 0.05, r * 0.2);
  ctx.lineTo(r * 0.02, r * 0.6);
  ctx.lineTo(-r * 0.02, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  
  // Horns
  ctx.fillStyle = "#1a0f14";
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.5);
  ctx.lineTo(-r * 0.5, -r * 1.1);
  ctx.lineTo(-r * 0.15, -r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.3, -r * 0.5);
  ctx.lineTo(r * 0.5, -r * 1.1);
  ctx.lineTo(r * 0.15, -r * 0.55);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// ========== BEAST (Stage 3) ==========
function drawBeastBody(ctx, r, hurt, config, time, m) {
  const pulse = 1 + Math.sin(time / 80 + m.x * 0.04) * 0.08;
  const crouch = Math.sin(time / 150) * 0.05;
  
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.translate(0, r * crouch);
  
  // Quadrupedal body - hunched back
  ctx.fillStyle = hurt < 0.5 ? "#1a0f14" : "#2a1520";
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, r * 0.3);
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.3, -r * 0.3, -r * 0.6);
  ctx.quadraticCurveTo(0, -r * 0.8, r * 0.3, -r * 0.6);
  ctx.quadraticCurveTo(r * 0.9, -r * 0.3, r * 0.8, r * 0.3);
  ctx.quadraticCurveTo(r * 0.5, r * 0.6, 0, r * 0.5);
  ctx.quadraticCurveTo(-r * 0.5, r * 0.6, -r * 0.8, r * 0.3);
  ctx.fill();
  
  // Spikes on back
  ctx.fillStyle = "#0d070a";
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * r * 0.25;
    const h = r * (0.3 + Math.sin(time / 100 + i) * 0.1);
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.5);
    ctx.lineTo(x + r * 0.08, -r * 0.5 - h);
    ctx.lineTo(x + r * 0.16, -r * 0.5);
    ctx.fill();
  }
  
  // Four elongated limbs
  ctx.strokeStyle = hurt < 0.5 ? "#1a0f14" : "#2a1a1a";
  ctx.lineWidth = 4;
  const legPositions = [
    { x: -r * 0.5, y: r * 0.3, angle: -0.3 + Math.sin(time / 100) * 0.1 },
    { x: r * 0.5, y: r * 0.3, angle: 0.3 + Math.cos(time / 100) * 0.1 },
    { x: -r * 0.4, y: r * 0.2, angle: -0.5 + Math.cos(time / 120) * 0.1 },
    { x: r * 0.4, y: r * 0.2, angle: 0.5 + Math.sin(time / 120) * 0.1 },
  ];
  
  legPositions.forEach((leg) => {
    ctx.save();
    ctx.translate(leg.x, leg.y);
    ctx.rotate(leg.angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, r * 0.7 + Math.sin(time / 80 + leg.x) * r * 0.1);
    ctx.stroke();
    // Claw
    ctx.fillStyle = "#0d070a";
    ctx.beginPath();
    ctx.arc(0, r * 0.7 + Math.sin(time / 80 + leg.x) * r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  
  // Head - positioned underneath, looking up/forward
  ctx.save();
  ctx.translate(0, r * 0.1);
  ctx.rotate(Math.sin(time / 200) * 0.1);
  
  // Head shape
  ctx.fillStyle = "#c4c4c4";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.4, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Degraded face
  ctx.fillStyle = HORROR_PALETTE.eyeVoid;
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, -r * 0.05, r * 0.1, r * 0.12, -0.1, 0, Math.PI * 2);
  ctx.ellipse(r * 0.15, -r * 0.05, r * 0.1, r * 0.12, 0.1, 0, Math.PI * 2);
  ctx.fill();
  
  // Permanent scream mouth
  ctx.fillStyle = "#1a0a0a";
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, r * 0.1);
  ctx.quadraticCurveTo(0, r * 0.35, r * 0.2, r * 0.1);
  ctx.quadraticCurveTo(0, r * 0.2, -r * 0.2, r * 0.1);
  ctx.fill();
  
  // Teeth
  ctx.fillStyle = "#e8e8e8";
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * r * 0.08;
    ctx.beginPath();
    ctx.moveTo(x, r * 0.15);
    ctx.lineTo(x + r * 0.03, r * 0.22);
    ctx.lineTo(x + r * 0.06, r * 0.15);
    ctx.fill();
  }
  
  // Blood dripping
  ctx.fillStyle = HORROR_PALETTE.blood;
  ctx.globalAlpha = 0.7 + Math.sin(time / 60) * 0.3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.05, r * 0.25);
  ctx.quadraticCurveTo(0, r * 0.45 + Math.sin(time / 50) * r * 0.05, r * 0.05, r * 0.25);
  ctx.lineTo(r * 0.02, r * 0.55);
  ctx.lineTo(-r * 0.02, r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  
  ctx.restore();
  
  // Embedded spikes / torture wounds on back
  ctx.fillStyle = "#3a1f2a";
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * r * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.55);
    ctx.lineTo(x + r * 0.04, -r * 0.8);
    ctx.lineTo(x + r * 0.08, -r * 0.55);
    ctx.fill();
  }
  
  // Blood pool underneath
  ctx.fillStyle = "rgba(107, 26, 26, 0.3)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.85, r * 0.9, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawHorrorHealthBar(ctx, m, hurt) {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(m.x - 18, m.y - m.r - 16, 36, 6);
  ctx.fillStyle = hurt < 0.3 ? "#ff2e2e" : hurt < 0.6 ? "#f0c453" : "#7ae0a6";
  ctx.fillRect(m.x - 18, m.y - m.r - 16, 36 * hurt, 6);
}

// Legacy compatibility - draw all monsters using new system
export function drawAllHorrorMonsters(ctx, monsters, time) {
  monsters.forEach((m) => {
    drawHorrorMonster(ctx, m, time);
  });
}

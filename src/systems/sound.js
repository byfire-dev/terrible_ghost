let audioContext = null;
let enabled = true;

function context() {
  if (!enabled) return null;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone({ frequency, duration = 0.08, type = "sine", gain = 0.06, slide = 0 }) {
  const ctx = context();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const now = ctx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

let introAudioNodes = [];
let introIntervalIds = [];

// 创建持续循环的噪声源（雨声/风声底层）
function makeNoiseSource(ctx, durationSecs, filterFreq, filterType, gainVal) {
  const bufferSize = ctx.sampleRate * durationSecs;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const amp = ctx.createGain();
  amp.gain.value = gainVal;
  src.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  src.start();
  return { src, amp };
}

// 单次低频呻吟（随机触发营造不安感）
function playGroan(ctx) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const now = ctx.currentTime;
  const baseFreq = 28 + Math.random() * 18;
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.linearRampToValueAtTime(baseFreq * 0.6, now + 2.5 + Math.random() * 2);
  filter.type = "lowpass";
  filter.frequency.value = 120;
  amp.gain.setValueAtTime(0, now);
  amp.gain.linearRampToValueAtTime(0.022 + Math.random() * 0.012, now + 0.8);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 4 + Math.random() * 2);
  osc.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 7);
}

// 单次心跳（双拍，沉重感）
function playDeepHeartbeat(ctx) {
  const beatTimes = [0, 0.28]; // 两拍节奏
  beatTimes.forEach((offset) => {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const now = ctx.currentTime + offset;
    osc.type = "sine";
    osc.frequency.setValueAtTime(38, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.22);
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(0.16, now + 0.03);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  });
}

export function startIntroAmbience() {
  const ctx = context();
  if (!ctx) return;

  // 层 1：极低频压抑嗡鸣（像隧道里的电流声）
  const droneOsc = ctx.createOscillator();
  const droneAmp = ctx.createGain();
  const droneFilter = ctx.createBiquadFilter();
  const now = ctx.currentTime;
  droneOsc.type = "sine";
  droneOsc.frequency.setValueAtTime(42, now);
  droneOsc.frequency.linearRampToValueAtTime(38, now + 6);
  droneOsc.frequency.linearRampToValueAtTime(44, now + 14);
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 180;
  droneAmp.gain.setValueAtTime(0, now);
  droneAmp.gain.linearRampToValueAtTime(0.07, now + 3);
  droneOsc.connect(droneFilter);
  droneFilter.connect(droneAmp);
  droneAmp.connect(ctx.destination);
  droneOsc.start(now);
  introAudioNodes.push({ type: "osc", node: droneOsc, amp: droneAmp });

  // 层 2：带低通滤波的持续雨声（压抑、不清晰，像隔着墙听）
  const rain = makeNoiseSource(ctx, 4, 600, "lowpass", 0.055);
  introAudioNodes.push({ type: "src", node: rain.src, amp: rain.amp });

  // 层 3：更低的风噪（极低频，像胸腔的压迫感）
  const wind = makeNoiseSource(ctx, 6, 80, "lowpass", 0.04);
  introAudioNodes.push({ type: "src", node: wind.src, amp: wind.amp });

  // 层 4：不规律的远处低鸣（每 5~11 秒触发一次）
  function scheduleGroan() {
    const delay = 5000 + Math.random() * 6000;
    const id = setTimeout(() => {
      const freshCtx = context();
      if (freshCtx) playGroan(freshCtx);
      scheduleGroan();
    }, delay);
    introIntervalIds.push(id);
  }
  scheduleGroan();
  // 立刻来一次开场低鸣
  setTimeout(() => { const c = context(); if (c) playGroan(c); }, 1200);

  // 层 5：沉重心跳，间隔从快变慢，越来越绝望
  const heartbeatTimes = [2200, 4800, 8000, 11800, 16200, 21000];
  heartbeatTimes.forEach((t) => {
    const id = setTimeout(() => {
      const c = context();
      if (c) playDeepHeartbeat(c);
    }, t);
    introIntervalIds.push(id);
  });
}

export function stopIntroSounds() {
  // 淡出所有持续节点
  const ctx = audioContext;
  introAudioNodes.forEach(({ type, node, amp }) => {
    try {
      if (ctx && amp) {
        amp.gain.cancelScheduledValues(ctx.currentTime);
        amp.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      }
      setTimeout(() => {
        try { node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
      }, 700);
    } catch (e) {}
  });
  introAudioNodes = [];
  introIntervalIds.forEach((id) => clearTimeout(id));
  introIntervalIds = [];
}

export function playSound(name) {
  switch (name) {
    case "shoot":
      tone({ frequency: 220, duration: 0.055, type: "square", gain: 0.035, slide: -90 });
      break;
    case "hit":
      tone({ frequency: 90, duration: 0.11, type: "sawtooth", gain: 0.045, slide: -35 });
      break;
    case "pickup":
      tone({ frequency: 620, duration: 0.08, type: "triangle", gain: 0.035, slide: 120 });
      break;
    case "buy":
      tone({ frequency: 420, duration: 0.07, type: "triangle", gain: 0.03, slide: 260 });
      setTimeout(() => tone({ frequency: 720, duration: 0.07, type: "triangle", gain: 0.025 }), 65);
      break;
    case "open":
      tone({ frequency: 180, duration: 0.1, type: "sawtooth", gain: 0.035, slide: 120 });
      break;
    case "heartbeat": {
      const ctx = context();
      if (!ctx) break;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(40, now);
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(0.12, now + 0.06);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
      break;
    }
    case "rain": {
      const ctx = context();
      if (!ctx) break;
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.015;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.08;
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();
      return source;
    }
    case "lowDrone": {
      const ctx = context();
      if (!ctx) break;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(55, now);
      osc.frequency.linearRampToValueAtTime(48, now + 4);
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(0.06, now + 2);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now);
      return { osc, amp };
    }
    case "fail":
      tone({ frequency: 180, duration: 0.22, type: "sawtooth", gain: 0.05, slide: -120 });
      break;
    case "win":
      tone({ frequency: 520, duration: 0.1, type: "triangle", gain: 0.04, slide: 220 });
      setTimeout(() => tone({ frequency: 760, duration: 0.12, type: "triangle", gain: 0.035 }), 95);
      break;
    default:
      break;
  }
}

// New atmospheric sounds for intro
export function playAtmosphericSound(type, options = {}) {
  const ctx = context();
  if (!ctx) return null;
  
  switch (type) {
    case "deepDrone": {
      // Deep, unsettling drone that pulses irregularly
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const now = ctx.currentTime;
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(30 + Math.random() * 10, now);
      // Irregular frequency modulation
      osc.frequency.linearRampToValueAtTime(25 + Math.random() * 8, now + 3 + Math.random() * 2);
      
      filter.type = "lowpass";
      filter.frequency.value = 200;
      
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.02, now + 1.5);
      
      osc.connect(filter);
      filter.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now);
      
      return { osc, amp, filter };
    }
    
    case "distantGroan": {
      // Distant, low groaning sound
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const now = ctx.currentTime;
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(40, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 2);
      
      filter.type = "lowpass";
      filter.frequency.value = 150;
      
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(0.03, now + 0.5);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
      
      osc.connect(filter);
      filter.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 3);
      break;
    }
    
    case "windGust": {
      // Wind noise through trees
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.008;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 300 + Math.random() * 200;
      filter.Q.value = 0.5;
      
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, ctx.currentTime);
      amp.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.8);
      amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3);
      
      source.connect(filter);
      filter.connect(amp);
      amp.connect(ctx.destination);
      source.start();
      source.stop(ctx.currentTime + 3);
      break;
    }
    
    case "metalCreak": {
      // Metal creaking/stressing sound
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const now = ctx.currentTime;
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.3);
      osc.frequency.linearRampToValueAtTime(180, now + 0.6);
      
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(0.02, now + 0.1);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.5);
      break;
    }
    
    case "subtleThud": {
      // Distant thud/footstep
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const now = ctx.currentTime;
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
      
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(0.04, now + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
      break;
    }
  }
  return null;
}

export function setSoundEnabled(nextEnabled) {
  enabled = Boolean(nextEnabled);
}

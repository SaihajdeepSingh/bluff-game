// Web Audio API sound engine — no external files needed
// All sounds synthesized programmatically

let ctx = null;
let muted = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function resume() {
  const c = getCtx();
  if (c.state === 'suspended') c.resume();
}

export function setMuted(val) { muted = val; }
export function isMuted() { return muted; }

// A short card "snap" sound
export function playCardSound() {
  if (muted) return;
  resume();
  const c = getCtx();
  const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / c.sampleRate;
    // Click + short noise burst
    d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.6
          + Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 120) * 0.3;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.45, c.currentTime);
  src.connect(gain); gain.connect(c.destination);
  src.start();
}

// Deal sound — multiple card snaps staggered
export function playDealSound(count = 5) {
  if (muted) return;
  const delays = Math.min(count, 8);
  for (let i = 0; i < delays; i++) {
    setTimeout(() => playCardSound(), i * 90);
  }
}

// Pile card sound — heavier thud
export function playPileSound() {
  if (muted) return;
  resume();
  const c = getCtx();
  const buf = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / c.sampleRate;
    d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.5
          + Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 60) * 0.4
          + Math.sin(2 * Math.PI * 400 * t) * Math.exp(-t * 80) * 0.2;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.5, c.currentTime);
  src.connect(gain); gain.connect(c.destination);
  src.start();
}

// Bluff caught — dramatic low thud + descending tone
export function playBluffCaughtSound() {
  if (muted) return;
  resume();
  const c = getCtx();
  const now = c.currentTime;

  const osc1 = c.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(320, now);
  osc1.frequency.exponentialRampToValueAtTime(80, now + 0.35);

  const osc2 = c.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(160, now);
  osc2.frequency.exponentialRampToValueAtTime(50, now + 0.4);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc1.connect(gain); osc2.connect(gain); gain.connect(c.destination);
  osc1.start(now); osc2.start(now);
  osc1.stop(now + 0.5); osc2.stop(now + 0.5);
}

// Safe (no bluff) — bright ascending chime
export function playSafeSound() {
  if (muted) return;
  resume();
  const c = getCtx();
  const now = c.currentTime;
  const freqs = [523, 659, 784]; // C5 E5 G5

  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.22, now + i * 0.1 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.4);
  });
}

// Win fanfare — triumphant ascending arpeggio
export function playWinSound() {
  if (muted) return;
  resume();
  const c = getCtx();
  const now = c.currentTime;
  const freqs = [261, 329, 392, 523, 659];

  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.6);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.6);
  });
}

// Click/button sound
export function playClickSound() {
  if (muted) return;
  resume();
  const c = getCtx();
  const buf = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / c.sampleRate;
    d[i] = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 200) * 0.25;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
}

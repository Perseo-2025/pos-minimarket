// Beep + vibration after each scan, so whoever scans knows it counted
// without looking at the screen. iOS has no vibration for web pages: there
// the beep and the on-screen flash are the only signal.

let audio: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  audio ??= new AudioContext();
  // Browsers start audio suspended until the first tap on the page.
  if (audio.state === "suspended") void audio.resume().catch(() => {});
  return audio;
}

function tone(frequency: number, ms: number, startAfterMs = 0) {
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + startAfterMs / 1000;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.08, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + ms / 1000);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function scanSucceeded() {
  tone(1800, 90);
  vibrate(40);
}

// Two low tones: unknown code, or something that can't be added here.
export function scanFailed() {
  tone(400, 140);
  tone(400, 140, 200);
  vibrate([80, 60, 80]);
}

// Call from the first tap on a scanning screen: unlocks audio on iOS.
export function primeScanFeedback() {
  context();
}

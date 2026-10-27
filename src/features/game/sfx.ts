/**
 * Tiny synthesized sound effects (Web Audio — no audio files). Created on the
 * first pickup, which always follows a user gesture, so autoplay rules allow it.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(a: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, gain: number) {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(a.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Pickup chime: 1 note, a 2-note "bling" for 2x, a sparkling arpeggio for 5x. */
export function playPickup(value: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  if (value >= 5) {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => note(a, f, t + i * 0.07, 0.35, "triangle", 0.18));
    note(a, 2093, t + 0.38, 0.6, "sine", 0.08);
  } else if (value >= 2) {
    note(a, 880, t, 0.18, "triangle", 0.16);
    note(a, 1318.5, t + 0.09, 0.3, "triangle", 0.16);
  } else {
    note(a, 1046.5, t, 0.2, "sine", 0.15);
  }
}

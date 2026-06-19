// Client-only audible alert using the Web Audio API (no asset needed).
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Play an urgent two-tone alarm. Returns true if it played. */
export function playAlertSound() {
  const audio = getCtx();
  if (!audio) return false;
  if (audio.state === "suspended") void audio.resume();

  const now = audio.currentTime;
  const pattern = [880, 660, 880, 660];
  pattern.forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const start = now + i * 0.28;
    const end = start + 0.22;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  });
  return true;
}

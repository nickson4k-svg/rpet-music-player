export const seekAudio = (time: number) => {
  const a = document.getElementById('audio-deck-a') as HTMLAudioElement;
  const b = document.getElementById('audio-deck-b') as HTMLAudioElement;
  if (a && !a.paused && a.src) a.currentTime = time;
  else if (b && !b.paused && b.src) b.currentTime = time;
  else if (a && a.src) a.currentTime = time; // fallback
};

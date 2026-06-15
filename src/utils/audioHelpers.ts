export const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00';
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const seekAudio = (time: number) => {
  const a = document.getElementById('audio-deck-a') as HTMLAudioElement;
  const b = document.getElementById('audio-deck-b') as HTMLAudioElement;
  if (a && !a.paused && a.src) a.currentTime = time;
  else if (b && !b.paused && b.src) b.currentTime = time;
  else if (a && a.src) a.currentTime = time; // fallback
};

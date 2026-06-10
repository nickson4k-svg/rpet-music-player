export const audioContextState = {
  context: null as AudioContext | null,
  analyser: null as AnalyserNode | null,
  source: null as MediaElementAudioSourceNode | null,
  bassNode: null as BiquadFilterNode | null,
  midNode: null as BiquadFilterNode | null,
  trebleNode: null as BiquadFilterNode | null,
};

export const initAudioContext = (audioElement: HTMLAudioElement) => {
  if (!audioContextState.context) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    
    // Equalizer Nodes
    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 250;
    bass.gain.value = 0;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 1;
    mid.gain.value = 0;

    const treble = ctx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 4000;
    treble.gain.value = 0;

    const source = ctx.createMediaElementSource(audioElement);
    
    // Connect nodes in sequence
    source.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(analyser);
    analyser.connect(ctx.destination);

    audioContextState.context = ctx;
    audioContextState.analyser = analyser;
    audioContextState.source = source;
    audioContextState.bassNode = bass;
    audioContextState.midNode = mid;
    audioContextState.trebleNode = treble;
  }
  return audioContextState;
};

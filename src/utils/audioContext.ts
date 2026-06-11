export const audioContextState = {
  context: null as AudioContext | null,
  analyser: null as AnalyserNode | null,
  source: null as MediaElementAudioSourceNode | null,
  bassNode: null as BiquadFilterNode | null,
  midNode: null as BiquadFilterNode | null,
  trebleNode: null as BiquadFilterNode | null,
  reverbGainNode: null as GainNode | null,
  dryGainNode: null as GainNode | null,
};

function createReverbBuffer(ctx: AudioContext, duration: number, decay: number) {
  const length = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

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
    
    // Spatial Audio (Reverb)
    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbBuffer(ctx, 2.5, 3.0);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;

    // Connect nodes in sequence
    source.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    
    // Split to dry and wet (reverb) signals
    treble.connect(dryGain);
    treble.connect(reverb);
    reverb.connect(reverbGain);

    dryGain.connect(analyser);
    reverbGain.connect(analyser);
    
    analyser.connect(ctx.destination);

    audioContextState.context = ctx;
    audioContextState.analyser = analyser;
    audioContextState.source = source;
    audioContextState.bassNode = bass;
    audioContextState.midNode = mid;
    audioContextState.trebleNode = treble;
    audioContextState.reverbGainNode = reverbGain;
    audioContextState.dryGainNode = dryGain;
  }
  return audioContextState;
};

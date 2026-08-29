export const audioContextState = {
  context: null as AudioContext | null,
  analyser: null as AnalyserNode | null,
  sourceA: null as MediaElementAudioSourceNode | null,
  sourceB: null as MediaElementAudioSourceNode | null,
  gainA: null as GainNode | null,
  gainB: null as GainNode | null,
  compressor: null as DynamicsCompressorNode | null,
  bassNode: null as BiquadFilterNode | null,
  midNode: null as BiquadFilterNode | null,
  trebleNode: null as BiquadFilterNode | null,
  reverbGainNode: null as GainNode | null,
  dryGainNode: null as GainNode | null,
  localMasterGain: null as GainNode | null,
  mediaStreamDestination: null as MediaStreamAudioDestinationNode | null,
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

export const initAudioContext = (audioA: HTMLAudioElement, audioB: HTMLAudioElement) => {
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

    // Decks setup
    const sourceA = ctx.createMediaElementSource(audioA);
    const sourceB = ctx.createMediaElementSource(audioB);
    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    
    gainA.gain.value = 1;
    gainB.gain.value = 1;

    sourceA.connect(gainA);
    sourceB.connect(gainB);

    // Spatial Audio (Reverb)
    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbBuffer(ctx, 2.5, 3.0);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;

    // Automatic Gain Control (ReplayGain proxy)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    // By default compressor acts as passthrough until normalization is enabled, 
    // but actually we can just leave it connected and toggle it dynamically later.
    // For now, let's connect it in the chain but we'll bypass it if normalization is off.
    
    // Connect nodes in sequence
    gainA.connect(bass);
    gainB.connect(bass);
    
    bass.connect(mid);
    mid.connect(treble);
    
    // Split to dry and wet (reverb) signals
    treble.connect(dryGain);
    treble.connect(reverb);
    reverb.connect(reverbGain);

    dryGain.connect(compressor);
    reverbGain.connect(compressor);
    
    // Stream Destination (always full 100% volume for LiveKit guests)
    const streamDest = ctx.createMediaStreamDestination();
    compressor.connect(analyser);
    analyser.connect(streamDest);

    // Local Master Gain Node (only controls the host's speakers)
    const localMasterGain = ctx.createGain();
    localMasterGain.gain.value = 1.0;
    analyser.connect(localMasterGain);
    localMasterGain.connect(ctx.destination);

    audioContextState.context = ctx;
    audioContextState.analyser = analyser;
    audioContextState.sourceA = sourceA;
    audioContextState.sourceB = sourceB;
    audioContextState.gainA = gainA;
    audioContextState.gainB = gainB;
    audioContextState.compressor = compressor;
    audioContextState.bassNode = bass;
    audioContextState.midNode = mid;
    audioContextState.trebleNode = treble;
    audioContextState.reverbGainNode = reverbGain;
    audioContextState.dryGainNode = dryGain;
    audioContextState.localMasterGain = localMasterGain;
    audioContextState.mediaStreamDestination = streamDest;
  }
  return audioContextState;
};

export const updateNormalization = (enabled: boolean) => {
  if (audioContextState.compressor) {
    if (enabled) {
      audioContextState.compressor.threshold.value = -30;
      audioContextState.compressor.ratio.value = 12;
    } else {
      audioContextState.compressor.threshold.value = 0;
      audioContextState.compressor.ratio.value = 1;
    }
  }
};

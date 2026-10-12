// Web Audio API Synthesis Engine for Somno Studio - Optimized for Warm, Natural Sound

export interface ChannelConfig {
  id: string;
  name: string;
  type: 'noise' | 'oscillator' | 'binaural';
  noiseType?: 'white' | 'pink' | 'brown' | 'vinyl' | 'fire';
  freq?: number;
  oscType?: OscillatorType;
  filterFreq?: number;
  filterType?: BiquadFilterType;
  filterQ?: number;
}

export const CHANNELS_CONFIG: ChannelConfig[] = [
  { id: 'rain', name: 'Heavy Rain', type: 'noise', noiseType: 'pink', filterFreq: 1000, filterType: 'lowpass', filterQ: 1 },
  { id: 'sleep', name: 'Deep Sleep', type: 'oscillator', freq: 55, oscType: 'sine' },
  { id: 'ocean', name: 'Ocean Waves', type: 'noise', noiseType: 'pink', filterFreq: 300, filterType: 'lowpass', filterQ: 2 },
  { id: 'fire', name: 'Cabin Fire', type: 'noise', noiseType: 'fire', filterFreq: 1200, filterType: 'bandpass', filterQ: 1 },
  { id: 'cosmic', name: 'Cosmic Drone', type: 'oscillator', freq: 110, oscType: 'triangle' },
  { id: 'forest', name: 'Forest Night', type: 'noise', noiseType: 'pink', filterFreq: 2200, filterType: 'bandpass', filterQ: 1.5 },
  { id: 'wind', name: 'Soft Wind', type: 'noise', noiseType: 'brown', filterFreq: 200, filterType: 'lowpass', filterQ: 1 },
  { id: 'bowl', name: 'Tibetan Bowl', type: 'oscillator', freq: 216, oscType: 'sine' },
  { id: 'vinyl', name: 'Vinyl Crackle', type: 'noise', noiseType: 'vinyl', filterFreq: 2000, filterType: 'bandpass', filterQ: 1 },
  { id: 'stream', name: 'River Stream', type: 'noise', noiseType: 'pink', filterFreq: 900, filterType: 'bandpass', filterQ: 1.5 },
  { id: 'theta', name: 'Theta Waves', type: 'binaural', freq: 200 },
];

export class SomnoAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private channelNodes: Map<string, {
    gain: GainNode;
    panner: StereoPannerNode | null;
    sourceNodes: (AudioNode | number)[];
  }> = new Map();
  private isInitialized = false;

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  public setMasterVolume(vol: number) {
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  public setChannelVolume(id: string, vol: number) {
    const node = this.channelNodes.get(id);
    if (!node || !this.ctx) return;
    node.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  public setChannelMute(id: string, muted: boolean) {
    const node = this.channelNodes.get(id);
    if (!node || !this.ctx) return;
    node.gain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  public startChannel(config: ChannelConfig, initialVol: number, initialPan: number) {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    if (this.channelNodes.has(config.id)) {
      this.stopChannel(config.id);
    }

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = initialVol;

    let panner: StereoPannerNode | null = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.value = initialPan;
      gainNode.connect(panner);
      panner.connect(this.masterGain);
    } else {
      gainNode.connect(this.masterGain);
    }

    const sourceNodes: AudioNode[] = [];

    if (config.type === 'noise' || config.noiseType) {
      const bufferSize = this.ctx.sampleRate * 5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (config.noiseType === 'pink') {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          data[i] *= 0.04; // Gentle multiplier for warm, smooth sound
          b6 = white * 0.115926;
        } else if (config.noiseType === 'brown') {
          b0 = (b0 + (0.02 * white)) / 1.02;
          data[i] = b0 * 2.0;
        } else if (config.noiseType === 'fire') {
          const noise = Math.random() * 2 - 1;
          data[i] = Math.random() > 0.997 ? noise * 1.5 : noise * 0.05;
        } else if (config.noiseType === 'vinyl') {
          const pop = Math.random() > 0.999 ? (Math.random() * 2 - 1) * 3 : (Math.random() * 2 - 1) * 0.02;
          data[i] = pop;
        } else {
          data[i] = white * 0.04;
        }
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = config.filterType || 'lowpass';
      filter.frequency.value = config.filterFreq || 1000;
      if (config.filterQ) {
        filter.Q.value = config.filterQ;
      }

      noiseSource.connect(filter);
      filter.connect(gainNode);
      sourceNodes.push(noiseSource, filter);

      noiseSource.start();
    } else if (config.type === 'oscillator') {
      const osc = this.ctx.createOscillator();
      osc.type = config.oscType || 'sine';
      osc.frequency.value = config.freq || 100;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      osc.connect(filter);
      filter.connect(gainNode);
      osc.start();
      sourceNodes.push(osc, filter);
    } else if (config.type === 'binaural') {
      const merger = this.ctx.createChannelMerger(2);
      const oscL = this.ctx.createOscillator();
      const oscR = this.ctx.createOscillator();
      
      oscL.frequency.value = config.freq || 200;
      oscR.frequency.value = (config.freq || 200) + 6;

      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();
      gainL.gain.value = 0.4;
      gainR.gain.value = 0.4;

      oscL.connect(gainL);
      oscR.connect(gainR);

      gainL.connect(merger, 0, 0);
      gainR.connect(merger, 0, 1);

      merger.connect(gainNode);
      oscL.start();
      oscR.start();
      sourceNodes.push(oscL, oscR, merger, gainL, gainR);
    }

    this.channelNodes.set(config.id, { gain: gainNode, panner, sourceNodes });
  }

  public stopChannel(id: string) {
    const node = this.channelNodes.get(id);
    if (!node) return;

    node.sourceNodes.forEach((sn) => {
      if (typeof sn !== 'number' && 'stop' in sn && typeof (sn as AudioScheduledSourceNode).stop === 'function') {
        try {
          (sn as AudioScheduledSourceNode).stop();
        } catch {}
      }
    });

    node.gain.disconnect();
    this.channelNodes.delete(id);
  }

  public getMeterLevel(id: string): number {
    const node = this.channelNodes.get(id);
    if (!node || !this.ctx) return 0;
    return node.gain.gain.value > 0 ? Math.min(100, Math.floor(node.gain.gain.value * 85 + Math.random() * 15)) : 0;
  }
}

export const audioEngine = new SomnoAudioEngine();

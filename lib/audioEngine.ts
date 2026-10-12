// Web Audio API Synthesis Engine for Somno Studio

export interface ChannelConfig {
  id: string;
  name: string;
  type: 'noise' | 'oscillator' | 'binaural';
  noiseType?: 'white' | 'pink' | 'brown' | 'vinyl' | 'fire';
  freq?: number;
  oscType?: OscillatorType;
  filterFreq?: number;
  filterType?: BiquadFilterType;
  modFreq?: number;
}

export const CHANNELS_CONFIG: ChannelConfig[] = [
  { id: 'rain', name: 'Heavy Rain', type: 'noise', noiseType: 'pink', filterFreq: 1000, filterType: 'bandpass' },
  { id: 'sleep', name: 'Deep Sleep', type: 'oscillator', freq: 55, oscType: 'sine' },
  { id: 'ocean', name: 'Ocean Waves', type: 'noise', noiseType: 'pink', filterFreq: 400, filterType: 'lowpass' },
  { id: 'fire', name: 'Cabin Fire', type: 'noise', noiseType: 'fire', filterFreq: 1500, filterType: 'bandpass' },
  { id: 'cosmic', name: 'Cosmic Drone', type: 'oscillator', freq: 110, oscType: 'triangle' },
  { id: 'forest', name: 'Forest Night', type: 'noise', noiseType: 'white', filterFreq: 4000, filterType: 'highpass' },
  { id: 'wind', name: 'Soft Wind', type: 'noise', noiseType: 'brown', filterFreq: 300, filterType: 'lowpass' },
  { id: 'bowl', name: 'Tibetan Bowl', type: 'oscillator', freq: 216, oscType: 'sine' },
  { id: 'vinyl', name: 'Vinyl Crackle', type: 'noise', noiseType: 'vinyl', filterFreq: 3000, filterType: 'bandpass' },
  { id: 'stream', name: 'River Stream', type: 'noise', noiseType: 'pink', filterFreq: 1800, filterType: 'lowpass' },
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

  public setChannelPan(id: string, pan: number) {
    const node = this.channelNodes.get(id);
    if (!node || !node.panner) return;
    node.panner.pan.setTargetAtTime(pan, this.ctx?.currentTime || 0, 0.05);
  }

  public setChannelMute(id: string, muted: boolean) {
    const node = this.channelNodes.get(id);
    if (!node || !this.ctx) return;
    node.gain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  public startChannel(config: ChannelConfig, initialVol: number, initialPan: number) {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx) return;

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
      // Generate 5s noise buffer
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
          data[i] *= 0.11;
          b6 = white * 0.115926;
        } else if (config.noiseType === 'brown') {
          b0 = (b0 + (0.02 * white)) / 1.02;
          data[i] = b0 * 3.5;
        } else if (config.noiseType === 'fire') {
          // Crackle bursts
          const noise = Math.random() * 2 - 1;
          data[i] = Math.random() > 0.995 ? noise * 2 : noise * 0.1;
        } else if (config.noiseType === 'vinyl') {
          const pop = Math.random() > 0.998 ? (Math.random() * 2 - 1) * 5 : (Math.random() * 2 - 1) * 0.05;
          data[i] = pop;
        } else {
          data[i] = white * 0.2;
        }
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      if (config.filterFreq && config.filterType) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = config.filterType;
        filter.frequency.value = config.filterFreq;
        noiseSource.connect(filter);
        filter.connect(gainNode);
        sourceNodes.push(noiseSource, filter);
      } else {
        noiseSource.connect(gainNode);
        sourceNodes.push(noiseSource);
      }

      noiseSource.start();
    } else if (config.type === 'oscillator') {
      const osc = this.ctx.createOscillator();
      osc.type = config.oscType || 'sine';
      osc.frequency.value = config.freq || 100;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;

      osc.connect(filter);
      filter.connect(gainNode);
      osc.start();
      sourceNodes.push(osc, filter);
    } else if (config.type === 'binaural') {
      // Create dual oscillators for binaural beat (e.g. 200Hz left, 206Hz right)
      const merger = this.ctx.createChannelMerger(2);
      const oscL = this.ctx.createOscillator();
      const oscR = this.ctx.createOscillator();
      
      oscL.frequency.value = config.freq || 200;
      oscR.frequency.value = (config.freq || 200) + 6; // 6Hz Theta difference

      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();
      gainL.gain.value = 0.5;
      gainR.gain.value = 0.5;

      oscL.connect(gainL);
      oscR.connect(gainR);

      gainL.connect(merger, 0, 0);
      gainR.connect(merger, 0, 1);

      merger.connect(gainNode);
      oscL.start();
      oscR.start();
      sourceNodes.push(oscL, oscR, merger, gainL, gainR);
    }

    this.channelNodes.set(id, { gain: gainNode, panner, sourceNodes });
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
    // Return mock dynamic meter based on gain
    return node.gain.gain.value > 0 ? Math.min(100, Math.floor(node.gain.gain.value * 85 + Math.random() * 15)) : 0;
  }
}

export const audioEngine = new SomnoAudioEngine();

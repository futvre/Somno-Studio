// Web Audio Buffer Engine for Somno Studio - MP3 Support & Seamless Looping

export interface ChannelConfig {
  id: string;
  name: string;
  audioUrl: string;
}

export const CHANNELS_CONFIG: ChannelConfig[] = [
  { id: 'rain', name: 'Heavy Rain', audioUrl: '/audio/rain.mp3' },
  { id: 'thunder', name: 'Thunderstorm', audioUrl: '/audio/thunder.mp3' },
  { id: 'birds', name: 'Forest Birds', audioUrl: '/audio/birds.mp3' },
];

export class SomnoAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, { source: AudioBufferSourceNode; gain: GainNode }> = new Map();
  private masterVol: number = 0.8;

  public init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVol;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.preloadBuffers();
  }

  private async preloadBuffers() {
    if (!this.ctx) return;
    for (const config of CHANNELS_CONFIG) {
      if (!this.buffers.has(config.id)) {
        try {
          const response = await fetch(config.audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(config.id, audioBuffer);
        } catch (e) {
          console.error(`Error loading buffer for ${config.id}:`, e);
        }
      }
    }
  }

  public setMasterVolume(vol: number) {
    this.masterVol = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }
  }

  public setChannelVolume(id: string, vol: number) {
    const active = this.activeSources.get(id);
    if (!active || !this.ctx) return;
    active.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  public setChannelMute(id: string, muted: boolean, currentVol: number) {
    const active = this.activeSources.get(id);
    if (!active || !this.ctx) return;
    active.gain.gain.setTargetAtTime(muted ? 0 : currentVol, this.ctx.currentTime, 0.05);
  }

  public async startChannel(config: ChannelConfig, initialVol: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    this.stopChannel(config.id);

    let buffer = this.buffers.get(config.id);
    if (!buffer) {
      try {
        const response = await fetch(config.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(config.id, buffer);
      } catch (e) {
        return;
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = initialVol;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start(0);
    this.activeSources.set(config.id, { source, gain: gainNode });
  }

  public stopChannel(id: string) {
    const active = this.activeSources.get(id);
    if (active) {
      try {
        active.source.stop();
        active.source.disconnect();
        active.gain.disconnect();
      } catch {}
      this.activeSources.delete(id);
    }
  }

  public stopAll() {
    this.activeSources.forEach((_, id) => {
      this.stopChannel(id);
    });
  }

  public getMeterLevel(id: string, volume: number): number {
    const active = this.activeSources.get(id);
    if (!active || volume === 0) return 0;
    return Math.min(100, Math.floor(volume * 80 + Math.random() * 20));
  }
}

export const audioEngine = new SomnoAudioEngine();

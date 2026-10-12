// Local Audio Engine for Somno Studio using local WAV files in /public/audio/

export interface ChannelConfig {
  id: string;
  name: string;
  audioUrl: string;
}

export const CHANNELS_CONFIG: ChannelConfig[] = [
  { id: 'rain', name: 'Heavy Rain', audioUrl: '/audio/rain.wav' },
  { id: 'sleep', name: 'Deep Sleep', audioUrl: '/audio/sleep.wav' },
  { id: 'ocean', name: 'Ocean Waves', audioUrl: '/audio/ocean.wav' },
  { id: 'fire', name: 'Cabin Fire', audioUrl: '/audio/fire.wav' },
  { id: 'cosmic', name: 'Cosmic Drone', audioUrl: '/audio/cosmic.wav' },
  { id: 'forest', name: 'Forest Night', audioUrl: '/audio/forest.wav' },
  { id: 'wind', name: 'Soft Wind', audioUrl: '/audio/wind.wav' },
  { id: 'bowl', name: 'Tibetan Bowl', audioUrl: '/audio/bowl.wav' },
  { id: 'vinyl', name: 'Vinyl Crackle', audioUrl: '/audio/vinyl.wav' },
  { id: 'stream', name: 'River Stream', audioUrl: '/audio/stream.wav' },
  { id: 'theta', name: 'Theta Waves', audioUrl: '/audio/theta.wav' },
];

export class SomnoAudioEngine {
  private audioElements: Map<string, HTMLAudioElement> = new Map();

  public init() {
    CHANNELS_CONFIG.forEach(config => {
      if (!this.audioElements.has(config.id)) {
        const audio = new Audio(config.audioUrl);
        audio.loop = true;
        audio.volume = 0;
        audio.preload = 'auto';
        this.audioElements.set(config.id, audio);
      }
    });
  }

  public setChannelVolume(id: string, vol: number, master: number) {
    this.init();
    const audio = this.audioElements.get(id);
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, vol * master));
    if (vol > 0 && audio.paused) {
      audio.play().catch(() => {});
    } else if (vol === 0 && !audio.paused) {
      audio.pause();
    }
  }

  public setChannelMute(id: string, muted: boolean, currentVol: number, master: number) {
    const audio = this.audioElements.get(id);
    if (!audio) return;
    audio.volume = muted ? 0 : currentVol * master;
  }

  public startChannel(config: ChannelConfig, initialVol: number, master: number) {
    this.init();
    const audio = this.audioElements.get(config.id);
    if (!audio) return;
    audio.volume = initialVol * master;
    audio.play().catch(() => {});
  }

  public stopChannel(id: string) {
    const audio = this.audioElements.get(id);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  public stopAll() {
    this.audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  public getMeterLevel(id: string, volume: number): number {
    const audio = this.audioElements.get(id);
    if (!audio || audio.paused || volume === 0) return 0;
    return Math.min(100, Math.floor(volume * 80 + Math.random() * 20));
  }
}

export const audioEngine = new SomnoAudioEngine();

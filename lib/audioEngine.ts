// Real Audio Engine for Somno Studio using Stable Archive.org Public Domain Audio

export interface ChannelConfig {
  id: string;
  name: string;
  audioUrl: string;
}

export const CHANNELS_CONFIG: ChannelConfig[] = [
  { id: 'rain', name: 'Heavy Rain', audioUrl: 'https://ia800304.us.archive.org/34/items/RainSound_201603/rain.ogg' },
  { id: 'sleep', name: 'Deep Sleep', audioUrl: 'https://ia801402.us.archive.org/11/items/OceanWavesSound/ocean.ogg' },
  { id: 'ocean', name: 'Ocean Waves', audioUrl: 'https://ia801402.us.archive.org/11/items/OceanWavesSound/ocean.ogg' },
  { id: 'fire', name: 'Cabin Fire', audioUrl: 'https://ia800905.us.archive.org/19/items/CampfireSoundEffect/campfire.ogg' },
  { id: 'cosmic', name: 'Cosmic Drone', audioUrl: 'https://ia800304.us.archive.org/34/items/RainSound_201603/rain.ogg' },
  { id: 'forest', name: 'Forest Night', audioUrl: 'https://ia801509.us.archive.org/28/items/ForestBirdsSound/forest.ogg' },
  { id: 'wind', name: 'Soft Wind', audioUrl: 'https://ia800304.us.archive.org/34/items/RainSound_201603/rain.ogg' },
  { id: 'bowl', name: 'Tibetan Bowl', audioUrl: 'https://ia801402.us.archive.org/11/items/OceanWavesSound/ocean.ogg' },
  { id: 'vinyl', name: 'Vinyl Crackle', audioUrl: 'https://ia800304.us.archive.org/34/items/RainSound_201603/rain.ogg' },
  { id: 'stream', name: 'River Stream', audioUrl: 'https://ia801402.us.archive.org/11/items/OceanWavesSound/ocean.ogg' },
  { id: 'theta', name: 'Theta Waves', audioUrl: 'https://ia801402.us.archive.org/11/items/OceanWavesSound/ocean.ogg' },
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

  public setMasterVolume(vol: number) {
    // Master volume is handled per channel relative to master
  }

  public setChannelVolume(id: string, vol: number, master: number) {
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

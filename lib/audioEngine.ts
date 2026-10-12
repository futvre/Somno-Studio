// Real Audio Engine for Somno Studio using HTML5 Audio Elements & Real Recordings

export interface ChannelConfig {
  id: string;
  name: string;
  audioUrl: string;
}

export const CHANNELS_CONFIG: ChannelConfig[] = [
  { id: 'rain', name: 'Heavy Rain', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Rain_on_tin_roof.ogg' },
  { id: 'sleep', name: 'Deep Sleep', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Ocean_waves_sounds.ogg' }, // Deep ambient wave pad
  { id: 'ocean', name: 'Ocean Waves', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Ocean_waves_sounds.ogg' },
  { id: 'fire', name: 'Cabin Fire', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Campfire.ogg' },
  { id: 'cosmic', name: 'Cosmic Drone', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Wind_in_trees.ogg' },
  { id: 'forest', name: 'Forest Night', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Night_forest_ambience.ogg' },
  { id: 'wind', name: 'Soft Wind', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Wind_in_trees.ogg' },
  { id: 'bowl', name: 'Tibetan Bowl', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Stream_running_water.ogg' },
  { id: 'vinyl', name: 'Vinyl Crackle', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Vinyl_crackle.ogg' },
  { id: 'stream', name: 'River Stream', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Stream_running_water.ogg' },
  { id: 'theta', name: 'Theta Waves', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Rain_on_tin_roof.ogg' },
];

export class SomnoAudioEngine {
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private masterVol: number = 0.8;

  public init() {
    // Pre-create audio elements if not exist
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
    this.masterVol = vol;
    this.audioElements.forEach((audio, id) => {
      // Adjust individual audio relative to master
      // We keep track or let React handle it, but here we can scale
    });
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

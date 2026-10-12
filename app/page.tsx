'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Moon, Sliders, Shield, Sparkles, Clock, Music, X } from 'lucide-react';
import { CHANNELS_CONFIG, audioEngine } from '@/lib/audioEngine';

interface ChannelState {
  volume: number;
  pan: number;
  muted: number; // 0 or 1
  active: boolean;
}

export default function SomnoStudio() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [masterVol, setMasterVol] = useState<number>(0.8);
  const [channels, setChannels] = useState<Record<string, ChannelState>>(() => {
    const initial: Record<string, ChannelState> = {};
    CHANNELS_CONFIG.forEach(ch => {
      initial[ch.id] = { volume: 0, pan: 0, muted: 0, active: false };
    });
    return initial;
  });

  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [meters, setMeters] = useState<Record<string, number>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('somno_studio_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.channels) setChannels(parsed.channels);
        if (typeof parsed.masterVol === 'number') setMasterVol(parsed.masterVol);
      } catch {}
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('somno_studio_state', JSON.stringify({ channels, masterVol }));
  }, [channels, masterVol]);

  // VU Meters animation loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const newMeters: Record<string, number> = {};
      CHANNELS_CONFIG.forEach(ch => {
        if (channels[ch.id]?.active && channels[ch.id]?.volume > 0) {
          newMeters[ch.id] = audioEngine.getMeterLevel(ch.id);
        } else {
          newMeters[ch.id] = 0;
        }
      });
      setMeters(newMeters);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, channels]);

  // Sleep Timer countdown
  useEffect(() => {
    if (sleepTimer === null) {
      setTimerRemaining(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setTimerRemaining(sleepTimer * 60);
    timerRef.current = setInterval(() => {
      setTimerRemaining(prev => {
        if (prev === null || prev <= 1) {
          setIsPlaying(false);
          audioEngine.setMasterVolume(0);
          setSleepTimer(null);
          if (timerRef.current) clearInterval(timerRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sleepTimer]);

  const toggleMasterPlay = () => {
    audioEngine.init();
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    if (nextState) {
      audioEngine.setMasterVolume(masterVol);
      CHANNELS_CONFIG.forEach(ch => {
        const state = channels[ch.id];
        if (state.active) {
          audioEngine.startChannel(ch, state.volume, state.pan);
        }
      });
    } else {
      CHANNELS_CONFIG.forEach(ch => {
        audioEngine.stopChannel(ch.id);
      });
    }
  };

  const handleMasterVolChange = (val: number) => {
    setMasterVol(val);
    audioEngine.setMasterVolume(val);
  };

  const handleChannelVolChange = (id: string, val: number) => {
    setChannels(prev => ({
      ...prev,
      [id]: { ...prev[id], volume: val, active: val > 0 ? true : prev[id].active }
    }));
    if (isPlaying) {
      const config = CHANNELS_CONFIG.find(c => c.id === id);
      if (config) {
        if (!channels[id].active && val > 0) {
          audioEngine.startChannel(config, val, channels[id].pan);
        } else {
          audioEngine.setChannelVolume(id, val);
        }
      }
    }
  };

  const handleChannelPanChange = (id: string, pan: number) => {
    setChannels(prev => ({
      ...prev,
      [id]: { ...prev[id], pan }
    }));
    audioEngine.setChannelPan(id, pan);
  };

  const toggleChannelActive = (id: string) => {
    const current = channels[id];
    const newActive = !current.active;
    const newVol = newActive && current.volume === 0 ? 0.6 : current.volume;

    setChannels(prev => ({
      ...prev,
      [id]: { ...prev[id], active: newActive, volume: newVol }
    }));

    if (isPlaying) {
      const config = CHANNELS_CONFIG.find(c => c.id === id);
      if (config) {
        if (newActive) {
          audioEngine.startChannel(config, newVol, current.pan);
        } else {
          audioEngine.stopChannel(id);
        }
      }
    }
  };

  const toggleMute = (id: string) => {
    const current = channels[id];
    const newMuted = current.muted === 1 ? 0 : 1;
    setChannels(prev => ({
      ...prev,
      [id]: { ...prev[id], muted: newMuted }
    }));
    audioEngine.setChannelMute(id, newMuted === 1);
  };

  const applyPreset = (presetName: string) => {
    audioEngine.init();
    setActivePreset(presetName);
    setIsPlaying(true);

    const newChannels = { ...channels };
    CHANNELS_CONFIG.forEach(ch => {
      newChannels[ch.id] = { ...newChannels[ch.id], active: false, volume: 0 };
    });

    let targetIds: string[] = [];
    if (presetName === 'Heavy Rain') targetIds = ['rain', 'wind', 'stream'];
    else if (presetName === 'Deep Sleep') targetIds = ['sleep', 'ocean', 'theta'];
    else if (presetName === 'Cabin Fire') targetIds = ['fire', 'rain', 'vinyl'];
    else if (presetName === 'Reset') targetIds = ['bowl', 'ocean'];

    targetIds.forEach(id => {
      newChannels[id] = { active: true, volume: 0.7, pan: 0, muted: 0 };
      const config = CHANNELS_CONFIG.find(c => c.id === id);
      if (config) {
        audioEngine.startChannel(config, 0.7, 0);
      }
    });

    CHANNELS_CONFIG.forEach(ch => {
      if (!targetIds.includes(ch.id)) {
        audioEngine.stopChannel(ch.id);
      }
    });

    setChannels(newChannels);
    audioEngine.setMasterVolume(masterVol);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <main className="h-screen w-screen flex flex-col bg-[#08090d] text-gray-200 select-none overflow-hidden">
      {/* Header / Master Suite */}
      <header className="h-16 px-4 md:px-6 border-b border-[#1f2430] bg-[#0c0e15] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Somno Studio <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">v1.0</span>
            </h1>
            <p className="text-[11px] md:text-xs text-gray-400 hidden sm:block">Ambient Audio Mixing Console</p>
          </div>
        </div>

        {/* Master Play / Presets / Sleep Timer */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Quick Presets */}
          <div className="hidden xl:flex items-center gap-1.5 bg-[#12141c] p-1 rounded-xl border border-[#1f2430]">
            <span className="text-xs text-gray-400 px-2 font-medium">Presets:</span>
            {['Heavy Rain', 'Deep Sleep', 'Cabin Fire', 'Reset'].map(p => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activePreset === p
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1e29]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Sleep Timer (Visible on all screens with scroll/wrap if needed) */}
          <div className="flex items-center gap-1 bg-[#12141c] p-1 rounded-xl border border-[#1f2430]">
            <Clock className="w-3.5 h-3.5 text-gray-400 ml-1 md:ml-2 hidden sm:block" />
            <span className="text-xs text-gray-400 font-medium hidden sm:inline">Timer:</span>
            {[15, 30, 45, 60].map(m => (
              <button
                key={m}
                onClick={() => setSleepTimer(sleepTimer === m ? null : m)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  sleepTimer === m
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1e29]'
                }`}
              >
                {m}m
              </button>
            ))}
            {timerRemaining !== null && (
              <button
                onClick={() => setSleepTimer(null)}
                title="Κλείσιμο Timer"
                className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 rounded-lg text-xs font-mono text-purple-300 animate-pulse hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 transition-all"
              >
                <span>{formatTime(timerRemaining)}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Master Volume */}
          <div className="hidden sm:flex items-center gap-2 bg-[#12141c] px-3 py-1.5 rounded-xl border border-[#1f2430]">
            <span className="text-xs text-gray-400 font-medium">Master</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVol}
              onChange={e => handleMasterVolChange(parseFloat(e.target.value))}
              className="w-16 md:w-20 accent-blue-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
            />
            <span className="text-xs font-mono w-8 text-right text-gray-300">{Math.round(masterVol * 100)}%</span>
          </div>

          {/* Master Play Button */}
          <button
            onClick={toggleMasterPlay}
            className={`flex items-center gap-2 px-3 md:px-5 py-2 rounded-xl font-semibold text-xs md:text-sm transition-all shadow-lg ${
              isPlaying
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span className="hidden xs:inline">{isPlaying ? 'Pause All' : 'Play All'}</span>
          </button>
        </div>
      </header>

      {/* 11 Channel Strips Grid Container */}
      <div className="flex-1 p-2 md:p-4 overflow-x-auto overflow-y-hidden flex items-center justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2 md:gap-3 w-full max-w-[1600px] h-full max-h-[calc(100vh-7.5rem)]">
          {CHANNELS_CONFIG.map(ch => {
            const state = channels[ch.id] || { volume: 0, pan: 0, muted: 0, active: false };
            const meter = meters[ch.id] || 0;

            return (
              <div
                key={ch.id}
                className={`flex flex-col justify-between bg-[#12141c] border rounded-2xl p-2.5 md:p-3 transition-all h-full ${
                  state.active
                    ? 'border-blue-500/50 shadow-lg shadow-blue-500/10 bg-gradient-to-b from-[#161a29] to-[#12141c]'
                    : 'border-[#1f2430] opacity-80 hover:opacity-100'
                }`}
              >
                {/* Channel Header */}
                <div className="flex items-center justify-between pb-1.5 md:pb-2 border-b border-[#1f2430]">
                  <span className="text-[11px] md:text-xs font-bold tracking-tight text-white truncate max-w-[85px]">{ch.name}</span>
                  <button
                    onClick={() => toggleChannelActive(ch.id)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      state.active ? 'bg-blue-500 shadow-md shadow-blue-500' : 'bg-gray-600'
                    }`}
                    title="Toggle Channel"
                  />
                </div>

                {/* Vertical Fader & VU Meter Section */}
                <div className="flex-1 flex items-center justify-center gap-2 md:gap-3 py-1 md:py-2">
                  {/* VU Meter Bar */}
                  <div className="w-1.5 md:w-2 h-24 md:h-28 bg-[#08090d] rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-[#1f2430]">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-75"
                      style={{ height: `${meter}%` }}
                    />
                  </div>

                  {/* Vertical Fader */}
                  <div className="flex flex-col items-center h-full justify-center">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={state.volume}
                      onChange={e => handleChannelVolChange(ch.id, parseFloat(e.target.value))}
                      className="slider-vertical my-auto accent-blue-500"
                    />
                  </div>
                </div>

                {/* Percentage & Panning */}
                <div className="space-y-1.5 md:space-y-2 pt-1.5 md:pt-2 border-t border-[#1f2430]">
                  <div className="text-center">
                    <span className="text-[10px] md:text-[11px] font-mono text-gray-300 font-semibold">
                      {Math.round(state.volume * 100)}%
                    </span>
                  </div>

                  {/* Stereo Pan Slider */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-[8px] md:text-[9px] text-gray-500 px-0.5 font-mono">
                      <span>L</span>
                      <span>C</span>
                      <span>R</span>
                    </div>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={state.pan}
                      onChange={e => handleChannelPanChange(ch.id, parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1 bg-gray-700 rounded cursor-pointer"
                    />
                  </div>

                  {/* Mute Button */}
                  <button
                    onClick={() => toggleMute(ch.id)}
                    className={`w-full py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                      state.muted === 1
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-[#1a1e29] hover:bg-[#252b3b] text-gray-300 border border-[#252b3b]'
                    }`}
                  >
                    {state.muted === 1 ? 'MUTED' : 'MUTE'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="h-8 md:h-10 px-4 md:px-6 border-t border-[#1f2430] bg-[#0c0e15] flex items-center justify-between text-[11px] md:text-xs text-gray-500 shrink-0">
        <div>Somno Studio © 2026 — Web Audio API Synthesizer</div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">Zero MP3s • Instant Playback • Offline Ready</span>
          <span className="text-blue-400 font-mono">v1.0.0</span>
        </div>
      </footer>
    </main>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Sliders, Clock, X } from 'lucide-react';
import { CHANNELS_CONFIG, audioEngine } from '@/lib/audioEngine';

interface ChannelState {
  volume: number;
  muted: number;
  active: boolean;
}

export default function SomnoStudio() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [masterVol, setMasterVol] = useState<number>(0.8);
  const [channels, setChannels] = useState<Record<string, ChannelState>>(() => {
    const initial: Record<string, ChannelState> = {};
    CHANNELS_CONFIG.forEach(ch => {
      initial[ch.id] = { volume: 0, muted: 0, active: false };
    });
    return initial;
  });

  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [meters, setMeters] = useState<Record<string, number>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    localStorage.setItem('somno_studio_state', JSON.stringify({ channels, masterVol }));
  }, [channels, masterVol]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const newMeters: Record<string, number> = {};
      CHANNELS_CONFIG.forEach(ch => {
        if (channels[ch.id]?.active && channels[ch.id]?.volume > 0) {
          newMeters[ch.id] = audioEngine.getMeterLevel(ch.id, channels[ch.id].volume);
        } else {
          newMeters[ch.id] = 0;
        }
      });
      setMeters(newMeters);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, channels]);

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
          audioEngine.stopAll();
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
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    if (nextState) {
      CHANNELS_CONFIG.forEach(ch => {
        const state = channels[ch.id];
        if (state.active && state.volume > 0) {
          audioEngine.startChannel(ch, state.volume, masterVol);
        }
      });
    } else {
      audioEngine.stopAll();
    }
  };

  const handleMasterVolChange = (val: number) => {
    setMasterVol(val);
    if (isPlaying) {
      CHANNELS_CONFIG.forEach(ch => {
        const state = channels[ch.id];
        if (state.active) {
          audioEngine.setChannelVolume(ch.id, state.volume, val);
        }
      });
    }
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
          audioEngine.startChannel(config, val, masterVol);
        } else {
          audioEngine.setChannelVolume(id, val, masterVol);
        }
      }
    }
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
          audioEngine.startChannel(config, newVol, masterVol);
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
    audioEngine.setChannelMute(id, newMuted === 1, current.volume, masterVol);
  };

  const applyPreset = (presetName: string) => {
    setActivePreset(presetName);
    setIsPlaying(true);
    audioEngine.stopAll();

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
      newChannels[id] = { active: true, volume: 0.7, muted: 0 };
      const config = CHANNELS_CONFIG.find(c => c.id === id);
      if (config) {
        audioEngine.startChannel(config, 0.7, masterVol);
      }
    });

    setChannels(newChannels);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <main className="min-h-screen w-full flex flex-col bg-[#08090d] text-gray-200 select-none overflow-x-hidden">
      {/* Header / Master Suite */}
      <header className="h-16 px-3 md:px-6 border-b border-[#1f2430] bg-[#0c0e15] flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
            <Sliders className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Somno Studio <span className="text-[10px] md:text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">v1.2</span>
            </h1>
            <p className="text-[11px] text-gray-400 hidden sm:block">Ambient Audio Mixing Console</p>
          </div>
        </div>

        {/* Controls: Timer, Master Vol, Master Play */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Sleep Timer */}
          <div className="flex items-center gap-1 bg-[#12141c] p-1 rounded-xl border border-[#1f2430]">
            <Clock className="w-3.5 h-3.5 text-gray-400 ml-1 hidden sm:block" />
            <span className="text-xs text-gray-400 font-medium hidden sm:inline">Timer:</span>
            {[15, 30, 45, 60].map(m => (
              <button
                key={m}
                onClick={() => setSleepTimer(sleepTimer === m ? null : m)}
                className={`px-1.5 md:px-2 py-1 rounded-lg text-[11px] md:text-xs font-medium transition-all ${
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
                className="flex items-center gap-1 bg-purple-500/25 border border-purple-500/40 px-1.5 py-0.5 rounded-lg text-[11px] font-mono text-purple-300 animate-pulse hover:bg-red-500/20 transition-all"
              >
                <span>{formatTime(timerRemaining)}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Master Volume */}
          <div className="hidden md:flex items-center gap-2 bg-[#12141c] px-3 py-1.5 rounded-xl border border-[#1f2430]">
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
            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 rounded-xl font-semibold text-xs md:text-sm transition-all shadow-lg ${
              isPlaying
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
        </div>
      </header>

      {/* Presets bar */}
      <div className="bg-[#0f111a] px-4 py-2 border-b border-[#1f2430] flex items-center justify-center gap-2 overflow-x-auto shrink-0">
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Presets:</span>
        {['Heavy Rain', 'Deep Sleep', 'Cabin Fire', 'Reset'].map(p => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activePreset === p
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-[#161923] text-gray-300 hover:bg-[#1f2430]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Responsive Channels Container */}
      <div className="flex-1 p-3 md:p-6 overflow-y-auto flex items-start lg:items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11 gap-3 w-full max-w-[1600px] my-auto">
          {CHANNELS_CONFIG.map(ch => {
            const state = channels[ch.id] || { volume: 0, muted: 0, active: false };
            const meter = meters[ch.id] || 0;

            return (
              <div
                key={ch.id}
                className={`flex flex-col justify-between bg-[#12141c] border rounded-2xl p-4 lg:p-3 transition-all ${
                  state.active
                    ? 'border-blue-500/50 shadow-lg shadow-blue-500/10 bg-gradient-to-b from-[#161a29] to-[#12141c]'
                    : 'border-[#1f2430] opacity-85 hover:opacity-100'
                }`}
              >
                {/* Channel Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#1f2430]">
                  <span className="text-sm lg:text-xs font-bold tracking-tight text-white truncate">{ch.name}</span>
                  <button
                    onClick={() => toggleChannelActive(ch.id)}
                    className={`w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 rounded-full transition-all ${
                      state.active ? 'bg-blue-500 shadow-md shadow-blue-500' : 'bg-gray-600'
                    }`}
                    title="Toggle Channel"
                  />
                </div>

                {/* Fader & VU Meter Section: Horizontal on mobile, Vertical on Desktop */}
                <div className="flex items-center lg:flex-col justify-between lg:justify-center gap-4 lg:gap-3 py-4 lg:py-3">
                  {/* VU Meter */}
                  <div className="w-full lg:w-2 h-2 lg:h-36 bg-[#08090d] rounded-full overflow-hidden flex lg:flex-col justify-end p-0.5 border border-[#1f2430]">
                    <div
                      className="h-full lg:h-full w-full bg-gradient-to-r lg:bg-gradient-to-t from-blue-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-75"
                      style={{ width: `${meter}%` }}
                    />
                  </div>

                  {/* Volume Slider */}
                  <div className="flex-1 lg:flex-none flex items-center justify-center w-full">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={state.volume}
                      onChange={e => handleChannelVolChange(ch.id, parseFloat(e.target.value))}
                      className="w-full lg:slider-vertical accent-blue-500 cursor-pointer h-2 lg:h-36 bg-gray-700 lg:bg-transparent rounded-lg"
                    />
                  </div>
                </div>

                {/* Percentage & Mute */}
                <div className="space-y-2 pt-2 border-t border-[#1f2430] flex lg:flex-col items-center lg:items-stretch justify-between">
                  <span className="text-xs font-mono text-gray-300 font-semibold">
                    {Math.round(state.volume * 100)}%
                  </span>

                  {/* Mute Button */}
                  <button
                    onClick={() => toggleMute(ch.id)}
                    className={`px-4 lg:px-0 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
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
      <footer className="h-10 px-4 md:px-6 border-t border-[#1f2430] bg-[#0c0e15] flex items-center justify-between text-[11px] md:text-xs text-gray-500 shrink-0">
        <div>Somno Studio © 2026 — Local Audio Recordings</div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">100% Responsive Mobile & Desktop</span>
          <span className="text-blue-400 font-mono">v1.2.0</span>
        </div>
      </footer>
    </main>
  );
}

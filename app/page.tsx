'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Sliders, Clock, X, Volume2, VolumeX, Power } from 'lucide-react';
import { CHANNELS_CONFIG, audioEngine } from '@/lib/audioEngine';

interface ChannelState {
  volume: number;
  muted: number;
  active: boolean;
}

type CategoryType = 'all' | 'nature' | 'cozy' | 'sleep';

export default function SomnoStudio() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [masterVol, setMasterVol] = useState<number>(0.8);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  
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
    audioEngine.init();
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    if (nextState) {
      audioEngine.setMasterVolume(masterVol);
      CHANNELS_CONFIG.forEach(ch => {
        const state = channels[ch.id];
        if (state.active && state.volume > 0) {
          audioEngine.startChannel(ch, state.volume);
        }
      });
    } else {
      audioEngine.stopAll();
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
    
    audioEngine.setChannelVolume(id, val);

    if (isPlaying) {
      const config = CHANNELS_CONFIG.find(c => c.id === id);
      if (config && !channels[id].active && val > 0) {
        audioEngine.startChannel(config, val);
      }
    }
  };

  const toggleChannelActive = (id: string) => {
    audioEngine.init();
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
          audioEngine.startChannel(config, newVol);
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
    audioEngine.setChannelMute(id, newMuted === 1, current.volume);
  };

  const applyPreset = (presetName: string) => {
    audioEngine.init();
    setActivePreset(presetName);
    setIsPlaying(true);
    audioEngine.setMasterVolume(masterVol);
    audioEngine.stopAll();

    const newChannels = { ...channels };
    CHANNELS_CONFIG.forEach(ch => {
      newChannels[ch.id] = { ...newChannels[ch.id], active: false, volume: 0 };
    });

    let targetIds: string[] = [];
    if (presetName === 'Stormy Night') targetIds = ['rain', 'thunder'];
    else if (presetName === 'Peaceful Forest') targetIds = ['birds', 'rain'];

    targetIds.forEach(id => {
      newChannels[id] = { active: true, volume: 0.7, muted: 0 };
      const config = CHANNELS_CONFIG.find(c => c.id === id);
      if (config) {
        audioEngine.startChannel(config, 0.7);
      }
    });

    setChannels(newChannels);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredChannels = CHANNELS_CONFIG.filter(ch => {
    if (selectedCategory === 'all') return true;
    return ch.category === selectedCategory;
  });

  return (
    <main className="min-h-screen w-full flex flex-col bg-[#08090d] text-gray-200 select-none">
      {/* Header / Master Suite */}
      <header className="h-16 px-4 md:px-6 border-b border-[#1f2430] bg-[#0c0e15] flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Somno Studio <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">v2.1</span>
            </h1>
            <p className="text-xs text-gray-400 hidden sm:block">Ambient Soundscapes</p>
          </div>
        </div>

        {/* Master Controls & Play */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Sleep Timer */}
          <div className="hidden sm:flex items-center gap-1 bg-[#12141c] p-1 rounded-xl border border-[#1f2430]">
            <Clock className="w-3.5 h-3.5 text-gray-400 ml-1" />
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
                className="flex items-center gap-1 bg-purple-500/25 border border-purple-500/40 px-2 py-0.5 rounded-lg text-xs font-mono text-purple-300 animate-pulse hover:bg-red-500/20 transition-all"
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
              className="w-20 accent-blue-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
            />
            <span className="text-xs font-mono w-8 text-right text-gray-300">{Math.round(masterVol * 100)}%</span>
          </div>

          {/* Master Play Button */}
          <button
            onClick={toggleMasterPlay}
            className={`flex items-center gap-2 px-4 md:px-5 py-2 rounded-xl font-semibold text-xs md:text-sm transition-all shadow-lg ${
              isPlaying
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Pause All' : 'Play All'}</span>
          </button>
        </div>
      </header>

      {/* Presets & Category Filter Chips bar */}
      <div className="bg-[#0f111a] px-4 py-2.5 border-b border-[#1f2430] flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Presets */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Presets:</span>
          {['Stormy Night', 'Peaceful Forest'].map(p => (
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

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {[
            { id: 'all', label: 'All Sounds' },
            { id: 'nature', label: 'Nature & Weather' },
            { id: 'cozy', label: 'Cozy & Indoor' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as CategoryType)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-[#161923] text-gray-400 hover:text-white hover:bg-[#1f2430]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Stacked List Container with Filtered Categories */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto flex items-start justify-center">
        <div className="w-full max-w-2xl space-y-3.5 my-auto">
          {filteredChannels.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Δεν βρέθηκαν ήχοι σε αυτή την κατηγορία.
            </div>
          ) : (
            filteredChannels.map(ch => {
              const state = channels[ch.id] || { volume: 0, muted: 0, active: false };
              const meter = meters[ch.id] || 0;

              return (
                <div
                  key={ch.id}
                  className={`relative flex flex-col bg-[#12141c] border rounded-2xl p-4 md:p-5 transition-all ${
                    state.active
                      ? 'border-blue-500/50 shadow-lg shadow-blue-500/10 bg-gradient-to-r from-[#161a29] to-[#12141c]'
                      : 'border-[#1f2430] opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Top Row: Name, Status & Power Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleChannelActive(ch.id)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          state.active
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'bg-[#1a1e29] text-gray-400 hover:text-white'
                        }`}
                      >
                        <Power className="w-5 h-5" />
                      </button>
                      <div>
                        <h2 className="text-sm md:text-base font-bold text-white tracking-tight">{ch.name}</h2>
                        <p className="text-[11px] text-gray-400 capitalize">
                          {ch.category} • {state.active ? (state.muted === 1 ? 'Muted' : `Playing (${Math.round(state.volume * 100)}%)`) : 'Inactive'}
                        </p>
                      </div>
                    </div>

                    {/* Mute Button */}
                    <button
                      onClick={() => toggleMute(ch.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        state.muted === 1
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-[#1a1e29] text-gray-300 hover:bg-[#252b3b] border border-[#252b3b]'
                      }`}
                    >
                      {state.muted === 1 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      <span>{state.muted === 1 ? 'MUTED' : 'MUTE'}</span>
                    </button>
                  </div>

                  {/* Bottom Row: Wide Horizontal Volume Slider & VU Meter */}
                  <div className="space-y-1.5 pt-2 border-t border-[#1f2430]">
                    <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                      <span>Volume</span>
                      <span className="text-blue-400 font-bold">{Math.round(state.volume * 100)}%</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={state.volume}
                        onInput={e => handleChannelVolChange(ch.id, parseFloat((e.target as HTMLInputElement).value))}
                        onChange={e => handleChannelVolChange(ch.id, parseFloat(e.target.value))}
                        className="flex-1 accent-blue-500 cursor-pointer h-2.5 bg-gray-800 rounded-lg touch-none"
                      />
                    </div>

                    {/* Micro VU Meter bar */}
                    <div className="w-full h-1 bg-[#08090d] rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-75"
                        style={{ width: `${state.active && state.volume > 0 ? meter : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="h-10 px-4 md:px-6 border-t border-[#1f2430] bg-[#0c0e15] flex items-center justify-between text-[11px] md:text-xs text-gray-500 shrink-0">
        <div>Somno Studio © 2026 — Clean Stacked Mobile UX</div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">Optimized with Category Filters</span>
          <span className="text-blue-400 font-mono">v2.1.0</span>
        </div>
      </footer>
    </main>
  );
}

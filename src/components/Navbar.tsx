import React from 'react';
import { Volume2, VolumeX, Flame, ExternalLink, ShieldAlert } from 'lucide-react';
import { sfx } from '../services/soundEffects';

interface NavbarProps {
  currentView: 'audience' | 'stage' | 'admin';
  onViewChange: (view: 'audience' | 'stage' | 'admin') => void;
  roomCode: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onViewChange, roomCode }) => {
  const [muted, setMuted] = React.useState(sfx.isMuted);

  const toggleMute = () => {
    sfx.isMuted = !sfx.isMuted;
    setMuted(sfx.isMuted);
    if (!sfx.isMuted) {
      sfx.playDing();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-amber-500/20 px-3 py-2 sm:px-6 sm:py-3 shadow-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
        {/* Brand Header */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Flame className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-400 bg-clip-text text-transparent">
                PARIVAR FEUD
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {currentView === 'admin' ? 'Host Admin' : currentView === 'stage' ? 'Stage TV' : 'Live Audience'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Indian Family Feud • Gandhi Edition</p>
          </div>
        </div>

        {/* View Selection Tabs ONLY shown on Admin URL so audience members cannot access or see Stage/Admin */}
        {currentView === 'admin' && (
          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-amber-300 hover:bg-slate-800 flex items-center gap-1"
            >
              <span>Audience Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href="/stage"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-cyan-300 hover:bg-slate-800 flex items-center gap-1"
            >
              <span>Stage Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Room Status & Audio Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-amber-500/30 px-2.5 py-1 rounded-lg text-amber-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono font-semibold">{roomCode}</span>
          </div>

          <button
            onClick={toggleMute}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition"
            title={muted ? 'Unmute SFX' : 'Mute SFX'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};

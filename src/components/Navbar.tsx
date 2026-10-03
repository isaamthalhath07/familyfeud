import React from 'react';
import { Volume2, VolumeX, Flame, ExternalLink } from 'lucide-react';
import { sfx } from '../services/soundEffects';

interface NavbarProps {
  currentView: 'audience' | 'stage' | 'admin';
  roomCode: string;
  connectedBrokers: number;
  totalBrokers: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, roomCode, connectedBrokers, totalBrokers }) => {
  const [muted, setMuted] = React.useState(sfx.isMuted);
  const online = connectedBrokers > 0;

  const toggleMute = () => {
    sfx.isMuted = !sfx.isMuted;
    setMuted(sfx.isMuted);
    if (!sfx.isMuted) sfx.playDing();
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-amber-500/20 px-3 py-2 sm:px-6 sm:py-3 shadow-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Flame className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-400 bg-clip-text text-transparent">
                PARIVAR FEUD
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {currentView === 'admin' ? 'Host Admin' : currentView === 'stage' ? 'Stage TV' : 'Live Audience'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Indian Family Feud • Gandhi Edition</p>
          </div>
        </div>

        {/* Links to other screens are ONLY rendered on the admin URL */}
        {currentView === 'admin' && (
          <div className="flex items-center gap-2">
            <a
              id="admin-open-audience"
              href="/"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-amber-300 hover:bg-slate-800 flex items-center gap-1"
            >
              Audience <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              id="admin-open-stage"
              href="/stage"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-cyan-300 hover:bg-slate-800 flex items-center gap-1"
            >
              Stage <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          <div
            id="connection-status"
            title={`${connectedBrokers}/${totalBrokers} live servers connected`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
              online ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-red-950/40 border-red-500/40 text-red-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
            <span>{online ? 'LIVE' : 'Reconnecting…'}</span>
            {currentView === 'admin' && <span className="font-mono opacity-70">{connectedBrokers}/{totalBrokers}</span>}
          </div>

          <span className="hidden md:inline font-mono font-semibold text-amber-300/80">{roomCode}</span>

          {currentView !== 'audience' && (
            <button
              id="toggle-sound"
              onClick={toggleMute}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition"
              title={muted ? 'Unmute SFX' : 'Mute SFX'}
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

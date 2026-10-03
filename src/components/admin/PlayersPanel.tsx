import React, { useState } from 'react';
import type { GameState, UserSubmission } from '../../types/game';
import type { Scoreboard } from '../../lib/scoring';
import { contestantKey } from '../../lib/scoring';
import { adjustScore, kickPlayer, setContestant, unkickPlayer } from '../../lib/gameActions';
import { Users, Ban, Mic, CheckCircle2, Search } from 'lucide-react';

interface Props {
  state: GameState;
  scoreboard: Scoreboard;
  submissions: UserSubmission[];
  playerCount: number;
}

export const PlayersPanel: React.FC<Props> = ({ state, scoreboard, submissions, playerCount }) => {
  const [filter, setFilter] = useState('');
  const votedNow = new Set(submissions.filter((s) => s.questionId === state.currentQuestionId).map((s) => s.userId));
  const onStage = contestantKey(state.stagePlayer);
  const rows = scoreboard.rows.filter((r) => r.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const kicked = Object.entries(state.kicked);

  const setTotal = (key: string, name: string, total: number) => {
    const raw = prompt(`Set ${name}'s total points to:`, String(total));
    if (raw === null) return;
    const target = parseInt(raw, 10);
    if (Number.isNaN(target)) return;
    adjustScore(key, target - total);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" /> Players & Points
          <span className="text-xs font-semibold text-slate-400">
            ({playerCount} joined • {votedNow.size} voted this round)
          </span>
        </h3>
        {scoreboard.rows.length > 6 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find player"
              className="bg-slate-950 border border-slate-700 rounded-lg py-1.5 pl-8 pr-2 text-xs text-slate-200 w-40"
            />
          </div>
        )}
      </div>

      {scoreboard.rows.length === 0 ? (
        <p className="text-sm text-slate-400">Nobody has joined yet. Audience members appear here as soon as they enter their name.</p>
      ) : (
        <ol className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {rows.map((r) => {
            const rank = scoreboard.rows.indexOf(r) + 1;
            return (
              <li key={r.key} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-6 text-right text-xs font-black text-amber-400">{rank}.</span>
                  <span className="text-xl">{r.avatar}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate flex items-center gap-1.5">
                      {r.name}
                      {r.key === onStage && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">ON STAGE</span>}
                      {r.guest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">guest</span>}
                      {r.userId && votedNow.has(r.userId) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-label="Voted this round" />}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      votes {r.votePoints} • stage {r.stagePoints} • host {r.adjustment >= 0 ? '+' : ''}
                      {r.adjustment}
                    </p>
                  </div>
                </div>

                <span className="font-mono font-black text-amber-300 text-lg w-16 text-right">{r.total}</span>

                <div className="flex items-center gap-1 flex-wrap">
                  {[-10, -5, 5, 10].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => adjustScore(r.key, d)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                        d < 0 ? 'border-red-500/30 text-red-300 bg-red-950/30' : 'border-emerald-500/30 text-emerald-300 bg-emerald-950/30'
                      }`}
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                  <button type="button" onClick={() => setTotal(r.key, r.name, r.total)} className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-700 text-slate-300">
                    Set…
                  </button>
                  {r.userId && r.key !== onStage && (
                    <button
                      type="button"
                      title="Call to stage"
                      onClick={() => setContestant({ name: r.name, userId: r.userId })}
                      className="p-1.5 rounded-lg border border-amber-500/30 text-amber-300"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {r.userId && (
                    <button
                      type="button"
                      title="Kick from room"
                      onClick={() => {
                        if (confirm(`Kick ${r.name} from the room? Their votes are removed and their phone is locked out.`)) kickPlayer(r.userId as string, r.name);
                      }}
                      className="p-1.5 rounded-lg border border-red-500/30 text-red-300"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {kicked.length > 0 && (
        <div className="pt-3 border-t border-slate-800">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Kicked</p>
          <div className="flex flex-wrap gap-2">
            {kicked.map(([id, name]) => (
              <span key={id} className="inline-flex items-center gap-2 text-xs bg-red-950/30 border border-red-500/30 text-red-200 rounded-lg px-2 py-1">
                {name}
                <button type="button" onClick={() => unkickPlayer(id)} className="text-emerald-300 font-semibold">
                  Allow back
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

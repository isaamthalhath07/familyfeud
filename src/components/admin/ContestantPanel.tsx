import React, { useState } from 'react';
import type { GameState, Player, Question } from '../../types/game';
import type { Scoreboard } from '../../lib/scoring';
import { contestantFor, contestantKey, revealedSet, stageRoundPoints } from '../../lib/scoring';
import { setContestant, setStageGuess } from '../../lib/gameActions';
import { ArrowUp, ArrowDown, X, Mic, Link2Off } from 'lucide-react';

interface Props {
  state: GameState;
  question: Question;
  order: string[]; // live board order
  players: Player[];
  scoreboard: Scoreboard;
}

export const ContestantPanel: React.FC<Props> = ({ state, question, order, players, scoreboard }) => {
  const current = state.stagePlayer;
  const roundPlayer = contestantFor(state, question.id) ?? current;
  const [nameInput, setNameInput] = useState(current.name);
  const [dirty, setDirty] = useState(false);

  // Keep the field in step with the live state (e.g. another host device changed it), unless typing.
  const [seenName, setSeenName] = useState(current.name);
  if (seenName !== current.name) {
    setSeenName(current.name);
    if (!dirty) setNameInput(current.name);
  }

  const guess = state.stageGuesses[question.id] ?? [];
  const remaining = question.options.filter((o) => !guess.includes(o.id));
  const optionText = (id: string) => question.options.find((o) => o.id === id)?.text ?? '—';
  const roundPoints = stageRoundPoints(guess, order, revealedSet(state, question.id));
  const total = scoreboard.byKey.get(contestantKey(roundPlayer))?.total ?? 0;

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    // Renaming keeps the link to the audience member only if it's still clearly them.
    const linked = current.userId && players.find((p) => p.id === current.userId)?.name === name ? current.userId : undefined;
    setContestant({ name, userId: linked });
    setDirty(false);
  };

  const moveGuess = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= guess.length) return;
    const next = [...guess];
    [next[idx], next[target]] = [next[target], next[idx]];
    setStageGuess(next);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
        <Mic className="w-4 h-4" /> Stage Contestant
      </h3>

      <form onSubmit={saveName} className="flex gap-2">
        <input
          id="admin-stage-guy-input"
          type="text"
          maxLength={24}
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value);
            setDirty(true);
          }}
          placeholder="Contestant name"
          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-amber-100 outline-none focus:border-amber-500"
        />
        <button type="submit" className="px-3 rounded-xl font-bold text-xs bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30">
          Set
        </button>
      </form>

      {players.length > 0 && (
        <select
          id="admin-pick-contestant"
          value=""
          onChange={(e) => {
            const p = players.find((x) => x.id === e.target.value);
            if (p) {
              setContestant({ name: p.name, userId: p.id });
              setDirty(false);
            }
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-slate-200"
        >
          <option value="">🎤 Call someone up from the audience…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.avatar} {p.name}
            </option>
          ))}
        </select>
      )}

      <div className="text-xs text-slate-400 space-y-1">
        {current.userId ? (
          <p className="flex items-center gap-2 flex-wrap">
            <span className="text-emerald-300 font-semibold">Linked to their audience profile — stage points add to their total.</span>
            <button type="button" onClick={() => setContestant({ name: current.name })} className="inline-flex items-center gap-1 text-slate-400 hover:text-red-300">
              <Link2Off className="w-3.5 h-3.5" /> Unlink
            </button>
          </p>
        ) : (
          <p>Guest contestant (not on the audience list).</p>
        )}
        {contestantKey(roundPlayer) !== contestantKey(current) && (
          <p className="text-amber-300">
            This round was played by <b>{roundPlayer.name}</b>. {current.name} plays from the next question.
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">{roundPlayer.name}'s ranking</span>
          {guess.length > 0 && (
            <button type="button" onClick={() => setStageGuess([])} className="text-[11px] text-slate-400 hover:text-red-300">
              Clear
            </button>
          )}
        </div>

        {guess.length > 0 && (
          <ol className="space-y-1.5">
            {guess.map((id, idx) => (
              <li key={id} className="flex items-center bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs gap-2">
                <span className="font-mono text-amber-400 font-bold">#{idx + 1}</span>
                <span className="truncate flex-1 font-medium text-slate-200">{optionText(id)}</span>
                <button type="button" aria-label="Move up" onClick={() => moveGuess(idx, -1)} disabled={idx === 0} className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-30">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => moveGuess(idx, 1)}
                  disabled={idx === guess.length - 1}
                  className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-30"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button type="button" aria-label="Remove" onClick={() => setStageGuess(guess.filter((g) => g !== id))} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-red-300">
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ol>
        )}

        {remaining.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500">
              Tap the options in the order {roundPlayer.name} calls them out (pick #{guess.length + 1}):
            </p>
            {remaining.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setStageGuess([...guess, o.id])}
                className="w-full text-left text-xs px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-100 hover:bg-amber-500/15"
              >
                + {o.text}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-400 pt-1">
          This round: <b className="text-emerald-300">+{roundPoints}</b> • {roundPlayer.name}'s total: <b className="text-amber-300">{total} pts</b>
        </p>
      </div>
    </div>
  );
};

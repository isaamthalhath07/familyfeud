import React, { useState, useEffect, useMemo } from 'react';
import type { LiveSnapshot } from '../services/liveSync';
import type { GamePhase } from '../types/game';
import { liveSync } from '../services/liveSync';
import { sfx } from '../services/soundEffects';
import { useCountdown } from '../hooks/useLiveGame';
import { checkPin, isAdminDevice, setAdminDevice } from '../lib/adminAuth';
import { computeRanking, computeScoreboard } from '../lib/scoring';
import {
  clearOverrides,
  cueSfx,
  currentQuestionOf,
  hideAll,
  lockVotingIfTimeUp,
  resetTimer,
  revealAll,
  revealNext,
  selectQuestion,
  setOverride,
  setPhase,
  startTimer,
  toggleReveal,
  toggleTimer,
} from '../lib/gameActions';
import { ContestantPanel } from './admin/ContestantPanel';
import { PlayersPanel } from './admin/PlayersPanel';
import { QuestionBank } from './admin/QuestionBank';
import { ShieldAlert, Play, Pause, RotateCcw, Sliders, KeyRound, LogOut, Eye, EyeOff, SkipForward, Sparkles, Loader2, ChevronRight, CheckCircle2, XCircle, X } from 'lucide-react';

const PHASES: { id: GamePhase; label: string }[] = [
  { id: 'VOTING', label: 'Voting' },
  { id: 'LOCKED', label: 'Locked' },
  { id: 'STAGE_GUESSING', label: 'Stage Guessing' },
  { id: 'REVEALED', label: 'Revealed' },
];

const card = 'bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl';

const PinGate: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkPin(pinInput)) {
      setPinError(false);
      sfx.playVictory();
      onUnlock();
    } else {
      setPinError(true);
      sfx.playBuzzer();
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 border-2 border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6 relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
          <KeyRound className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Admin Secret Access</h2>
          <p className="text-xs text-slate-400 mt-1">Enter the secret PIN to unlock God Mode & Stage Controls.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              id="admin-pin-input"
              type="password"
              required
              autoComplete="off"
              placeholder="Enter Secret PIN"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError(false);
              }}
              className={`w-full text-center tracking-widest text-lg font-mono bg-slate-950 border rounded-2xl py-3.5 px-4 text-amber-200 outline-none transition ${
                pinError ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-700 focus:border-amber-500'
              }`}
            />
            {pinError && <p className="text-xs font-bold text-red-400 mt-2">❌ Incorrect Secret PIN. Try again!</p>}
          </div>
          <button
            id="admin-pin-submit"
            type="submit"
            className="w-full py-3.5 rounded-2xl font-bold bg-gradient-to-r from-red-600 via-amber-600 to-red-500 text-white shadow-xl shadow-red-500/20 hover:brightness-110 active:scale-[0.99] transition text-sm"
          >
            Unlock Admin Panel
          </button>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC<{ live: LiveSnapshot; onLock: () => void }> = ({ live, onLock }) => {
  const { state, questions, submissions, players } = live;
  const question = currentQuestionOf(state, questions);
  const ranking = useMemo(() => computeRanking(question, submissions), [question, submissions]);
  const order = ranking.map((r) => r.option.id);
  const scoreboard = useMemo(() => computeScoreboard(state, questions, submissions, players), [state, questions, submissions, players]);
  const voteCount = submissions.filter((s) => s.questionId === question.id).length;
  const remaining = useCountdown(state);
  const revealed = state.revealed[question.id] ?? [];
  const guess = state.stageGuesses[question.id] ?? [];
  const qIndex = questions.findIndex((q) => q.id === question.id);
  const nextQuestion = questions[qIndex + 1];

  const [durationInput, setDurationInput] = useState(String(state.timerDuration));
  // Follow the live duration (e.g. changed from another host device).
  const [seenDuration, setSeenDuration] = useState(state.timerDuration);
  if (seenDuration !== state.timerDuration) {
    setSeenDuration(state.timerDuration);
    setDurationInput(String(state.timerDuration));
  }

  // Close voting automatically when the countdown runs out.
  useEffect(() => {
    if (remaining === 0) lockVotingIfTimeUp();
  }, [remaining, state.timerEndsAt, state.phase]);

  const okToReopen = () => revealed.length === 0 || confirm('Answers are already revealed for this question. Re-open voting and hide the board?');

  const duration = () => {
    const n = parseInt(durationInput, 10);
    const d = Number.isNaN(n) ? 60 : Math.min(600, Math.max(5, n));
    setDurationInput(String(d));
    return d;
  };

  const handlePhase = (phase: GamePhase) => {
    if (phase === state.phase) return;
    if (phase === 'VOTING' && !okToReopen()) return;
    setPhase(phase);
  };

  const timerStatus = state.timerEndsAt ? 'RUNNING 🟢' : remaining > 0 && remaining < state.timerDuration ? 'PAUSED ⏸️' : 'STOPPED';

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-red-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-100">Host Control Center</h2>
            <p className="text-xs text-slate-400">
              Live on Q{qIndex + 1}: <span className="text-amber-300">{question.title}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold flex-wrap">
            {PHASES.map((p) => (
              <button
                key={p.id}
                id={`admin-phase-${p.id.toLowerCase()}`}
                onClick={() => handlePhase(p.id)}
                className={`px-3 py-1.5 rounded-xl transition ${
                  state.phase === p.id ? 'bg-red-500 text-white font-bold shadow-md shadow-red-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            id="admin-logout"
            onClick={onLock}
            className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-red-400 transition"
            title="Lock Admin Panel"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column */}
        <div className="space-y-6">
          {/* Timer */}
          <div className={`${card} border-amber-500/30 space-y-4`}>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">⏱️ Voting Timer</h3>
            <div className="text-center py-4 bg-slate-950 rounded-2xl border border-slate-800">
              <span id="admin-timer-display" className={`font-mono text-4xl sm:text-5xl font-black ${state.timerEndsAt && remaining <= 10 ? 'text-red-300' : 'text-amber-300'}`}>
                {remaining}s
              </span>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                {timerStatus} | Votes: <span className="text-cyan-300 font-bold">{voteCount}</span> / {players.length}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="admin-start-voting"
                onClick={() => {
                  if (okToReopen()) startTimer(duration());
                }}
                className="py-3 rounded-xl font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Start Timer
              </button>
              <button
                id="admin-pause-timer"
                onClick={() => {
                  if (state.timerEndsAt || okToReopen()) toggleTimer();
                }}
                className="py-3 rounded-xl font-bold text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center justify-center gap-2"
              >
                {state.timerEndsAt ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} {state.timerEndsAt ? 'Pause' : 'Resume'}
              </button>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <label htmlFor="admin-timer-duration" className="text-xs text-slate-400 shrink-0">
                Duration (s):
              </label>
              <input
                id="admin-timer-duration"
                type="number"
                inputMode="numeric"
                min={5}
                max={600}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={duration}
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg py-1 px-2 text-xs font-mono text-amber-300"
              />
              <button onClick={resetTimer} className="ml-auto px-3 py-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>

          {/* Round flow */}
          <div className={`${card} space-y-3`}>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">🎬 Round Flow</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button onClick={() => handlePhase('LOCKED')} className="py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 hover:border-amber-500/50">
                🔒 Lock votes
              </button>
              <button onClick={() => handlePhase('STAGE_GUESSING')} className="py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 hover:border-amber-500/50">
                🎤 Stage guessing
              </button>
              <button
                id="admin-reveal-next"
                onClick={() => revealNext(order)}
                disabled={revealed.length >= order.length}
                className="py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <SkipForward className="w-3.5 h-3.5" /> Reveal next
              </button>
              <button
                id="admin-reveal-all"
                onClick={revealAll}
                className="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" /> Reveal all
              </button>
              <button
                onClick={hideAll}
                disabled={revealed.length === 0}
                className="py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <EyeOff className="w-3.5 h-3.5" /> Hide all
              </button>
              <button
                id="admin-next-question"
                onClick={() => nextQuestion && selectQuestion(nextQuestion.id)}
                disabled={!nextQuestion}
                className="py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 flex items-center justify-center gap-1 disabled:opacity-40"
              >
                Next question <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 pt-2">Play on stage speakers</p>
            <div className="grid grid-cols-4 gap-1.5 text-lg">
              {(
                [
                  ['ding', '🔔'],
                  ['buzzer', '❌'],
                  ['drumroll', '🥁'],
                  ['victory', '🎺'],
                ] as const
              ).map(([kind, icon]) => (
                <button key={kind} title={kind} onClick={() => cueSfx(kind)} className="py-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-amber-500/50">
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <ContestantPanel state={state} question={question} order={order} players={players} scoreboard={scoreboard} />

          {/* Dangerous actions */}
          <div className={`${card} border-red-500/20 space-y-3`}>
            <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">⚠️ Room Controls</h3>
            <button
              id="admin-clear-votes"
              onClick={() => {
                if (confirm('Clear all audience votes for the current question?')) liveSync.clearSubmissions(question.id);
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/40 transition"
            >
              Clear Votes For Current Question
            </button>
            <button
              id="admin-reset-game"
              onClick={() => {
                if (confirm('Reset the entire game? All votes, reveals, stage guesses and points are wiped. Players stay in the room.')) liveSync.resetGame();
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
            >
              Reset Entire Game
            </button>
          </div>
        </div>

        {/* Right columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live board */}
          <div className={`${card} border-amber-500/30`}>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-400" /> Live Board
              </h3>
              <span className="text-xs text-slate-400">
                {revealed.length}/{order.length} revealed • {voteCount} votes • tap a row to flip it on stage
              </span>
            </div>
            <div className="space-y-2">
              {ranking.map((r, i) => {
                const isRevealed = revealed.includes(r.option.id);
                const guessed = guess[i];
                return (
                  <button
                    key={r.option.id}
                    id={`admin-slot-${i + 1}`}
                    onClick={() => toggleReveal(r.option.id)}
                    className={`w-full text-left p-3 rounded-2xl border flex items-center gap-3 transition ${
                      isRevealed ? 'bg-amber-500/10 border-amber-500/60' : 'bg-slate-950 border-slate-800 hover:border-amber-500/40'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${isRevealed ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-amber-300'}`}>
                      #{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100 leading-tight">{r.option.text}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                        <span>
                          crowd {r.audiencePct !== null ? `${r.audiencePct}%` : '—'} • {r.firstPicks} picked #1
                        </span>
                        {r.overridden && <span className="text-red-300 font-semibold">• God Mode</span>}
                        {guess.length > 0 &&
                          (guessed === r.option.id ? (
                            <span className="text-emerald-300 flex items-center gap-0.5">
                              • <CheckCircle2 className="w-3 h-3" /> contestant correct
                            </span>
                          ) : (
                            <span className="text-red-300 flex items-center gap-0.5">
                              • <XCircle className="w-3 h-3" /> contestant wrong
                            </span>
                          ))}
                      </p>
                    </div>
                    <span className="font-mono font-black text-amber-300 text-lg shrink-0">{r.pct}%</span>
                    {isRevealed ? <Eye className="w-4 h-4 text-amber-300 shrink-0" /> : <EyeOff className="w-4 h-4 text-slate-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* God Mode — listed in fixed option order so rows don't jump while dragging a slider */}
          <div className="bg-slate-900/90 border-2 border-red-500/40 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-base text-slate-100">God Mode — Percentage Manipulator</h3>
              </div>
              <button id="admin-reset-godmode" onClick={clearOverrides} className="text-xs text-slate-400 hover:text-red-400 border border-slate-700 px-2.5 py-1 rounded-lg">
                Reset Overrides
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Drag a slider to override the crowd's % for that answer. The board re-ranks itself live on every screen.</p>
            <div className="space-y-3">
              {question.options.map((option) => {
                const row = ranking.find((r) => r.option.id === option.id);
                if (!row) return null;
                return (
                  <div key={option.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-semibold text-amber-200 min-w-0">
                        <span className="text-slate-500 font-mono">#{row.rank}</span> {option.text}
                      </span>
                      <div className="flex items-center gap-2 font-mono shrink-0">
                        <span className="text-slate-400 text-[11px] hidden sm:inline">crowd {row.audiencePct !== null ? `${row.audiencePct}%` : 'no votes'}</span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold border ${
                            row.overridden ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          }`}
                        >
                          {row.pct}%
                        </span>
                        {row.overridden && (
                          <button aria-label="Remove override" onClick={() => setOverride(option.id, undefined)} className="text-slate-500 hover:text-red-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={row.pct}
                      onChange={(e) => setOverride(option.id, parseInt(e.target.value, 10))}
                      className="w-full accent-red-500 cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <PlayersPanel state={state} scoreboard={scoreboard} submissions={submissions} playerCount={players.length} />

          <QuestionBank questions={questions} state={state} onBroadcast={selectQuestion} />
        </div>
      </div>
    </div>
  );
};

export const AdminPanel: React.FC<{ live: LiveSnapshot }> = ({ live }) => {
  const [authed, setAuthed] = useState(isAdminDevice);

  // Admin keeps the public brokers' copy of the game fresh.
  useEffect(() => {
    if (authed) liveSync.enableAdminMode();
  }, [authed]);

  if (!authed) {
    return (
      <PinGate
        onUnlock={() => {
          setAdminDevice(true);
          setAuthed(true);
        }}
      />
    );
  }

  // Never act on default data: a click before the live game loads would overwrite it.
  if (!live.synced) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
        <p className="font-bold text-amber-200">Loading the live game…</p>
        <p className="text-xs text-slate-400">
          {live.connectedBrokers}/{live.totalBrokers} live servers connected
        </p>
      </div>
    );
  }

  return (
    <AdminDashboard
      live={live}
      onLock={() => {
        setAdminDevice(false);
        setAuthed(false);
      }}
    />
  );
};

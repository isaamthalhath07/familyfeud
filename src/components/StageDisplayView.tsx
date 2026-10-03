import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { LiveSnapshot } from '../services/liveSync';
import type { SfxKind } from '../types/game';
import { sfx } from '../services/soundEffects';
import { useCountdown } from '../hooks/useLiveGame';
import { serverNow } from '../lib/clock';
import { isAdminDevice } from '../lib/adminAuth';
import { currentQuestionOf, hideAll, revealAll, revealNext, toggleReveal } from '../lib/gameActions';
import { seededShuffle } from '../lib/shuffle';
import { computeRanking, computeScoreboard, contestantFor, contestantKey, revealedSet, stageRoundPoints, POINTS_PER_CORRECT_SLOT } from '../lib/scoring';
import { Users, Eye, Sparkles, Flame, HelpCircle, Volume2, CheckCircle2, XCircle, EyeOff, Lock, Mic, Smartphone, SkipForward, Settings2 } from 'lucide-react';

const EMPTY: string[] = [];

const playSfx = (kind: SfxKind) => {
  if (kind === 'ding') sfx.playDing();
  else if (kind === 'buzzer') sfx.playBuzzer();
  else if (kind === 'drumroll') sfx.playDrumroll();
  else if (kind === 'victory') sfx.playVictory();
  else sfx.playFlip();
};

/** "Survey in progress" buffer shown while the audience is voting — the answers stay hidden. */
const VotingBuffer: React.FC<{ voteCount: number; timerRunning: boolean; timeUp: boolean }> = ({ voteCount, timerRunning, timeUp }) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-8 py-10 text-center">
    <div className="relative w-48 h-48 md:w-60 md:h-60">
      <div className="absolute inset-0 rounded-full border-[6px] border-slate-800"></div>
      <div className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-amber-400 border-r-amber-500/60 animate-spin [animation-duration:1.4s]"></div>
      <div className="absolute inset-6 rounded-full border-4 border-transparent border-b-cyan-400 border-l-cyan-500/50 animate-spin [animation-duration:2.2s] [animation-direction:reverse]"></div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-end gap-1.5 h-12">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="eq-bar w-2.5 rounded-full bg-gradient-to-t from-amber-500 to-yellow-300" style={{ animationDelay: `${i * 0.15}s` }}></span>
          ))}
        </div>
        <span id="stage-vote-count-big" className="mt-3 text-4xl md:text-5xl font-black text-amber-300 font-mono">{voteCount}</span>
        <span className="text-[11px] uppercase tracking-widest text-slate-400">responses</span>
      </div>
    </div>
    <div className="space-y-2">
      <p className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight">
        {timeUp ? "⏰ Time's up!" : 'Survey in progress'}
        {!timeUp && <span className="loading-dots" aria-hidden="true"></span>}
      </p>
      <p className="text-lg md:text-2xl text-slate-400 font-semibold">
        {timeUp ? 'Locking in the crowd’s answers…' : timerRunning ? 'The crowd is ranking the answers on their phones' : 'Voting is open — rank the answers on your phone'}
      </p>
    </div>
    <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900/80 border border-amber-500/30">
      <Smartphone className="w-6 h-6 text-amber-400" />
      <span className="text-lg md:text-2xl font-bold text-slate-200">
        Play along at <span className="font-mono text-amber-300">{window.location.host}</span>
      </span>
    </div>
  </div>
);

export const StageDisplayView: React.FC<{ live: LiveSnapshot }> = ({ live }) => {
  const { state, questions, submissions, players, synced } = live;
  const question = currentQuestionOf(state, questions);
  const ranking = useMemo(() => computeRanking(question, submissions), [question, submissions]);
  const order = ranking.map((r) => r.option.id);
  const voteCount = submissions.filter((s) => s.questionId === question.id).length;
  const guess = state.stageGuesses[question.id] ?? EMPTY;
  const revealed = state.revealed[question.id] ?? EMPTY;
  const remaining = useCountdown(state);
  const scoreboard = useMemo(() => computeScoreboard(state, questions, submissions, players), [state, questions, submissions, players]);
  const contestant = contestantFor(state, question.id) ?? state.stagePlayer;
  const contestantRow = scoreboard.byKey.get(contestantKey(contestant));
  const roundStagePoints = stageRoundPoints(guess, order, revealedSet(state, question.id));
  const leaders = scoreboard.rows.filter((r) => r.total !== 0).slice(0, 5);
  const shuffledOptions = useMemo(() => seededShuffle(question.options, question.id), [question]);

  const isVoting = state.phase === 'VOTING';
  const isFinished = state.phase === 'REVEALED';
  const timeUp = state.timerEndsAt !== null && remaining === 0;

  const [soundReady, setSoundReady] = useState(false);
  const [hostMode] = useState(isAdminDevice);
  const [showControls, setShowControls] = useState(true);

  // ---- Sounds react to shared state, so reveals triggered from the Admin phone also play here.
  const prevReveal = useRef<{ qid: string; ids: string[] } | null>(null);
  useEffect(() => {
    if (!synced) return;
    const before = prevReveal.current;
    prevReveal.current = { qid: question.id, ids: revealed };
    if (!before || before.qid !== question.id) return; // first load / question switch: no sounds
    const added = revealed.filter((id) => !before.ids.includes(id));
    if (added.length === 0) return;

    if (added.length > 1 || revealed.length === order.length) {
      sfx.playVictory();
      confetti({ particleCount: 140, spread: 100, origin: { y: 0.55 } });
      return;
    }
    const id = added[0];
    const slot = order.indexOf(id);
    sfx.playFlip();
    if (guess.length > 0 && guess[slot] !== id) {
      setTimeout(() => sfx.playBuzzer(), 150);
    } else {
      setTimeout(() => sfx.playDing(), 150);
      if (slot === 0) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, question.id, synced]);

  // ---- Sound cues fired from the Admin panel (ignore stale cues replayed from the broker on load).
  const lastCue = useRef<number | null>(null);
  useEffect(() => {
    const cue = state.sfx;
    if (!cue || cue.id === lastCue.current) return;
    lastCue.current = cue.id;
    if (serverNow() - cue.id < 5000) playSfx(cue.kind);
  }, [state.sfx]);

  // ---- Countdown ticks + buzzer at zero (not on first render, e.g. when the screen loads late)
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (!state.timerEndsAt) {
      lastTick.current = null;
      return;
    }
    const first = lastTick.current === null;
    if (lastTick.current === remaining) return;
    lastTick.current = remaining;
    if (first) return;
    if (remaining > 0 && remaining <= 5) sfx.playTick();
    if (remaining === 0) sfx.playBuzzer();
  }, [remaining, state.timerEndsAt]);

  const optionText = (id: string) => question.options.find((o) => o.id === id)?.text ?? '';

  return (
    <div className="min-h-[90vh] max-w-7xl mx-auto p-4 sm:p-6 flex flex-col gap-5">
      {!soundReady && (
        <button
          id="stage-enable-sound"
          onClick={() => {
            setSoundReady(true);
            sfx.playDing();
          }}
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center"
        >
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
            <Volume2 className="w-10 h-10 text-amber-300" />
          </div>
          <p className="text-2xl font-black text-amber-200">Click anywhere to start the Stage Screen</p>
          <p className="text-sm text-slate-400">Browsers block sound until you click once. Then press F11 for full screen.</p>
        </button>
      )}

      {/* Header */}
      <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl studio-border-glow">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-orange-500 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/30">
              <Flame className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
                Question {questions.findIndex((q) => q.id === question.id) + 1} of {questions.length} • {question.category}
              </span>
              <h2 id="stage-question" className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-100 tracking-tight leading-tight">
                {question.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {isVoting && state.timerEndsAt && (
              <div
                id="stage-timer"
                className={`px-5 py-3 rounded-2xl border-2 font-mono font-black text-3xl md:text-4xl ${
                  remaining <= 10 ? 'border-red-500 text-red-300 bg-red-500/10 animate-pulse' : 'border-amber-500/40 text-amber-300 bg-slate-950/70'
                }`}
              >
                {remaining}s
              </div>
            )}
            {!isVoting && (
              <div className="px-4 py-3 rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300 font-bold flex items-center gap-2">
                <Lock className="w-5 h-5" /> Voting closed
              </div>
            )}
            <div className="bg-slate-950/80 border border-cyan-500/30 px-4 py-3 rounded-2xl flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <div>
                <div id="stage-vote-count" className="text-2xl font-black text-cyan-300 leading-none">
                  {voteCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">votes</div>
              </div>
            </div>
          </div>
        </div>

        {question.bapuCommentary && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2 text-sm md:text-base text-amber-200/90 font-medium italic">
            <span className="text-lg">📢</span>
            <span>{question.bapuCommentary}</span>
          </div>
        )}
      </div>

      {isVoting ? (
        <VotingBuffer voteCount={voteCount} timerRunning={!!state.timerEndsAt} timeUp={timeUp} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 flex-1">
          {/* Board */}
          <div className="xl:col-span-2 space-y-3">
            {ranking.map((r, index) => {
              const isRevealed = revealed.includes(r.option.id);
              const guessed = guess[index];
              const guessCorrect = guessed === r.option.id;
              return (
                <button
                  key={r.option.id}
                  id={`stage-slot-${index + 1}`}
                  type="button"
                  disabled={!hostMode}
                  onClick={() => toggleReveal(r.option.id)}
                  className={`w-full text-left min-h-[84px] rounded-3xl border-2 transition-all duration-500 relative overflow-hidden shadow-2xl flex items-center justify-between p-4 sm:p-5 ${
                    isRevealed
                      ? 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-900 border-amber-500 shadow-amber-500/20'
                      : `bg-slate-900/80 border-slate-800 ${hostMode ? 'hover:border-amber-500/50' : ''}`
                  } disabled:cursor-default`}
                >
                  {isRevealed && (
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-500/10 transition-all duration-1000 ease-out pointer-events-none"
                      style={{ width: `${Math.min(100, r.pct)}%` }}
                    ></div>
                  )}
                  <div className="flex items-center gap-4 z-10 min-w-0">
                    <div
                      className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg ${
                        isRevealed ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-amber-400 border border-slate-700'
                      }`}
                    >
                      #{index + 1}
                    </div>
                    {isRevealed ? (
                      <div className="min-w-0">
                        <h3 className="text-lg md:text-2xl font-bold text-slate-100 leading-snug">{r.option.text}</h3>
                        {guess.length > 0 && (
                          <p className={`text-xs md:text-sm font-semibold mt-0.5 flex items-center gap-1 ${guessCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
                            {guessCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            {guessCorrect ? `${contestant.name} nailed it! +${POINTS_PER_CORRECT_SLOT}` : `${contestant.name} said: ${guessed ? optionText(guessed) : '—'}`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 font-semibold">
                        <HelpCircle className="w-5 h-5 text-amber-500/60 animate-pulse" />
                        <span>Hidden answer</span>
                      </div>
                    )}
                  </div>
                  <div className="z-10 shrink-0 pl-3">
                    {isRevealed ? (
                      <div className="text-right">
                        <div className="text-2xl md:text-4xl font-black text-amber-400 font-mono">{r.pct}%</div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">of the crowd</span>
                      </div>
                    ) : (
                      <Eye className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <div className="bg-slate-900/85 border border-amber-500/30 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2 min-w-0">
                  <Mic className="w-4 h-4 shrink-0" /> <span className="truncate">{contestant.name}</span>
                </h3>
                <span id="stage-player-score" className="font-mono font-black text-amber-300 text-xl shrink-0">
                  {contestantRow?.total ?? 0} pts
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Guessed order</p>
              <ol className="space-y-1.5">
                {order.map((_, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className={guess[i] ? 'text-slate-100 font-medium' : 'text-slate-600 italic'}>{guess[i] ? optionText(guess[i]) : 'waiting…'}</span>
                  </li>
                ))}
              </ol>
              {revealed.length > 0 && guess.length > 0 && (
                <p className="mt-3 text-sm font-bold text-emerald-300">
                  This round: +{roundStagePoints} pts{isFinished ? '' : ' so far'}
                </p>
              )}
            </div>

            {!isFinished ? (
              <div className="bg-slate-900/85 border border-slate-800 rounded-3xl p-5 shadow-xl">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">The options</p>
                <ul className="space-y-1.5">
                  {shuffledOptions.map((o) => (
                    <li
                      key={o.id}
                      className={`text-sm px-3 py-2 rounded-xl border ${
                        guess.includes(o.id) ? 'border-slate-800 text-slate-500 line-through' : 'border-slate-700 text-slate-200 bg-slate-950/60'
                      }`}
                    >
                      {o.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-slate-900/85 border border-cyan-500/30 rounded-3xl p-5 shadow-xl">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-cyan-300 mb-3">🏆 Leaderboard</h3>
                {leaders.length === 0 ? (
                  <p className="text-sm text-slate-400">No points on the board yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {leaders.map((l, i) => (
                      <li key={l.key} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-6 text-amber-400 font-black">{i + 1}.</span>
                          <span className="text-lg">{l.avatar}</span>
                          <span className="truncate text-slate-100 font-semibold">{l.name}</span>
                        </span>
                        <span className="font-mono font-bold text-amber-300">{l.total}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Host controls — only on a device where the Admin PIN has been entered */}
      {hostMode && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-3 flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => setShowControls((v) => !v)}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 border border-slate-800 flex items-center gap-1.5"
          >
            <Settings2 className="w-4 h-4" /> {showControls ? 'Hide host controls' : 'Host controls'}
          </button>
          {showControls && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => sfx.playBuzzer()} className="px-4 py-2.5 rounded-xl font-bold bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-sm">
                  ❌ Buzzer
                </button>
                <button onClick={() => sfx.playDing()} className="px-4 py-2.5 rounded-xl font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-sm">
                  🔔 Ding
                </button>
                <button onClick={() => sfx.playDrumroll()} className="px-4 py-2.5 rounded-xl font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-sm">
                  🥁 Drumroll
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button id="stage-hide-all" onClick={hideAll} className="px-4 py-2.5 rounded-xl font-bold bg-slate-800 border border-slate-700 text-slate-300 text-sm flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4" /> Hide all
                </button>
                <button
                  id="stage-reveal-next"
                  onClick={() => revealNext(order)}
                  className="px-4 py-2.5 rounded-xl font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm flex items-center gap-1.5"
                >
                  <SkipForward className="w-4 h-4" /> Reveal next
                </button>
                <button
                  id="stage-reveal-all"
                  onClick={revealAll}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 text-sm flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Reveal all
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

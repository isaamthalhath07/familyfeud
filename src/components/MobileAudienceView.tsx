import React, { useEffect, useMemo, useState } from 'react';
import type { AudienceMember } from '../types/game';
import type { LiveSnapshot } from '../services/liveSync';
import { liveSync } from '../services/liveSync';
import { useCountdown } from '../hooks/useLiveGame';
import { audienceScore, finalOrder, scoreGuess, POINTS_PER_CORRECT_SLOT } from '../lib/scoring';
import { ArrowUp, ArrowDown, Send, CheckCircle2, Lock, Sparkles, User, RefreshCw, Loader2, Pencil, Trophy, XCircle } from 'lucide-react';

const USER_KEY = 'PARIVAR_FEUD_USER';
const AVATARS = ['🧘‍♂️', '👑', '🔥', '🦁', '⚡', '🌶️', '🎭', '🦚'];
const SATIRE_BADGES = ['Ahinsa Master', 'Dandi Pioneer', 'Charkha Weaver', 'Satyagrahi', 'Desi Feud Legend'];

function loadUser(): AudienceMember | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    const u = raw ? JSON.parse(raw) : null;
    return u && u.id && u.name ? u : null;
  } catch {
    return null;
  }
}

export const MobileAudienceView: React.FC<{ live: LiveSnapshot }> = ({ live }) => {
  const { state, questions, submissions, synced, connectedBrokers } = live;
  const [user, setUser] = useState<AudienceMember | null>(loadUser);
  const [nameInput, setNameInput] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [editing, setEditing] = useState(false);
  const [slowConnect, setSlowConnect] = useState(false);

  const question = questions.find((q) => q.id === state.currentQuestionId) || questions[0];
  const remaining = useCountdown(state);
  const timeUp = state.timerEndsAt !== null && remaining === 0;
  const votingOpen = state.phase === 'VOTING' && !timeUp;

  const mySub = user ? submissions.find((s) => s.userId === user.id && s.questionId === question.id) : undefined;
  const optionKey = question.id + ':' + question.options.map((o) => o.id).join(',');

  const [order, setOrder] = useState<string[]>(() => question.options.map((o) => o.id));

  // Reset the local ordering whenever the live question (or its options) changes.
  useEffect(() => {
    setOrder(mySub ? [...mySub.rankedOptionIds] : question.options.map((o) => o.id));
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionKey]);

  // If our vote was cleared by the host, drop back into edit mode with a fresh list.
  useEffect(() => {
    if (!mySub) setEditing(false);
  }, [mySub]);

  useEffect(() => {
    if (synced) return;
    const t = setTimeout(() => setSlowConnect(true), 8000);
    return () => clearTimeout(t);
  }, [synced]);

  const myTotal = useMemo(
    () => (user ? audienceScore(user.id, state, questions, submissions) : 0),
    [user, state, questions, submissions],
  );

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    const member: AudienceMember = {
      id: 'usr_' + Math.random().toString(36).slice(2, 11),
      name,
      avatar,
      badge: SATIRE_BADGES[Math.floor(Math.random() * SATIRE_BADGES.length)],
    };
    localStorage.setItem(USER_KEY, JSON.stringify(member));
    setUser(member);
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const submit = () => {
    if (!user || !votingOpen) return;
    liveSync.submitRanking({
      userId: user.id,
      userName: user.name,
      avatar: user.avatar,
      questionId: question.id,
      rankedOptionIds: order,
      submittedAt: Date.now(),
    });
    setEditing(false);
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  };

  // ------------------------------------------------------------ profile setup
  if (!user) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3 text-3xl">🦚</div>
            <h2 className="text-2xl font-black text-amber-300 tracking-tight">Join Parivar Feud</h2>
            <p className="text-xs text-slate-400 mt-1">Pick a stage name, then rank the answers by what you think the crowd will say!</p>
          </div>

          <form onSubmit={handleCreateProfile} className="space-y-5">
            <div>
              <label htmlFor="audience-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Your Stage Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  id="audience-name"
                  type="text"
                  required
                  maxLength={18}
                  placeholder="e.g. Sharma ji ka beta"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3 pl-10 pr-4 text-base text-amber-100 outline-none transition"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Choose Your Avatar</span>
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`py-2 text-2xl rounded-xl border transition ${
                      avatar === av ? 'bg-amber-500/20 border-amber-500 scale-105 shadow-md shadow-amber-500/20' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              id="audience-join"
              type="submit"
              className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25 active:scale-[0.99] transition"
            >
              Enter Game Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ waiting for live data
  if (!synced) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
        <p className="font-bold text-amber-200">Connecting to the live game…</p>
        {slowConnect && connectedBrokers === 0 && (
          <p className="text-xs text-slate-400 max-w-xs">
            Taking longer than usual. Check your internet, or switch between Wi-Fi and mobile data.
          </p>
        )}
      </div>
    );
  }

  const isRevealed = state.phase === 'REVEALED' || state.finishedQuestionIds.includes(question.id);
  const answerKey = isRevealed ? finalOrder(question, submissions) : [];
  const optionText = (id: string) => question.options.find((o) => o.id === id)?.text ?? '—';
  const showEditor = votingOpen && (!mySub || editing);
  const displayOrder = showEditor ? order : mySub?.rankedOptionIds ?? order;
  const myPoints = isRevealed ? scoreGuess(mySub?.rankedOptionIds, answerKey) : 0;

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-20">
      {/* Player card */}
      <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">{user.avatar}</div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-100">{user.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">{user.badge}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Total: <span id="audience-total-score" className="text-amber-400 font-bold">{myTotal} pts</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (!confirm('Change your name? Your points stay with your old name.')) return;
            localStorage.removeItem(USER_KEY);
            setUser(null);
          }}
          className="text-xs text-slate-400 hover:text-red-400 p-1.5"
          title="Change Profile"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Question */}
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">{question.category}</span>
          {state.phase === 'VOTING' && (
            <span
              id="audience-timer"
              className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                state.timerEndsAt && remaining <= 10 ? 'text-red-300 bg-red-500/15 animate-pulse' : 'text-amber-400'
              }`}
            >
              ⏱️ {remaining}s
            </span>
          )}
        </div>
        <h2 id="audience-question" className="text-base sm:text-lg font-bold text-amber-100 leading-snug mb-3">
          {question.title}
        </h2>
        {question.darkHumorTrivia && (
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-2.5 text-xs text-amber-200/90 italic">
            🔥 <span className="font-semibold text-amber-400">Satire Note:</span> {question.darkHumorTrivia}
          </div>
        )}
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between text-xs text-slate-300 px-1">
        <span className="font-semibold text-amber-300/90 uppercase tracking-wider">
          {isRevealed ? 'Crowd answer vs yours' : 'Rank: #1 = most popular'}
        </span>
        {isRevealed ? null : showEditor ? (
          <span className="text-slate-400">Use ▲ ▼ to reorder</span>
        ) : mySub ? (
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Vote locked in
          </span>
        ) : (
          <span className="text-red-400 font-bold flex items-center gap-1">
            <Lock className="w-4 h-4" /> Voting closed
          </span>
        )}
      </div>

      {/* Results (after reveal) */}
      {isRevealed ? (
        <div className="space-y-2.5">
          {answerKey.map((id, i) => {
            const mine = mySub?.rankedOptionIds[i];
            const correct = mine === id;
            return (
              <div
                key={id}
                className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                  correct ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <span className="w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs bg-amber-400 text-slate-950 shrink-0">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-100 leading-tight">{optionText(id)}</p>
                  {mySub && !correct && <p className="text-[11px] text-slate-400 mt-0.5">You said: {optionText(mine ?? '')}</p>}
                </div>
                {mySub &&
                  (correct ? (
                    <span className="text-emerald-300 text-xs font-bold shrink-0">+{POINTS_PER_CORRECT_SLOT}</span>
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400/70 shrink-0" />
                  ))}
              </div>
            );
          })}
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 text-center">
            <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-1" />
            {mySub ? (
              <p className="text-sm text-amber-100">
                You scored <span id="audience-round-score" className="font-black text-amber-300">{myPoints} pts</span> this round!
              </p>
            ) : (
              <p className="text-sm text-slate-300">You didn't vote this round — catch the next one!</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Ranking list */}
          <div className="space-y-2.5">
            {displayOrder.map((id, index) => {
              const top = index === 0;
              return (
                <div
                  key={id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    top ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10' : 'bg-slate-900/70 border-slate-800'
                  } ${showEditor ? '' : 'opacity-90'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        top ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-amber-300 border border-slate-700'
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <p className="text-sm font-medium text-slate-100 leading-tight">{optionText(id)}</p>
                  </div>
                  {showEditor && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        aria-label="Move up"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 active:bg-amber-500 active:text-slate-950 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        aria-label="Move down"
                        onClick={() => move(index, 1)}
                        disabled={index === displayOrder.length - 1}
                        className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 active:bg-amber-500 active:text-slate-950 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {showEditor && (
            <button
              id="audience-submit"
              onClick={submit}
              className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 shadow-xl shadow-amber-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2 text-base"
            >
              <Send className="w-4 h-4" /> {mySub ? 'Update My Ranking' : 'Submit My Ranking'}
            </button>
          )}

          {mySub && !showEditor && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-2">
              <Sparkles className="w-6 h-6 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-sm text-emerald-300">Your ranking is in!</h3>
              <p className="text-xs text-slate-300">Watch the stage — points appear here once the board is revealed.</p>
              {votingOpen && (
                <button
                  id="audience-edit"
                  onClick={() => {
                    setOrder([...mySub.rankedOptionIds]);
                    setEditing(true);
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 border border-amber-500/40 rounded-lg px-3 py-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Change my ranking
                </button>
              )}
            </div>
          )}

          {!mySub && !votingOpen && (
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 text-center text-sm text-slate-300">
              ⏳ Voting is closed for this question. Eyes on the stage!
            </div>
          )}
        </>
      )}
    </div>
  );
};

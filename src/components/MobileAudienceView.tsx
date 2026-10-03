import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { AudienceMember } from '../types/game';
import type { LiveSnapshot } from '../services/liveSync';
import { liveSync } from '../services/liveSync';
import { useCountdown } from '../hooks/useLiveGame';
import { serverNow } from '../lib/clock';
import { currentQuestionOf } from '../lib/gameActions';
import { seededShuffle } from '../lib/shuffle';
import { audienceRoundPoints, closenessPoints, computeScoreboard, revealedSet } from '../lib/scoring';
import { ArrowUp, ArrowDown, Send, CheckCircle2, Lock, Sparkles, User, Loader2, Pencil, Trophy, GripVertical, Ban, HelpCircle } from 'lucide-react';

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

function saveUser(u: AudienceMember) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  } catch {
    /* private mode — profile lasts for this page only */
  }
}

const ProfileForm: React.FC<{ initial: AudienceMember | null; onSave: (m: AudienceMember) => void; onCancel?: () => void }> = ({ initial, onSave, onCancel }) => {
  const [nameInput, setNameInput] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    onSave({
      id: initial?.id ?? 'usr_' + Math.random().toString(36).slice(2, 11),
      name,
      avatar,
      badge: initial?.badge ?? SATIRE_BADGES[Math.floor(Math.random() * SATIRE_BADGES.length)],
    });
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3 text-3xl">🦚</div>
          <h2 className="text-2xl font-black text-amber-300 tracking-tight">{initial ? 'Edit Your Profile' : 'Join Parivar Feud'}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {initial ? 'Your points stay with you.' : 'Pick a stage name, then rank the answers by what you think the crowd will say!'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
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
                autoComplete="off"
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
            {initial ? 'Save' : 'Enter Game Room'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-slate-400">
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export const MobileAudienceView: React.FC<{ live: LiveSnapshot }> = ({ live }) => {
  const { state, questions, submissions, players, synced, connectedBrokers } = live;
  const [user, setUser] = useState<AudienceMember | null>(loadUser);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editing, setEditing] = useState(false);
  const [slowConnect, setSlowConnect] = useState(false);

  const question = currentQuestionOf(state, questions);
  const remaining = useCountdown(state);
  const timeUp = state.timerEndsAt !== null && remaining === 0;
  const votingOpen = state.phase === 'VOTING' && !timeUp;
  const kicked = user ? !!state.kicked[user.id] : false;

  const mySub = user ? submissions.find((s) => s.userId === user.id && s.questionId === question.id) : undefined;
  const me = user ? players.find((p) => p.id === user.id) : undefined;
  const optionKey = question.id + ':' + question.options.map((o) => o.id).join(',');

  // Start every phone on a shuffled list — the question bank order is the preset answer key.
  const shuffled = useMemo(
    () => seededShuffle(question.options.map((o) => o.id), (user?.id ?? '') + question.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionKey, user?.id],
  );
  const [order, setOrder] = useState<string[]>(shuffled);
  const orderRef = useRef(order);
  const applyOrder = (next: string[]) => {
    orderRef.current = next;
    setOrder(next);
  };

  // Reset the local ordering whenever the live question (or its options) changes.
  useEffect(() => {
    applyOrder(mySub ? [...mySub.rankedOptionIds] : shuffled);
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffled]);

  // Announce ourselves to the room (and re-announce if the record went missing or got stale).
  useEffect(() => {
    if (!user || !synced || kicked) return;
    if (me && me.name === user.name && me.avatar === user.avatar && me.badge === user.badge) return;
    liveSync.announcePlayer({ ...user, joinedAt: me?.joinedAt ?? serverNow() });
  }, [user, synced, kicked, me]);

  useEffect(() => {
    if (synced) return;
    const t = setTimeout(() => setSlowConnect(true), 8000);
    return () => clearTimeout(t);
  }, [synced]);

  const scoreboard = useMemo(() => computeScoreboard(state, questions, submissions, players), [state, questions, submissions, players]);
  const myRow = user ? scoreboard.byKey.get(user.id) : undefined;
  const myRank = user ? scoreboard.rows.findIndex((r) => r.key === user.id) + 1 : 0;

  // ------------------------------------------------------------ drag to reorder
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<{ id: string; startY: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null);

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, startY: e.clientY };
    setDrag({ id, dy: 0 });
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    // Swap with a neighbour once the dragged card passes its middle; keep the card under the finger.
    for (let guard = 0; guard < order.length; guard++) {
      const dy = e.clientY - d.startY;
      const cur = orderRef.current;
      const idx = cur.indexOf(d.id);
      const el = rowRefs.current.get(d.id);
      const nextEl = rowRefs.current.get(cur[idx + 1]);
      const prevEl = rowRefs.current.get(cur[idx - 1]);
      if (!el) break;
      let target = -1;
      let shift = 0;
      if (nextEl && el.offsetTop + el.offsetHeight + dy > nextEl.offsetTop + nextEl.offsetHeight / 2) {
        target = idx + 1;
        shift = nextEl.offsetTop + nextEl.offsetHeight - (el.offsetTop + el.offsetHeight);
      } else if (prevEl && el.offsetTop + dy < prevEl.offsetTop + prevEl.offsetHeight / 2) {
        target = idx - 1;
        shift = prevEl.offsetTop - el.offsetTop;
      }
      if (target < 0) break;
      const next = [...cur];
      [next[idx], next[target]] = [next[target], next[idx]];
      flushSync(() => applyOrder(next));
      d.startY += shift;
    }
    setDrag({ id: d.id, dy: e.clientY - d.startY });
  };

  const onDragEnd = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    applyOrder(next);
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
      submittedAt: serverNow(),
    });
    setEditing(false);
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  };

  const saveProfile = (m: AudienceMember) => {
    saveUser(m);
    setUser(m);
    setEditingProfile(false);
  };

  // ------------------------------------------------------------ profile setup
  if (!user || editingProfile) {
    return <ProfileForm initial={user} onSave={saveProfile} onCancel={user ? () => setEditingProfile(false) : undefined} />;
  }

  // ------------------------------------------------------------ removed by host
  if (kicked) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Ban className="w-12 h-12 text-red-400" />
        <p className="text-xl font-black text-red-300">You've been removed from the room</p>
        <p className="text-sm text-slate-400 max-w-xs">The host has removed you from this game. Ask the host if you think this was a mistake.</p>
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
          <p className="text-xs text-slate-400 max-w-xs">Taking longer than usual. Check your internet, or switch between Wi-Fi and mobile data.</p>
        )}
      </div>
    );
  }

  const revealed = revealedSet(state, question.id);
  const answerKey = scoreboard.orders.get(question.id) ?? [];
  const showResults = !votingOpen && revealed.size > 0;
  const allRevealed = revealed.size > 0 && answerKey.every((id) => revealed.has(id));
  const optionText = (id: string) => question.options.find((o) => o.id === id)?.text ?? '—';
  const showEditor = votingOpen && (!mySub || editing);
  const displayOrder = showEditor ? order : mySub?.rankedOptionIds ?? order;
  const roundPoints = audienceRoundPoints(mySub?.rankedOptionIds, answerKey, revealed);

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-20">
      {/* Player card */}
      <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">{user.avatar}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-slate-100 truncate">{user.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">{user.badge}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Total: <span id="audience-total-score" className="text-amber-400 font-bold">{myRow?.total ?? 0} pts</span>
              {myRank > 0 && scoreboard.rows.length > 1 && (
                <span className="ml-1.5 text-slate-500">
                  • Rank #{myRank} of {scoreboard.rows.length}
                </span>
              )}
            </p>
          </div>
        </div>
        <button onClick={() => setEditingProfile(true)} className="text-xs text-slate-400 hover:text-amber-300 p-1.5 shrink-0" title="Edit profile">
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      {/* Question */}
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">{question.category}</span>
          {state.phase === 'VOTING' && state.timerEndsAt && (
            <span
              id="audience-timer"
              className={`font-mono font-bold px-2 py-0.5 rounded-lg ${remaining <= 10 ? 'text-red-300 bg-red-500/15 animate-pulse' : 'text-amber-400'}`}
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
        <span className="font-semibold text-amber-300/90 uppercase tracking-wider">{showResults ? 'Crowd answer vs yours' : 'Rank: #1 = most popular'}</span>
        {showResults ? null : showEditor ? (
          <span className="text-slate-400">Drag ⠿ or tap ▲ ▼</span>
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

      {showResults ? (
        /* Results, flipping in as the host reveals each slot on stage */
        <div className="space-y-2.5">
          {answerKey.map((id, slot) => {
            if (!revealed.has(id)) {
              return (
                <div key={id} className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs bg-slate-800 text-amber-300 border border-slate-700 shrink-0">
                    #{slot + 1}
                  </span>
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 animate-pulse" /> Waiting for the stage reveal…
                  </span>
                </div>
              );
            }
            const mine = mySub ? mySub.rankedOptionIds.indexOf(id) : -1;
            const distance = mine < 0 ? -1 : Math.abs(mine - slot);
            const pts = distance < 0 ? 0 : closenessPoints(distance);
            return (
              <div
                key={id}
                className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                  distance === 0 ? 'bg-emerald-950/40 border-emerald-500/50' : pts > 0 ? 'bg-amber-950/30 border-amber-500/40' : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <span className="w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs bg-amber-400 text-slate-950 shrink-0">#{slot + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-100 leading-tight">{optionText(id)}</p>
                  {mySub && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{distance === 0 ? 'Spot on!' : `You had it at #${mine + 1}`}</p>
                  )}
                </div>
                {mySub && <span className={`text-xs font-bold shrink-0 ${pts > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>+{pts}</span>}
              </div>
            );
          })}
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 text-center">
            <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-1" />
            {mySub ? (
              <p className="text-sm text-amber-100">
                {allRevealed ? 'You scored ' : 'So far: '}
                <span id="audience-round-score" className="font-black text-amber-300">
                  {roundPoints} pts
                </span>
                {allRevealed ? ' this round!' : ' — more answers coming…'}
              </p>
            ) : (
              <p className="text-sm text-slate-300">You didn't vote this round — catch the next one!</p>
            )}
            <p className="text-[11px] text-slate-500 mt-1">Exact slot +20 • one off +10 • two off +5</p>
          </div>
        </div>
      ) : (
        <>
          {/* Ranking list */}
          <div className="space-y-2.5 relative">
            {displayOrder.map((id, index) => {
              const top = index === 0;
              const dragging = drag?.id === id;
              return (
                <div
                  key={id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(id, el);
                    else rowRefs.current.delete(id);
                  }}
                  style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-2 select-none ${
                    dragging ? 'relative z-10 scale-[1.02] shadow-2xl shadow-amber-500/30 border-amber-400 bg-slate-800' : 'transition-colors'
                  } ${
                    !dragging && top
                      ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10'
                      : !dragging
                        ? 'bg-slate-900/70 border-slate-800'
                        : ''
                  } ${showEditor ? '' : 'opacity-90'}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {showEditor ? (
                      <div
                        aria-label="Drag to reorder"
                        onPointerDown={(e) => onDragStart(e, id)}
                        onPointerMove={onDragMove}
                        onPointerUp={onDragEnd}
                        onPointerCancel={onDragEnd}
                        style={{ touchAction: 'none' }}
                        className="flex items-center gap-1 py-2 pr-1 -my-2 cursor-grab active:cursor-grabbing shrink-0"
                      >
                        <GripVertical className="w-5 h-5 text-slate-500" />
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs ${
                            top ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-amber-300 border border-slate-700'
                          }`}
                        >
                          #{index + 1}
                        </span>
                      </div>
                    ) : (
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                          top ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-amber-300 border border-slate-700'
                        }`}
                      >
                        #{index + 1}
                      </span>
                    )}
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
              <p className="text-xs text-slate-300">Watch the stage — you earn points as each answer is revealed.</p>
              {votingOpen && (
                <button
                  id="audience-edit"
                  onClick={() => {
                    applyOrder([...mySub.rankedOptionIds]);
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

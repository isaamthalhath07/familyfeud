/**
 * Every host action in one place, shared by the Admin panel and the (host-unlocked) Stage screen.
 *
 * Rules that keep the game consistent:
 *  - Points are earned per board slot as it is flipped, so scores grow with each reveal.
 *  - Flipping every slot ends the round (phase REVEALED); (re)opening VOTING hides the board.
 *  - The stage contestant for a round is frozen when its first slot is flipped.
 */
import { liveSync } from '../services/liveSync';
import { secondsLeft, serverNow } from './clock';
import type { Contestant, GamePhase, GameState, Question, SfxKind } from '../types/game';

const snap = () => liveSync.getSnapshot();

export function currentQuestionOf(state: GameState, questions: Question[]) {
  return questions.find((q) => q.id === state.currentQuestionId) ?? questions[0];
}

const currentQuestion = () => currentQuestionOf(snap().state, snap().questions);

export function revealedCount(state: GameState, questionId = state.currentQuestionId) {
  return (state.revealed[questionId] ?? []).length;
}

const stopTimer = (s: GameState): Partial<GameState> => (s.timerEndsAt ? { timerEndsAt: null, timerRemaining: secondsLeft(s) } : {});

const freezeContestant = (s: GameState, qid: string) => (s.stagePlayers[qid] ? s.stagePlayers : { ...s.stagePlayers, [qid]: s.stagePlayer });

function unfreezeContestant(s: GameState, qid: string) {
  const rest = { ...s.stagePlayers };
  delete rest[qid];
  return rest;
}

/** Board patch for a new set of flipped options on the current question. */
function withRevealed(s: GameState, q: Question, ids: string[]): Partial<GameState> {
  const qid = q.id;
  if (ids.length === 0) {
    return { revealed: { ...s.revealed, [qid]: [] }, stagePlayers: unfreezeContestant(s, qid), phase: s.phase === 'REVEALED' ? 'STAGE_GUESSING' : s.phase };
  }
  const all = q.options.every((o) => ids.includes(o.id));
  return {
    revealed: { ...s.revealed, [qid]: ids },
    stagePlayers: freezeContestant(s, qid),
    phase: all ? 'REVEALED' : 'STAGE_GUESSING',
    ...stopTimer(s),
  };
}

// ------------------------------------------------------------------ round flow

export function selectQuestion(questionId: string) {
  const q = snap().questions.find((x) => x.id === questionId);
  if (!q) return;
  liveSync.updateState((s) => {
    const r = s.revealed[q.id] ?? [];
    const all = q.options.every((o) => r.includes(o.id));
    return {
      currentQuestionId: q.id,
      phase: all ? 'REVEALED' : r.length > 0 ? 'STAGE_GUESSING' : 'VOTING',
      timerEndsAt: null,
      timerRemaining: s.timerDuration,
    };
  });
}

export function setPhase(phase: GamePhase) {
  const q = currentQuestion();
  liveSync.updateState((s) => {
    if (phase === 'VOTING') return { phase, revealed: { ...s.revealed, [q.id]: [] }, stagePlayers: unfreezeContestant(s, q.id) };
    if (phase === 'REVEALED') return withRevealed(s, q, q.options.map((o) => o.id));
    return { phase, ...stopTimer(s) };
  });
}

export function startTimer(duration: number) {
  const q = currentQuestion();
  liveSync.updateState((s) => ({
    phase: 'VOTING',
    timerDuration: duration,
    timerEndsAt: serverNow() + duration * 1000,
    timerRemaining: duration,
    revealed: { ...s.revealed, [q.id]: [] },
    stagePlayers: unfreezeContestant(s, q.id),
  }));
}

/** Pause a running timer, or resume (re-opening voting) a paused one. */
export function toggleTimer() {
  const q = currentQuestion();
  liveSync.updateState((s) => {
    if (s.timerEndsAt) return { timerEndsAt: null, timerRemaining: secondsLeft(s) };
    const left = s.timerRemaining > 0 ? s.timerRemaining : s.timerDuration;
    return {
      phase: 'VOTING',
      timerEndsAt: serverNow() + left * 1000,
      timerRemaining: left,
      revealed: { ...s.revealed, [q.id]: [] },
      stagePlayers: unfreezeContestant(s, q.id),
    };
  });
}

export function resetTimer() {
  liveSync.updateState((s) => ({ timerEndsAt: null, timerRemaining: s.timerDuration }));
}

/** Called by the Admin screen when the countdown reaches zero. */
export function lockVotingIfTimeUp() {
  const s = snap().state;
  if (s.phase === 'VOTING' && s.timerEndsAt && secondsLeft(s) === 0) {
    liveSync.updateState({ phase: 'LOCKED', timerEndsAt: null, timerRemaining: 0 });
  }
}

// ------------------------------------------------------------------ board reveals

export function toggleReveal(optionId: string) {
  const q = currentQuestion();
  liveSync.updateState((s) => {
    const cur = s.revealed[q.id] ?? [];
    return withRevealed(s, q, cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId]);
  });
}

/** Flips the highest-ranked hidden slot. `order` is the live board order. */
export function revealNext(order: string[]) {
  const q = currentQuestion();
  liveSync.updateState((s) => {
    const cur = s.revealed[q.id] ?? [];
    const next = order.find((id) => !cur.includes(id));
    return next ? withRevealed(s, q, [...cur, next]) : {};
  });
}

export const revealAll = () => setPhase('REVEALED');

export function hideAll() {
  const q = currentQuestion();
  liveSync.updateState((s) => withRevealed(s, q, []));
}

// ------------------------------------------------------------------ stage contestant

export function setContestant(c: Contestant) {
  liveSync.updateState((s) => {
    const qid = s.currentQuestionId;
    // Mid-round (board partly flipped) the change applies to this round too; after the round
    // is over the host is setting up the next contestant, so the finished round keeps its player.
    const fixCurrentRound = s.stagePlayers[qid] && s.phase !== 'REVEALED';
    return { stagePlayer: c, stagePlayers: fixCurrentRound ? { ...s.stagePlayers, [qid]: c } : s.stagePlayers };
  });
}

export function setStageGuess(order: string[]) {
  const q = currentQuestion();
  liveSync.updateState((s) => ({ stageGuesses: { ...s.stageGuesses, [q.id]: order } }));
}

// ------------------------------------------------------------------ players & points

export function adjustScore(key: string, delta: number) {
  if (!delta) return;
  liveSync.updateState((s) => ({ scoreAdjustments: { ...s.scoreAdjustments, [key]: (s.scoreAdjustments[key] ?? 0) + delta } }));
}

export function kickPlayer(userId: string, name: string) {
  liveSync.updateState((s) => ({ kicked: { ...s.kicked, [userId]: name } }));
  liveSync.removePlayerData(userId);
}

export function unkickPlayer(userId: string) {
  liveSync.updateState((s) => {
    const kicked = { ...s.kicked };
    delete kicked[userId];
    return { kicked };
  });
}

// ------------------------------------------------------------------ sound cues & questions

/** Plays a sound on the Stage screen, wherever the host is. */
export function cueSfx(kind: SfxKind) {
  liveSync.updateState({ sfx: { kind, id: serverNow() } });
}

export function setOverride(optionId: string, pct: number | undefined) {
  const q = currentQuestion();
  liveSync.setQuestions((qs) =>
    qs.map((x) => (x.id === q.id ? { ...x, options: x.options.map((o) => (o.id === optionId ? { ...o, manipulatedPercentage: pct } : o)) } : x)),
  );
}

export function clearOverrides() {
  const q = currentQuestion();
  liveSync.setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, options: x.options.map((o) => ({ ...o, manipulatedPercentage: undefined })) } : x)));
}

export function saveQuestion(question: Question) {
  liveSync.setQuestions((qs) => (qs.some((q) => q.id === question.id) ? qs.map((q) => (q.id === question.id ? question : q)) : [...qs, question]));
}

export function deleteQuestion(questionId: string) {
  const { questions, state } = snap();
  if (questions.length <= 1) return;
  liveSync.setQuestions((qs) => qs.filter((q) => q.id !== questionId));
  if (state.currentQuestionId === questionId) selectQuestion(snap().questions[0].id);
}

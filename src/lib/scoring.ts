import type { AnswerOption, Contestant, GameState, Player, Question, UserSubmission } from '../types/game';

/** Stage contestant: points for each slot he gets exactly right. */
export const POINTS_PER_CORRECT_SLOT = 20;
/** Audience: points per slot by how far their placement was from the crowd's — exact, 1 off, 2 off. */
export const CLOSENESS_POINTS = [20, 10, 5];

export const closenessPoints = (distance: number) => CLOSENESS_POINTS[distance] ?? 0;

export interface RankedOption {
  option: AnswerOption;
  rank: number; // 1-based
  pct: number; // what the stage board shows
  audiencePct: number | null; // real crowd consensus (null = no votes yet)
  firstPicks: number; // how many people put this option at #1
  overridden: boolean;
}

/** Rounds shares to whole percentages that still add up to exactly 100 (largest remainder). */
function toPercentages(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const result = exact.map(Math.floor);
  let left = 100 - result.reduce((a, b) => a + b, 0);
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .forEach(({ i }) => {
      if (left > 0) {
        result[i] += 1;
        left -= 1;
      }
    });
  return result;
}

/**
 * Crowd consensus via Borda count: with N options, rank #1 earns N points, #2 earns N-1 …
 * Board % = Admin override if set, else real audience %, else the preset fallback.
 */
export function computeRanking(question: Question, submissions: UserSubmission[]): RankedOption[] {
  const subs = submissions.filter((s) => s.questionId === question.id);
  const n = question.options.length;
  const points: Record<string, number> = {};
  const firsts: Record<string, number> = {};
  question.options.forEach((o) => {
    points[o.id] = 0;
    firsts[o.id] = 0;
  });
  subs.forEach((s) => {
    s.rankedOptionIds.forEach((id, idx) => {
      if (id in points) points[id] += Math.max(0, n - idx);
    });
    const top = s.rankedOptionIds[0];
    if (top in firsts) firsts[top] += 1;
  });
  const totalPoints = Object.values(points).reduce((a, b) => a + b, 0);
  const shares = toPercentages(question.options.map((o) => points[o.id]));

  const rows = question.options.map((option, index) => {
    const audiencePct = totalPoints > 0 ? shares[index] : null;
    const overridden = typeof option.manipulatedPercentage === 'number';
    const pct = overridden ? (option.manipulatedPercentage as number) : audiencePct ?? option.presetPercentage;
    return { option, index, pct, audiencePct, firstPicks: firsts[option.id], overridden, points: points[option.id] };
  });

  rows.sort((a, b) => b.pct - a.pct || b.points - a.points || a.index - b.index);
  return rows.map((r, i) => ({
    option: r.option,
    rank: i + 1,
    pct: r.pct,
    audiencePct: r.audiencePct,
    firstPicks: r.firstPicks,
    overridden: r.overridden,
  }));
}

export function finalOrder(question: Question, submissions: UserSubmission[]) {
  return computeRanking(question, submissions).map((r) => r.option.id);
}

export const revealedSet = (state: GameState, questionId: string) => new Set(state.revealed[questionId] ?? []);

/** Audience points for one question, counting only the board slots flipped so far. */
export function audienceRoundPoints(ranked: string[] | undefined, order: string[], revealed: Set<string>) {
  if (!ranked) return 0;
  return order.reduce((acc, id, slot) => {
    if (!revealed.has(id)) return acc;
    const mine = ranked.indexOf(id);
    return acc + (mine < 0 ? 0 : closenessPoints(Math.abs(mine - slot)));
  }, 0);
}

/** Stage contestant points for one question: 20 per exactly-right slot that has been flipped. */
export function stageRoundPoints(guess: string[] | undefined, order: string[], revealed: Set<string>) {
  if (!guess) return 0;
  return order.reduce((acc, id, slot) => acc + (revealed.has(id) && guess[slot] === id ? POINTS_PER_CORRECT_SLOT : 0), 0);
}

export const guestKey = (name: string) => 'guest:' + name.trim().toLowerCase();
/** Score key: audience member id, or a name-based key for a contestant who never joined on a phone. */
export const contestantKey = (c: Contestant) => c.userId || guestKey(c.name);

/** Who played the stage for a question (frozen once the board starts flipping). */
export function contestantFor(state: GameState, questionId: string): Contestant | undefined {
  return state.stagePlayers[questionId] ?? (questionId === state.currentQuestionId ? state.stagePlayer : undefined);
}

export interface ScoreRow {
  key: string;
  userId?: string;
  name: string;
  avatar: string;
  votePoints: number;
  stagePoints: number;
  adjustment: number;
  total: number;
  guest: boolean; // stage contestant who isn't in the audience list
}

export interface Scoreboard {
  rows: ScoreRow[]; // highest total first
  byKey: Map<string, ScoreRow>;
  orders: Map<string, string[]>; // questionId -> final board order
}

export function computeScoreboard(state: GameState, questions: Question[], submissions: UserSubmission[], players: Player[]): Scoreboard {
  const orders = new Map(questions.map((q) => [q.id, finalOrder(q, submissions)]));
  const byKey = new Map<string, ScoreRow>();
  const ensure = (key: string, init: Pick<ScoreRow, 'userId' | 'name' | 'avatar' | 'guest'>) => {
    let row = byKey.get(key);
    if (!row) {
      row = { key, ...init, votePoints: 0, stagePoints: 0, adjustment: 0, total: 0 };
      byKey.set(key, row);
    }
    return row;
  };

  players.forEach((p) => ensure(p.id, { userId: p.id, name: p.name, avatar: p.avatar, guest: false }));
  // Votes still count if a presence record went missing (e.g. a broker dropped it).
  submissions.forEach((s) => ensure(s.userId, { userId: s.userId, name: s.userName, avatar: s.avatar, guest: false }));

  const guestNames = new Map<string, string>();
  [state.stagePlayer, ...Object.values(state.stagePlayers)].forEach((c) => {
    if (c && !c.userId && c.name) guestNames.set(guestKey(c.name), c.name);
  });
  const ensureContestant = (c: Contestant) =>
    c.userId
      ? ensure(c.userId, { userId: c.userId, name: c.name, avatar: '🎤', guest: false })
      : ensure(guestKey(c.name), { name: c.name, avatar: '🎤', guest: true });

  questions.forEach((q) => {
    const revealed = revealedSet(state, q.id);
    if (revealed.size === 0) return;
    const order = orders.get(q.id) ?? [];
    submissions.forEach((s) => {
      if (s.questionId === q.id) ensure(s.userId, { userId: s.userId, name: s.userName, avatar: s.avatar, guest: false }).votePoints += audienceRoundPoints(s.rankedOptionIds, order, revealed);
    });
    const who = contestantFor(state, q.id);
    const guess = state.stageGuesses[q.id];
    if (who && guess && guess.length > 0 && !(who.userId && state.kicked[who.userId])) {
      ensureContestant(who).stagePoints += stageRoundPoints(guess, order, revealed);
    }
  });

  Object.entries(state.scoreAdjustments).forEach(([key, adj]) => {
    if (!adj || state.kicked[key]) return;
    const row = byKey.get(key) ?? (key.startsWith('guest:') ? ensure(key, { name: guestNames.get(key) ?? key.slice(6), avatar: '🎤', guest: true }) : undefined);
    if (row) row.adjustment += adj;
  });

  byKey.forEach((row) => {
    row.total = row.votePoints + row.stagePoints + row.adjustment;
  });
  const rows = Array.from(byKey.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { rows, byKey, orders };
}

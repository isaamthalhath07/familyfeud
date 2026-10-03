import type { AnswerOption, GameState, Question, UserSubmission } from '../types/game';

export const POINTS_PER_CORRECT_SLOT = 20;

export interface RankedOption {
  option: AnswerOption;
  rank: number; // 1-based
  pct: number; // what the stage board shows
  audiencePct: number | null; // real crowd consensus (null = no votes yet)
  firstPicks: number; // how many people put this option at #1
  overridden: boolean;
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
      if (id in points) points[id] += n - idx;
    });
    const top = s.rankedOptionIds[0];
    if (top in firsts) firsts[top] += 1;
  });
  const total = Object.values(points).reduce((a, b) => a + b, 0);

  const rows = question.options.map((option, index) => {
    const audiencePct = total > 0 ? Math.round((points[option.id] / total) * 100) : null;
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

/** Points for a guessed order: 20 per option placed in exactly the right slot. */
export function scoreGuess(guess: string[] | undefined, order: string[]) {
  if (!guess) return 0;
  return order.reduce((acc, id, i) => acc + (guess[i] === id ? POINTS_PER_CORRECT_SLOT : 0), 0);
}

function finishedQuestions(state: GameState, questions: Question[]) {
  return questions.filter((q) => state.finishedQuestionIds.includes(q.id));
}

export function audienceScore(userId: string, state: GameState, questions: Question[], submissions: UserSubmission[]) {
  return finishedQuestions(state, questions).reduce((acc, q) => {
    const mine = submissions.find((s) => s.userId === userId && s.questionId === q.id);
    return acc + scoreGuess(mine?.rankedOptionIds, finalOrder(q, submissions));
  }, 0);
}

export function stageScore(state: GameState, questions: Question[], submissions: UserSubmission[]) {
  return finishedQuestions(state, questions).reduce(
    (acc, q) => acc + scoreGuess(state.stageGuesses[q.id], finalOrder(q, submissions)),
    0,
  );
}

export interface LeaderRow {
  userId: string;
  name: string;
  avatar: string;
  score: number;
}

export function leaderboard(state: GameState, questions: Question[], submissions: UserSubmission[]): LeaderRow[] {
  const users = new Map<string, LeaderRow>();
  submissions.forEach((s) => {
    if (!users.has(s.userId)) users.set(s.userId, { userId: s.userId, name: s.userName, avatar: s.avatar, score: 0 });
  });
  users.forEach((row) => {
    row.score = audienceScore(row.userId, state, questions, submissions);
  });
  return Array.from(users.values()).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

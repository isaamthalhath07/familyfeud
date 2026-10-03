export interface AnswerOption {
  id: string;
  text: string;
  presetPercentage: number; // Fallback % used only when nobody has voted yet
  manipulatedPercentage?: number; // Admin "God Mode" override (wins over real votes)
  presetPoints: number;
}

export interface Question {
  id: string;
  title: string;
  category: string;
  options: AnswerOption[];
  darkHumorTrivia?: string;
  bapuCommentary?: string;
}

export type GamePhase = 'VOTING' | 'LOCKED' | 'STAGE_GUESSING' | 'REVEALED';

export interface GameState {
  currentQuestionId: string;
  phase: GamePhase;

  // Timer — clients compute remaining time locally from timerEndsAt
  timerDuration: number; // seconds per round (admin configurable)
  timerEndsAt: number | null; // epoch ms when running, null when paused/stopped
  timerRemaining: number; // seconds left while paused

  stagePlayerName: string;
  stageGuesses: Record<string, string[]>; // questionId -> option ids in the order the stage guy guessed
  revealedOptionIds: string[]; // option ids flipped on the stage board (current question)
  finishedQuestionIds: string[]; // questions that reached REVEALED (count toward scores)
  roomCode: string;
}

export interface UserSubmission {
  userId: string;
  userName: string;
  avatar: string;
  questionId: string;
  rankedOptionIds: string[]; // index 0 = predicted most popular
  submittedAt: number;
}

export interface AudienceMember {
  id: string;
  name: string;
  avatar: string;
  badge: string;
}

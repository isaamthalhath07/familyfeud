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

/** The person called up on stage. Linked to an audience member when picked from the room. */
export interface Contestant {
  name: string;
  userId?: string;
}

export type SfxKind = 'ding' | 'buzzer' | 'drumroll' | 'victory' | 'flip';

export interface GameState {
  currentQuestionId: string;
  phase: GamePhase;

  // Timer — clients compute remaining time locally from timerEndsAt (server-corrected clock)
  timerDuration: number; // seconds per round (admin configurable)
  timerEndsAt: number | null; // epoch ms when running, null when paused/stopped
  timerRemaining: number; // seconds left while paused

  stagePlayer: Contestant; // current stage contestant
  stagePlayers: Record<string, Contestant>; // questionId -> contestant who played that round
  stageGuesses: Record<string, string[]>; // questionId -> option ids in the order the contestant ranked them
  revealed: Record<string, string[]>; // questionId -> option ids flipped on the stage board

  scoreAdjustments: Record<string, number>; // score key (userId or guest key) -> manual +/- points from the host
  kicked: Record<string, string>; // userId -> name of players removed from the room

  sfx: { kind: SfxKind; id: number } | null; // sound cue the host fires on the stage screen
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

/** Presence record every audience phone publishes when it joins the room. */
export interface Player extends AudienceMember {
  joinedAt: number;
}

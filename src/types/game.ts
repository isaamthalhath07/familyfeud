export interface AnswerOption {
  id: string;
  text: string;
  presetPercentage: number; // Original default percentage
  manipulatedPercentage?: number; // Override percentage by Admin (God mode)
  presetPoints: number;
  revealed?: boolean;
}

export interface Question {
  id: string;
  title: string;
  category: 'Gandhi Special' | 'Indian Parivar' | 'Dark Satire' | 'Historical Twist';
  options: AnswerOption[];
  darkHumorTrivia?: string;
  bapuCommentary?: string;
}

export type GamePhase = 'LOBBY' | 'VOTING' | 'LOCKED' | 'STAGE_GUESSING' | 'REVEALED';

export interface GameState {
  currentQuestionId: string;
  phase: GamePhase;
  timerSeconds: number;
  isTimerRunning: boolean;
  stagePlayerName: string;
  stagePlayerScore: number;
  revealedOptionIds: string[]; // Options revealed on Stage Board
  godModeEnabled: boolean;
  customOptionOrder?: string[]; // Admin forced ranking order of option IDs
  roomCode: string;
  updatedAt: number;
}

export interface UserSubmission {
  userId: string;
  userName: string;
  questionId: string;
  rankedOptionIds: string[]; // 1st place to 5th place
  scoreGained: number;
  submittedAt: number;
}

export interface AudienceMember {
  id: string;
  name: string;
  totalScore: number;
  streak: number;
  avatar: string;
  badge: string;
}

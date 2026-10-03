import { GameState, Question, UserSubmission, AudienceMember } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';

const CHANNEL_NAME = 'PARIVAR_FEUD_LIVE_SYNC';
const STORAGE_KEYS = {
  GAME_STATE: 'PARIVAR_FEUD_STATE_V1',
  QUESTIONS: 'PARIVAR_FEUD_QUESTIONS_V1',
  SUBMISSIONS: 'PARIVAR_FEUD_SUBMISSIONS_V1',
  AUDIENCE: 'PARIVAR_FEUD_AUDIENCE_V1',
};

// Global High-Speed Cloud Sync Object IDs
const CLOUD_ENDPOINTS = {
  GAME_STATE: 'https://api.restful-api.dev/objects/ff808181a09d98f701a103c6ca7f6f37',
  QUESTIONS: 'https://api.restful-api.dev/objects/ff808181a09d98f701a103c715496f38',
  SUBMISSIONS: 'https://api.restful-api.dev/objects/ff808181a09d98f701a103c715516f39',
};

const defaultInitialState: GameState = {
  currentQuestionId: DEFAULT_QUESTIONS[0].id,
  phase: 'VOTING',
  timerSeconds: 60,
  isTimerRunning: false,
  stagePlayerName: 'Rahul (Stage Guy)',
  stagePlayerScore: 0,
  revealedOptionIds: [],
  godModeEnabled: false,
  roomCode: 'FEUD2026',
  updatedAt: Date.now(),
};

class LiveSyncService {
  private channel: BroadcastChannel | null = null;
  private stateListeners: Set<(state: GameState) => void> = new Set();
  private submissionListeners: Set<(subs: UserSubmission[]) => void> = new Set();
  private questionsListeners: Set<(qs: Question[]) => void> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 1. Same-device BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        const { type, data } = event.data || {};
        this.handleIncomingData(type, data);
      };
    }

    // 2. Same-device LocalStorage listener
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.GAME_STATE && e.newValue) {
          this.notifyStateListeners(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.SUBMISSIONS && e.newValue) {
          this.notifySubmissionListeners(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.QUESTIONS && e.newValue) {
          this.notifyQuestionsListeners(JSON.parse(e.newValue));
        }
      });
    }

    // 3. Start high-frequency Cloud REST polling (500ms) for cross-device instant sync
    this.startCloudPolling();
  }

  private startCloudPolling() {
    if (typeof window === 'undefined') return;

    this.pollInterval = setInterval(() => {
      this.fetchCloudGameState();
    }, 600);
  }

  private async fetchCloudGameState() {
    try {
      const res = await fetch(CLOUD_ENDPOINTS.GAME_STATE, { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json();
      if (body && body.data) {
        const cloudState = body.data as GameState;
        const currentLocal = this.getGameState();
        
        if (!currentLocal || cloudState.updatedAt > (currentLocal.updatedAt || 0)) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(cloudState));
          }
          this.notifyStateListeners(cloudState);
        }
      }
    } catch {
      // Network drop fallback
    }
  }

  private async pushCloudGameState(state: GameState) {
    try {
      await fetch(CLOUD_ENDPOINTS.GAME_STATE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'GameState',
          data: state,
        }),
      });
    } catch {
      // Push error fallback
    }
  }

  private async pushCloudQuestions(questions: Question[]) {
    try {
      await fetch(CLOUD_ENDPOINTS.QUESTIONS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'QuestionsState',
          data: questions,
        }),
      });
    } catch {}
  }

  private async pushCloudSubmissions(subs: UserSubmission[]) {
    try {
      await fetch(CLOUD_ENDPOINTS.SUBMISSIONS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'SubmissionsState',
          data: subs,
        }),
      });
    } catch {}
  }

  private handleIncomingData(type: string, data: any) {
    if (!data) return;
    if (type === 'GAME_STATE_UPDATE') {
      const current = this.getGameState();
      if (!current || data.updatedAt > (current.updatedAt || 0)) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(data));
        }
        this.notifyStateListeners(data);
      }
    } else if (type === 'SUBMISSIONS_UPDATE') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(data));
      }
      this.notifySubmissionListeners(data);
    } else if (type === 'QUESTIONS_UPDATE') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(data));
      }
      this.notifyQuestionsListeners(data);
    }
  }

  // --- GAME STATE ---
  getGameState(): GameState {
    if (typeof localStorage === 'undefined') return defaultInitialState;
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (!raw) {
      this.saveGameState(defaultInitialState);
      return defaultInitialState;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return defaultInitialState;
    }
  }

  saveGameState(state: GameState) {
    const updated = { ...state, updatedAt: Date.now() };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(updated));
    }
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'GAME_STATE_UPDATE', data: updated });
      } catch {}
    }
    this.notifyStateListeners(updated);

    // Push to global cloud KV store instantly
    this.pushCloudGameState(updated);
  }

  subscribeGameState(callback: (state: GameState) => void): () => void {
    this.stateListeners.add(callback);
    callback(this.getGameState());
    return () => this.stateListeners.delete(callback);
  }

  private notifyStateListeners(state: GameState) {
    this.stateListeners.forEach((cb) => cb(state));
  }

  // --- QUESTIONS ---
  getQuestions(): Question[] {
    if (typeof localStorage === 'undefined') return DEFAULT_QUESTIONS;
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    if (!raw) {
      this.saveQuestions(DEFAULT_QUESTIONS);
      return DEFAULT_QUESTIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_QUESTIONS;
    }
  }

  saveQuestions(questions: Question[]) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    }
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'QUESTIONS_UPDATE', data: questions });
      } catch {}
    }
    this.notifyQuestionsListeners(questions);
    this.pushCloudQuestions(questions);
  }

  subscribeQuestions(callback: (qs: Question[]) => void): () => void {
    this.questionsListeners.add(callback);
    callback(this.getQuestions());
    return () => this.questionsListeners.delete(callback);
  }

  private notifyQuestionsListeners(qs: Question[]) {
    this.questionsListeners.forEach((cb) => cb(qs));
  }

  // --- USER SUBMISSIONS ---
  getSubmissions(): UserSubmission[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  addSubmission(sub: UserSubmission) {
    const list = this.getSubmissions();
    const filtered = list.filter((s) => !(s.userId === sub.userId && s.questionId === sub.questionId));
    filtered.push(sub);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(filtered));
    }
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'SUBMISSIONS_UPDATE', data: filtered });
      } catch {}
    }
    this.notifySubmissionListeners(filtered);
    this.pushCloudSubmissions(filtered);
  }

  subscribeSubmissions(callback: (subs: UserSubmission[]) => void): () => void {
    this.submissionListeners.add(callback);
    callback(this.getSubmissions());
    return () => this.submissionListeners.delete(callback);
  }

  private notifySubmissionListeners(subs: UserSubmission[]) {
    this.submissionListeners.forEach((cb) => cb(subs));
  }

  // --- AUDIENCE MEMBERS ---
  getAudienceMembers(): AudienceMember[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIENCE);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveAudienceMember(member: AudienceMember) {
    const list = this.getAudienceMembers();
    const index = list.findIndex((m) => m.id === member.id);
    if (index >= 0) {
      list[index] = member;
    } else {
      list.push(member);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.AUDIENCE, JSON.stringify(list));
    }
  }
}

export const liveSync = new LiveSyncService();

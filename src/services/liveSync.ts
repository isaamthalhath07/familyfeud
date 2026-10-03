import { GameState, Question, UserSubmission, AudienceMember } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';
import { Peer, DataConnection } from 'peerjs';

const CHANNEL_NAME = 'PARIVAR_FEUD_LIVE_SYNC';
const STORAGE_KEYS = {
  GAME_STATE: 'PARIVAR_FEUD_STATE_V1',
  QUESTIONS: 'PARIVAR_FEUD_QUESTIONS_V1',
  SUBMISSIONS: 'PARIVAR_FEUD_SUBMISSIONS_V1',
  AUDIENCE: 'PARIVAR_FEUD_AUDIENCE_V1',
};

// Public WebSocket relays for zero-config cross-device internet sync
const WS_RELAYS = [
  'wss://socketsbay.com/wss/v2/1/demo/',
  'wss://free.websocket.org',
];

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

  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private ws: WebSocket | null = null;
  private roomPeerId = 'parivar-feud-host-feud2026';

  constructor() {
    // 1. Same-device BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        const { type, data } = event.data || {};
        this.handleIncomingMessage(type, data);
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

    // 3. Cross-Device Public WebSocket Mesh
    this.initWebSocketRelay();

    // 4. Cross-Device PeerJS WebRTC Channel
    this.initPeerJS();
  }

  private handleIncomingMessage(type: string, data: any) {
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

  // Cross-device WebSocket Relay setup
  private initWebSocketRelay() {
    if (typeof window === 'undefined') return;
    try {
      this.ws = new WebSocket(WS_RELAYS[0]);
      
      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.room === defaultInitialState.roomCode) {
            this.handleIncomingMessage(payload.type, payload.data);
          }
        } catch {
          // ignore non-json messages
        }
      };

      this.ws.onerror = () => {
        // Fallback reconnection after 3 seconds
        setTimeout(() => this.initWebSocketRelay(), 3000);
      };
    } catch {
      // SILENT FALLBACK
    }
  }

  // Cross-device PeerJS WebRTC mesh setup
  private initPeerJS() {
    if (typeof window === 'undefined') return;

    try {
      // Generate a deterministic or random peer id
      const randomId = 'p_' + Math.random().toString(36).substring(2, 9);
      this.peer = new Peer(randomId, {
        debug: 0,
      });

      this.peer.on('open', () => {
        // Connect to host peer
        this.connectToHostPeer();
      });

      this.peer.on('connection', (conn) => {
        this.connections.set(conn.peer, conn);
        conn.on('data', (data: any) => {
          if (data && data.type) {
            this.handleIncomingMessage(data.type, data.data);
          }
        });
        conn.on('close', () => this.connections.delete(conn.peer));

        // Immediately send current game state to newly connected client
        conn.send({ type: 'GAME_STATE_UPDATE', data: this.getGameState() });
        conn.send({ type: 'QUESTIONS_UPDATE', data: this.getQuestions() });
        conn.send({ type: 'SUBMISSIONS_UPDATE', data: this.getSubmissions() });
      });

    } catch {
      // PeerJS init fallback
    }
  }

  private connectToHostPeer() {
    if (!this.peer) return;
    try {
      const conn = this.peer.connect(this.roomPeerId);
      conn.on('open', () => {
        this.connections.set(this.roomPeerId, conn);
      });
      conn.on('data', (data: any) => {
        if (data && data.type) {
          this.handleIncomingMessage(data.type, data.data);
        }
      });
    } catch {
      // silent catch
    }
  }

  private broadcastToAll(type: string, data: any) {
    const payload = { room: defaultInitialState.roomCode, type, data };

    // 1. BroadcastChannel (same browser tabs)
    if (this.channel) {
      try {
        this.channel.postMessage({ type, data });
      } catch {}
    }

    // 2. WebSocket Relay (cross-device public internet)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {}
    }

    // 3. PeerJS Connections (WebRTC P2P mesh)
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({ type, data });
        } catch {}
      }
    });
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
    this.broadcastToAll('GAME_STATE_UPDATE', updated);
    this.notifyStateListeners(updated);
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
    this.broadcastToAll('QUESTIONS_UPDATE', questions);
    this.notifyQuestionsListeners(questions);
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
    this.broadcastToAll('SUBMISSIONS_UPDATE', filtered);
    this.notifySubmissionListeners(filtered);
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

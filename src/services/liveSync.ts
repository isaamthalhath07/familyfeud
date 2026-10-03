/**
 * Real-time cross-device sync for Parivar Feud.
 *
 * Transport: MQTT over secure WebSockets, connected to several free public brokers at once
 * (redundancy — if one broker is down or blocked by venue Wi-Fi, the others still work).
 *
 * Data model: every piece of shared data is one *retained* MQTT topic holding a record
 *   { rev, by, data }
 *  - "retained" means the broker keeps the latest value, so a phone that joins late
 *    instantly receives the current question / phase / votes.
 *  - `rev` only ever increases. Receivers keep the highest rev per topic, so an old or
 *    duplicate message (e.g. from a second broker) can never overwrite newer data.
 *  - data === null is a tombstone (used to clear votes).
 *
 * Audience devices NEVER write game state — only Admin and Stage do. That was the root
 * cause of the old bug where every new phone reset the game to defaults.
 */
import mqtt from 'mqtt';
import type { GameState, Question, UserSubmission } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';

const NAMESPACE = 'parivarfeud/live-v2-k7q9x3m2';
const TOPIC_STATE = `${NAMESPACE}/state`;
const TOPIC_QUESTIONS = `${NAMESPACE}/questions`;
const SUBS_PREFIX = `${NAMESPACE}/subs/`;

const BROKERS: { url: string; username?: string; password?: string }[] = [
  { url: 'wss://broker.emqx.io:8084/mqtt' },
  { url: 'wss://broker.hivemq.com:8884/mqtt' },
  { url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' }, // port 443 — passes strict venue firewalls
];

const ADMIN_CACHE_KEY = 'PARIVAR_FEUD_ADMIN_CACHE_V2';

export const DEFAULT_STATE: GameState = {
  currentQuestionId: DEFAULT_QUESTIONS[0].id,
  phase: 'VOTING',
  timerDuration: 60,
  timerEndsAt: null,
  timerRemaining: 60,
  stagePlayerName: 'Stage Contestant',
  stageGuesses: {},
  revealedOptionIds: [],
  finishedQuestionIds: [],
  roomCode: 'FEUD2026',
};

interface SyncRecord<T = unknown> {
  rev: number;
  by: string;
  data: T | null;
}

export interface LiveSnapshot {
  state: GameState;
  questions: Question[];
  submissions: UserSubmission[];
  connectedBrokers: number;
  totalBrokers: number;
  synced: boolean; // true once we've received (or confirmed absence of) the live state
}

type Patch<T> = Partial<T> | ((current: T) => Partial<T>);

class LiveSyncService {
  private clientId = 'pf_' + Math.random().toString(36).slice(2, 10);
  private records = new Map<string, SyncRecord>();
  private clients: ReturnType<typeof mqtt.connect>[] = [];
  private connected = new Set<number>();
  private synced = false;
  private listeners = new Set<() => void>();
  private snapshot: LiveSnapshot;
  private adminMode = false;
  private healTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.snapshot = this.buildSnapshot();
    if (typeof window !== 'undefined') {
      BROKERS.forEach((b, i) => this.connectBroker(b, i));
    }
  }

  // ---------------------------------------------------------------- transport

  private connectBroker(b: (typeof BROKERS)[number], index: number) {
    const client = mqtt.connect(b.url, {
      clientId: `${this.clientId}_${index}`,
      username: b.username,
      password: b.password,
      clean: true,
      keepalive: 30,
      reconnectPeriod: 2000,
      connectTimeout: 10_000,
      protocolVersion: 4,
    });
    this.clients[index] = client;

    client.on('connect', () => {
      this.connected.add(index);
      client.subscribe([TOPIC_STATE, TOPIC_QUESTIONS, `${SUBS_PREFIX}#`], { qos: 1 }, (err) => {
        if (err) return;
        // Retained messages arrive right after SUBACK. If nothing arrives, no game has been
        // started yet — defaults are correct.
        setTimeout(() => this.markSynced(), 1500);
        if (this.adminMode) setTimeout(() => this.republish(client, true), 3000);
      });
      this.emit();
    });

    const onDown = () => {
      if (this.connected.delete(index)) this.emit();
    };
    client.on('close', onDown);
    client.on('offline', onDown);
    client.on('error', () => {
      /* mqtt.js auto-reconnects */
    });

    client.on('message', (topic, payload) => this.receive(topic, payload));
  }

  private receive(topic: string, payload: Uint8Array) {
    if (!payload || payload.length === 0) return;
    let rec: SyncRecord;
    try {
      rec = JSON.parse(new TextDecoder().decode(payload));
    } catch {
      return;
    }
    if (!rec || typeof rec.rev !== 'number') return;

    const prev = this.records.get(topic);
    const newer = !prev || rec.rev > prev.rev || (rec.rev === prev.rev && String(rec.by) > String(prev.by));
    if (!newer) return;

    this.records.set(topic, rec);
    if (topic === TOPIC_STATE) this.synced = true;
    this.emit();
  }

  private publish(topic: string, rec: SyncRecord, only?: ReturnType<typeof mqtt.connect>) {
    const msg = JSON.stringify(rec);
    (only ? [only] : this.clients).forEach((c) => {
      try {
        // QoS 1 messages are queued by mqtt.js while offline and flushed on reconnect.
        c.publish(topic, msg, { qos: 1, retain: true });
      } catch {
        /* ignore */
      }
    });
  }

  private write<T>(topic: string, data: T | null) {
    const prev = this.records.get(topic);
    // Monotonic: never lower than anything we've seen for this topic.
    const rev = Math.max(Date.now(), (prev?.rev ?? 0) + 1);
    const rec: SyncRecord<T> = { rev, by: this.clientId, data };
    this.records.set(topic, rec);
    this.emit();
    this.publish(topic, rec);
  }

  private markSynced() {
    if (!this.synced) {
      this.synced = true;
      this.emit();
    }
  }

  // ---------------------------------------------------------------- admin self-healing

  /** Admin keeps the brokers' retained data fresh (in case a public broker restarts mid-event). */
  enableAdminMode() {
    if (this.adminMode || typeof window === 'undefined') return;
    this.adminMode = true;

    // Restore last known state/questions from this browser (merged by rev, so never regresses).
    try {
      const cache = JSON.parse(localStorage.getItem(ADMIN_CACHE_KEY) || '{}') as Record<string, SyncRecord>;
      Object.entries(cache).forEach(([topic, rec]) => {
        const prev = this.records.get(topic);
        if (rec && typeof rec.rev === 'number' && (!prev || rec.rev > prev.rev)) this.records.set(topic, rec);
      });
      this.emit();
    } catch {
      /* ignore */
    }

    this.clients.forEach((c, i) => {
      if (this.connected.has(i)) setTimeout(() => this.republish(c, true), 3000);
    });
    this.healTimer = setInterval(() => this.clients.forEach((c, i) => this.connected.has(i) && this.republish(c, false)), 60_000);
  }

  private republish(client: ReturnType<typeof mqtt.connect>, includeVotes: boolean) {
    this.records.forEach((rec, topic) => {
      if (!includeVotes && topic.startsWith(SUBS_PREFIX)) return;
      this.publish(topic, rec, client);
    });
  }

  private cacheForAdmin() {
    if (!this.adminMode) return;
    try {
      const cache: Record<string, SyncRecord> = {};
      [TOPIC_STATE, TOPIC_QUESTIONS].forEach((t) => {
        const r = this.records.get(t);
        if (r) cache[t] = r;
      });
      localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------- store API (React)

  private buildSnapshot(): LiveSnapshot {
    const stateRec = this.records.get(TOPIC_STATE)?.data as Partial<GameState> | null | undefined;
    const qRec = this.records.get(TOPIC_QUESTIONS)?.data as Question[] | null | undefined;
    const submissions: UserSubmission[] = [];
    this.records.forEach((rec, topic) => {
      if (topic.startsWith(SUBS_PREFIX) && rec.data) submissions.push(rec.data as UserSubmission);
    });
    const questions = Array.isArray(qRec) && qRec.length > 0 ? qRec : DEFAULT_QUESTIONS;
    return {
      state: { ...DEFAULT_STATE, ...(stateRec || {}) },
      questions,
      submissions,
      connectedBrokers: this.connected.size,
      totalBrokers: BROKERS.length,
      synced: this.synced,
    };
  }

  private emit() {
    this.snapshot = this.buildSnapshot();
    this.cacheForAdmin();
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  // ---------------------------------------------------------------- game actions

  updateState(patch: Patch<GameState>) {
    const current = this.snapshot.state;
    const changes = typeof patch === 'function' ? patch(current) : patch;
    this.write<GameState>(TOPIC_STATE, { ...current, ...changes });
  }

  setQuestions(next: Question[] | ((current: Question[]) => Question[])) {
    const value = typeof next === 'function' ? next(this.snapshot.questions) : next;
    this.write<Question[]>(TOPIC_QUESTIONS, value);
  }

  submitRanking(sub: UserSubmission) {
    this.write<UserSubmission>(`${SUBS_PREFIX}${sub.questionId}/${sub.userId}`, sub);
  }

  /** Clears votes for one question (or every question when questionId is omitted). */
  clearSubmissions(questionId?: string) {
    const prefix = questionId ? `${SUBS_PREFIX}${questionId}/` : SUBS_PREFIX;
    Array.from(this.records.entries()).forEach(([topic, rec]) => {
      if (topic.startsWith(prefix) && rec.data) this.write(topic, null);
    });
  }

  resetGame() {
    this.clearSubmissions();
    const s = this.snapshot.state;
    this.write<GameState>(TOPIC_STATE, {
      ...DEFAULT_STATE,
      currentQuestionId: this.snapshot.questions[0]?.id ?? DEFAULT_STATE.currentQuestionId,
      stagePlayerName: s.stagePlayerName,
      timerDuration: s.timerDuration,
      timerRemaining: s.timerDuration,
      roomCode: s.roomCode,
    });
  }
}

export const liveSync = new LiveSyncService();

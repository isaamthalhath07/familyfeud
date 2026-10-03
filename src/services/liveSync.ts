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
 *  - data === null is a tombstone (used to clear votes and kicked players).
 *
 * Audience devices only ever write their own vote and presence records — never game state.
 */
import mqtt from 'mqtt';
import type { GameState, Player, Question, UserSubmission } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';
import { serverNow, syncClock } from '../lib/clock';

// Override with VITE_SYNC_NAMESPACE (e.g. in .env.e2e.local) to test without touching the live event.
const NAMESPACE: string = import.meta.env.VITE_SYNC_NAMESPACE || 'parivarfeud/live-v3-k7q9x3m2';
const TOPIC_STATE = `${NAMESPACE}/state`;
const TOPIC_QUESTIONS = `${NAMESPACE}/questions`;
const SUBS_PREFIX = `${NAMESPACE}/subs/`;
const PLAYERS_PREFIX = `${NAMESPACE}/players/`;

const BROKERS: { url: string; username?: string; password?: string }[] = [
  { url: 'wss://broker.emqx.io:8084/mqtt' },
  { url: 'wss://broker.hivemq.com:8884/mqtt' },
  { url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' }, // port 443 — passes strict venue firewalls
];

const ADMIN_CACHE_KEY = `PARIVAR_FEUD_ADMIN_CACHE_V3:${NAMESPACE}`;

// Rapid writes (e.g. dragging a God Mode slider) are coalesced so public brokers don't rate-limit us.
const PUBLISH_INTERVAL_MS = 150;

export const DEFAULT_STATE: GameState = {
  currentQuestionId: DEFAULT_QUESTIONS[0].id,
  phase: 'VOTING',
  timerDuration: 60,
  timerEndsAt: null,
  timerRemaining: 60,
  stagePlayer: { name: 'Stage Contestant' },
  stagePlayers: {},
  stageGuesses: {},
  revealed: {},
  scoreAdjustments: {},
  kicked: {},
  sfx: null,
  roomCode: 'FEUD2026',
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Fills in anything missing/malformed so the UI never crashes on partial data. */
function normalizeState(raw: unknown): GameState {
  const s = (isRecord(raw) ? raw : {}) as Partial<GameState>;
  return {
    ...DEFAULT_STATE,
    ...s,
    stagePlayer: isRecord(s.stagePlayer) && typeof s.stagePlayer.name === 'string' ? s.stagePlayer : DEFAULT_STATE.stagePlayer,
    stagePlayers: isRecord(s.stagePlayers) ? s.stagePlayers : {},
    stageGuesses: isRecord(s.stageGuesses) ? s.stageGuesses : {},
    revealed: isRecord(s.revealed) ? s.revealed : {},
    scoreAdjustments: isRecord(s.scoreAdjustments) ? s.scoreAdjustments : {},
    kicked: isRecord(s.kicked) ? s.kicked : {},
  };
}

const isValidQuestions = (v: unknown): v is Question[] =>
  Array.isArray(v) && v.length > 0 && v.every((q) => isRecord(q) && typeof q.id === 'string' && Array.isArray(q.options) && q.options.length > 0);

interface SyncRecord<T = unknown> {
  rev: number;
  by: string;
  data: T | null;
}

export interface LiveSnapshot {
  state: GameState;
  questions: Question[];
  submissions: UserSubmission[]; // kicked players' votes are excluded
  players: Player[]; // everyone who joined (minus kicked), oldest first
  connectedBrokers: number;
  totalBrokers: number;
  synced: boolean; // true once we've received (or confirmed absence of) the live state
}

type Patch<T> = Partial<T> | ((current: T) => Partial<T>);
type Client = ReturnType<typeof mqtt.connect>;

class LiveSyncService {
  private clientId = 'pf_' + Math.random().toString(36).slice(2, 10);
  private records = new Map<string, SyncRecord>();
  private clients: Client[] = [];
  private connected = new Set<number>();
  private synced = false;
  private listeners = new Set<() => void>();
  private snapshot: LiveSnapshot;
  private adminMode = false;
  private lastPublish = new Map<string, number>();
  private pendingPublish = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.snapshot = this.buildSnapshot();
    if (typeof window !== 'undefined') {
      void syncClock();
      BROKERS.forEach((b, i) => this.connectBroker(b, i));
      // Don't lose a throttled write if the tab is closed right after a click.
      window.addEventListener('pagehide', () => this.flushPublishes());
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
      client.subscribe([TOPIC_STATE, TOPIC_QUESTIONS, `${SUBS_PREFIX}#`, `${PLAYERS_PREFIX}#`], { qos: 1 }, (err) => {
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

  private publish(topic: string, rec: SyncRecord, only?: Client) {
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

  /** Publishes the latest record for a topic, at most once per PUBLISH_INTERVAL_MS. */
  private schedulePublish(topic: string) {
    if (this.pendingPublish.has(topic)) return; // a trailing publish will send the latest record
    const send = () => {
      this.pendingPublish.delete(topic);
      this.lastPublish.set(topic, Date.now());
      const rec = this.records.get(topic);
      if (rec) this.publish(topic, rec);
    };
    const wait = PUBLISH_INTERVAL_MS - (Date.now() - (this.lastPublish.get(topic) ?? 0));
    if (wait <= 0) send();
    else this.pendingPublish.set(topic, setTimeout(send, wait));
  }

  private flushPublishes() {
    this.pendingPublish.forEach((timer, topic) => {
      clearTimeout(timer);
      this.pendingPublish.delete(topic);
      const rec = this.records.get(topic);
      if (rec) this.publish(topic, rec);
    });
  }

  private write<T>(topic: string, data: T | null) {
    const prev = this.records.get(topic);
    // Monotonic: never lower than anything we've seen for this topic.
    const rev = Math.max(serverNow(), (prev?.rev ?? 0) + 1);
    const rec: SyncRecord<T> = { rev, by: this.clientId, data };
    this.records.set(topic, rec);
    this.emit();
    this.schedulePublish(topic);
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
    setInterval(() => this.clients.forEach((c, i) => this.connected.has(i) && this.republish(c, false)), 60_000);
  }

  private republish(client: Client, includeAudienceData: boolean) {
    this.records.forEach((rec, topic) => {
      if (!includeAudienceData && (topic.startsWith(SUBS_PREFIX) || topic.startsWith(PLAYERS_PREFIX))) return;
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
    const state = normalizeState(this.records.get(TOPIC_STATE)?.data);
    const qRec = this.records.get(TOPIC_QUESTIONS)?.data;
    const submissions: UserSubmission[] = [];
    const players: Player[] = [];
    this.records.forEach((rec, topic) => {
      if (!isRecord(rec.data)) return;
      if (topic.startsWith(SUBS_PREFIX)) {
        const sub = rec.data as unknown as UserSubmission;
        if (Array.isArray(sub.rankedOptionIds) && !state.kicked[sub.userId]) submissions.push(sub);
      } else if (topic.startsWith(PLAYERS_PREFIX)) {
        const p = rec.data as unknown as Player;
        if (p.id && !state.kicked[p.id]) players.push(p);
      }
    });
    players.sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
    return {
      state,
      questions: isValidQuestions(qRec) ? qRec : DEFAULT_QUESTIONS,
      submissions,
      players,
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
    if (!isValidQuestions(value)) return;
    this.write<Question[]>(TOPIC_QUESTIONS, value);
  }

  submitRanking(sub: UserSubmission) {
    this.write<UserSubmission>(`${SUBS_PREFIX}${sub.questionId}/${sub.userId}`, sub);
  }

  announcePlayer(player: Player) {
    this.write<Player>(`${PLAYERS_PREFIX}${player.id}`, player);
  }

  private tombstone(match: (topic: string) => boolean) {
    Array.from(this.records.entries()).forEach(([topic, rec]) => {
      if (rec.data && match(topic)) this.write(topic, null);
    });
  }

  /** Clears votes for one question (or every question when questionId is omitted). */
  clearSubmissions(questionId?: string) {
    const prefix = questionId ? `${SUBS_PREFIX}${questionId}/` : SUBS_PREFIX;
    this.tombstone((t) => t.startsWith(prefix));
  }

  /** Removes a player's presence and all of their votes (used when kicking). */
  removePlayerData(userId: string) {
    this.tombstone((t) => t === `${PLAYERS_PREFIX}${userId}` || (t.startsWith(SUBS_PREFIX) && t.endsWith(`/${userId}`)));
  }

  resetGame() {
    this.clearSubmissions();
    const s = this.snapshot.state;
    this.write<GameState>(TOPIC_STATE, {
      ...DEFAULT_STATE,
      currentQuestionId: this.snapshot.questions[0]?.id ?? DEFAULT_STATE.currentQuestionId,
      stagePlayer: s.stagePlayer,
      timerDuration: s.timerDuration,
      timerRemaining: s.timerDuration,
      kicked: s.kicked,
      roomCode: s.roomCode,
    });
  }
}

export const liveSync = new LiveSyncService();

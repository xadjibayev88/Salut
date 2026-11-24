// Live browser transport is intentionally unavailable until a separately approved server-side POC.
import type { CharacterId, ExplainLang, RoleId } from '../../data/characters';
import type { InputMode, SessionRecord } from './prefs';
import { talkStats } from './markers';
import { NEUTRAL_VIVI_CUE, type ViviCue } from '../../shared/vivi-cue';
import type { SttResult } from './stt-result';

/** Live cue data uses the same strict versioned semantic contract as the rest of the app. */
export type LiveCue = ViviCue;

export type LivePhase = 'connecting' | 'listening' | 'speaking' | 'ended';

export interface LiveSnap {
  phase: LivePhase;
  /** Vivi ovozi darajasi (0..1). */
  level: number;
  /** Mikrofon darajasi (0..1). */
  micLevel: number;
  turns: { role: 'user' | 'tutor'; text: string }[];
  liveUser: string;
  liveTutor: string;
  elapsedMs: number;
  limitMs: number;
  muted: boolean;
  error: string | null;
  endReason: 'user' | 'limit' | 'error' | null;
  cue: LiveCue;
  /** O'quvchi hozir gapiryapti (ilova aniqlagan). */
  userTalking: boolean;
}

export interface ReviewedLiveTranscript {
  readonly sttResult: SttResult;
  readonly confirmedText: string;
  readonly userConfirmed: boolean;
}

export interface LiveOptions {
  character: CharacterId;
  role: RoleId;
  customRole: string;
  explicit: boolean;
  lang: ExplainLang;
  inputMode: InputMode;
  context: () => unknown;
  /** Retained for a future server-side POC; it cannot activate Live in this client. */
  reviewedTranscript?: ReviewedLiveTranscript;
}

// Future POC gates: Node/hosting WebSocket, server-only ADC, user/session binding, revoke/cancel,
// timeout, atomic quota, location, and model/service lifecycle. No browser transport is installed here.
export const LIVE_DISABLED_MESSAGE = 'Jonli rejim hozircha o‘chiq. Oddiy darslar yoki matnli mashqdan davom eting.';

/**
 * Compatibility shell for existing callers. Live is unavailable until the future POC gates pass;
 * this class intentionally performs no network, microphone, browser audio, or socket operations.
 */
export class LiveSession {
  snap: LiveSnap;
  onUpdate?: (s: LiveSnap) => void;
  private readonly id = `live-${Date.now()}`;

  constructor(private o: LiveOptions) {
    this.snap = {
      phase: 'connecting',
      level: 0,
      micLevel: 0,
      turns: [],
      liveUser: '',
      liveTutor: '',
      elapsedMs: 0,
      limitMs: 5 * 60_000,
      muted: false,
      error: null,
      endReason: null,
      cue: { ...NEUTRAL_VIVI_CUE },
      userTalking: false,
    };
  }

  private set(p: Partial<LiveSnap>) {
    this.snap = { ...this.snap, ...p };
    this.onUpdate?.(this.snap);
  }

  async start() {
    this.set({ error: LIVE_DISABLED_MESSAGE, phase: 'ended', endReason: 'error' });
  }

  /** Controls remain inert because no microphone session can be opened while Live is disabled. */
  togglePushToTalk() {}

  toggleMute() {}

  end(reason: 'user' | 'limit' | 'error' = 'user') {
    if (this.snap.phase === 'ended') return;
    this.set({ phase: 'ended', endReason: reason, level: 0, micLevel: 0, liveUser: '', liveTutor: '' });
  }

  record(): SessionRecord {
    const userTurns = this.snap.turns.filter((t) => t.role === 'user').map((t) => t.text);
    return {
      id: this.id,
      at: Date.now(),
      character: this.o.character,
      role: this.o.role,
      durationMs: this.snap.elapsedMs,
      speakingMs: 0,
      stats: talkStats(userTurns),
      turns: this.snap.turns,
      feedback: undefined,
    };
  }
}

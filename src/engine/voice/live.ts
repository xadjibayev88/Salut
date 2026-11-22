// Gemini Live: real vaqtli ovozli suhbat. Brauzer to'g'ridan-to'g'ri Gemini bilan WebSocket orqali gaplashadi
// (server bergan bir martalik token bilan — API kalit brauzerga chiqmaydi). Mikrofon: PCM16 16 kHz,
// Vivi ovozi: PCM16 24 kHz. Gapni bo'lish, subtitrlar (transkripsiya), taymer va suhbat yozuvi.
import type { CharacterId, ExplainLang, RoleId } from '../../data/characters';
import type { SessionRecord } from './prefs';
import { talkStats } from './markers';

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
}

export interface LiveOptions {
  character: CharacterId;
  role: RoleId;
  customRole: string;
  explicit: boolean;
  lang: ExplainLang;
  context: () => unknown;
}

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Int16Array {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Int16Array(buf, 0, Math.floor(bin.length / 2));
}

/** Float32 [-1,1] → PCM16, kerak bo'lsa 16 kHz ga kamaytirib. */
function toPcm16(input: Float32Array, fromRate: number): Uint8Array {
  const ratio = fromRate / 16000;
  const len = Math.floor(input.length / ratio);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const v = input[Math.floor(i * ratio)];
    out[i] = Math.max(-1, Math.min(1, v)) * 0x7fff;
  }
  return new Uint8Array(out.buffer);
}

export class LiveSession {
  snap: LiveSnap;
  onUpdate?: (s: LiveSnap) => void;
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private ctxIn: AudioContext | null = null;
  private proc: ScriptProcessorNode | null = null;
  private ctxOut: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private timer = 0;
  private raf = 0;
  private startedAt = 0;
  private speakingMs = 0;
  private readonly id = `live-${Date.now()}`;

  constructor(private o: LiveOptions) {
    this.snap = { phase: 'connecting', level: 0, micLevel: 0, turns: [], liveUser: '', liveTutor: '', elapsedMs: 0, limitMs: 5 * 60_000, muted: false, error: null, endReason: null };
  }

  private set(p: Partial<LiveSnap>) {
    this.snap = { ...this.snap, ...p };
    this.onUpdate?.(this.snap);
  }

  async start() {
    let tok: { token?: string; minutes?: number; setup?: unknown; code?: string; message?: string };
    try {
      const r = await fetch('./api/live/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scenario: this.o.role,
          message: '[SUHBAT BOSHLANDI] jonli suhbat',
          character: this.o.character,
          lang: this.o.lang,
          customRole: this.o.customRole,
          explicit: this.o.explicit,
          context: this.o.context(),
        }),
      });
      tok = await r.json().catch(() => ({}));
      if (!r.ok || !tok.token) return this.fail(tok.message ?? "Jonli rejimga ulanib bo'lmadi.", tok.code === 'voice_limit' || tok.code === 'daily_limit' ? 'limit' : 'error');
    } catch {
      return this.fail("Internetga ulanib bo'lmadi.");
    }
    this.set({ limitMs: (tok.minutes ?? 5) * 60_000 });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch {
      return this.fail('Mikrofonga ruxsat berilmadi.');
    }
    this.ctxOut = new AudioContext({ sampleRate: 24000 });
    this.gain = this.ctxOut.createGain();
    this.analyser = this.ctxOut.createAnalyser();
    this.analyser.fftSize = 512;
    this.gain.connect(this.analyser);
    this.analyser.connect(this.ctxOut.destination);

    const ws = new WebSocket(`${WS_URL}?access_token=${encodeURIComponent(tok.token)}`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ setup: tok.setup }));
    ws.onmessage = (ev) => void this.onMessage(ev);
    ws.onerror = () => this.snap.phase !== 'ended' && this.fail("Jonli aloqa uzildi.");
    ws.onclose = (e) => {
      if (this.snap.phase === 'ended') return;
      if (e.code === 1000) this.end('user');
      else this.fail(this.snap.elapsedMs >= this.snap.limitMs - 5000 ? 'Suhbat vaqti tugadi.' : "Jonli aloqa uzildi — qayta urinib ko'ring.", this.snap.elapsedMs >= this.snap.limitMs - 5000 ? 'limit' : 'error');
    };
  }

  private async onMessage(ev: MessageEvent) {
    const raw = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text();
    let m: {
      setupComplete?: unknown;
      goAway?: unknown;
      serverContent?: {
        modelTurn?: { parts?: { inlineData?: { data: string; mimeType?: string } }[] };
        outputTranscription?: { text?: string };
        inputTranscription?: { text?: string };
        interrupted?: boolean;
        turnComplete?: boolean;
      };
    };
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m.setupComplete) {
      this.startedAt = Date.now();
      this.startMic();
      this.timer = window.setInterval(() => this.tick(), 500);
      this.loop();
      this.set({ phase: 'listening' });
      // Vivi o'zi salomlashadi (xotiradan eslab).
      this.ws?.send(JSON.stringify({ realtimeInput: { text: '[SUHBAT BOSHLANDI]' } }));
      return;
    }
    if (m.goAway) return this.end('limit');
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) {
      // O'quvchi gapni bo'ldi — Vivi darhol jim bo'ladi.
      this.stopPlayback();
      if (this.snap.liveTutor) this.pushTurn('tutor', `${this.snap.liveTutor}…`);
      this.set({ liveTutor: '', phase: 'listening' });
    }
    for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data) this.play(fromBase64(p.inlineData.data));
    if (sc.inputTranscription?.text) {
      // Vivi gapira boshlasa, o'quvchining gapi yakunlangan hisoblanadi.
      this.set({ liveUser: this.snap.liveUser + sc.inputTranscription.text });
    }
    if (sc.outputTranscription?.text) {
      if (this.snap.liveUser.trim()) {
        this.pushTurn('user', this.snap.liveUser.trim());
        this.set({ liveUser: '' });
      }
      this.set({ liveTutor: this.snap.liveTutor + sc.outputTranscription.text });
    }
    if (sc.turnComplete) {
      if (this.snap.liveUser.trim()) this.pushTurn('user', this.snap.liveUser.trim());
      if (this.snap.liveTutor.trim()) this.pushTurn('tutor', this.snap.liveTutor.trim());
      this.set({ liveUser: '', liveTutor: '' });
    }
  }

  private pushTurn(role: 'user' | 'tutor', text: string) {
    this.set({ turns: [...this.snap.turns, { role, text }].slice(-60) });
  }

  private startMic() {
    if (!this.stream) return;
    this.ctxIn = new AudioContext({ sampleRate: 16000 });
    const src = this.ctxIn.createMediaStreamSource(this.stream);
    const proc = this.ctxIn.createScriptProcessor(2048, 1, 1);
    const rate = this.ctxIn.sampleRate;
    proc.onaudioprocess = (e) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.snap.muted) return;
      const ch = e.inputBuffer.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < ch.length; i += 16) peak = Math.max(peak, Math.abs(ch[i]));
      this.snap.micLevel = Math.min(1, peak * 2.5);
      // O'quvchining gapirish vaqti (tahlil uchun).
      if (peak > 0.04) this.speakingMs += (ch.length / rate) * 1000;
      this.ws.send(JSON.stringify({ realtimeInput: { audio: { data: toBase64(toPcm16(ch, rate)), mimeType: 'audio/pcm;rate=16000' } } }));
    };
    src.connect(proc);
    proc.connect(this.ctxIn.destination);
    this.proc = proc;
  }

  private play(pcm: Int16Array) {
    const ctx = this.ctxOut;
    if (!ctx || !this.gain || !pcm.length) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const buf = ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(this.gain);
    const at = Math.max(ctx.currentTime + 0.03, this.nextTime);
    s.start(at);
    this.nextTime = at + buf.duration;
    this.sources.add(s);
    s.onended = () => this.sources.delete(s);
    if (this.snap.phase !== 'speaking') this.set({ phase: 'speaking' });
  }

  private stopPlayback() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* allaqachon tugagan */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
  }

  private loop() {
    const data = new Uint8Array(256);
    const step = () => {
      if (this.snap.phase === 'ended') return;
      let level = 0;
      if (this.analyser) {
        this.analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        level = Math.min(1, peak / 64);
      }
      const playing = this.ctxOut ? this.nextTime > this.ctxOut.currentTime : false;
      const phase: LivePhase = playing ? 'speaking' : 'listening';
      if (phase !== this.snap.phase || Math.abs(level - this.snap.level) > 0.04) this.set({ phase, level });
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private tick() {
    const elapsedMs = Date.now() - this.startedAt;
    this.set({ elapsedMs });
    if (elapsedMs >= this.snap.limitMs) this.end('limit');
  }

  toggleMute() {
    this.set({ muted: !this.snap.muted, micLevel: 0 });
  }

  private fail(message: string, reason: 'error' | 'limit' = 'error') {
    this.set({ error: message });
    this.end(reason);
  }

  end(reason: 'user' | 'limit' | 'error' = 'user') {
    if (this.snap.phase === 'ended') return;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    if (this.snap.liveUser.trim()) this.pushTurn('user', this.snap.liveUser.trim());
    if (this.snap.liveTutor.trim()) this.pushTurn('tutor', this.snap.liveTutor.trim());
    try {
      this.ws?.close(1000);
    } catch {
      /* e'tiborsiz */
    }
    this.ws = null;
    this.proc?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stopPlayback();
    void this.ctxIn?.close().catch(() => undefined);
    void this.ctxOut?.close().catch(() => undefined);
    this.set({ phase: 'ended', endReason: reason, level: 0, micLevel: 0, liveUser: '', liveTutor: '' });
  }

  record(): SessionRecord {
    const userTurns = this.snap.turns.filter((t) => t.role === 'user').map((t) => t.text);
    return {
      id: this.id,
      at: this.startedAt || Date.now(),
      character: this.o.character,
      role: this.o.role,
      durationMs: this.snap.elapsedMs,
      speakingMs: this.speakingMs,
      stats: talkStats(userTurns),
      turns: this.snap.turns,
      feedback: undefined,
    };
  }
}

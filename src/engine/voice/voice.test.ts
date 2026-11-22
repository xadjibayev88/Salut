import { describe, expect, it } from 'vitest';
import { displayText, extractCues, langSegments, SentenceSplitter, speechText, talkStats } from './markers';
import { compareStats, type SessionRecord } from './prefs';

describe('markers', () => {
  it('extracts shape and actions and hides them from text', () => {
    const { clean, cue } = extractCues('[[shape:heart]][[do:hop]] Zo\'r! [[do:nope]] [[shape:xx]]');
    expect(cue).toEqual({ shape: 'heart', actions: ['hop'] });
    expect(clean.trim()).toBe("Zo'r!");
  });
  it('accepts shorthand markers and drops unknown ones', () => {
    const { clean, cue } = extractCues('[[tall]] [[point]] [[zzz]] Yetarli emas.');
    expect(cue).toEqual({ shape: 'tall', actions: ['point'] });
    expect(clean.trim()).toBe('Yetarli emas.');
  });
  it('strips audio tags for display and for non-v3 speech', () => {
    expect(displayText('[laughs] [fr]Oui[/fr] juda yaxshi')).toBe('[fr]Oui[/fr] juda yaxshi');
    expect(speechText('[laughs] [fr]Oui[/fr]', false)).toBe('Oui');
    expect(speechText('[laughs] [fr]Oui[/fr]', true)).toBe('[laughs] Oui');
  });
  it('splits a stream into sentences as soon as they complete, never inside [fr]', () => {
    const sp = new SentenceSplitter();
    expect(sp.push('Salom! Bugun ')).toEqual(['Salom!']);
    expect(sp.push('[fr]Ça va ? Oui.[/fr] deymiz. Keyin')).toEqual(['Bugun [fr]Ça va ? Oui.[/fr] deymiz.']);
    expect(sp.flush()).toEqual(['Keyin']);
  });
  it('splits languages for browser voices', () => {
    expect(langSegments('Ayting: [fr]Bonjour ![/fr] — salom.')).toEqual([
      { fr: false, text: 'Ayting:' },
      { fr: true, text: 'Bonjour !' },
      { fr: false, text: '— salom.' },
    ]);
  });
  it('counts talk statistics', () => {
    expect(talkStats(['Je suis Ali. Je suis ouzbek!', 'merci'])).toEqual({ words: 7, sentences: 3, unique: 5 });
  });
});

describe('records', () => {
  const rec = (id: string, words: number, speakingMs: number): SessionRecord => ({
    id, at: 0, character: 'classic', role: 'free', durationMs: 0, speakingMs, stats: { words, sentences: 1, unique: words }, turns: [],
  });
  it('detects personal records and improvement over last session', () => {
    const c = compareStats({ stats: { words: 30, sentences: 1, unique: 10 }, speakingMs: 5000 }, [rec('b', 20, 9000), rec('a', 25, 1000)]);
    expect(c.words).toEqual({ record: true, up: true });
    expect(c.speaking).toEqual({ record: false, up: false });
  });
});

import { answerLang } from './markers';
import { parseRich as parseRichAns } from '../tutor';

describe('answerLang — mikrofon tilini avtomatik tanlash', () => {
  it('model belgisi ustun', () => {
    expect(answerLang("Zo'r! Endi ayting: [fr]Je m'appelle Ali.[/fr] [[ans:fr]]")).toBe('fr');
    expect(answerLang('Bugun nima o\'rganamiz? [[ans:uz]]')).toBe('uz');
  });
  it('belgisiz — matndan taxmin', () => {
    expect(answerLang("Qani, buni fransuzcha ayting: men talabaman.")).toBe('fr');
    expect(answerLang("[fr]Comment tu t'appelles ?[/fr]")).toBe('fr');
    expect(answerLang('Bugun kayfiyatingiz qanday?')).toBeNull();
  });
  it('belgi chatda ko\'rinmaydi (oqim paytida ham)', () => {
    const txt = parseRichAns('Salom! [[ans:fr]]').map((s) => s.text).join('');
    expect(txt).not.toContain('[[');
    expect(parseRichAns('Salom [[an', true).map((s) => s.text).join('')).not.toContain('[[');
  });
});

describe('answerLang — fransuzcha savol belgidan ustun', () => {
  it("oxirgi fransuzcha savol + tarjima → fr", () => {
    expect(answerLang("Tanishamiz: [fr]Comment tu t'appelles ?[/fr] (komma tü appel) — isming nima?\n\n[[ans:uz]]")).toBe('fr');
    expect(answerLang("[fr]Bonjour ![/fr] — salom. Bugun nimani o'rganamiz? [[ans:uz]]")).toBe('uz');
  });
});

describe('effektlar: rasm va noto\'g\'ri teglar', () => {
  it('[[img:...]] ajratiladi va matndan olinadi', () => {
    const { clean, cue } = extractCues("[[shape:heart]] Voy, [[img:Ulug'bek Rahmatullayev]] kabi romantik!");
    expect(cue.image).toBe("Ulug'bek Rahmatullayev");
    expect(cue.shape).toBe('heart');
    expect(clean).not.toContain('[[');
  });
  it('«[[fr]» xatosi tuzatiladi', () => {
    expect(parseRichAns('ey [[fr]mon amour[/fr] — muhabbatim').find((s) => s.kind === 'fr')?.text).toBe('mon amour');
  });
});

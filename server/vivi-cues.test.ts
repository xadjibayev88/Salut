import { describe, expect, it } from 'vitest';
import { NEUTRAL_VIVI_CUE, validateViviCue, type ViviCue } from './vivi-cues.ts';

describe('ViviCue server validator', () => {
  it('accepts the exact approved state, face, action and ornament values', () => {
    const valid: ViviCue = {
      state: 'speaking',
      face: 'supportive',
      action: 'tail_wag',
      ornament: 'thought_dots',
    };
    expect(validateViviCue(valid)).toEqual(valid);
  });

  it.each([
    { state: 'running', face: 'happy' },
    { state: 'speaking', face: 'angry' },
    { state: 'speaking', face: 'happy', action: 'slap' },
    { state: 'speaking', face: 'happy', action: 'punch' },
    { state: 'speaking', face: 'happy', action: 'spit' },
    { state: 'speaking', face: 'happy', action: 'flip' },
    { state: 'speaking', face: 'happy', action: 'eval("bad")' },
    { state: 'speaking', face: 'happy', action: 'shape:heart' },
    { state: 'speaking', face: 'happy', ornament: 'sound:slap' },
    null,
    '[[do:slap]]',
  ])('maps malformed, unapproved or command-like cue data to neutral', (input) => {
    expect(validateViviCue(input)).toEqual(NEUTRAL_VIVI_CUE);
  });

  it('drops unknown fields rather than forwarding arbitrary model data', () => {
    expect(validateViviCue({
      state: 'speaking',
      face: 'happy',
      action: 'hop',
      ornament: 'heart',
      code: 'alert(1)',
      soundEffect: 'slap',
    })).toEqual({ state: 'speaking', face: 'happy', action: 'hop', ornament: 'heart' });
  });

  it('returns a fresh neutral value for every invalid cue', () => {
    const one = validateViviCue({ action: 'slap' });
    const two = validateViviCue({ action: 'slap' });
    expect(one).toEqual(NEUTRAL_VIVI_CUE);
    expect(one).not.toBe(two);
  });
});


it('accepts every individually approved enum value and optional ornament', () => {
  for (const state of ['idle', 'listening', 'thinking', 'speaking'] as const) {
    expect(validateViviCue({ state, face: 'neutral' }).state).toBe(state);
  }
  for (const face of ['neutral', 'happy', 'amused', 'curious', 'confused', 'surprised', 'supportive', 'proud'] as const) {
    expect(validateViviCue({ state: 'idle', face }).face).toBe(face);
  }
  for (const action of ['blink', 'head_tilt', 'ear_perk', 'tail_wag', 'giggle', 'hop', 'wave'] as const) {
    expect(validateViviCue({ state: 'idle', face: 'neutral', action }).action).toBe(action);
  }
  for (const ornament of ['sparkle', 'thought_dots', 'heart'] as const) {
    expect(validateViviCue({ state: 'idle', face: 'neutral', ornament }).ornament).toBe(ornament);
  }
});

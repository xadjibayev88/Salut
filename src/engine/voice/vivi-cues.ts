export const VIVI_CUE_STATES = ['idle', 'listening', 'thinking', 'speaking'] as const;
export const VIVI_CUE_FACES = ['neutral', 'happy', 'amused', 'curious', 'confused', 'surprised', 'supportive', 'proud'] as const;
export const VIVI_CUE_ACTIONS = ['blink', 'head_tilt', 'ear_perk', 'tail_wag', 'giggle', 'hop', 'wave'] as const;
export const VIVI_CUE_ORNAMENTS = ['sparkle', 'thought_dots', 'heart'] as const;

export type ViviCueState = (typeof VIVI_CUE_STATES)[number];
export type ViviCueFace = (typeof VIVI_CUE_FACES)[number];
export type ViviCueAction = (typeof VIVI_CUE_ACTIONS)[number];
export type ViviCueOrnament = (typeof VIVI_CUE_ORNAMENTS)[number];

export interface ViviCue {
  readonly state: ViviCueState;
  readonly face: ViviCueFace;
  readonly action?: ViviCueAction;
  readonly ornament?: ViviCueOrnament;
}

export const NEUTRAL_VIVI_CUE: ViviCue = Object.freeze({ state: 'idle', face: 'neutral' });

function member<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

/** Client-side defense-in-depth. Task 8 will move this mirror beside the server schema. */
export function validateViviCue(value: unknown): ViviCue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...NEUTRAL_VIVI_CUE };
  const input = value as Record<string, unknown>;
  if (!member(input.state, VIVI_CUE_STATES) || !member(input.face, VIVI_CUE_FACES)
    || (input.action !== undefined && !member(input.action, VIVI_CUE_ACTIONS))
    || (input.ornament !== undefined && !member(input.ornament, VIVI_CUE_ORNAMENTS))) return { ...NEUTRAL_VIVI_CUE };
  return Object.freeze({
    state: input.state,
    face: input.face,
    ...(input.action !== undefined ? { action: input.action } : {}),
    ...(input.ornament !== undefined ? { ornament: input.ornament } : {}),
  });
}

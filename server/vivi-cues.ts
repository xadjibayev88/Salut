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

function neutral(): ViviCue {
  return { ...NEUTRAL_VIVI_CUE };
}

function isMember<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

/** Validate model output at the server boundary; no arbitrary action or effect string is retained. */
export function validateViviCue(value: unknown): ViviCue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return neutral();
  const input = value as Record<string, unknown>;
  if (!isMember(input.state, VIVI_CUE_STATES) || !isMember(input.face, VIVI_CUE_FACES)) return neutral();
  if (input.action !== undefined && !isMember(input.action, VIVI_CUE_ACTIONS)) return neutral();
  if (input.ornament !== undefined && !isMember(input.ornament, VIVI_CUE_ORNAMENTS)) return neutral();

  return Object.freeze({
    state: input.state,
    face: input.face,
    ...(input.action !== undefined ? { action: input.action } : {}),
    ...(input.ornament !== undefined ? { ornament: input.ornament } : {}),
  });
}

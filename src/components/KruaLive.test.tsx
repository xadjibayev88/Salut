import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ViviCue } from '../shared/vivi-cue.ts';
import { KruaLive } from './KruaLive.tsx';

const render = (cue: unknown, level = 0) => renderToStaticMarkup(createElement(KruaLive, { cue: cue as ViviCue, level, size: 200 }));

describe('Vivi semantic mascot renderer', () => {
  it('renders validated semantic face, state, action, and ornament cues on the original cat', () => {
    const html = render({ state: 'listening', face: 'curious', action: 'ear_perk', ornament: 'thought_dots' });
    expect(html).toContain('vivi-cue-state-listening');
    expect(html).toContain('vivi-cue-face-curious');
    expect(html).toContain('vivi-cue-action-ear_perk');
    expect(html).toContain('vivi-cue-ornament-thought_dots');
    expect(html).toContain('vivi-tail');
    expect(html).toContain('vivi-ear-l');
    expect(html).not.toContain('krua-morph');
    expect(html).not.toContain('vivi-flip');
    expect(html).not.toContain('krua-flame');
  });

  it('maps malformed or unsafe cue data to a neutral, non-animated cat', () => {
    const html = render({ state: 'speaking', face: 'angry', action: 'flip', shape: 'heart', soundEffect: 'slap' });
    expect(html).toContain('vivi-cue-state-idle');
    expect(html).toContain('vivi-cue-face-neutral');
    expect(html).not.toContain('vivi-cue-action-flip');
    expect(html).not.toContain('vivi-cue-ornament-');
  });

  it.each([
    ['happy', 'hop'],
    ['proud', 'hop'],
    ['amused', 'giggle'],
    ['supportive', 'tail_wag'],
  ])('maps the %s face to its subtle approved motion', (face, action) => {
    const html = render({ state: 'idle', face });
    expect(html).toContain(`vivi-cue-action-${action}`);
  });

  it('uses the clamped audio level to vary only the speaking mouth', () => {
    const html = render({ state: 'speaking', face: 'happy' }, 1);
    expect(html).toContain('ellipse class="vivi-cue-mouth-speaking" cx="100" cy="121" rx="8" ry="9"');
  });

  it('keeps the animated cue layer still when reduced motion is requested', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const reducedMotionStart = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
    const reducedMotionBlock = css.slice(reducedMotionStart);
    expect(reducedMotionStart).toBeGreaterThanOrEqual(0);
    expect(reducedMotionBlock).toContain('animation: none');
    expect(reducedMotionBlock).toContain('transition: none');
    expect(reducedMotionBlock).toContain('transform: none');
    expect(reducedMotionBlock).toContain('.vivi-cue-motion .vivi-cue-head');
    expect(reducedMotionBlock).toContain('.vivi-cue-motion .krua-glow');
  });
});

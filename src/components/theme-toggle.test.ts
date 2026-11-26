import { describe, expect, it } from 'vitest';
import { holeState, stickPose } from './ThemeToggle';

describe('theme toggle stickman', () => {
  it('appears, walks toward the hole, jumps and then sinks out of sight', () => {
    const start = stickPose(0.31);
    const walking = stickPose(1.0);
    const jump = stickPose(1.55);
    const falling = stickPose(1.95);
    expect(start.visible).toBe(true);
    expect(walking.x).toBeGreaterThan(start.x);
    expect(jump.y).toBeLessThan(walking.y); // in the air
    expect(jump.arm).toBeGreaterThan(1.5); // arms raised
    expect(falling.sink).toBeGreaterThan(0);
    expect(stickPose(2.2).visible).toBe(false);
  });

  it('darkens and widens the hole while he falls, then closes it again', () => {
    expect(holeState(1.0).dark).toBe(0);
    expect(holeState(2.0).dark).toBeGreaterThan(0.9);
    expect(holeState(2.0).rx).toBeGreaterThan(holeState(1.0).rx);
    expect(holeState(3.0).dark).toBe(0);
  });
});

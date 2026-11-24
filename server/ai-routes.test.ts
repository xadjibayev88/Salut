import { describe, expect, it } from 'vitest';
import { enabledAiRoutes } from './ai-routes.ts';

const handlers = {
  'GET /api/health': () => 'health',
  'POST /api/tutor': () => 'tutor',
  'POST /api/live/token': () => 'live',
};

describe('AI route registry gates', () => {
  it('does not register Live-token while liveEnabled is false even if providerEnabled is true', () => {
    const routes = enabledAiRoutes(handlers, { providerEnabled: true, liveEnabled: false });

    expect(routes['GET /api/health']).toBe(handlers['GET /api/health']);
    expect(routes['POST /api/tutor']).toBe(handlers['POST /api/tutor']);
    expect(routes).not.toHaveProperty('POST /api/live/token');
  });

  it('registers Live-token only when both provider and Live are enabled', () => {
    expect(enabledAiRoutes(handlers, { providerEnabled: true, liveEnabled: true })).toHaveProperty('POST /api/live/token');
    expect(enabledAiRoutes(handlers, { providerEnabled: false, liveEnabled: true })).not.toHaveProperty('POST /api/live/token');
  });
});

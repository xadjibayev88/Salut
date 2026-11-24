import { describe, expect, it } from 'vitest';
import { AI_ROUTE_REQUIREMENTS } from './ai-consent.ts';
import { enabledAiRoutes } from './ai-routes.ts';

const handlers = {
  'GET /api/health': () => 'health',
  'POST /api/tutor': () => 'tutor',
  'POST /api/tutor/feedback': () => 'feedback',
  'POST /api/live/token': () => 'live',
  'POST /api/translate': () => 'translate',
  'POST /api/tutor/memory': () => 'memory',
  'POST /api/stt': () => 'stt',
  'POST /api/tts': () => 'tts',
};

const providerRouteKeys = [
  'POST /api/tutor',
  'POST /api/tutor/feedback',
  'POST /api/live/token',
  'POST /api/translate',
  'POST /api/tutor/memory',
  'POST /api/stt',
  'POST /api/tts',
] as const;

describe('AI route registry gates', () => {
  it('does not register Live-token while liveEnabled is false even if providerEnabled is true', () => {
    const routes = enabledAiRoutes(handlers, { providerEnabled: true, liveEnabled: false, quotaReservationReady: true });

    expect(routes['GET /api/health']).toBe(handlers['GET /api/health']);
    expect(routes['POST /api/tutor']).toBe(handlers['POST /api/tutor']);
    expect(routes).not.toHaveProperty('POST /api/live/token');
  });

  it('registers Live-token only when both provider and Live are enabled', () => {
    expect(enabledAiRoutes(handlers, { providerEnabled: true, liveEnabled: true, quotaReservationReady: true })).toHaveProperty('POST /api/live/token');
    expect(enabledAiRoutes(handlers, { providerEnabled: false, liveEnabled: true, quotaReservationReady: true })).not.toHaveProperty('POST /api/live/token');
  });

  it.each(providerRouteKeys)('does not expose %s before quota reservation is wired', (routeKey) => {
    expect(handlers).toHaveProperty(routeKey);
    expect(AI_ROUTE_REQUIREMENTS).toHaveProperty(routeKey);
    const routes = enabledAiRoutes(handlers, { providerEnabled: true, liveEnabled: true, quotaReservationReady: false });
    expect(routes).not.toHaveProperty(routeKey);
  });
});

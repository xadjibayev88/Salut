import { AI_ROUTE_REQUIREMENTS } from './ai-consent.ts';

export interface AiRouteGates {
  readonly providerEnabled: boolean;
  readonly liveEnabled: boolean;
  /** Must be true only after every provider handler reserves quota before calling its provider. */
  readonly quotaReservationReady: boolean;
}

/** Keep AI endpoints out of the route table unless their provider capability is enabled. Live has an additional independent gate. */
export function enabledAiRoutes<T>(
  handlers: Readonly<Record<string, T>>,
  gates: AiRouteGates,
): Readonly<Record<string, T>> {
  const routes = Object.fromEntries(
    Object.entries(handlers).filter(([key]) => {
      if (!Object.prototype.hasOwnProperty.call(AI_ROUTE_REQUIREMENTS, key)) return true;
      if (!gates.providerEnabled || !gates.quotaReservationReady) return false;
      return key !== 'POST /api/live/token' || gates.liveEnabled;
    }),
  ) as Record<string, T>;
  return Object.freeze(routes);
}

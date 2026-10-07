import { ActiveUser, BasePath, Currency, type HostContext } from '@baseline/host-contract';
import { rs } from '@rstest/core';

/** A host context for tests: the demo user and EUR, with a `navigate` spy. */
export function testContext(overrides: Partial<HostContext> = {}): HostContext {
  return {
    currency: Currency.parse({ code: 'EUR', perEur: 1 }),
    activeUser: ActiveUser.parse({ id: 'user-1', name: 'Demo Planner' }),
    basePath: BasePath.parse('/people'),
    navigate: rs.fn(),
    ...overrides,
  };
}

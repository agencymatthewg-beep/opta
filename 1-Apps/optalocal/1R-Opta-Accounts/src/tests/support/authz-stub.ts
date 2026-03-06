import { getMockAuthzResult } from './route-mocks.ts';

export async function requireScopeOrPrivilegedRole() {
  return getMockAuthzResult();
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers provide explicit return types while ctor remains runtime-validated unknown
export function instantiateOrInvoke<T>(ctor: unknown, ...args: unknown[]): T {
  if (typeof ctor !== 'function') {
    throw new TypeError(`Expected constructor/function, received ${String(ctor)}`);
  }

  // Vitest mocks and Sinon-style stubs expose `.mock`; calling those directly is
  // the intended test path and avoids TypeError behavior differences across
  // runtimes when they are used in place of constructors.
  if (Object.prototype.hasOwnProperty.call(ctor, 'mock')) {
    return (ctor as (...args: unknown[]) => T)(...args);
  }

  try {
    return new (ctor as new (...args: unknown[]) => T)(...args);
  } catch (err) {
    if (
      err instanceof TypeError &&
      typeof err.message === 'string' &&
      err.message.includes('is not a constructor')
    ) {
      return (ctor as (...args: unknown[]) => T)(...args);
    }
    throw err;
  }
}

export class DiagnosticFailure extends Error {
  constructor(readonly stage: string, readonly elapsedMs: number, reason: string) {
    super(`${stage}: ${reason} (${elapsedMs}ms elapsed)`);
    this.name = "DiagnosticFailure";
  }
}

interface Flight {
  startedMs: number;
  stage: string;
  work: Promise<unknown>;
}

interface DiagnosticScope {
  step<T>(name: string, read: () => Promise<T>): Promise<T>;
}

/** One diagnostic per key while its underlying read is outstanding. A timed-out SDK
 * call cannot be cancelled safely through the shared runtime, so retain its flight
 * until it settles. Late results are never returned as a cached healthy reading. */
export function createDiagnosticRunner(budgetMs = 10_000) {
  const flights = new Map<string, Flight>();
  return async function diagnose<T>(key: string, operation: (scope: DiagnosticScope) => Promise<T>): Promise<{ value: T; elapsedMs: number }> {
    let flight = flights.get(key);
    if (!flight) {
      flight = { startedMs: Date.now(), stage: key, work: Promise.resolve() };
      const own = flight;
      flights.set(key, own);
      own.work = Promise.resolve().then(() => operation({
        async step(name, read) {
          // A previous read may finish after the caller's budget. Do not start the
          // next stage in the background after the response has already timed out.
          if (Date.now() - own.startedMs >= budgetMs) throw new DiagnosticFailure(own.stage, Date.now() - own.startedMs, "timed out");
          own.stage = name;
          return read();
        },
      })).finally(() => {
        if (flights.get(key) === own) flights.delete(key);
      });
    }
    const current = flight;
    const remainingMs = budgetMs - (Date.now() - current.startedMs);
    if (remainingMs <= 0) throw new DiagnosticFailure(current.stage, Date.now() - current.startedMs, "still awaiting the timed-out upstream read");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        current.work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new DiagnosticFailure(current.stage, Date.now() - current.startedMs, "timed out")), remainingMs);
        }),
      ]);
      return { value: value as T, elapsedMs: Date.now() - current.startedMs };
    } catch (error) {
      if (error instanceof DiagnosticFailure) throw error;
      throw new DiagnosticFailure(current.stage, Date.now() - current.startedMs, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  };
}

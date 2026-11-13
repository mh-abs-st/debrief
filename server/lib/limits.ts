// Rate limits and usage counts. Every AI call and speech key costs money, so the API limits each client
// per minute and everyone together per day, and counts calls (counts only, never content). In memory:
// a restart clears them, which is fine for limits; durable per-account counts come with sign-in (#18).

export interface LimitConfig {
  aiPerMinute: number; // per client: /api/skills, /api/followups, /api/plan, /api/resume/parse
  keysPerMinute: number; // per client: /api/transcribe-token (one per start of listening)
  badTokenPerMinute: number; // per client: requests with a wrong app token
  aiPerDay: number; // everyone together, a cap on the AI bill (0 = no cap)
  keysPerDay: number; // everyone together, a cap on speech keys (0 = no cap)
}

export const DEFAULT_LIMITS: LimitConfig = {
  aiPerMinute: 30,
  keysPerMinute: 6,
  badTokenPerMinute: 10,
  aiPerDay: 2000,
  keysPerDay: 500,
};

// Reads DAILY_AI_CALLS and DAILY_TRANSCRIBE_KEYS (and the per-minute ones) from the environment.
export function limitsFromEnv(env: Record<string, string | undefined>): LimitConfig {
  const num = (name: string, fallback: number) => {
    const v = Number(env[name]);
    return env[name] !== undefined && env[name] !== '' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
  };
  return {
    aiPerMinute: num('AI_CALLS_PER_MINUTE', DEFAULT_LIMITS.aiPerMinute),
    keysPerMinute: num('TRANSCRIBE_KEYS_PER_MINUTE', DEFAULT_LIMITS.keysPerMinute),
    badTokenPerMinute: num('BAD_TOKEN_PER_MINUTE', DEFAULT_LIMITS.badTokenPerMinute),
    aiPerDay: num('DAILY_AI_CALLS', DEFAULT_LIMITS.aiPerDay),
    keysPerDay: num('DAILY_TRANSCRIBE_KEYS', DEFAULT_LIMITS.keysPerDay),
  };
}

const MINUTE = 60_000;

// A sliding one-minute window per client: at most `limit` hits in any 60 seconds.
// wait(key): 0 when another hit is allowed, else the seconds until one is. hit(key) records one.
export function makeWindow(limit: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  const recent = (key: string) => {
    const t = now();
    const list = (hits.get(key) || []).filter((h) => h > t - MINUTE);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };
  return {
    wait(key: string): number {
      if (limit <= 0) return 0; // 0 = no limit
      const list = recent(key);
      return list.length < limit ? 0 : Math.max(1, Math.ceil((list[0] + MINUTE - now()) / 1000));
    },
    hit(key: string): void {
      if (limit <= 0) return;
      hits.set(key, [...recent(key), now()]);
    },
    // Forgets clients with no hits in the last minute, so the map doesn't grow forever.
    sweep(): void {
      for (const key of [...hits.keys()]) recent(key);
    },
    size: () => hits.size,
  };
}

export type Kind = 'ai' | 'key';
export type Route = 'skills' | 'followups' | 'plan' | 'resume' | 'transcribe-token';
export const KIND: Record<Route, Kind> = { skills: 'ai', followups: 'ai', plan: 'ai', resume: 'ai', 'transcribe-token': 'key' };
const TOTAL: Record<Kind, string> = { ai: 'aiCalls', key: 'transcribeKeys' };

const day = (t: number) => new Date(t).toISOString().slice(0, 10); // UTC

// Counts per UTC day: each route, the totals (aiCalls, transcribeKeys) and refusals. Last 7 days kept.
export function makeUsage(now: () => number = Date.now) {
  const days = new Map<string, Record<string, number>>();
  const add = (name: string) => {
    const d = day(now());
    const counts = days.get(d) || {};
    counts[name] = (counts[name] || 0) + 1;
    days.set(d, counts);
    for (const old of [...days.keys()].sort().slice(0, -7)) days.delete(old);
  };
  return {
    count(route: Route): void {
      add(route);
      add(TOTAL[KIND[route]]);
    },
    refused(reason: Refusal): void {
      add(`refused.${reason}`);
    },
    today(kind: Kind): number {
      return days.get(day(now()))?.[TOTAL[kind]] || 0;
    },
    report(): Array<{ day: string; counts: Record<string, number> }> {
      return [...days.keys()].sort().reverse().map((d) => ({ day: d, counts: { ...days.get(d) } }));
    },
  };
}

export type Refusal = 'perMinute' | 'daily' | 'badToken';
export type Decision = { ok: true } | { ok: false; reason: Refusal; retryAfter: number };

// Seconds until the next midnight UTC, when the daily caps reset.
export function untilMidnight(t: number): number {
  const d = new Date(t);
  return Math.max(1, Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - t) / 1000));
}

// What the API asks before doing any work: may this client make this call now? A call that's allowed
// is counted; a refused one only counts as a refusal.
export function makeLimits(config: LimitConfig = DEFAULT_LIMITS, now: () => number = Date.now) {
  const perMinute: Record<Kind, ReturnType<typeof makeWindow>> = { ai: makeWindow(config.aiPerMinute, now), key: makeWindow(config.keysPerMinute, now) };
  const wrongToken = makeWindow(config.badTokenPerMinute, now);
  const daily: Record<Kind, number> = { ai: config.aiPerDay, key: config.keysPerDay };
  const usage = makeUsage(now);
  const refuse = (reason: Refusal, retryAfter: number): Decision => {
    usage.refused(reason);
    return { ok: false, reason, retryAfter };
  };
  return {
    config,
    usage,
    check(client: string, route: Route): Decision {
      const kind = KIND[route];
      if (daily[kind] && usage.today(kind) >= daily[kind]) return refuse('daily', untilMidnight(now()));
      const wait = perMinute[kind].wait(client);
      if (wait) return refuse('perMinute', wait);
      perMinute[kind].hit(client);
      usage.count(route);
      return { ok: true };
    },
    // Before checking the token: a client that sent too many wrong tokens waits out the minute, even
    // with the right one, so guessing is slow.
    guessing(client: string): Decision {
      const wait = wrongToken.wait(client);
      return wait ? refuse('badToken', wait) : { ok: true };
    },
    wrongToken(client: string): void {
      wrongToken.hit(client);
    },
    sweep(): void {
      perMinute.ai.sweep();
      perMinute.key.sweep();
      wrongToken.sweep();
    },
  };
}

export type Limits = ReturnType<typeof makeLimits>;

import { createApp } from './lib/app.ts';
import { makeClaude } from './lib/claude.ts';
import { makeGrantKey } from './lib/deepgram.ts';
import { makeLimits, limitsFromEnv } from './lib/limits.ts';

const {
  PORT = '8789',
  ANTHROPIC_API_KEY = '',
  DEBRIEF_APP_TOKEN = '',
  FAST_MODEL = 'claude-haiku-5-5',
  ASSIST_MODEL = 'claude-sonnet-5-5',
  DEEPGRAM_API_KEY = '',
  TRUST_PROXY = '',
} = process.env;

if (!ANTHROPIC_API_KEY) console.warn('[warn] ANTHROPIC_API_KEY is not set. AI features will fail.');
if (!DEBRIEF_APP_TOKEN) console.warn('[warn] DEBRIEF_APP_TOKEN is not set. The API will refuse all requests until it is.');

if (!DEEPGRAM_API_KEY) console.warn('[warn] DEEPGRAM_API_KEY is not set. Live transcription will be unavailable.');

const complete = makeClaude({ apiKey: ANTHROPIC_API_KEY });
const grantKey = DEEPGRAM_API_KEY ? makeGrantKey({ apiKey: DEEPGRAM_API_KEY }) : null;
const limits = makeLimits(limitsFromEnv(process.env));
const server = createApp({
  complete,
  grantKey,
  appToken: DEBRIEF_APP_TOKEN,
  models: { fast: FAST_MODEL, assist: ASSIST_MODEL },
  limits,
  trustProxy: TRUST_PROXY === '1',
});

server.listen(Number(PORT), () => {
  console.log(`Debrief server listening on http://localhost:${PORT}`);
  const l = limits.config;
  const cap = (n: number) => (n ? String(n) : 'no cap');
  console.log(`Limits per client a minute: AI calls ${l.aiPerMinute}, speech keys ${l.keysPerMinute}. Per day for everyone: AI calls ${cap(l.aiPerDay)}, speech keys ${cap(l.keysPerDay)}.`);
});

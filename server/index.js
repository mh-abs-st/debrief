import { createApp } from './lib/app.js';
import { makeClaude } from './lib/claude.js';

const {
  PORT = '8787',
  ANTHROPIC_API_KEY = '',
  DEBRIEF_APP_TOKEN = '',
  FAST_MODEL = 'claude-haiku-5-5',
} = process.env;

if (!ANTHROPIC_API_KEY) console.warn('[warn] ANTHROPIC_API_KEY is not set. AI features will fail.');
if (!DEBRIEF_APP_TOKEN) console.warn('[warn] DEBRIEF_APP_TOKEN is not set. The API will refuse all requests until it is.');

const complete = makeClaude({ apiKey: ANTHROPIC_API_KEY });
const server = createApp({ complete, appToken: DEBRIEF_APP_TOKEN, models: { fast: FAST_MODEL } });

server.listen(Number(PORT), () => {
  console.log(`Debrief server listening on http://localhost:${PORT}`);
});

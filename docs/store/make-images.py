"""Makes the Chrome Web Store images in this folder from the built extension (extension/dist/).

    cd extension && npm run build && cd .. && python3 docs/store/make-images.py

Needs Python Playwright and Chrome. Every person and company shown is made up (the Demo's Sam, and seed data below).
"""
import json, pathlib, mimetypes, time, sys
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
DIST = HERE.parent.parent / 'extension' / 'dist'
CHROME = sys.argv[1] if len(sys.argv) > 1 else None
now = int(time.time() * 1000)
H = 3600000
RESUME = ("Backend engineer, 6 years. Northwind (2022 to now): led the rewrite of the checkout endpoint in the Node and Express "
          "orders API; moved price calculation into a cache and email sending onto a queue. Cut query times by 60 percent after "
          "indexing work on Postgres. Mentored two junior engineers. Before that: Contoso (2019 to 2022), building internal "
          "reporting tools in Node and SQL, owning the nightly data jobs and their alerts. Skills: Node.js, TypeScript, Express, "
          "PostgreSQL, Redis, RabbitMQ, Jest, Docker, AWS. Education: BSc Computer Science.")

skills = [{"name": "Node.js APIs", "why": "Owns the orders service"}, {"name": "SQL performance", "why": "Large Postgres tables"}, {"name": "Testing", "why": "Money paths need tests"}]
plan = {"opening": "Ask about the checkout rewrite they led last quarter.",
        "skills": [{"name": "Node.js APIs", "resumeShows": "4 years on an Express orders API; rewrote checkout.", "askAbout": "How they kept the API stable during the rewrite.", "questions": ["What changed in the checkout endpoint, and why?", "How did you roll it out?"]},
                   {"name": "SQL performance", "resumeShows": "Says query times fell 60% after indexing work.", "askAbout": "How the 60% was measured.", "questions": ["How did you find which queries to fix?"]},
                   {"name": "Testing", "resumeShows": "Not mentioned.", "askAbout": "What they test before a release.", "questions": ["What do you test first, and what do you skip?"]}],
        "verify": [{"claim": "Cut query times by 60%", "question": "Over which queries, and measured how?"}],
        "madeFromSkills": [s["name"] for s in skills]}
data = {"jobs": [{"id": "job_1", "title": "Backend engineer", "company": "Northwind", "description": "Node and Postgres", "skills": skills, "status": "open", "createdAt": now, "updatedAt": now}],
        "candidates": [{"id": "cand_1", "jobId": "job_1", "name": "Sam Rivera", "email": "", "profileUrl": "", "resumeText": RESUME, "stage": "interviewed", "interviewAt": "", "plan": plan, "createdAt": now, "updatedAt": now},
                       {"id": "cand_2", "jobId": "job_1", "name": "Priya Nair", "email": "", "profileUrl": "", "resumeText": RESUME, "stage": "scheduled", "interviewAt": "", "plan": plan, "createdAt": now, "updatedAt": now}],
        "interviews": [{"id": "iv_1", "jobId": "job_1", "candidateId": "cand_1", "startedAt": now - 2 * H, "endedAt": now - H,
                        "skills": [{"name": "Node.js APIs", "why": "", "covered": True, "notes": "Rewrote checkout: price cache + email queue. Rolled out behind a flag, 10% then 100%."},
                                   {"name": "SQL performance", "why": "", "covered": True, "notes": "Slow query log, 3 queries = most of the time. 2 indexes, 1 rewrite. 60% = average over those 3, week before vs after."},
                                   {"name": "Testing", "why": "", "covered": True, "notes": "Tests price rules before changing them. Missed a currency rounding case once; found by a support ticket."}],
                        "generalNotes": "Clear on trade-offs. Wants to work closer to product."}]}

STUB = """(() => {
  const fn = () => {}; const ev = { addListener: fn, removeListener: fn, hasListener: () => false };
  const store = { debriefData: %s, debriefSettings: { serverUrl: 'https://api.example.com', appToken: 't', language: 'en', theme: 'light', retentionDays: 90 } };
  const local = { get: async (k) => { const keys = k == null ? Object.keys(store) : typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(k);
      const out = {}; for (const key of keys) { if (key in store) out[key] = structuredClone(store[key]); else if (k && typeof k === 'object' && !Array.isArray(k)) out[key] = k[key]; } return out; },
    set: async (o) => { Object.assign(store, structuredClone(o)); }, remove: async () => {}, clear: async () => {}, getBytesInUse: async () => 0 };
  const deep = (path) => new Proxy(function () {}, { get: (t, p) => (p === 'then' ? undefined : p.startsWith?.('on') ? ev : deep(path + '.' + String(p))), apply: () => Promise.resolve(path.endsWith('query') ? [] : undefined) });
  window.chrome = new Proxy({ storage: { local, onChanged: ev, session: local } }, { get: (t, p) => (p in t ? t[p] : deep(String(p))) });
})();""" % json.dumps(data)

FRAME = """<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1280px; height: 800px; display: flex; font-family: Inter, system-ui, sans-serif; background: #eef1f4; }
  .call { flex: 1; display: flex; flex-direction: column; padding: 40px 36px 36px 48px; gap: 22px; }
  h1 { margin: 0; font-size: 38px; line-height: 1.15; color: #16212b; letter-spacing: -0.5px; }
  p.lead { margin: 0; font-size: 19px; color: #4a5866; max-width: 640px; line-height: 1.45; }
  .stage { flex: 1; border-radius: 16px; background: #1e2a33; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 14px; }
  .tile { border-radius: 12px; background: #2c3a45; position: relative; display: grid; place-items: center; }
  .face { width: 104px; height: 104px; border-radius: 50%%; display: grid; place-items: center; font-size: 40px; font-weight: 600; color: #fff; }
  .tile span { position: absolute; left: 14px; bottom: 12px; color: #dfe6ec; font-size: 15px; }
  .side { width: 420px; padding: 20px 20px 20px 0; box-sizing: border-box; }
  iframe { width: 400px; height: 760px; border: 0; border-radius: 14px; box-shadow: 0 10px 30px rgba(20,30,40,.18); background: #fff; }
</style></head><body>
  <div class="call"><h1>%s</h1><p class="lead">%s</p>
    <div class="stage"><div class="tile"><div class="face" style="background:#3d7a6e">%s</div><span>%s</span></div>
    <div class="tile"><div class="face" style="background:#6b5b95">You</div><span>You</span></div></div></div>
  <div class="side"><iframe src="/panel.html"></iframe></div></body></html>"""

def serve(page):
    def handle(route):
        path = route.request.url.split('debrief.test/', 1)[1].split('?')[0]
        if path.startswith('frame-'):
            return route.fulfill(body=FRAMES[path], content_type='text/html')
        f = DIST / path
        route.fulfill(body=f.read_bytes(), content_type=mimetypes.guess_type(str(f))[0] or 'application/javascript') if f.is_file() else route.fulfill(status=404, body='')
    page.route('http://debrief.test/**', handle)

FRAMES = {
    'frame-live': FRAME % ('Follow-up questions while you listen', 'A skills checklist and a live transcript beside any web call. No bot joins, nothing is recorded.', 'S', 'Sam Rivera'),
    'frame-plan': FRAME % ('An interview plan from the job and the resume', 'What the resume shows for each skill, what to find out, and claims worth checking. Never a score.', 'P', 'Priya Nair'),
    'frame-notes': FRAME % ('Clean notes, ready to share', 'Your notes per skill, kept on your computer. Copy them as Markdown when the call ends.', 'S', 'Sam Rivera'),
}

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}), args=['--no-sandbox'])
    def shot(name, steps):
        page = b.new_page(viewport={'width': 1280, 'height': 800})
        page.add_init_script(STUB)
        serve(page)
        page.goto(f'http://debrief.test/{name}'); page.wait_for_timeout(600)
        steps(page.frame_locator('iframe'), page)
        page.screenshot(path=str(HERE / f'screenshot-{name[6:]}.png'))
        page.close()
    def live(f, page):
        f.locator('#openSettings').click(); f.locator('#setDemo').click(); f.locator('#demoPlay').click()
        page.wait_for_timeout(13500)
    def plan_steps(f, page):
        f.locator('#tab-jobs').click(); page.wait_for_timeout(200)
        f.locator(':text("Backend engineer"):visible').first.click(); page.wait_for_timeout(200)
        f.locator('.cand-card:has-text("Priya Nair") button:has-text("Open")').click(); page.wait_for_timeout(200)
        f.locator('#sec-plan').click(); page.wait_for_timeout(300)
    def notes_steps(f, page):
        f.locator('#tab-jobs').click(); page.wait_for_timeout(200)
        f.locator(':text("Backend engineer"):visible').first.click(); page.wait_for_timeout(200)
        f.locator('.cand-card:has-text("Sam Rivera") button:has-text("Open")').click(); page.wait_for_timeout(300)
    shot('frame-live', live)
    shot('frame-plan', plan_steps)
    shot('frame-notes', notes_steps)

    # Small promo tile, 440 x 280.
    logo = (DIST / 'icons' / 'logo.svg').read_text()
    tile = b.new_page(viewport={'width': 440, 'height': 280})
    tile.set_content('<!doctype html><html><body style="margin:0;width:440px;height:280px;display:flex;flex-direction:column;justify-content:center;gap:14px;padding:0 36px;box-sizing:border-box;background:#1f6f63;font-family:Inter,system-ui,sans-serif;color:#fff">'
                     f'<div style="display:flex;align-items:center;gap:14px"><div style="width:56px;height:56px;background:#fff;border-radius:14px;display:grid;place-items:center">{logo.replace("<svg", "<svg width=40 height=40", 1)}</div>'
                     '<b style="font-size:34px">Debrief</b></div><div style="font-size:19px;line-height:1.35;opacity:.95">Structured interviews and clean notes, beside any web call. No recording, no scores.</div></body></html>')
    tile.screenshot(path=str(HERE / 'promo-small.png'))
    b.close()
print('Wrote', ', '.join(sorted(x.name for x in HERE.glob('*.png'))))

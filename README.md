# Top Tier — Backend

A standalone REST API for a trading-education platform: signup/login,
referrals, social-media task points, streaks, a leaderboard, and a
dashboard summary. Built to be consumed by any frontend over HTTP.

> **Not yet included: the actual invest-and-earn-profit feature.**
> `users.total_contribution` exists as a placeholder column only — nothing
> writes to it, and there's no deposit/payout logic anywhere in this repo.
> That's deliberate: "users invest and get profit from trade results" can
> mean a few very different things (real trades executed via a licensed
> broker API, a paper-trading simulator for education, a manually-managed
> fund) and each has a different build **and different legal
> requirements** — in Nigeria, taking public deposits to trade on people's
> behalf falls under SEC Nigeria's investment-scheme rules regardless of
> what the product is called. Wire this up once that mechanism is decided.

## Stack
Node.js · Express · Supabase Postgres (raw `pg`, no ORM) · JWT auth · node-cron

## 1. Setup

```bash
cd leaderboard-backend
npm install
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` — from your Supabase project: **Settings → Database →
  Connection string → URI**. Use the direct connection (port `5432`) for
  this server; use the pooler (port `6543`) instead if you ever deploy it
  as serverless functions.
- `DB_SSL=true` — required for Supabase, already set in `.env.example`.
- `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`).
  This stays your own — Supabase's own Auth is not used here (see note
  below).
- `ALLOWED_ORIGINS` — the URL(s) your frontend runs on

Apply the schema — either paste `sql/schema.sql` into the Supabase
dashboard's **SQL Editor** and run it, or run it from your machine:

```bash
npm run migrate
```

Start the server:

```bash
npm run dev     # nodemon, auto-restarts on file changes
# or
npm start
```

Health check: `GET http://localhost:5000/health` → `{"status":"ok"}`

> **Note on Supabase Auth:** this backend keeps its own JWT auth
> (bcrypt + jsonwebtoken) rather than Supabase's built-in Auth — that
> keeps `role`, `referral_code`, points, etc. as plain columns on your
> own `users` table instead of needing to sync a second Supabase
> `auth.users` table. If you'd rather use Supabase Auth directly (and
> get Google/email-link login, etc. for free), that's a bigger swap —
> say the word and I'll wire it in instead.

## 2. How it works

- **Signup/login** issue a JWT. The frontend sends it back as
  `Authorization: Bearer <token>` on every protected request.
- **Activity** is anything in `src/config/points.js` — `login`,
  `post_created`, `comment_created`, `like_received`. Add or repoint
  values there; no other file needs to change.
- **Points** update instantly when an activity is logged — the
  leaderboard is never stale by more than one request.
- **Streaks**: logging a `login` activity checks the user's last
  active date. Consecutive days increment the streak; a gap resets it;
  every 7-day milestone auto-awards a bonus.
- **Daily job** (`node-cron`, 00:05 server time): recalculates every
  user's `rank` column, snapshots the day's standings for "top movers",
  and resets each user's `daily_points` counter to zero for the new day.
  Lifetime `total_points` is never reset.
- **Referrals**: every user gets a `referral_code` at signup (e.g.
  `GUDDIE7F2A`). Share it as `https://yourapp.com/join?ref=GUDDIE7F2A` —
  your frontend reads the `ref` query param and sends it as
  `referralCode` in the signup request. The referrer earns
  `POINTS.referral_bonus` the moment the referred user signs up.
- **Tasks** (admin-posted social-media actions — like/comment/reshare):
  an admin creates a task with a link and a point value; users submit a
  claim (optionally with a proof URL/screenshot link) which sits
  `pending`; an admin approves or rejects it. Points are only awarded on
  approval. This is manual-review by design — Instagram/X/Telegram don't
  expose a way to verify a specific user liked a specific post without
  that platform's own API and the account's cooperation.
- **Demo trading**: every user can practice against a simulated market.
  `demo_symbol_prices` holds a handful of instruments (EUR/USD, BTC/USD,
  etc.) that a cron tick nudges every minute with a small random walk;
  opening/closing a position reads/writes against that price. No real
  money, no external market-data dependency to configure. Swap
  `utils/priceSimulator.js` for a real feed later — the open/close logic
  doesn't need to change.
- **Admin control room** (`/api/admin/*`): lists every user with points,
  streak, referrals, and pending-task count in one view; a detail
  endpoint pulls one user's full activity + demo-trading summary; admins
  can suspend/reactivate a user and manually adjust a user's points with
  a logged reason — for scoring effort/quality that doesn't map to one
  of the fixed activity types.

## 3. API reference

| Method | Endpoint                        | Auth       | Body / Query                                          |
|--------|----------------------------------|------------|--------------------------------------------------------|
| POST   | `/api/auth/signup`              | —          | `{ username, email, password, telegramUsername?, referralCode? }` |
| POST   | `/api/auth/login`               | —          | `{ email, password }`                                  |
| POST   | `/api/activity`                 | ✅          | `{ actionType }`                                        |
| GET    | `/api/activity/me`              | ✅          | —                                                        |
| GET    | `/api/leaderboard`              | —          | `?limit=20&offset=0`                                     |
| GET    | `/api/dashboard`                | —          | —                                                        |
| GET    | `/api/dashboard/me`             | ✅          | a single user's own stats + recent activity              |
| GET    | `/api/profile/me`               | ✅          | —                                                        |
| PATCH  | `/api/profile/me`               | ✅          | `{ telegramUsername? }`                                   |
| GET    | `/api/referral/me`              | ✅          | — returns `{ referral_code, referral_count }`            |
| GET    | `/api/tasks`                    | —          | active tasks                                             |
| POST   | `/api/tasks`                    | ✅ admin    | `{ title, description?, link?, points }`                |
| PATCH  | `/api/tasks/:id/deactivate`     | ✅ admin    | —                                                         |
| POST   | `/api/tasks/:id/submit`         | ✅          | `{ proofUrl? }`                                          |
| GET    | `/api/tasks/me`                 | ✅          | the caller's own submissions                             |
| GET    | `/api/tasks/:id/submissions`    | ✅ admin    | —                                                         |
| PATCH  | `/api/tasks/submissions/:id`    | ✅ admin    | `{ status: "approved" \| "rejected" }`                   |
| GET    | `/api/demo/prices`              | —          | current simulated instrument prices                       |
| GET    | `/api/demo/account`             | ✅          | virtual balance + open positions (auto-created)           |
| GET    | `/api/demo/trades`              | ✅          | the caller's trade history                                |
| POST   | `/api/demo/trades`              | ✅          | `{ symbol, side: "buy"\|"sell", size }`                   |
| POST   | `/api/demo/trades/:id/close`    | ✅          | closes at the current simulated price                     |
| GET    | `/api/admin/users`              | ✅ admin    | `?search=&limit=50&offset=0`                              |
| GET    | `/api/admin/users/:id`          | ✅ admin    | full profile + activity + demo-trading summary            |
| PATCH  | `/api/admin/users/:id/status`   | ✅ admin    | `{ status: "active" \| "inactive" }`                      |
| POST   | `/api/admin/users/:id/score`    | ✅ admin    | `{ points, note? }` — points can be negative               |

**Admin access**: there's no signup flow for admins — set `role = 'admin'`
directly on a user's row in the database. Their next login issues a token
carrying that role.

All responses are JSON. Errors: `{ "error": "message" }`.

### Example: signup
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"guddie","email":"g@example.com","password":"secret123"}'
```

### Example: log activity
```bash
curl -X POST http://localhost:5000/api/activity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"actionType":"post_created"}'
```

## 4. Notes for the frontend dev
- CORS is locked to `ALLOWED_ORIGINS` in `.env` — add their dev URL there.
- The leaderboard and dashboard endpoints are public (no auth) since
  they're meant to be displayed openly; flip that in the route files
  if you want them gated.
- `rank` on a user is only accurate after the daily job has run once —
  before that it's `null`. The leaderboard endpoint itself always
  sorts live by `total_points`, so it's correct regardless.

## 5. Project structure
```
src/
├── app.js              Express app + middleware wiring
├── server.js            Entry point, starts the cron job
├── config/               DB pool, migration runner, points config
├── models/               Raw SQL data-access (User, Activity, Snapshot)
├── controllers/          Route handler logic
├── routes/               Express routers
├── middleware/           JWT auth guard, error handler
├── jobs/                 Daily rank/snapshot cron job
└── utils/                Validators, streak math, async wrapper
sql/schema.sql            Table definitions
```

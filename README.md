# DebtClear — AI-Powered Debt Strategy Engine

> **Pay off debt smarter. Save thousands.**
> A mathematically rigorous debt-payoff analyzer that simulates Avalanche vs Snowball strategies on real numbers, then layers an LLM (Amazon Nova Pro via Amazon Bedrock) for personalized, dollar-grounded financial advice, settlement-negotiation scripts, voice-call practice, and downloadable plans.

[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://python.org)
[![Django](https://img.shields.io/badge/Django-5.0-092E20.svg)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-3.15-A30000.svg)](https://www.django-rest-framework.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CDN-06B6D4.svg)](https://tailwindcss.com/)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Nova%20Pro-FF9900.svg)](https://aws.amazon.com/bedrock/)
[![AWS EC2](https://img.shields.io/badge/Deployed-AWS%20EC2-FF9900.svg)](https://aws.amazon.com/ec2/)

**Live demo:** https://debtclear.aryangorde.com

> **Architecture note:** DebtClear is a **pure-Python** application — Django + Django REST Framework on the backend, with the UI served as a single server-rendered template (`templates/index.html`, vanilla HTML/JS, no build step or Node toolchain). There is no TypeScript or JavaScript framework in this project.

---

## The Problem

77% of adults globally carry multiple debts simultaneously — credit cards, student loans, car loans, personal loans. Most people make minimum payments on all of them without realising that **the order in which you pay off debts determines how much total interest you pay**.

Choosing the wrong strategy costs people **thousands of dollars** in unnecessary interest and adds **months or years** to their debt-free date. There is no simple, intelligent tool that explains this clearly and gives personalized guidance grounded in real math.

## The Solution

DebtClear takes a user's debt portfolio (multiple debts with balance, APR, minimum payment) plus monthly income and any extra payment they can afford, and:

1. Simulates **Avalanche** (highest interest rate first), **Snowball** (lowest balance first), and a **minimum-only** baseline month-by-month with real interest compounding.
2. Computes total interest paid, months to debt-free, and the exact dollar / time difference between the two active strategies vs. the do-nothing baseline.
3. Assigns a **Financial Stress Score (0–100)** — AI-assessed from debt-to-income ratio, payment burden, and weighted rate, with the deterministic formula as reference and fallback.
4. Visualises the payoff trajectory, debt mix, milestone timeline, and "cost of waiting" with interactive **Chart.js** charts.
5. Sends the math to **Amazon Nova Pro** (via the Bedrock Converse API) for a 3-paragraph personalised analysis.
6. Exposes a **Negotiate Mode** for every debt — leverage scoring, settlement ranges, and full phone scripts.

The bundled web UI ships the full **analyze** flow (strategies, stress score, charts) and **negotiate** (leverage + phone script). Additional capabilities — the what-if **simulate** endpoint, voice **roleplay**, certified-mail **settlement letters**, and grounded advisor **chat** — are exposed as REST endpoints (see [API](#api)) for programmatic use.

## ⚡ Negotiate Mode

Most consumers don't know that **creditors regularly settle debts for 40–60% of the balance** — banks would rather get partial payment than nothing on a delinquent account. But the average person has no idea what's negotiable, what to ask for, or what to actually say on the phone.

**Negotiate Mode** closes that gap. For every debt in the user's portfolio, DebtClear can:

1. **Analyse leverage** — auto-detect the debt type (credit card, medical, auto, private/federal student loan, personal), score the user's negotiation power 0–100 from their stress score, debt-to-income ratio, and account count.
2. **Compute a realistic settlement range** grounded in real-world creditor behaviour: 40–60% on credit cards, 25–50% on medical, 70–85% on secured auto debt, IDR enrollment instead of settlement on federal student loans.
3. **Generate a 7-section phone script** with the LLM — opening, hardship statement, initial offer, counter-responses for "if they say no" and "if they counter," closing language demanding written agreement, and three things to never say.
4. **Show projected savings** as best/target/worst case scenarios with exact dollar figures.
5. **Practice the call** — a voice roleplay (`/api/roleplay/`) where the user negotiates against an AI collections agent that pushes back, counters, and only settles if they make a strong case.
6. **Generate a formal settlement letter** (`/api/letter/`) — certified-mail-ready text the user can copy or print.

Every engine ships with a deterministic fallback so the app never produces an empty card, even when Bedrock is unreachable.

## Tech Stack

| Layer       | Choice                                                                                                |
|-------------|-------------------------------------------------------------------------------------------------------|
| **Backend** | Python 3.12, Django 5.0, Django REST Framework 3.15, django-cors-headers, python-dotenv               |
| **AI**      | **Amazon Bedrock** — Amazon Nova Pro via the Converse API (sole provider) with deterministic per-engine fallback; override with `BEDROCK_MODEL` |
| **AI infra**| Single Bedrock client (`api/bedrock_client.py`), one retry on throttle/capacity errors only, 30s read timeout |
| **Frontend**| Server-rendered Django template (`templates/index.html`) — vanilla HTML + JS, **no build step or Node toolchain**. Tailwind via CDN, Chart.js 4 for charts, GSAP + ScrollTrigger + Lenis for motion |
| **Server**  | Gunicorn (Django) behind Nginx, TLS via Let's Encrypt                                                  |
| **Static**  | WhiteNoise for Django static files                                                                    |
| **Deploy**  | **AWS EC2** (Amazon Linux, single instance, one systemd unit: `debtclear`)                            |

## Architecture

```
   Browser
      │  HTTPS
      ▼
┌──────────────────────── AWS EC2 (Amazon Linux) ────────────────────────┐
│                                                                         │
│   Nginx (TLS, reverse proxy)  ──►  Django + Gunicorn (systemd: debtclear)
│                                      • serves templates/index.html (UI) │
│                                      • DRF JSON API under /api/          │
│                                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                      │
                       ┌──────────────┴───────────────┐
                       │       api/views.py (DRF)      │
                       │  analyze · simulate ·         │
                       │  negotiate · roleplay ·       │
                       │  letter · chat · health       │
                       └──────────────┬───────────────┘
                                      │
      ┌───────────┬──────────────────┼──────────────────┬─────────────┐
      ▼           ▼                  ▼                  ▼             ▼
 debt_engine  ai_advisor    negotiation_engine     chat_engine   letter_generator
 • month-by-  • 3-para      • leverage 0–100        • grounded    • formal
   month sim    analysis    • settlement ranges       Q&A           certified-mail
 • Avalanche                • debt-type detection    • full          letter
   & Snowball                • → script_generator      snapshot   roleplay_engine
 • min-only                    (7-section script)      in context  • turn-by-turn
   baseline                                                          creditor agent
 • stress score
 • pure Python
                                      │
                                      ▼
                          api/bedrock_client.py
              • auth: AWS_BEARER_TOKEN_BEDROCK, else AWS chain
              • converse(): Bedrock Converse API, 30s read timeout
              • one retry on throttle/capacity only; never on 4xx
                                      │
                        fallback if the call fails
                                      ▼
            Deterministic per-engine fallback (data-driven)
```

The payoff **simulation** in `api/debt_engine.py` is **deterministic and pure-Python** — no ML, no random sampling — so every dollar in the charts and payoff timeline traces to that file. On top of the exact math, the LLM makes the **judgement calls** (financial stress score; and in Negotiate Mode the debt-type classification, leverage score, and hardship factors) and writes all the prose (analysis, chat, scripts, letters). Each judgement call falls back to a deterministic rule when Bedrock is unavailable, and the settlement **dollar figures** are always exact arithmetic — the LLM influences the percentages, never multiplies the numbers itself.

### Why Bedrock only?

- **Amazon Nova Pro** covers every engine from one endpoint, with quotas that can be raised per-account rather than a fixed free-tier ceiling. The previous provider's 8,000 tokens/min limit was reachable by a single user completing one analyze → negotiate flow.
- **One provider, one auth path.** `api/bedrock_client.py` is the only module that talks to a model; every engine calls `converse()`. Swapping models is a `BEDROCK_MODEL` change, and swapping providers touches one file.
- **Retries are deliberate, not blanket.** Throttling and capacity errors get one retry; `ValidationException` and `AccessDeniedException` do not, because they fail identically the second time.
- If Bedrock is unreachable, every engine returns a deterministic, data-driven response built from the user's actual numbers — the app never breaks, and the UI says so in amber rather than passing canned text off as AI output.

### LLM call parameters per engine

| Engine                | `max_tokens` | `temperature` | Purpose                       |
|-----------------------|--------------|---------------|-------------------------------|
| `ai_advisor` (analysis)     | 800  | 0.4 | 3-paragraph plan analysis                          |
| `ai_advisor` (stress score) | 30   | 0.2 | Financial stress score 0–100 (JSON)                |
| `chat_engine`               | 300  | 0.5 | Short Q&A turns                                    |
| `script_generator`          | 1500 | 0.3 | Full 7-section phone script                        |
| `roleplay_engine`           | 200  | 0.7 | Single creditor turn                               |
| `letter_generator`          | 1000 | 0.3 | Formal settlement letter body                      |
| `negotiation_engine`        | 250  | 0.3 | Debt type + leverage + hardship + settlement (JSON)|

The frontend is a single server-rendered page (`templates/index.html`) served by Django at `/`. The debt form, results dashboard, and negotiate panels are all sections within that page, updated client-side from the JSON API — no separate frontend server or client-side routing.

## Local Setup

```bash
# 1. Clone
git clone https://github.com/aryangorde8/debtclearr.git debtclear
cd debtclear

# 2. Create venv & install
python -m venv venv
source venv/bin/activate         # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env             # then add AWS_BEARER_TOKEN_BEDROCK

# 4. Run Django (serves both the UI and the API)
python manage.py runserver       # → http://127.0.0.1:8000
```

That's the whole app — there is no separate frontend to build or run. Open the printed URL and the UI is served directly by Django.

If you don't add Bedrock credentials, the app still works — every engine falls back to a deterministic, data-driven response that uses the user's actual numbers, and the UI flags it. Add `AWS_BEARER_TOKEN_BEDROCK` (or any AWS credential with `bedrock:InvokeModel`) to switch on Nova Pro.

## Required Environment Variables

Backend (`.env` at repo root, loaded via `python-dotenv`):

```bash
# ── Django ───────────────────────────────────────────────────────────────────
DJANGO_SECRET_KEY=<generate-a-long-random-string>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,debtclear.aryangorde.com

# ── Amazon Bedrock (the only AI provider) ────────────────────────────────────
AWS_BEARER_TOKEN_BEDROCK=your-bedrock-api-key
BEDROCK_REGION=eu-north-1
# Optional — omit to use the in-code default (api/bedrock_client.py: DEFAULT_MODEL).
# Nova Pro has no In-Region endpoint in eu-north-1; the EU geo profile is required.
# BEDROCK_MODEL=eu.amazon.nova-pro-v1:0
```

The UI is served from the same Django origin as the API, so there is no separate frontend configuration to set.

## API

Base path: `/api/` (reverse-proxied to Django by Nginx in production).

### `POST /api/analyze/`

Full debt analysis with both strategies, stress score, and AI commentary.

**Request**
```json
{
  "monthly_income": 5000,
  "extra_payment": 200,
  "debts": [
    { "name": "Credit Card",  "balance": 5000,  "rate": 22.99, "min_payment": 100 },
    { "name": "Student Loan", "balance": 15000, "rate": 6.5,   "min_payment": 200 }
  ]
}
```

**Response** _(abbreviated)_
```json
{
  "stress_score": 41,
  "total_debt": 20000.00,
  "weighted_avg_rate": 10.62,
  "avalanche":     { "months": 47, "total_interest": 4218.73, "payoff_timeline": [20000.00, ...], "payoff_order": ["Credit Card", "Student Loan"], "converged": true },
  "snowball":      { "months": 47, "total_interest": 4502.18, "payoff_timeline": [20000.00, ...], "payoff_order": ["Credit Card", "Student Loan"], "converged": true },
  "minimum_only":  { "months": 89, "total_interest": 9842.10 },
  "interest_saved": 283.45,
  "months_saved": 0,
  "recommended_strategy": "avalanche",
  "ai_analysis": "You're carrying $20,000 in total debt against $5,000/mo income...",
  "ai_source": "bedrock"
}
```

`ai_source` is one of `bedrock` or `fallback`.

### `POST /api/simulate/`

Lightweight what-if endpoint — same simulation as `/api/analyze/` but skips the LLM call. Recomputes payoff numbers for a given extra-payment amount.

### `POST /api/negotiate/`

Leverage analysis + 7-section phone script for a single debt.

**Request**
```json
{
  "debt": { "name": "Chase Sapphire", "balance": 5000, "rate": 22.99, "min_payment": 100 },
  "financial_context": { "monthly_income": 5000, "total_debt": 20000, "stress_score": 72 },
  "debt_count": 3
}
```

**Response** _(abbreviated)_
```json
{
  "leverage_analysis": {
    "debt_type": "credit_card",
    "leverage_score": 100,
    "settlement_low": 40, "settlement_high": 60, "settlement_target": 50,
    "hardship_factors": ["Carrying multiple concurrent debts", "..."],
    "notes": []
  },
  "savings":       { "original_balance": 5000, "settlement_amount": 2500, "dollars_saved": 2500, "percentage_saved": 50 },
  "savings_range": { "best_case": {...}, "target": {...}, "worst_case": {...} },
  "script": {
    "sections": {
      "opening": "...", "hardship": "...", "initial_offer": "...",
      "if_they_say_no": "...", "if_they_counter": "...",
      "closing": "...", "avoid": "..."
    },
    "section_order": [...],
    "source": "bedrock"
  }
}
```

### `POST /api/roleplay/`

Turn-by-turn creditor-AI dialogue for the practice-call feature.

**Request**
```json
{
  "debt": { "name": "Chase Sapphire", "balance": 5000, "rate": 22.99, "min_payment": 100 },
  "leverage": { ... },
  "history": [{ "role": "user|creditor", "text": "..." }]
}
```

**Response**
```json
{ "message": "Sarah's next line", "status": "active|settled|declined", "settlement_amount": 2400 }
```

### `POST /api/letter/`

Returns a formal settlement-letter body, ready to print and certify-mail.

**Request**
```json
{
  "debt": { ... },
  "leverage": { ... },
  "financial_context": { "monthly_income": 5000, "total_debt": 20000 }
}
```

**Response**
```json
{ "body": "Re: Account #...\n\nDear Sir or Madam,\n\nI am writing to propose...", "source": "bedrock" }
```

### `POST /api/chat/`

Grounded advisor Q&A — the LLM receives the user's full financial snapshot plus the rolling chat history and answers using their actual numbers.

**Request**
```json
{
  "snapshot": { "monthly_income": 5000, "total_debt": 20000, "debts": [...], "stress_score": 41, ... },
  "history":  [{ "role": "user|assistant", "content": "..." }],
  "question": "Should I stop investing to pay this off faster?"
}
```

**Response** `{ "text": "...", "source": "bedrock" }`

### `GET /api/health/`

Returns `{"status": "ok"}` for uptime monitoring.

## Deployment (AWS EC2)

The production stack runs on a single Amazon Linux EC2 instance:

- **Django** on Gunicorn (`core.wsgi`), managed by systemd unit `debtclear`. Django serves both the UI (`templates/index.html`) and the `/api/` endpoints.
- **Nginx** in front, terminating TLS (Let's Encrypt) and reverse-proxying all traffic to Gunicorn.
- **Static files** collected with `python manage.py collectstatic` and served via WhiteNoise.

### CI/CD — auto-deploy on push

Deploys are automated with GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Every push to `main`:

1. **check** — runs `python manage.py check` + `collectstatic` so a broken build never ships.
2. **deploy** — SSHes into the EC2 box, `git reset --hard origin/main`, then runs [`deploy/remote_deploy.sh`](deploy/remote_deploy.sh) (sync deps → collectstatic → check → `systemctl restart debtclear`).

```
git push main ─▶ GitHub Actions ─▶ ssh ec2 ─▶ git reset --hard ─▶ pip install ─▶ collectstatic ─▶ restart gunicorn ─▶ live
```

One-time setup (deploy SSH key + the `EC2_HOST` / `EC2_USER` / `EC2_SSH_KEY` repo secrets) is in **[DEPLOY.md](DEPLOY.md)**. You can also trigger a deploy manually from the repo's **Actions** tab.

## What's Next

- Plaid integration for automatic debt import
- Per-debt extra-payment allocation (split extra across multiple debts)
- Hybrid strategies (start Snowball for psychological wins, switch to Avalanche)
- Creditor-specific negotiation intelligence (different scripts for Capital One vs. medical debt vs. private student loans)
- Currency selection for non-USD users
- Save analyses with a magic-link account

## License

MIT — built by Aryan Gorde.
</content>
</invoke>

# DebtClear — AI-Powered Debt Strategy Engine

> **Pay off debt smarter. Save thousands.**
> A mathematically rigorous debt-payoff analyzer that simulates Avalanche vs Snowball strategies on real numbers, then layers a fast LLM (Llama 3.3 70B via Groq) for personalized, dollar-grounded financial advice, settlement-negotiation scripts, voice-call practice, and downloadable plans.

[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://python.org)
[![Django](https://img.shields.io/badge/Django-5.0-092E20.svg)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-3.15-A30000.svg)](https://www.django-rest-framework.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CDN-06B6D4.svg)](https://tailwindcss.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-F55036.svg)](https://groq.com/)
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
3. Calculates a **Financial Stress Score (0–100)** combining debt-to-income ratio, monthly-payment burden, and weighted average rate.
4. Visualises the payoff trajectory, debt mix, milestone timeline, and "cost of waiting" with interactive **Chart.js** charts.
5. Sends the math to **Llama 3.3 70B** (via Groq's low-latency inference API) for a 3-paragraph personalised analysis.
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

Every engine ships with a deterministic fallback so the app never produces an empty card, even when Groq is unreachable.

## Tech Stack

| Layer       | Choice                                                                                                |
|-------------|-------------------------------------------------------------------------------------------------------|
| **Backend** | Python 3.12, Django 5.0, Django REST Framework 3.15, django-cors-headers, python-dotenv               |
| **AI**      | **Groq** — `llama-3.3-70b-versatile` (sole provider) with deterministic per-engine fallback           |
| **AI infra**| Multi-key Groq client pool (`api/groq_pool.py`) with round-robin failover, 20s hard timeout, `max_retries=0` |
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
                            api/groq_pool.py
                 • reads GROQ_API_KEYS (comma-separated)
                 • builds N Groq clients, max_retries=0, 20s timeout
                 • call_with_failover(fn) iterates until success
                                      │
                          fallback if all keys fail
                                      ▼
            Deterministic per-engine fallback (data-driven)
```

The simulation in `api/debt_engine.py` is **deterministic and pure-Python** — no hidden ML, no random sampling. Every dollar shown in the UI is traceable to that file. The LLM is given the math and writes the prose; it never invents the numbers.

### Why Groq only?

- **Llama 3.3 70B Versatile on Groq** runs at ~hundreds of tokens/sec, keeping the analyze and negotiate flows under ~2 seconds end-to-end — fast enough that the UI never feels like it's waiting on an LLM.
- A **multi-key Groq pool** (`api/groq_pool.py`) round-robins across keys with automatic failover so a single rate-limited key doesn't break the demo. Each client is built with `max_retries=0` and a 20-second timeout so failover happens fast.
- If every Groq key is rate-limited or unreachable, every engine returns a deterministic, data-driven response built from the user's actual numbers — the app never breaks.

### LLM call parameters per engine

| Engine                | `max_tokens` | `temperature` | Purpose                       |
|-----------------------|--------------|---------------|-------------------------------|
| `ai_advisor`          | 800          | 0.4           | 3-paragraph plan analysis      |
| `chat_engine`         | 300          | 0.5           | Short Q&A turns                |
| `script_generator`    | 1500         | 0.3           | Full 7-section phone script    |
| `roleplay_engine`     | 200          | 0.7           | Single creditor turn           |
| `letter_generator`    | 1000         | 0.3           | Formal settlement letter body  |
| `negotiation_engine`  | 60           | 0.2           | Settlement-range JSON          |

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
cp .env.example .env             # then add GROQ_API_KEYS

# 4. Run Django (serves both the UI and the API)
python manage.py runserver       # → http://127.0.0.1:8000
```

That's the whole app — there is no separate frontend to build or run. Open the printed URL and the UI is served directly by Django.

If you don't add Groq credentials, the app still works — every engine falls back to a deterministic, data-driven response that uses the user's actual numbers. Add `GROQ_API_KEYS` (comma-separated for the multi-key pool) to switch on Llama 3.3.

## Required Environment Variables

Backend (`.env` at repo root, loaded via `python-dotenv`):

```bash
# ── Django ───────────────────────────────────────────────────────────────────
DJANGO_SECRET_KEY=<generate-a-long-random-string>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,debtclear.aryangorde.com

# ── Groq (the only AI provider — Llama 3.3 70B Versatile) ────────────────────
# Comma-separated keys enable the multi-key failover pool. A single key works too.
GROQ_API_KEYS=gsk_key_one,gsk_key_two,gsk_key_three
GROQ_MODEL=llama-3.3-70b-versatile
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
  "ai_source": "groq"
}
```

`ai_source` is one of `groq` or `fallback`.

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
    "source": "groq"
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
{ "body": "Re: Account #...\n\nDear Sir or Madam,\n\nI am writing to propose...", "source": "groq" }
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

**Response** `{ "text": "...", "source": "groq" }`

### `GET /api/health/`

Returns `{"status": "ok"}` for uptime monitoring.

## Deployment (AWS EC2)

The production stack runs on a single Amazon Linux EC2 instance:

- **Django** on Gunicorn (`core.wsgi`), managed by systemd unit `debtclear`. Django serves both the UI (`templates/index.html`) and the `/api/` endpoints.
- **Nginx** in front, terminating TLS (Let's Encrypt) and reverse-proxying all traffic to Gunicorn.
- **Static files** collected with `python manage.py collectstatic` and served via WhiteNoise.

Deploy steps after a code change:

```bash
ssh -i ~/debtclear-key.pem ec2-user@<host>
cd ~/debtclear
git pull
source venv/bin/activate && pip install -r requirements.txt
python manage.py collectstatic --noinput
sudo systemctl restart debtclear
```

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

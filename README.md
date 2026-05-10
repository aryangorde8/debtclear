# DebtClear — AI-Powered Debt Strategy Engine

> **Pay off debt smarter. Save thousands.**
> A mathematically rigorous debt-payoff analyzer that simulates Avalanche vs Snowball strategies on real numbers, then layers a fast LLM (Llama 3.3 70B via Groq, with Anthropic Claude as fallback) for personalized, dollar-grounded financial advice, settlement-negotiation scripts, voice-call practice, and downloadable plans.

[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://python.org)
[![Django](https://img.shields.io/badge/Django-5.0-092E20.svg)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-3.15-A30000.svg)](https://www.django-rest-framework.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4.svg)](https://tailwindcss.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-F55036.svg)](https://groq.com/)
[![Claude](https://img.shields.io/badge/Fallback-Claude%20Sonnet%204.6-D97757.svg)](https://www.anthropic.com/)
[![AWS EC2](https://img.shields.io/badge/Deployed-AWS%20EC2-FF9900.svg)](https://aws.amazon.com/ec2/)

**Live demo:** https://debtclear.aryangorde.com

---

## The Problem

77% of adults globally carry multiple debts simultaneously — credit cards, student loans, car loans, personal loans. Most people make minimum payments on all of them without realising that **the order in which you pay off debts determines how much total interest you pay**.

Choosing the wrong strategy costs people **thousands of dollars** in unnecessary interest and adds **months or years** to their debt-free date. There is no simple, intelligent tool that explains this clearly and gives personalized guidance grounded in real math.

## The Solution

DebtClear takes a user's debt portfolio (multiple debts with balance, APR, minimum payment) plus monthly income and any extra payment they can afford, and:

1. Simulates **Avalanche** (highest interest rate first), **Snowball** (lowest balance first), and a **minimum-only** baseline month-by-month with real interest compounding.
2. Computes total interest paid, months to debt-free, and the exact dollar / time difference between the two active strategies vs. the do-nothing baseline.
3. Calculates a **Financial Stress Score (0–100)** combining debt-to-income ratio, monthly-payment burden, and weighted average rate.
4. Visualises the payoff trajectory, debt mix, milestone timeline, and "cost of waiting" with interactive Recharts charts.
5. Sends the math to **Llama 3.3 70B** (via Groq's low-latency inference API) for a 3-paragraph personalised analysis, with **Anthropic Claude Sonnet 4.6** wired as a direct-API fallback for resilience.
6. Lets the user **chat with an AI advisor** that has their full snapshot in context ("what if I lose my job?", "should I refinance?").
7. Exposes a **Negotiate Mode** for every debt — leverage scoring, settlement ranges, full phone scripts, voice roleplay, and certified-mail letters.
8. Exports the entire plan as a **downloadable PDF**.

## ⚡ Negotiate Mode

Most consumers don't know that **creditors regularly settle debts for 40–60% of the balance** — banks would rather get partial payment than nothing on a delinquent account. But the average person has no idea what's negotiable, what to ask for, or what to actually say on the phone.

**Negotiate Mode** closes that gap. For every debt in the user's portfolio, DebtClear can:

1. **Analyse leverage** — auto-detect the debt type (credit card, medical, auto, private/federal student loan, personal), score the user's negotiation power 0–100 from their stress score, debt-to-income ratio, and account count.
2. **Compute a realistic settlement range** grounded in real-world creditor behaviour: 40–60% on credit cards, 25–50% on medical, 70–85% on secured auto debt, IDR enrollment instead of settlement on federal student loans.
3. **Generate a 7-section phone script** with the LLM — opening, hardship statement, initial offer, counter-responses for "if they say no" and "if they counter," closing language demanding written agreement, and three things to never say.
4. **Show projected savings** as best/target/worst case scenarios with exact dollar figures.
5. **Practice the call** — a built-in voice roleplay where the user negotiates against an AI collections agent that pushes back, counters, and only settles if they make a strong case (Web Speech API for STT/TTS).
6. **Generate a formal settlement letter** — certified-mail-ready text the user can copy or download as PDF.

Every engine ships with a deterministic fallback so the app never produces an empty card, even when both LLM providers are unreachable.

## Tech Stack

| Layer       | Choice                                                                                                |
|-------------|-------------------------------------------------------------------------------------------------------|
| **Backend** | Python 3.12, Django 5.0, Django REST Framework 3.15, django-cors-headers, python-dotenv               |
| **AI**      | **Groq** (`llama-3.3-70b-versatile`) primary · **Anthropic** (`claude-sonnet-4-6`) fallback · deterministic last-resort |
| **AI infra**| Multi-key Groq client pool (`api/groq_pool.py`) with round-robin failover, 20s hard timeout, `max_retries=0` |
| **Frontend**| Next.js 14 (App Router), TypeScript 5, Tailwind CSS 3.4, Framer Motion 12, Recharts 3, jsPDF 4, Lucide icons, Sonner toasts |
| **UI primitives** | shadcn/ui on top of Radix UI (dialog, progress, slot, tabs, tooltip)                            |
| **Visuals** | Custom WebGL fragment shader (animated nebula background, adaptive resolution on mobile)              |
| **Voice**   | Browser Web Speech API (SpeechRecognition + SpeechSynthesis) for the phone-roleplay feature           |
| **Server**  | Gunicorn (Django, port 8002), `next start` via systemd, Nginx reverse proxy with TLS                  |
| **Static**  | WhiteNoise for Django static files; Next.js handles its own static assets                              |
| **Deploy**  | **AWS EC2** (Amazon Linux, single instance, two systemd units: `debtclear` + `debtclear-frontend`)    |

## Architecture

```
                              ┌───────────────────────────────────────┐
                              │         AWS EC2 (Amazon Linux)        │
                              │  ┌────────────────────────────────┐   │
   Browser  ───── HTTPS ─────►│  │   Nginx (reverse proxy + TLS)  │   │
                              │  └────┬──────────────────┬────────┘   │
                              │       │                  │            │
                              │       │ /api/*           │ everything │
                              │       ▼                  ▼ else        │
                              │  ┌─────────────┐   ┌────────────────┐ │
                              │  │ Django +    │   │ Next.js 14     │ │
                              │  │ Gunicorn    │   │ (next start)   │ │
                              │  │ :8002       │   │ :3005          │ │
                              │  │ systemd     │   │ systemd        │ │
                              │  └──────┬──────┘   └────────────────┘ │
                              └─────────┼─────────────────────────────┘
                                        │
            ┌───────────────────────────┴───────────────────────────┐
            │                  api/views.py (DRF)                   │
            │   /api/analyze · /api/simulate · /api/negotiate ·     │
            │   /api/roleplay · /api/letter · /api/chat · /api/health
            └─┬───────┬───────────┬──────────┬─────────┬───────────┬┘
              │       │           │          │         │           │
              ▼       ▼           ▼          ▼         ▼           ▼
       ┌───────────┐ ┌────────────┐ ┌───────────────┐ ┌───────────────────┐
       │debt_engine│ │ai_advisor  │ │negotiation_   │ │   chat_engine     │
       │ • month-  │ │• 3-para    │ │ engine        │ │• grounded Q&A     │
       │   by-     │ │  analysis  │ │• leverage     │ │• full snapshot    │
       │   month   │ │            │ │  0–100        │ │  in context        │
       │   sim     │ │            │ │• settlement   │ │                    │
       │ • Avalan- │ │            │ │  ranges       │ │                    │
       │   che &   │ │            │ │• debt-type    │ ├───────────────────┤
       │   Snow-   │ │            │ │  detection    │ │  letter_generator │
       │   ball    │ │            │ └─────┬─────────┘ │• formal certified-│
       │ • min-    │ │            │       │           │  mail letter      │
       │   only    │ │            │       ▼           ├───────────────────┤
       │   base-   │ │            │ ┌──────────────┐  │  roleplay_engine  │
       │   line    │ │            │ │script_       │  │• turn-by-turn     │
       │ • stress  │ │            │ │ generator    │  │  creditor agent   │
       │   score   │ │            │ │• 7-section   │  │• status: active / │
       │ • pure    │ │            │ │  phone script│  │  settled/declined │
       │   Python  │ │            │ └──────────────┘  └───────────────────┘
       └───────────┘ └─────┬──────┘
                           │
                           ▼
                  ┌────────────────────────────────────────────────┐
                  │              api/groq_pool.py                  │
                  │  • Reads GROQ_API_KEYS (comma-separated)        │
                  │  • Builds N Groq clients, max_retries=0, 20s tmo│
                  │  • call_with_failover(fn) iterates until success│
                  └─────────────────┬──────────────────────────────┘
                                    │
                          fallback if all keys fail
                                    ▼
                  ┌────────────────────────────────────────────────┐
                  │     Anthropic Claude (claude-sonnet-4-6)       │
                  │  Direct Anthropic API — NOT AWS Bedrock         │
                  └─────────────────┬──────────────────────────────┘
                                    │
                       fallback if Anthropic fails
                                    ▼
                  ┌────────────────────────────────────────────────┐
                  │ Deterministic per-engine fallback (data-driven)│
                  └────────────────────────────────────────────────┘
```

The simulation in `api/debt_engine.py` is **deterministic and pure-Python** — no hidden ML, no random sampling. Every dollar shown in the UI is traceable to that file. The LLM is given the math and writes the prose; it never invents the numbers.

### Why Groq + Claude fallback?

- **Groq's Llama 3.3 70B inference** runs at ~hundreds of tokens/sec, keeping the analyze and negotiate flows under ~2 seconds end-to-end.
- A **multi-key Groq pool** (`api/groq_pool.py`) round-robins across keys with automatic failover so a single rate-limited key doesn't break the demo. Each client is built with `max_retries=0` and a 20-second timeout so failover happens fast.
- If every Groq key is exhausted, calls fall through to **Anthropic Claude Sonnet 4.6** via the direct Anthropic API (not AWS Bedrock).
- If both providers are down, every engine returns a deterministic, data-driven response built from the user's actual numbers — the app never breaks.

### LLM call parameters per engine

| Engine                | `max_tokens` | `temperature` | Purpose                       |
|-----------------------|--------------|---------------|-------------------------------|
| `ai_advisor`          | 800          | 0.4           | 3-paragraph plan analysis      |
| `chat_engine`         | 300          | 0.5           | Short Q&A turns                |
| `script_generator`    | (large)      | 0.6           | Full 7-section phone script    |
| `roleplay_engine`     | 200          | 0.7           | Single creditor turn           |
| `letter_generator`    | 1000         | 0.3           | Formal settlement letter body  |
| `negotiation_engine`  | 60           | 0.2           | Leverage analysis (small JSON) |

Frontend routes are static: `/` (hero), `/how-it-works`, `/analyze` (debt form), `/results` (dashboard). Result data passes from `/analyze` to `/results` via `localStorage`.

## Local Setup

### Backend

```bash
# 1. Clone
git clone https://github.com/aryangorde8/debtclearr.git debtclear
cd debtclear

# 2. Create venv & install
python -m venv venv
source venv/bin/activate         # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env             # then add GROQ_API_KEYS / ANTHROPIC_API_KEY

# 4. Run Django on port 8002 (the frontend expects this)
python manage.py runserver 0.0.0.0:8002
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local 2>/dev/null || true   # optional
npm run dev                       # → http://localhost:3000
```

If you don't add Groq or Anthropic credentials, the app still works — every engine falls back to a deterministic, data-driven response that uses the user's actual numbers. Add `GROQ_API_KEYS` (comma-separated for the multi-key pool) to switch on Llama 3.3, and optionally `ANTHROPIC_API_KEY` for the Claude fallback.

## Required Environment Variables

Backend (`.env` at repo root, loaded via `python-dotenv`):

```bash
# ── Django ───────────────────────────────────────────────────────────────────
DJANGO_SECRET_KEY=<generate-a-long-random-string>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,debtclear.aryangorde.com

# ── Groq (PRIMARY AI: Llama 3.3 70B Versatile) ───────────────────────────────
# Comma-separated keys enable the multi-key failover pool. A single key works too.
GROQ_API_KEYS=gsk_key_one,gsk_key_two,gsk_key_three
GROQ_MODEL=llama-3.3-70b-versatile

# ── Anthropic Claude (FALLBACK — used only if every Groq key is rate-limited) ─
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Frontend (`frontend/.env.local`):

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8002    # Django origin in dev
```

In production both env files are populated on the EC2 instance; the frontend points at the same origin (`/api/*` is reverse-proxied to Django by Nginx) so `NEXT_PUBLIC_API_BASE` can be left empty or omitted.

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

`ai_source` is one of `groq`, `claude`, or `fallback`.

### `POST /api/simulate/`

Lightweight what-if endpoint — same simulation as `/api/analyze/` but skips the AI call. Used by the in-app "what-if slider" to recompute payoff numbers as the user drags the extra-payment slider.

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

- **Django** on Gunicorn bound to `127.0.0.1:8002`, managed by systemd unit `debtclear`.
- **Next.js** built with `npm run build` and served by `next start` on `127.0.0.1:3005`, managed by systemd unit `debtclear-frontend`.
- **Nginx** in front, terminating TLS (Let's Encrypt) and reverse-proxying `/api/*` to Django (`:8002`) and everything else to Next.js (`:3005`).
- **Static files** for Django collected with `python manage.py collectstatic` and served via WhiteNoise.

Deploy steps after a code change:

```bash
ssh -i ~/debtclear-key.pem ec2-user@<host>
cd ~/debtclear
git pull
# backend changed:
source venv/bin/activate && pip install -r requirements.txt
sudo systemctl restart debtclear
# frontend changed:
cd frontend && npm install && npm run build
sudo systemctl restart debtclear-frontend
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

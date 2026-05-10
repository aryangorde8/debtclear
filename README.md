# DebtClear — AI-Powered Debt Strategy Engine

> **Pay off debt smarter. Save thousands.**
> A mathematically rigorous debt-payoff analyzer that compares Avalanche vs Snowball strategies on real numbers, then asks an LLM (Llama 3.3 70B via Groq, with Anthropic Claude as fallback) to give personalized, specific financial advice grounded in the user's exact figures.

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://python.org) [![Django](https://img.shields.io/badge/Django-5.0-092E20.svg)](https://www.djangoproject.com/) [![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/) [![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-F55036.svg)](https://groq.com/) [![AWS EC2](https://img.shields.io/badge/Deployed-AWS%20EC2-FF9900.svg)](https://aws.amazon.com/ec2/)

**Live demo:** _https://debtclear.aryangorde.com_

---

## The Problem

77% of adults globally carry multiple debts simultaneously — credit cards, student loans, car loans, personal loans. Most people make minimum payments on all of them without realising that **the order in which you pay off debts determines how much total interest you pay**.

Choosing the wrong strategy costs people **thousands of dollars** in unnecessary interest and adds **months or years** to their debt-free date. There is no simple, intelligent tool that explains this clearly and gives personalized guidance grounded in real math.

## The Solution

DebtClear takes a user's debt portfolio (multiple debts with balance, APR, minimum payment) and:

1. Simulates **Avalanche** (highest interest rate first) and **Snowball** (lowest balance first) strategies month-by-month with real interest compounding.
2. Computes total interest paid, months to debt-free, and the exact dollar difference between the two strategies.
3. Calculates a **Financial Stress Score (0–100)** combining debt-to-income ratio, monthly-payment burden, and weighted average rate.
4. Visualises the payoff trajectory and current debt mix with interactive charts.
5. Sends the mathematical results to **Llama 3.3 70B** (via Groq's low-latency inference API), which returns three paragraphs of specific, dollar-grounded advice. Anthropic Claude Sonnet 4.6 is wired as a fallback for resilience.

## ⚡ Negotiate Mode

Most consumers don't know that **creditors regularly settle debts for 40–60% of the balance** — banks would rather get partial payment than nothing on a delinquent account. But the average person has no idea what's negotiable, what to ask for, or what to actually say on the phone.

**Negotiate Mode** closes that gap. For every debt in the user's portfolio, DebtClear can:

1. **Analyse leverage** — auto-detect the debt type (credit card, medical, auto, private/federal student loan, personal), score the user's negotiation power 0–100 from their stress score, debt-to-income ratio, and account count.
2. **Compute a realistic settlement range** grounded in real-world creditor behaviour: 40–60% on credit cards, 25–50% on medical, 70–85% on secured auto debt, IDR enrollment instead of settlement on federal student loans.
3. **Generate a phone-call script** with the LLM — opening, hardship statement, initial offer (low end of the range), counter-responses, closing language demanding written agreement, and three things to never say.
4. **Show projected savings** as best/target/worst case scenarios with exact dollar figures.
5. **Practice the call** — a built-in voice roleplay where users negotiate against an AI collections agent that pushes back, counters, and only settles if the user makes a strong case (Web Speech API for STT/TTS).
6. **Generate a formal settlement letter** — certified-mail-ready PDF for users who'd rather negotiate in writing.

The script is structured into named sections so the UI can render each one with its own visual treatment, money figures highlighted inline. A deterministic fallback generator ships with the project so the demo never produces an empty card.

### `POST /api/negotiate/`

**Request**
```json
{
  "debt": { "name": "Chase Sapphire Credit Card", "balance": 5000, "rate": 22.99, "min_payment": 100 },
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
    "hardship_factors": ["Carrying multiple concurrent debts", "Limited monthly cash flow after minimums", "High interest rate burden on this account"],
    "notes": []
  },
  "savings":       { "original_balance": 5000.00, "settlement_amount": 2500.00, "dollars_saved": 2500.00, "percentage_saved": 50.0 },
  "savings_range": { "best_case": {...}, "target": {...}, "worst_case": {...} },
  "script": {
    "sections": {
      "opening": "Hi, I'm calling about my account with...",
      "hardship": "...",
      "initial_offer": "I can offer $2,000.00 as a one-time lump-sum settlement...",
      "if_they_say_no": "...",
      "if_they_counter": "...",
      "closing": "...",
      "avoid": "- Don't disclose the full amount you have available..."
    },
    "section_order": [...],
    "source": "groq"
  },
  "debt": { "name": "Chase Sapphire Credit Card", ... }
}
```

## Tech Stack

| Layer    | Choice                                                                                            |
|----------|---------------------------------------------------------------------------------------------------|
| Backend  | Python 3.12, Django 5.0, Django REST Framework                                                    |
| AI       | **Groq** (Llama 3.3 70B Versatile) primary · Anthropic Claude Sonnet 4.6 fallback · deterministic fallback last |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Recharts, jsPDF, Web Speech API |
| Visuals  | WebGL fragment shader (animated nebula background)                                                |
| Deploy   | **AWS EC2** (Django on Gunicorn :8002, Next.js on systemd service, Nginx reverse proxy)           |

## Architecture

```
┌────────────────────────────┐                  ┌──────────────────────────────┐
│  Next.js frontend          │                  │  api/views.py (Django DRF)   │
│   • / (hero)               │  POST /api/...   │   • validate input           │
│   • /how-it-works          │ ───────────────► │   • dispatch to engines      │
│   • /analyze (debt form)   │ ◄────── JSON ─── │   • merge LLM output         │
│   • /results (dashboard)   │                  └──────┬─────────────┬─────────┘
│   • Negotiate / roleplay / │                         │             │
│     letter modals          │                         │             │
└────────────────────────────┘                         │             │
                                  ┌────────────────────┘             │
                                  │                                  │
            ┌─────────────────────┼─────────────────┐                │
            │                     │                 │                │
   ┌────────▼─────────┐  ┌────────▼──────────┐  ┌───▼──────────────┐ │
   │ api/debt_engine  │  │ api/ai_advisor    │  │ api/negotiation_ │ │
   │  • month-by-     │  │  • Groq pool      │  │  engine          │ │
   │    month sim     │  │    (multi-key     │  │  • leverage 0–100│ │
   │  • Avalanche &   │  │     failover)     │  │  • settlement    │ │
   │    Snowball      │  │  • Anthropic      │  │    ranges        │ │
   │  • stress score  │  │    fallback       │  │  • debt-type     │ │
   │  • minimum-only  │  │  • deterministic  │  │    detection     │ │
   │    baseline      │  │    last-resort    │  └──────────────────┘ │
   └──────────────────┘  └───────────────────┘                       │
                                                                     │
                ┌────────────────────┬───────────────────┬───────────┴────────┐
                │                    │                   │                    │
   ┌────────────▼──────┐  ┌──────────▼────────┐  ┌───────▼─────────┐  ┌──────▼──────────┐
   │ script_generator  │  │ roleplay_engine   │  │ letter_generator│  │ chat_engine      │
   │  • 7-section      │  │  • turn-by-turn   │  │  • formal       │  │  • grounded Q&A │
   │    phone script   │  │    creditor AI    │  │    settlement   │  │    on user data │
   └───────────────────┘  └───────────────────┘  └─────────────────┘  └─────────────────┘
```

The simulation is deterministic and pure-Python — no hidden ML, no random sampling. Every dollar shown in the UI is traceable to `api/debt_engine.py`. The LLM is given the math and writes the prose; it never invents the numbers.

### Why Groq + Claude fallback?

- **Groq's Llama 3.3 70B inference** is ~10× faster than typical hosted Claude/GPT endpoints, which keeps the analyze + negotiate flows under ~2 seconds end-to-end.
- A **multi-key Groq pool** (`api/groq_pool.py`) round-robins across keys with automatic failover so a single rate-limited key doesn't break the demo.
- If Groq is unavailable, calls fall through to **Anthropic Claude Sonnet 4.6** (direct Anthropic API).
- If both are down, every engine returns a deterministic, data-driven response so the app never breaks.

## Local Setup

### Backend

```bash
# 1. Clone
git clone https://github.com/<your-handle>/debtclear.git
cd debtclear

# 2. Create venv & install
python -m venv venv
source venv/bin/activate         # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env             # then add GROQ_API_KEYS / ANTHROPIC_API_KEY

# 4. Run Django
python manage.py runserver 0.0.0.0:8002
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # → http://localhost:3000
```

If you don't add Groq or Anthropic credentials, the app still works — every engine falls back to a deterministic, data-driven version that uses the user's actual numbers. Add `GROQ_API_KEYS` (comma-separated for the pool) to switch on Llama 3.3, and optionally `ANTHROPIC_API_KEY` for the Claude fallback.

### Required environment variables

```
GROQ_API_KEYS=key1,key2,key3        # comma-separated for multi-key failover pool
GROQ_MODEL=llama-3.3-70b-versatile  # default
ANTHROPIC_API_KEY=sk-ant-...        # optional fallback
ANTHROPIC_MODEL=claude-sonnet-4-6   # default
DJANGO_SECRET_KEY=...
DJANGO_DEBUG=False
```

## API

### `POST /api/analyze/`

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
  "avalanche": {
    "months": 47,
    "total_interest": 4218.73,
    "payoff_timeline": [20000.00, 19853.41, ...],
    "payoff_order": ["Credit Card", "Student Loan"],
    "converged": true
  },
  "snowball": {
    "months": 47,
    "total_interest": 4502.18,
    "payoff_timeline": [20000.00, 19854.79, ...],
    "payoff_order": ["Credit Card", "Student Loan"],
    "converged": true
  },
  "minimum_only": { "months": 89, "total_interest": 9842.10 },
  "interest_saved": 283.45,
  "months_saved": 0,
  "recommended_strategy": "avalanche",
  "ai_analysis": "You're carrying $20,000 in total debt against...",
  "ai_source": "groq"
}
```

### `POST /api/negotiate/`

See the **Negotiate Mode** section above for the full schema. Generates a phone-call settlement script for a single debt.

### `POST /api/chat/`

Grounded advisor Q&A — the LLM is given the user's full financial snapshot plus chat history and answers questions like "what if I lose my job?" or "should I refinance?" using their actual numbers.

### `POST /api/roleplay/`

Turn-by-turn creditor-AI dialogue for the practice-call feature. Returns the next line, a status (`active` / `settled` / `declined`), and a settlement amount when a deal lands.

### `POST /api/generate-letter/`

Returns a formal settlement letter body, ready for certified mail.

### `GET /api/health/`

Returns `{"status": "ok"}` for uptime monitoring.

## Deployment (AWS EC2)

The production stack runs on a single EC2 instance:

- **Django** on Gunicorn bound to `:8002`, managed as a systemd service.
- **Next.js** built with `npm run build` and served by `next start`, also a systemd service (`debtclear-frontend`).
- **Nginx** in front, terminating TLS and reverse-proxying `/api/*` to Django and everything else to Next.js.
- **Static files** collected with `python manage.py collectstatic` and served via WhiteNoise.

Deploy steps after a code change:

```bash
ssh ec2-user@<host>
cd ~/debtclear
git pull
cd frontend && npm run build
sudo systemctl restart debtclear-frontend
sudo systemctl restart debtclear   # Django, if backend changed
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

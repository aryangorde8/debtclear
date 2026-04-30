# DebtClear — Global Debt Payoff Intelligence

> **Pay off debt smarter. Save thousands.**
> A mathematically rigorous debt-payoff analyzer that compares Avalanche vs Snowball strategies on real numbers, then asks Claude Sonnet 4.6 (via AWS Bedrock) to give personalized, specific financial advice.

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://python.org) [![Django](https://img.shields.io/badge/Django-5.0-092E20.svg)](https://www.djangoproject.com/) [![DRF](https://img.shields.io/badge/DRF-3.15-red.svg)](https://www.django-rest-framework.org/) [![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900.svg)](https://aws.amazon.com/bedrock/) [![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-D97757.svg)](https://www.anthropic.com/) [![Render](https://img.shields.io/badge/Deployed-Render-46E3B7.svg)](https://render.com/)

**Live demo:** _https://debtclear.onrender.com_ &nbsp;·&nbsp; **Built for** Nexora Innovation Summit 2026

---

## The Problem

77% of adults globally carry multiple debts simultaneously — credit cards, student loans, car loans, personal loans. Most people make minimum payments on all of them without realising that **the order in which you pay off debts determines how much total interest you pay**.

Choosing the wrong strategy costs people **thousands of dollars** in unnecessary interest and adds **months or years** to their debt-free date. There is no simple, intelligent tool that explains this clearly and gives personalized guidance grounded in real math.

## The Solution

DebtClear takes a user's debt portfolio (multiple debts with balance, APR, minimum payment) and:

1. Simulates **Avalanche** (highest interest rate first) and **Snowball** (lowest balance first) strategies month-by-month with real interest compounding.
2. Computes total interest paid, months to debt-free, and the exact dollar difference between the two strategies.
3. Calculates a **Financial Stress Score (0–100)** combining debt-to-income ratio, monthly-payment burden, and weighted average rate.
4. Visualises the payoff trajectory and current debt mix with interactive Chart.js charts.
5. Sends the mathematical results to **Claude Sonnet 4.6** via AWS Bedrock, which returns three paragraphs of specific, dollar-grounded advice.

## ⚡ Negotiate Mode

Most consumers don't know that **creditors regularly settle debts for 40–60% of the balance** — banks would rather get partial payment than nothing on a delinquent account. But the average person has no idea what's negotiable, what to ask for, or what to actually say on the phone.

**Negotiate Mode** closes that gap. For every debt in the user's portfolio, DebtClear can:

1. **Analyse leverage** — auto-detect the debt type (credit card, medical, auto, private/federal student loan, personal), score the user's negotiation power 0–100 from their stress score, debt-to-income ratio, and account count.
2. **Compute a realistic settlement range** grounded in real-world creditor behaviour: 40–60% on credit cards, 25–50% on medical, 70–85% on secured auto debt, IDR enrollment instead of settlement on federal student loans.
3. **Generate a phone-call script** with Claude Sonnet 4.6 — opening, hardship statement, initial offer (low end of the range), counter-responses, closing language demanding written agreement, and three things to never say.
4. **Show projected savings** as best/target/worst case scenarios with exact dollar figures.

The script is structured into named sections so the UI can render each one with its own visual treatment, money figures highlighted inline. A deterministic fallback generator ships with the project so the demo never produces an empty card — adding AWS credentials swaps it for live Claude generation.

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
    "source": "bedrock"
  },
  "debt": { "name": "Chase Sapphire Credit Card", ... }
}
```

## Tech Stack

| Layer    | Choice                                                                         |
|----------|--------------------------------------------------------------------------------|
| Backend  | Python 3.12, Django 5.0, Django REST Framework                                 |
| AI       | AWS Bedrock + Anthropic Claude Sonnet 4.6 (`anthropic.claude-sonnet-4-6`)      |
| Frontend | Tailwind CSS (CDN), GSAP, Lenis, Chart.js — single static `index.html`         |
| Deploy   | Render (free tier), Gunicorn, WhiteNoise                                       |

## Architecture

```
┌────────────────────────────┐                  ┌──────────────────────────────┐
│  templates/index.html      │                  │  api/views.py                │
│   • Hero + form            │  POST /api/...   │   • validate input           │
│   • Tailwind + GSAP        │ ───────────────► │   • dispatch to engines      │
│   • Lenis smooth scroll    │ ◄────── JSON ─── │   • merge LLM output         │
│   • Chart.js (donut+line)  │                  └──────┬─────────────┬─────────┘
│   • Negotiate modal        │                         │             │
└────────────────────────────┘                         │             │
                                  ┌────────────────────┘             │
                                  │                                  │
            ┌─────────────────────┼─────────────────┐                │
            │                     │                 │                │
   ┌────────▼─────────┐  ┌────────▼──────────┐  ┌───▼──────────────┐ │
   │ api/debt_engine  │  │ api/ai_advisor    │  │ api/negotiation_ │ │
   │  • month-by-     │  │  • Bedrock client │  │  engine          │ │
   │    month sim     │  │  • Claude Sonnet  │  │  • leverage 0–100│ │
   │  • Avalanche &   │  │    4.6 advice     │  │  • settlement    │ │
   │    Snowball      │  │  • deterministic  │  │    ranges        │ │
   │  • stress score  │  │    fallback       │  │  • debt-type     │ │
   │  • cascading     │  │    advisor        │  │    detection     │ │
   └──────────────────┘  └───────────────────┘  └──────────────────┘ │
                                                                     │
                                                ┌────────────────────▼─────────┐
                                                │ api/script_generator         │
                                                │  • prompt-engineered Claude  │
                                                │    call for negotiation      │
                                                │    script (7 sections)       │
                                                │  • parses sections by header │
                                                │  • full deterministic        │
                                                │    fallback per section      │
                                                └──────────────────────────────┘
```

The simulation is deterministic and pure-Python — no hidden ML, no random sampling. Every dollar shown in the UI is traceable to `api/debt_engine.py`. Claude is given the math and writes the prose; it never invents the numbers.

## Local Setup

```bash
# 1. Clone
git clone https://github.com/<your-handle>/debtclear.git
cd debtclear

# 2. Create venv & install
python -m venv venv
source venv/bin/activate         # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env             # then fill in AWS credentials (optional)

# 4. Run
python manage.py runserver
# → open http://127.0.0.1:8000/
```

If you don't add AWS credentials, the app still works — the `ai_advisor` falls back to a deterministic, data-driven advisor that uses your actual numbers. Add real AWS Bedrock credentials with access to `anthropic.claude-sonnet-4-6` to switch to Claude.

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
  "interest_saved": 283.45,
  "months_saved": 0,
  "recommended_strategy": "avalanche",
  "ai_analysis": "You're carrying $20,000 in total debt against...",
  "ai_source": "bedrock"
}
```

### `POST /api/negotiate/`

See the **Negotiate Mode** section above for the full schema. Generates a phone-call settlement script for a single debt.

### `GET /api/health/`

Returns `{"status": "ok"}` for uptime monitoring.

## Deployment (Render)

The repo includes a `render.yaml` blueprint:

1. Push to GitHub.
2. On Render: **New → Blueprint → connect repo**.
3. Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in the dashboard (the rest auto-populate).
4. Deploy. Live URL appears under `*.onrender.com`.

`Procfile`, `gunicorn`, and WhiteNoise are pre-configured. Static files are collected at build time.

## What's Next

- Per-debt extra-payment allocation (split extra across multiple debts)
- "What if I add $X/month?" sensitivity slider
- Hybrid strategies (start Snowball for psychological wins, switch to Avalanche)
- Currency selection for non-USD users
- Save analyses with a magic-link account

## License

MIT — built by Aryan Gorde for the Nexora Innovation Summit 2026.

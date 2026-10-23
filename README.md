# 🛡️ FraudGuard — Tax Fraud Detection System

A full-stack tax fraud detection application with a rule-based anomaly scoring engine, REST API, and React dashboard.

## Architecture

```
tax-fraud-detection/
├── backend/          # Node.js + TypeScript + Express API
│   ├── src/
│   │   ├── db/       # JSON file-based data store + seed script
│   │   ├── engine/   # Fraud detection rules & risk scoring
│   │   ├── routes/   # REST API endpoints
│   │   └── types/    # Shared TypeScript types
│   └── data/         # fraud.json (auto-created)
└── frontend/         # React + Vite + TypeScript dashboard
    └── src/
        ├── components/  # Reusable UI components
        ├── pages/       # Dashboard, Taxpayers, Returns, ReturnDetail
        ├── api.ts       # Typed API client
        └── types.ts     # Shared types
```

## Fraud Detection Rules

| Rule Code | Description | Severity |
|-----------|-------------|----------|
| `DEDUCTION_EXCEEDS_INCOME` | Deductions > gross income | Critical |
| `ZERO_TAX_ON_INCOME` | Taxable income > $10k but $0 tax paid | Critical |
| `INCOME_CALCULATION_MISMATCH` | Taxable income ≠ gross - deductions | Critical/High |
| `LOW_EFFECTIVE_TAX_RATE` | Effective rate < 5% on income > $50k | High |
| `BUSINESS_EXPENSES_EXCEED_INCOME` | Business expenses > gross income | High |
| `HIGH_DEDUCTION_RATIO` | Deductions > 50% of gross income | Medium/High |
| `EXCESSIVE_CHARITABLE_DONATIONS` | Donations > 30% of gross income | Medium/High |
| `EXCESSIVE_DEPENDENTS` | More than 10 dependents claimed | Medium/High |
| `SUDDEN_INCOME_DROP` | > 80% year-over-year income decrease | Medium |
| `SUDDEN_DEDUCTION_SPIKE` | > 200% year-over-year deduction increase | Medium/High |

Risk scores (0–100) are computed by summing severity weights:
- Low: 5 pts  ·  Medium: 15 pts  ·  High: 30 pts  ·  Critical: 50 pts

## Quick Start

### 1. Start the backend

```bash
cd backend
npm install
npm run seed    # Loads 8 taxpayers + 14 tax returns with fraud flags
npm run dev     # Starts API on http://localhost:4000
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev     # Opens dashboard on http://localhost:5173
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard stats, recent flags, top rules |
| GET | `/api/taxpayers` | List all taxpayers |
| POST | `/api/taxpayers` | Create taxpayer |
| PUT | `/api/taxpayers/:id` | Update taxpayer |
| DELETE | `/api/taxpayers/:id` | Delete taxpayer |
| GET | `/api/returns` | List all returns (filter: `?taxpayer_id=`) |
| GET | `/api/returns/:id` | Get return with fraud flags |
| POST | `/api/returns` | Submit return + auto-analyze |
| POST | `/api/returns/:id/analyze` | Re-run fraud analysis |
| PATCH | `/api/returns/:id/status` | Update review status |

## Features

- **Rule Engine** — 10 fraud detection rules covering income, deductions, tax rates, dependents, and year-over-year anomalies
- **Risk Scoring** — Weighted 0–100 score with Low / Medium / High / Critical levels
- **Dashboard** — Live stats, severity distribution chart, most-triggered rules, recent flags
- **Taxpayer Management** — Full CRUD with business type classification
- **Tax Return Submission** — Auto-analyzed on creation; re-analyzable on demand
- **Review Workflow** — Status transitions: Pending → Flagged → Reviewed → Cleared
- **Persistent Storage** — JSON file store (`data/fraud.json`), zero native dependencies

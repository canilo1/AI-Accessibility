# FairTax — Explainable Tax Review Prototype

A prototype for identifying unusual tax-return patterns, explaining each rule signal, and supporting human review. FairTax is not an automated fraud determination or enforcement system.

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

## Review Signal Rules

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
| `THIRD_PARTY_INCOME_MISMATCH` | Reported gross income differs from attached W-2/1099/K-1 records | Medium/High |
| `DUPLICATE_TAX_YEAR_RETURN` | More than one return exists for the taxpayer and tax year | Medium |

Income records can be entered with a return and are compared with gross income in aggregate. A mismatch is flagged when it exceeds the greater of $1,000 or 5% of the attached records. These records are manually supplied; the app does not connect to employers, banks, credit-card providers, social media, or government identity systems. Duplicate tax IDs are rejected after case and whitespace normalization. A duplicate-year filing may be an amendment, so it is a review lead rather than a fraud conclusion.

Automated flags only prioritize human review. Investigators can record notes, queue a return, approve it for audit, or dismiss it, and taxpayers can appeal. The status override API is disabled; audit approval must follow the named investigator action workflow. A return with no configured signals is labeled **No rule signal**, not compliant or cleared by the system.

## Fairness, Explainability, and Privacy

- Every signal includes a rule code, a factual description, and a plain-language explanation. Explanations identify the threshold and note that legitimate circumstances may account for the pattern.
- The dashboard reports live observed flag rates by business category and a separate synthetic benchmark. Live flag rates are descriptive and are not false-positive rates. Business category is not a demographic proxy; the prototype has no protected-class data and cannot evaluate racial disparities.
- The synthetic benchmark contains 5 hand-authored clean examples and 2 deliberately injected review patterns for each of 4 business categories (28 cases total). Its synthetic false-positive rate is the share of clean examples that trigger any rule; its detection rate is the share of injected patterns that trigger a rule. These examples are not real returns or verified fraud labels, and the small benchmark does not predict production accuracy or fairness.
- `npm run seed` creates synthetic people, reserved `.test` email addresses, and fabricated tax amounts. For a fresh demo database, configure `DATA_DIRECTORY=./.local-data` in `backend/.env` before running the seed command. The local database, environment files, and uploaded documents are excluded from Git.
- Do not enter real taxpayer documents or personal information into this hackathon prototype. Local JSON and disk uploads are not production-grade storage. Real deployments need access controls, encryption, managed storage, backups, retention limits, incident response, and legal/privacy review.

Whistleblower tips and external claims are not ingested or scored. They require independent verification through an authorized review process.

## Design Rationale and Sources

The safeguards reflect the project brief's points about audit-selection disparities, explainability, privacy, and the cost of burdensome reviews. They are design goals, not evidence that this prototype reduces those risks.

- U.S. GAO (2026), [Tax Fraud: The Federal Government Loses an Estimated $116 Billion to $304 Billion Annually](https://www.gao.gov/products/gao-26-107810), as cited in the project brief.
- NIST (2023), [Artificial Intelligence Risk Management Framework (AI RMF 1.0)](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf).
- The project brief cites GAO (2024) on audit-selection disparities and Belnap et al. (2022) on administrative costs of small-business audits. Those sources do not establish AI-generated false-positive rates or prove that small businesses are more likely to be incorrectly flagged by AI.

Rule scores (0–100) are computed by summing fixed severity weights. They are not calibrated probabilities of fraud, intent, or noncompliance:
- Low: 5 pts  ·  Medium: 15 pts  ·  High: 30 pts  ·  Critical: 50 pts

## Quick Start

### 1. Start the backend

```bash
cd backend
npm install
```

Create `backend/.env` from `.env.example`, set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters, and keep `DATA_DIRECTORY=./.local-data` for an isolated synthetic demo database. There is no default administrator password. Then start the backend:

```bash
npm run seed    # Loads 8 synthetic taxpayers + 14 sample returns
npm run dev     # Starts API on http://localhost:4000
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev     # Opens dashboard on http://localhost:5173
```

### Portal accounts

- Sign in as an administrator using the credentials from `backend/.env`.
- In **Accounts**, create additional administrator accounts. Their account records are saved in `backend/data/fraud.json`.
- In **Taxpayers**, create or verify a taxpayer record using the customer's email and tax ID, then choose **Invite to portal**. Share the generated one-time link with the customer through a separate secure channel.
- Customers open the invitation, create their own password, and are signed in. The invitation expires after 72 hours and can only be used once. Customer accounts are saved in `backend/data/fraud.json` and linked to the verified taxpayer record.
- Customers can sign in and see only their linked tax history, submit PDF/JPEG/PNG documents up to 10 MB, download their own documents, change their password, and submit appeals for eligible returns.
- In **Documents**, administrators can review uploads, request more information, accept documents, and leave customer-visible notes.

Customer account creation is invitation-only, with each invite linked to one verified taxpayer record. Uploaded files are stored in `backend/data/uploads/` outside the web root and are served only through authenticated, ownership-checked download routes. Local JSON and uploaded documents are prototype storage; use a managed database, private object storage, backups, HTTPS, secret management, and an appropriate retention policy before handling real taxpayer data in production.

Account passwords are stored as salted scrypt hashes; session and invitation tokens are stored as SHA-256 hashes. The first administrator is bootstrapped from environment variables; additional administrator records are created by an authenticated administrator.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Sign in; establishes an HttpOnly session |
| GET | `/api/auth/invitation/:token` | Check a one-time customer invitation |
| POST | `/api/auth/accept-invitation` | Create customer account and sign in |
| GET | `/api/auth/me` | Get the current account |
| POST | `/api/auth/logout` | End the current session |
| POST | `/api/auth/change-password` | Change password and revoke other sessions |
| GET | `/api/customer/dashboard` | Customer's own tax history, documents, and appeals |
| POST | `/api/customer/documents` | Upload a customer document for review |
| POST | `/api/customer/appeals` | Submit an appeal for an owned return |
| GET | `/api/admin/documents` | Admin document review queue |
| PATCH | `/api/admin/documents/:id` | Update document status and customer note |
| POST | `/api/admin/customer-accounts` | Provision portal access for an existing taxpayer |
| POST | `/api/admin/customer-accounts/invitations` | Create a 72-hour customer invitation |
| POST | `/api/admin/customer-accounts/admins` | Create an additional administrator account |
| GET | `/api/documents/:id/download` | Download an owned document (admin or customer) |
| GET | `/api/dashboard` | Admin dashboard stats, recent flags, top rules |
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

- **Rule Engine** — 12 review rules covering income, deductions, tax rates, dependents, source matching, and year-over-year anomalies
- **Risk Scoring** — Weighted 0–100 score with Low / Medium / High / Critical levels
- **Dashboard** — Live stats, severity distribution chart, most-triggered rules, recent flags
- **Taxpayer Management** — Full CRUD with business type classification
- **Tax Return Submission** — Auto-analyzed on creation; re-analyzable on demand
- **Review Workflow** — Status transitions: Pending → Flagged → Reviewed → Cleared
- **Persistent Storage** — JSON file store (`data/fraud.json`), zero native dependencies

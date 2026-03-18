# Dummy Trading — Project Guide

## Project Structure

```
├── server/src/
│   ├── app.ts                    # Express app — all route mounts
│   ├── index.ts                  # Server entry point + cron intervals
│   ├── prisma.ts                 # Prisma client singleton
│   ├── middleware/
│   │   └── auth.ts               # JWT authentication middleware
│   ├── routes/
│   │   ├── auth/                 # auth.routes, user.routes
│   │   ├── trading/              # trade.routes, order.routes, portfolio.routes
│   │   ├── market/               # market.routes, marketRegime, marketClassifiers, quote, search
│   │   ├── analysis/             # analysis, compare, factors, screener, predict, valuation
│   │   ├── social/               # group, leaderboard, badge
│   │   ├── alerts/               # alert, watchlist
│   │   ├── content/              # news, gemini, research
│   │   ├── dashboard.routes.ts
│   │   └── cron.routes.ts
│   └── services/
│       ├── trading/              # portfolioService, tradeValidation, orderService, taxService
│       ├── market/               # priceService, marketService, technicalAnalysisService
│       ├── ai/                   # geminiService, groqService, ollamaService, researchService
│       ├── social/               # badgeService, alertService
│       ├── data/                 # tickerMetadata, sp500, webScraperService
│       └── prediction/           # ensemble ML pipeline (baseLearners/, monteCarlo, etc.)
│
├── client/src/
│   ├── App.tsx                   # Root component — all route definitions
│   ├── main.tsx                  # Vite entry point
│   ├── apiClient.ts              # Axios instance with auth interceptor
│   ├── theme.ts                  # MUI dark theme config
│   ├── hooks/
│   │   └── useApi.ts             # Generic data-fetching hook
│   ├── context/
│   │   └── ToastContext.tsx       # Global toast notifications
│   ├── components/
│   │   ├── ui/                   # Reusable primitives (PageLoader, StatCard, StatRow, etc.)
│   │   ├── layout/               # Layout, AlertBadge, TickerTape
│   │   ├── trading/              # TradeForm, AnimatedNumber
│   │   ├── portfolio/            # Charts, RiskMetrics, TaxSummary, BehavioralBias, etc.
│   │   ├── market/               # SP500 charts, RegimePanel, ClassifierTiles, Heatmap
│   │   ├── analysis/             # FactorScorecard, ValuationContext, GeminiInsight
│   │   └── content/              # StockNewsPanel, ResearchNarrative, ResearchProgress
│   └── pages/
│       ├── auth/                 # LoginPage, ProfilePage
│       ├── dashboard/            # DashboardPage
│       ├── trading/              # TradePage, TradeHistoryPage, PortfolioList, PortfolioDetail
│       ├── market/               # MarketPage, StockDetailPage, StockComparisonPage
│       ├── analysis/             # AnalysisLanding, StockAnalysis, Screener, Prediction
│       ├── social/               # GroupList, GroupDetail, Leaderboard, Badges
│       ├── content/              # NewsLanding, ResearchLanding, ResearchReport
│       └── watchlist/            # WatchlistPage
│
├── docs/                         # Architecture docs, roadmap, knowledge base
├── api/index.ts                  # Vercel serverless adapter
└── n8n/                          # n8n webhook integration workflows
```

## Conventions

### File Organization
- **Domain-first grouping**: Routes, services, components, and pages are grouped by domain (trading/, market/, analysis/, social/, content/, etc.)
- **New files go in the matching domain folder** — don't add flat files to routes/, services/, components/, or pages/
- **Test files are co-located** with their source (e.g., `taxService.test.ts` next to `taxService.ts`)
- **ui/ is for reusable primitives only** — domain-specific components go in their domain folder

### Server Patterns
- **Services are pure functions** where possible (portfolioService, taxService, tradeValidation) — no DB or IO, only data in → data out
- **Routes handle HTTP concerns** — request parsing, auth checks, DB queries, then delegate to services for business logic
- **Route files import from services/** using relative paths like `../../services/trading/tradeValidation.js`
- **All route mounts** are in `app.ts` — grouped by domain with comments

### Client Patterns
- **`useApi<T>(url, params?, pollInterval?)`** is the standard data-fetching hook — returns `{ data, loading, error, refetch }`
- **Panel components** (RiskMetrics, BehavioralBias, TaxSummary) follow a consistent pattern: `useApi` fetch, skeleton loader, Paper with dark gradient styling
- **Pages lazy-load** via `React.lazy()` in `App.tsx`
- **Theme colors**: `#00C805` (success/green), `#ff5252` (error/red), `#ffab00` (warning/yellow), `#7a8ba5` (neutral)

### Tax System
- FIFO lot tracking in `services/trading/taxService.ts` (parallel to weighted-average in portfolioService)
- Flat rates: 32% short-term, 15% long-term
- Wash sale detection: 30-day window
- Tax endpoints: `GET /portfolios/:id/tax`, `GET /portfolios/:id/tax-preview`
- SELL responses include `taxImpact` field

### Trade Validation
- `checkSufficientShares()` — prevents selling more shares than owned
- `checkSufficientCash()` — prevents buying beyond available cash
- Both in `services/trading/tradeValidation.ts`, used by trade.routes, order.routes, and orderService

## Commands
- **Server tests**: `cd server && npm test`
- **Client type check**: `cd client && npx tsc --noEmit`
- **Dev server**: Server runs on port 3000, client on port 5173

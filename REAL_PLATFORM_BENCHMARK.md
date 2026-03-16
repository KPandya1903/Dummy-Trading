# Real Platform Benchmark

## Executive Summary

The two best real-world reference products for `Dummy Trading` are:

1. `TradingView` for the market intelligence, charting, screening, watchlist, alerting, and chart-first workflow.
2. `Webull` for the brokerage-like trading workflow, richer order entry, quote depth, active-trader ergonomics, and paper-trading realism.

This split matches the current product shape:

- Public market/research surfaces live in [client/src/App.tsx](client/src/App.tsx) and behave more like a charting and intelligence platform.
- Authenticated trading surfaces are backed by paper-trading entities in [server/prisma/schema.prisma](server/prisma/schema.prisma) and route domains in [server/src/app.ts](server/src/app.ts).

## What Dummy Trading Is Today

`Dummy Trading` is already more than a simple stock simulator. It currently combines:

- Paper portfolios, trade history, pending orders, alerts, badges, groups, and leaderboards.
- Public market exploration, quote pages, technical analysis, factor views, stock comparison, AI news, ML prediction, and deep research.
- A route split where market/research tools are public and portfolio/trading tools require login in [client/src/App.tsx](client/src/App.tsx).
- A backend with separate API domains for trading, market data, predictions, news, and research in [server/src/app.ts](server/src/app.ts).

That makes it a hybrid of:

- `TradingView`-style market analysis product
- `Webull`-style retail trading simulator
- A small amount of social/gamified learning product

## Why These 2 Platforms

### TradingView

TradingView is the strongest benchmark for:

- paper trading on top of charts
- watchlists and watchlist alerts
- screeners and symbol exploration
- chart-centered workflows
- cross-device alerts and technical tooling
- a market-intelligence-first product identity

Official feature references reviewed:

- Paper Trading
- Watchlists
- Alerts
- Features / Supercharts

### Webull

Webull is the strongest benchmark for:

- active-trader paper trading
- brokerage-like order entry
- more realistic order types
- real-time quotes and market-depth concepts
- technical charting paired with execution
- layout and workflow expectations of a live broker UI

Official feature references reviewed:

- Paper Trading
- Active Trading

## Feature Comparison Matrix

| Area | Dummy Trading | TradingView | Webull | Benchmark Result |
| --- | --- | --- | --- | --- |
| Product identity | Hybrid simulator + research app | Analysis and charting platform with paper/live trading hooks | Broker-style trading platform with paper trading | `Dummy Trading` is split between both |
| Paper trading | Yes, but simplified | Yes, close-to-real chart-linked simulator | Yes, realistic active-trader simulator | Behind both on realism |
| Portfolios | Strong educational portfolio support | Present, but not the core UX | Present as account-centric brokerage workflow | Closer to Webull than TradingView |
| Order types | Market, limit, stop | Market, limit, stop on paper trading | Market, limit, stop, trailing stop, stop-limit, bracket, OTO, OCO, OTOCO | Much closer to Webull target, but far behind |
| Order execution realism | Polling-based fills every 60s | Integrated simulator with chart trading/account manager | More broker-like active order tooling | Major gap |
| Buying power / position constraints | Weak | Stronger account model | Stronger account model | Major gap |
| Charts | Good Recharts-based charts | Best-in-class chart-first experience | Strong active-trading charting | TradingView should be target |
| Technical indicators | Solid starter set | Deep, highly configurable | Large indicator library and technical signals | Behind both in depth |
| Watchlists | Yes | Very strong, customizable, shareable, grouped, advanced view | Strong, customizable | TradingView should be target |
| Alerts | Price threshold only, in-app only | Price, technical, watchlist, webhook, app/email/toast | Price, volume, news, technical alerts | Big gap |
| Screeners / classifiers | Good lightweight market classifiers | Mature screeners and watchlist-based scanning | Screeners and quote tools | TradingView should be target |
| Search / discovery | Good ticker search, S&P-centric market page | Broad multi-asset discovery | Broad trading-oriented discovery | Behind on breadth |
| Quote depth | Basic quote/fundamental view | Strong chart context, DOM with brokers in some setups | Level 2, NBBO, order-book depth messaging | Big Webull gap |
| Research / AI news | Strong custom differentiator | Limited compared with this app | Limited compared with this app | `Dummy Trading` leads here |
| ML prediction | Strong custom differentiator | Not the core retail feature | Not the core retail feature | `Dummy Trading` leads here |
| Social / competition | Groups, badges, leaderboard | Public social/community ecosystem, competitions in some areas | Less core to product | `Dummy Trading` has differentiated educational value |
| Custom layouts / terminal feel | Limited | Strong | Strong | Gap for both benchmarks |
| Multi-asset support | Mostly equities | Very broad | Broader than current app | Gap |

## Capability-by-Capability Assessment

### 1. Market Analysis Surfaces

Current relevant surfaces:

- [client/src/pages/MarketPage.tsx](client/src/pages/MarketPage.tsx)
- [client/src/pages/StockDetailPage.tsx](client/src/pages/StockDetailPage.tsx)
- [client/src/pages/StockAnalysisPage.tsx](client/src/pages/StockAnalysisPage.tsx)
- [client/src/pages/StockComparisonPage.tsx](client/src/pages/StockComparisonPage.tsx)
- [client/src/components/Layout.tsx](client/src/components/Layout.tsx)

Assessment:

- The app already has a strong analysis shell: market table, heatmap, regime panel, classifier tiles, factor scorecard, analysis page, comparison, and prediction landing.
- The weakness is not lack of features; it is lack of platform depth and workflow density compared with TradingView.
- TradingView’s edge is not merely “more indicators.” It is chart-centric workflow design, richer watchlist/screener relationships, higher alert sophistication, better chart trading, and stronger information density.

Target benchmark:

- `TradingView`

### 2. Trading and Portfolio Surfaces

Current relevant surfaces:

- [client/src/pages/TradePage.tsx](client/src/pages/TradePage.tsx)
- [client/src/components/TradeForm.tsx](client/src/components/TradeForm.tsx)
- [client/src/pages/PortfolioDetailPage.tsx](client/src/pages/PortfolioDetailPage.tsx)
- [server/src/routes/trade.routes.ts](server/src/routes/trade.routes.ts)
- [server/src/routes/order.routes.ts](server/src/routes/order.routes.ts)
- [server/src/services/orderService.ts](server/src/services/orderService.ts)
- [server/src/services/portfolioService.ts](server/src/services/portfolioService.ts)

Assessment:

- The product has a credible educational trading workflow: market and pending orders, review journaling, portfolio metrics, CSV export, alerts, and competitions.
- The realism ceiling is currently much lower than a real brokerage UX because fills are polled, buying power checks are weak, position constraints are weak, and the order model is narrow.
- This part of the product should not imitate TradingView first. It should imitate a broker-like active trading workflow, and Webull is the better benchmark for that.

Target benchmark:

- `Webull`

### 3. Watchlists and Alerts

Current relevant surfaces:

- [client/src/pages/WatchlistPage.tsx](client/src/pages/WatchlistPage.tsx)
- [server/src/routes/watchlist.routes.ts](server/src/routes/watchlist.routes.ts)
- [server/src/routes/alert.routes.ts](server/src/routes/alert.routes.ts)
- [server/src/services/alertService.ts](server/src/services/alertService.ts)

Assessment:

- The current watchlist is useful for a simulator but is still basic: threshold alerts, triggered state, and paper-buy handoff.
- TradingView is the stronger benchmark for watchlists because it treats them as a discovery and monitoring workspace, not just a saved list of symbols.
- Webull is still relevant for alert richness, but the product feel here should primarily follow TradingView.

Target benchmark:

- `TradingView` primary
- `Webull` secondary for alert breadth

### 4. Research, AI News, and Prediction

Current relevant surfaces:

- [client/src/pages/NewsLandingPage.tsx](client/src/pages/NewsLandingPage.tsx)
- [client/src/pages/ResearchLandingPage.tsx](client/src/pages/ResearchLandingPage.tsx)
- [client/src/pages/ResearchReportPage.tsx](client/src/pages/ResearchReportPage.tsx)
- [client/src/pages/StockPredictionPage.tsx](client/src/pages/StockPredictionPage.tsx)
- [server/src/routes/research.routes.ts](server/src/routes/research.routes.ts)
- [server/src/routes/predict.routes.ts](server/src/routes/predict.routes.ts)
- [server/src/services/researchService.ts](server/src/services/researchService.ts)
- [server/src/services/prediction/ensemble.ts](server/src/services/prediction/ensemble.ts)

Assessment:

- This is the product’s clearest differentiator.
- Neither TradingView nor Webull is a direct benchmark here because the app is already doing more bespoke AI/research work than either of them in this exact educational form.
- The right move is to keep this area differentiated, but present it in a more polished TradingView-like information architecture.

Target benchmark:

- `TradingView` for presentation and workflow
- Keep `Dummy Trading`’s own feature differentiation

## Recommended UX Ownership Split

### Emulate TradingView For

- `Market` home and stock discovery
- quote pages and symbol drill-down
- technical analysis pages
- stock comparison
- watchlists
- screeners / market classifiers
- alerts UX
- chart layout and chart-first navigation
- research and prediction presentation layer

Current routes most aligned to this direction:

- `/market`
- `/stocks/:ticker`
- `/analysis`
- `/stocks/:ticker/analysis`
- `/compare`
- `/prediction`
- `/predict/:ticker`
- `/news`
- `/research`
- `/research/:id`

### Emulate Webull For

- trade ticket behavior
- order entry UX
- pending order lifecycle
- portfolio positions and P&L presentation
- account/holdings dashboard behavior
- active-trader shortcuts and execution ergonomics
- realism around market sessions, order states, and order constraints

Current routes most aligned to this direction:

- `/`
- `/portfolios`
- `/portfolios/:id`
- `/trade`
- `/watchlist`
- `/portfolios/:id/trades`
- backend order/trade/alert flows in [server/src/app.ts](server/src/app.ts)

## Biggest Gaps vs Real Platforms

### Highest-Impact Realism Gaps

1. No strong cash, buying power, or sell-position enforcement in the trade path.
2. No partial fills, no slippage, no bid/ask modeling, no spread-aware fills.
3. No time-in-force, trailing stops, stop-limit, OCO, bracket, or advanced linked orders.
4. Fills happen on a 60-second polling loop instead of a more realistic trigger engine.
5. Alerts are only threshold-based and only available in-app.
6. Watchlists are not yet a real monitoring workspace with columns, grouping, and saved market views.
7. Charts are useful but not yet dense enough to feel like a trading terminal.
8. No customizable multi-panel layout or workstation-like navigation.

### Biggest Gaps vs TradingView Specifically

- insufficient watchlist sophistication
- insufficient screener depth
- weaker alert system
- lighter charting ergonomics
- less information density around symbol detail and monitoring

### Biggest Gaps vs Webull Specifically

- insufficient order model
- insufficient execution realism
- insufficient quote depth and market microstructure
- insufficient account-state realism
- weaker active-trader workflow and layout design

## Prioritized Realism Roadmap

### Quick Wins

- Rework the watchlist into a richer monitoring table with customizable columns and sort/group behavior.
- Expand alerts from only `above/below` thresholds to include percentage move, volume spike, and indicator-trigger alerts.
- Improve the trade ticket UX to feel more broker-like even before backend realism is upgraded.
- Add clearer market session state, order status badges, and execution assumptions to portfolio and trade pages.
- Tighten search, symbol drill-down, and cross-page navigation so discovery feels more like a market terminal.
- Make research and prediction pages denser and more chart-linked so they inherit more TradingView-like flow.

### Medium Lifts

- Add buying power checks, sell-quantity validation, and explicit order rejection reasons in [server/src/routes/trade.routes.ts](server/src/routes/trade.routes.ts) and [server/src/routes/order.routes.ts](server/src/routes/order.routes.ts).
- Add support for `STOP_LIMIT`, `TRAILING_STOP`, `OCO`, and bracket-like workflows in the order model.
- Move from simple threshold alerts to reusable alert definitions and richer delivery states.
- Improve quote realism with bid/ask, spread display, and better session handling.
- Add saved market views, saved comparisons, and saved research/prediction workspaces.
- Upgrade charting and market tables to support more serious active analysis workflows.

### Major Architecture Changes

- Replace coarse polling-based order execution with a more realistic fill engine.
- Introduce a true account-state model: settled cash, buying power, short restrictions, margin rules, and order reservation logic.
- Add mark-to-market portfolio history instead of trade-date proxy history.
- Add more institutional-quality market data or better-real-time modeling if the app is meant to feel close to live brokerage platforms.
- Create a customizable terminal layout where market, chart, order ticket, positions, and research panels can coexist.

## What To Prioritize First

If the goal is “make this feel like the best analysis and learning product,” prioritize `TradingView` first.

If the goal is “make this feel like a real broker simulator,” prioritize `Webull` first.

Given the current codebase, the best product strategy is:

1. Use `TradingView` as the primary benchmark for public market intelligence UX.
2. Use `Webull` as the primary benchmark for authenticated trading realism.
3. Preserve `Dummy Trading`’s own differentiation in AI research, prediction, learning, and competition.

That produces a clearer product identity than trying to copy one platform end to end.

## Bottom-Line Recommendation

Do not turn the whole app into a clone of one site.

Instead:

- make the public market/research shell feel like `TradingView`
- make the trade/account workflow feel like `Webull`
- keep the AI research, prediction, badges, and group competition layers as the app’s own differentiated edge

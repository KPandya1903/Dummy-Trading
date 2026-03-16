---
name: Dummy Trading Platform Overview
description: Core facts about the Dummy Trading project — stack, purpose, deployment, and reference file location
type: project
---

Paper trading simulator + quant research platform. Zero-cost stack targeting financial education.

**Stack:** React 18 + Vite + MUI (frontend), Node.js + Express + TypeScript ESM (backend), PostgreSQL via Prisma (Supabase/Neon free tier), Vercel serverless deployment.

**AI/ML:** TensorFlow.js (4-model stacked ensemble: Holt-Winters, BiLSTM, GRU, Dense), Groq API (llama-3.3-70b-versatile) for LLM tasks — NOTE: TF.js disabled on Vercel prod (60s limit), only Holt-Winters runs in production.

**Market Data:** Alpaca WebSocket (real-time, IEX ~15min delay on free tier), Yahoo Finance 2 (historical OHLCV + fundamentals).

**Why:** Educational paper trading platform, zero-cost philosophy using all free tiers.

**Architecture reference:** /Users/enzo/Desktop/Projects/Dummy/ARCHITECTURE.md — always refer to this for system design, data flows, feature status, DB schema, and deployment architecture.

**Key gaps to fill:**
- Risk analytics (Sharpe, max drawdown, beta, VaR, correlation matrix)
- Custom screener builder
- Trailing stop / bracket / OCO orders
- Indicator-based alerts (RSI cross, MACD, etc.)
- TF.js full ML on production (currently degraded)
- Multi-timeframe chart support

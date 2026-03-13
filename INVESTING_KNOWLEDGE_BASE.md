# Investing Knowledge Base — Books, Papers & Frameworks
> Reference for feature design decisions in Dummy Trading Platform
> Last Updated: 2026-03-13

---

## THE CANON — 50 Essential Works

---

### PART 1 — FUNDAMENTAL ANALYSIS

| # | Work | Author | Year | Core Thesis |
|---|------|--------|------|-------------|
| 1 | **Security Analysis** | Graham & Dodd | 1934 | Intrinsic value from financials; margin of safety |
| 2 | **The Intelligent Investor** | Benjamin Graham | 1949 | Mr. Market metaphor; investor vs. speculator; margin of safety |
| 3 | **Common Stocks and Uncommon Profits** | Philip Fisher | 1958 | Scuttlebutt method; qualitative moat analysis; management quality |
| 4 | **One Up on Wall Street** | Peter Lynch | 1989 | Invest in what you know; stock categorization (stalwart/grower/turnaround) |
| 5 | **Beating the Street** | Peter Lynch | 1993 | PEG ratio; GARP (growth at reasonable price) |
| 6 | **The Essays of Warren Buffett** | Buffett / Cunningham | 1997 | Owner earnings; capital allocation; economic moats; compounding |
| 7 | **Poor Charlie's Almanack** | Charlie Munger | 2005 | Mental model latticework; multidisciplinary analysis |
| 8 | **You Can Be a Stock Market Genius** | Joel Greenblatt | 1997 | Special situations: spinoffs, mergers, restructurings create mispricings |
| 9 | **The Little Book That Still Beats the Market** | Joel Greenblatt | 2010 | Magic Formula: EBIT/EV × ROIC = quality + value combo |
| 10 | **The Warren Buffett Way** | Robert Hagstrom | 1994 | Buffett's 4 filters: business, management, financial, value tenets |

**Key concepts for platform:**
- Intrinsic value (DCF, earnings power)
- Margin of safety
- Economic moat / competitive advantage
- Owner earnings vs. accounting earnings
- PEG ratio (P/E ÷ growth rate)
- ROE, ROIC, capital allocation quality
- Special situations (catalysts)

---

### PART 2 — TECHNICAL ANALYSIS

| # | Work | Author | Year | Core Thesis |
|---|------|--------|------|-------------|
| 11 | **Technical Analysis of Stock Trends** | Edwards & Magee | 1948 | Chart patterns, support/resistance, trend theory — the original TA bible |
| 12 | **Technical Analysis of the Financial Markets** | John Murphy | 1999 | Complete TA toolkit: oscillators, MAs, intermarket relationships |
| 13 | **Japanese Candlestick Charting Techniques** | Steve Nison | 1991 | Candlestick patterns reveal market psychology per period |
| 14 | **How to Make Money in Stocks (CAN SLIM)** | William O'Neil | 1988 | Combine earnings strength with technical breakout timing |
| 15 | **Stan Weinstein's Secrets** | Stan Weinstein | 1988 | 4-stage analysis: base→advance→top→decline using 30-week MA |

**Key concepts for platform:**
- Chart patterns (H&S, triangles, flags, channels)
- Support & resistance levels
- Moving average crossovers (golden/death cross)
- Candlestick signals (doji, engulfing, hammer)
- Stage analysis (only buy Stage 2 advances)
- Volume confirmation
- CAN SLIM criteria

---

### PART 3 — QUANTITATIVE & FACTOR INVESTING

| # | Work | Author | Year | Core Thesis |
|---|------|--------|------|-------------|
| 16 | **What Works on Wall Street** | O'Shaughnessy | 1996 | Empirical factor study: P/S ratio, shareholder yield, momentum are most powerful |
| 17 | **Quantitative Value** | Gray & Carlisle | 2012 | Systematic deep value; Acquirer's Multiple (EV/EBIT) |
| 18 | **Quantitative Momentum** | Gray & Vogel | 2016 | Smooth momentum paths more durable; momentum+value combo |
| 19 | **Expected Returns** | Ilmanen (AQR) | 2011 | Comprehensive survey of risk premia: carry, value, momentum, liquidity |
| 20 | **Asset Management** | Andrew Ang | 2014 | All assets = factor bundles; harvest risk premia systematically |
| 21 | **Inside the Black Box** | Rishi Narang | 2009 | Full quant stack: alpha → risk model → transaction costs → execution |
| 39 | **Advances in Financial ML** | López de Prado | 2018 | ML for finance: fractional differentiation, triple barrier, CPCV |
| 40 | **Machine Learning for Asset Managers** | López de Prado | 2020 | Clustering, feature importance, explainability for portfolios |
| 41 | **Quantitative Trading** | Ernest Chan | 2008 | Building systematic trading from scratch; backtesting pitfalls |
| 43 | **Machine Learning for Factor Investing** | Coqueret & Guida | 2020 | ML + factors: gradient boosting, neural nets for return prediction |

**The 5 Core Return Factors (Fama-French + Momentum):**
| Factor | Signal | Direction |
|--------|--------|-----------|
| **Market (MKT)** | Market beta | Long equities, short cash |
| **Size (SMB)** | Market cap | Long small-cap, short large-cap |
| **Value (HML)** | Book-to-market | Long high B/M, short low B/M |
| **Profitability (RMW)** | Operating profit margin | Long robust, short weak |
| **Investment (CMA)** | Asset growth rate | Long conservative, short aggressive |
| **Momentum (WML)** | 12-1 month return | Long winners, short losers |

---

### PART 4 — BEHAVIORAL FINANCE

| # | Work | Author | Year | Core Thesis |
|---|------|--------|------|-------------|
| 22 | **Thinking, Fast and Slow** | Kahneman | 2011 | System 1 vs 2; anchoring, loss aversion, overconfidence |
| 23 | **Misbehaving** | Thaler | 2015 | Mental accounting, endowment effect, status quo bias |
| 24 | **Irrational Exuberance** | Shiller | 2000 | CAPE ratio; bubbles driven by narratives and social contagion |
| 25 | **Animal Spirits** | Akerlof & Shiller | 2009 | 5 psychological forces drive macro markets: confidence, fairness, stories |
| 26 | **Beyond Greed and Fear** | Shefrin | 2000 | Behavioral bias in professional analysts creates exploitable mispricings |

**Key biases that affect investors:**
- **Loss aversion** — losses hurt ~2× more than equivalent gains feel good → premature selling of winners, holding losers
- **Anchoring** — over-weighting the original purchase price
- **Overconfidence** — overestimating prediction accuracy; excessive trading
- **Disposition effect** — selling winners too early, holding losers too long (tax-suboptimal)
- **Herding** — following consensus → momentum AND mean-reversion opportunities
- **Recency bias** — over-weighting recent events (explains momentum crashes)
- **CAPE/mean reversion** — markets are predictable at 10+ year horizons via Shiller CAPE

---

### PART 5 — SEMINAL ACADEMIC PAPERS

| Paper | Authors | Journal | Year | Key Finding |
|-------|---------|---------|------|-------------|
| Portfolio Selection | Markowitz | J. Finance | 1952 | Diversification math; efficient frontier |
| CAPM | Sharpe/Lintner | J. Finance | 1964 | Beta as risk measure; risk-free rate + β × premium |
| Efficient Market Hypothesis | Fama | J. Finance | 1970 | 3 forms of efficiency; benchmark for active management |
| Cross-Section of Expected Returns | Fama & French | J. Finance | 1992 | Beta alone can't explain returns; size + value matter |
| Three-Factor Model | Fama & French | J. Fin. Econ. | 1993 | MKT + SMB + HML model |
| Momentum Anomaly | Jegadeesh & Titman | J. Finance | 1993 | 3-12 month winners keep winning → momentum factor |
| Four-Factor Model | Carhart | J. Finance | 1997 | MKT + SMB + HML + WML; most fund alpha = factor exposure |
| Five-Factor Model | Fama & French | J. Fin. Econ. | 2015 | + Profitability (RMW) + Investment (CMA) |
| Value & Momentum Everywhere | Asness/Moskowitz/Pedersen | J. Finance | 2013 | Both factors work globally across all asset classes |
| Empirical Asset Pricing via ML | Gu/Kelly/Xiu | Rev. Fin. Studies | 2020 | Neural nets best for return prediction; top signals: momentum, liquidity, vol |
| Replicating Anomalies | Hou/Xue/Zhang | Rev. Fin. Studies | 2020 | 64-85% of published anomalies are false positives → beware overfitting |
| Replication Crisis in Finance? | Jensen/Kelly/Pedersen | J. Finance | 2023 | Most robust factors DO replicate; 13 themes survive cross-country |

---

### PART 6 — RISK MANAGEMENT FRAMEWORKS

| # | Work | Author | Year | Core Thesis |
|---|------|--------|------|-------------|
| 44 | **Portfolio Selection (book)** | Markowitz | 1959 | MVO: maximize return for given risk; efficient frontier |
| 45 | **Fortune's Formula** | Poundstone | 2005 | Kelly Criterion: optimal bet sizing for long-run wealth maximization |
| 46 | **Kelly Capital Growth Criterion** | MacLean/Thorp/Ziemba | 2011 | Full academic treatment of Kelly betting; fractional Kelly |
| 47 | **The Black Swan** | Taleb | 2007 | Fat tails dominate; VaR fails; build for robustness |
| 48 | **Antifragile** | Taleb | 2012 | Barbell strategy: safe core + high-convexity positions; gain from volatility |
| 49 | **Definitive Guide to Position Sizing** | Van Tharp | 2008 | Position sizing > entry signals for long-run performance |
| 50 | **Against the Gods** | Bernstein | 1996 | 400-year history of probability and risk quantification |

**Core Risk Metrics:**

| Metric | Formula | What It Measures |
|--------|---------|-----------------|
| **Sharpe Ratio** | (R_p - R_f) / σ_p | Return per unit of total risk |
| **Sortino Ratio** | (R_p - R_f) / σ_downside | Return per unit of downside risk only |
| **Max Drawdown** | (Peak - Trough) / Peak | Worst peak-to-trough loss |
| **Calmar Ratio** | Annualized Return / Max Drawdown | Return vs. worst-case loss |
| **Beta** | Cov(R_p, R_m) / Var(R_m) | Market sensitivity |
| **Alpha** | R_p - [R_f + β(R_m - R_f)] | Excess return vs. CAPM expectation |
| **VaR (99%)** | 99th percentile loss | Maximum expected loss in normal conditions |
| **CVaR / ES** | Expected loss given VaR exceeded | Average loss in worst 1% of cases |
| **Kelly Fraction** | (p × b - q) / b | Optimal position size given edge |
| **Information Ratio** | Alpha / Tracking Error | Consistency of alpha generation |

---

## MAPPING TO PLATFORM FEATURES

### What the Literature Tells Us to Build

#### 1. Fundamental Screener (Graham + Lynch + Greenblatt)
From Graham: Filter by P/B, earnings yield, debt/equity
From Lynch: PEG ratio screener (P/E ÷ EPS growth)
From Greenblatt: Magic Formula = EV/EBIT + ROIC ranking
→ **Build: Custom screener with fundamental filters**

#### 2. Factor Dashboard (Fama-French + Momentum)
Show each stock's factor exposures:
- Size percentile (market cap rank)
- Value score (P/B, P/E, EV/EBIT)
- Momentum score (12-1 month return)
- Quality/Profitability score (ROE, ROIC, operating margin)
- Investment score (asset growth rate)
→ **Build: Factor exposure heatmap per stock**

#### 3. Risk Analytics (Markowitz + Sharpe + Taleb)
Portfolio-level metrics:
- Sharpe ratio (annualized)
- Max drawdown + drawdown chart
- Beta vs S&P 500
- VaR (95% and 99%)
- Portfolio correlation matrix
- Efficient frontier visualization
→ **Build: Risk analytics dashboard tab**

#### 4. Position Sizing Engine (Kelly + Van Tharp)
Given: win rate, avg win/loss ratio from trade history
Calculate: Kelly fraction → suggested position size
Show: Full Kelly vs Half Kelly vs fixed-fractional
→ **Build: Position sizing calculator in trade ticket**

#### 5. Behavioral Bias Tracker (Kahneman + Thaler)
Analyze user's trade history for:
- Disposition effect (selling winners early, holding losers)
- Overtrading (excessive churn)
- Loss aversion score (avg holding time: winners vs losers)
- Recency bias (concentration in recent winners)
→ **Build: Behavioral analytics section in dashboard**

#### 6. Stage Analysis Indicator (Weinstein)
Overlay on charts:
- 30-week MA
- Stage classification: 1 (base) / 2 (advance) / 3 (top) / 4 (decline)
- Volume confirmation signal
→ **Build: Stage analysis overlay on price charts**

#### 7. CAN SLIM Screener (O'Neil)
Systematic filter:
- C: Current quarterly EPS growth >25%
- A: Annual EPS growth >25% (3-5 years)
- N: New product/service/management (qualitative flag)
- S: Supply — small float preferred
- L: Leader (relative strength rank >80)
- I: Institutional ownership increasing
- M: Market in confirmed uptrend
→ **Build: CAN SLIM screening module**

#### 8. CAPE / Valuation Context (Shiller)
For any stock: show Rolling P/E vs 10-year average
Show sector-level valuation vs historical median
Show whether stock is above/below its own historical P/E range
→ **Build: Historical valuation context panel on quote pages**

#### 9. ML Prediction Transparency (Gu/Kelly/Xiu + López de Prado)
Show feature importance from ensemble:
- Which of the 23 features drove this prediction?
- Directional accuracy on validation set
- Out-of-sample Sharpe of the signal
→ **Build: Model transparency panel on prediction page**

#### 10. Momentum + Value Combo Screener (Asness + Greenblatt)
Combine:
- Value rank (cheap on EV/EBIT)
- Momentum rank (strong 12-1 month return)
Score: avg of both ranks → highest scores = best candidates
→ **Build: Combined factor score on screener**

---

## PRIORITY BUILD ORDER (Literature-Informed)

| Priority | Feature | Academic Basis |
|----------|---------|---------------|
| 🔴 HIGH | **Risk Analytics Dashboard** | Markowitz (1952), Sharpe (1964), Taleb (2007) |
| 🔴 HIGH | **Custom Fundamental Screener** | Graham, Lynch, Greenblatt, O'Shaughnessy |
| 🟡 MED | **Factor Exposure per Stock** | Fama-French 5-factor (2015), Carhart (1997) |
| 🟡 MED | **Position Sizing Calculator** | Kelly (1956), Van Tharp (2008) |
| 🟡 MED | **Behavioral Bias Tracker** | Kahneman (2011), Thaler (2015) |
| 🟡 MED | **Stage Analysis Overlay** | Weinstein (1988) |
| 🟢 LOW | **CAPE / Historical Valuation** | Shiller (2000) |
| 🟢 LOW | **ML Feature Importance** | Gu/Kelly/Xiu (2020), López de Prado (2018) |
| 🟢 LOW | **CAN SLIM Screener** | O'Neil (1988) |
| 🟢 LOW | **Barbell Portfolio Mode** | Taleb (2012) |

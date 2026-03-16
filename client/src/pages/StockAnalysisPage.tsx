import { useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Button,
  Tooltip,
  Grid,
  FormControlLabel,
  Checkbox,
  Breadcrumbs,
  Link as MuiLink,
} from '@mui/material';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import useApi from '../hooks/useApi';
import GeminiInsightPanel from '../components/GeminiInsightPanel';
import PageLoader from '../components/ui/PageLoader';
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_GRID_COLOR,
  CHART_AXIS_COLOR,
} from '../theme';

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AnalysisData {
  ticker: string;
  candles: Candle[];
  indicators: {
    rsi?: { date: string; value: number }[];
    macd?: { date: string; macd: number; signal: number; histogram: number }[];
    bollingerBands?: { date: string; upper: number; middle: number; lower: number }[];
    sma20?: { date: string; value: number }[];
    sma50?: { date: string; value: number }[];
    sma150?: { date: string; value: number }[];
    sma200?: { date: string; value: number }[];
    ema12?: { date: string; value: number }[];
    ema26?: { date: string; value: number }[];
  };
  summary: {
    trend: 'bullish' | 'bearish' | 'neutral';
    rsiSignal: 'overbought' | 'oversold' | 'neutral';
    macdSignal: 'bullish' | 'bearish';
    bollingerPosition: 'upper' | 'middle' | 'lower';
    weinsteinStage: '1' | '2' | '3' | '4' | null;
    weinsteinLabel: string;
    sma150Last: number | null;
  };
}

const PERIODS = ['3M', '6M', '1Y', '2Y', '5Y'];
const INDICATORS = ['rsi', 'macd', 'bollinger', 'sma', 'ema', 'stage'];

const WEINSTEIN_COLORS: Record<string, { color: 'success' | 'warning' | 'error' | 'default'; bg: string }> = {
  '1': { color: 'default',  bg: 'rgba(122,139,165,0.12)' },
  '2': { color: 'success',  bg: 'rgba(0,200,5,0.10)'    },
  '3': { color: 'warning',  bg: 'rgba(255,171,0,0.10)'   },
  '4': { color: 'error',    bg: 'rgba(255,82,82,0.10)'   },
};

const panelSx = {
  p: 4,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.1)',
};

const SIGNAL_COLORS: Record<string, string> = {
  bullish: '#00C805',
  bearish: '#ff5252',
  neutral: '#7a8ba5',
  overbought: '#ff5252',
  oversold: '#00C805',
  upper: '#ff5252',
  middle: '#7a8ba5',
  lower: '#00C805',
};

export default function StockAnalysisPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const [period, setPeriod] = useState('1Y');
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['rsi', 'macd', 'sma']);

  const { data, loading, error } = useApi<AnalysisData>(
    ticker ? `/analysis/${ticker}` : null,
    { period, indicators: activeIndicators.join(',') },
  );

  const toggleIndicator = (ind: string) => {
    setActiveIndicators((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind],
    );
  };

  if (loading && !data) return <PageLoader />;

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) return null;

  // Merge candle data with indicators for the main chart
  const indicatorMap = new Map<string, any>();
  if (data.indicators.bollingerBands) {
    for (const p of data.indicators.bollingerBands) {
      indicatorMap.set(p.date, { ...indicatorMap.get(p.date), bbUpper: p.upper, bbMiddle: p.middle, bbLower: p.lower });
    }
  }
  if (data.indicators.sma20) {
    for (const p of data.indicators.sma20) indicatorMap.set(p.date, { ...indicatorMap.get(p.date), sma20: p.value });
  }
  if (data.indicators.sma50) {
    for (const p of data.indicators.sma50) indicatorMap.set(p.date, { ...indicatorMap.get(p.date), sma50: p.value });
  }
  if (data.indicators.sma150) {
    for (const p of data.indicators.sma150) indicatorMap.set(p.date, { ...indicatorMap.get(p.date), sma150: p.value });
  }
  if (data.indicators.sma200) {
    for (const p of data.indicators.sma200) indicatorMap.set(p.date, { ...indicatorMap.get(p.date), sma200: p.value });
  }
  if (data.indicators.ema12) {
    for (const p of data.indicators.ema12) indicatorMap.set(p.date, { ...indicatorMap.get(p.date), ema12: p.value });
  }
  if (data.indicators.ema26) {
    for (const p of data.indicators.ema26) indicatorMap.set(p.date, { ...indicatorMap.get(p.date), ema26: p.value });
  }

  const mainChartData = data.candles.map((c) => ({
    ...c,
    ...indicatorMap.get(c.date),
  }));

  // RSI chart data
  const rsiData = data.indicators.rsi ?? [];
  // MACD chart data
  const macdData = data.indicators.macd ?? [];

  return (
    <>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <MuiLink component={RouterLink} to="/market" color="inherit" underline="hover">
          Market
        </MuiLink>
        <MuiLink component={RouterLink} to={`/stocks/${ticker}`} color="inherit" underline="hover">
          {ticker}
        </MuiLink>
        <Typography color="text.primary">Technical Analysis</Typography>
      </Breadcrumbs>

      <Typography variant="h4" gutterBottom fontWeight={700}>
        Technical Analysis — {data.ticker}
      </Typography>

      {/* Controls */}
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} mb={2}>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_e, v) => { if (v) setPeriod(v); }}
          size="small"
        >
          {PERIODS.map((p) => (
            <ToggleButton key={p} value={p}>{p}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box display="flex" gap={1} flexWrap="wrap">
          {INDICATORS.map((ind) => (
            <FormControlLabel
              key={ind}
              control={
                <Checkbox
                  checked={activeIndicators.includes(ind)}
                  onChange={() => toggleIndicator(ind)}
                  size="small"
                />
              }
              label={<Typography variant="caption">{ind.toUpperCase()}</Typography>}
            />
          ))}
        </Box>
      </Box>

      {/* Main Price Chart */}
      <Paper variant="outlined" sx={{ ...panelSx, mb: 2 }}>
        <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 1, display: 'block' }}>
          Price Chart
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={mainChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" minTickGap={60} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
            <YAxis yAxisId="price" domain={['auto', 'auto']} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
            <YAxis yAxisId="volume" orientation="right" tick={false} width={0} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend />

            {/* Volume bars */}
            <Bar yAxisId="volume" dataKey="volume" fill="rgba(0,200,5,0.15)" name="Volume" />

            {/* Bollinger Bands */}
            {activeIndicators.includes('bollinger') && (
              <>
                <Area yAxisId="price" dataKey="bbUpper" stroke="none" fill="rgba(61,142,247,0.08)" name="BB Upper" />
                <Line yAxisId="price" type="monotone" dataKey="bbUpper" stroke="rgba(61,142,247,0.4)" dot={false} strokeDasharray="3 3" name="BB Upper" strokeWidth={1} />
                <Line yAxisId="price" type="monotone" dataKey="bbLower" stroke="rgba(61,142,247,0.4)" dot={false} strokeDasharray="3 3" name="BB Lower" strokeWidth={1} />
              </>
            )}

            {/* SMA lines */}
            {activeIndicators.includes('sma') && (
              <>
                <Line yAxisId="price" type="monotone" dataKey="sma20" stroke="#ff7043" dot={false} name="SMA 20" strokeWidth={1} />
                <Line yAxisId="price" type="monotone" dataKey="sma50" stroke="#ab47bc" dot={false} name="SMA 50" strokeWidth={1} />
                <Line yAxisId="price" type="monotone" dataKey="sma200" stroke="#26c6da" dot={false} name="SMA 200" strokeWidth={1} />
              </>
            )}

            {/* Weinstein 30-week MA (SMA 150) */}
            {activeIndicators.includes('stage') && (
              <Line yAxisId="price" type="monotone" dataKey="sma150" stroke="#00C805" dot={false} name="SMA 150 (30w)" strokeWidth={2} strokeDasharray="5 3" />
            )}

            {/* EMA lines */}
            {activeIndicators.includes('ema') && (
              <>
                <Line yAxisId="price" type="monotone" dataKey="ema12" stroke="#66bb6a" dot={false} name="EMA 12" strokeWidth={1} />
                <Line yAxisId="price" type="monotone" dataKey="ema26" stroke="#ffa726" dot={false} name="EMA 26" strokeWidth={1} />
              </>
            )}

            {/* Price line (on top) */}
            <Line yAxisId="price" type="monotone" dataKey="close" stroke={CHART_COLORS[0]} dot={false} name="Close" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </Paper>

      {/* RSI Panel */}
      {activeIndicators.includes('rsi') && rsiData.length > 0 && (
        <Paper variant="outlined" sx={{ ...panelSx, mb: 2 }}>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 1, display: 'block' }}>
            RSI (14)
          </Typography>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={rsiData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" minTickGap={80} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
              <YAxis domain={[0, 100]} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} ticks={[0, 30, 50, 70, 100]} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <ReferenceLine y={70} stroke="rgba(255,82,82,0.5)" strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke="rgba(0,200,5,0.5)" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[1]} dot={false} strokeWidth={1.5} name="RSI" />
            </ComposedChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* MACD Panel */}
      {activeIndicators.includes('macd') && macdData.length > 0 && (
        <Paper variant="outlined" sx={{ ...panelSx, mb: 2 }}>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 1, display: 'block' }}>
            MACD (12, 26, 9)
          </Typography>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={macdData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" minTickGap={80} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
              <YAxis tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <ReferenceLine y={0} stroke="rgba(0,200,5,0.3)" strokeDasharray="3 3" />
              <Bar dataKey="histogram" name="Histogram" fill="rgba(0,200,5,0.4)" />
              <Line type="monotone" dataKey="macd" stroke={CHART_COLORS[2]} dot={false} strokeWidth={1.5} name="MACD" />
              <Line type="monotone" dataKey="signal" stroke={CHART_COLORS[3]} dot={false} strokeWidth={1.5} name="Signal" />
            </ComposedChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Analysis Summary */}
      <Paper variant="outlined" sx={{ ...panelSx, mb: 2 }}>
        <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 2, display: 'block' }}>
          Analysis Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Trend</Typography>
            <Typography fontWeight={700} sx={{ color: SIGNAL_COLORS[data.summary.trend] }}>
              {data.summary.trend.toUpperCase()}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">RSI Signal</Typography>
            <Typography fontWeight={700} sx={{ color: SIGNAL_COLORS[data.summary.rsiSignal] }}>
              {data.summary.rsiSignal.toUpperCase()}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">MACD Signal</Typography>
            <Typography fontWeight={700} sx={{ color: SIGNAL_COLORS[data.summary.macdSignal] }}>
              {data.summary.macdSignal.toUpperCase()}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Bollinger Position</Typography>
            <Typography fontWeight={700} sx={{ color: SIGNAL_COLORS[data.summary.bollingerPosition] }}>
              {data.summary.bollingerPosition.toUpperCase()}
            </Typography>
          </Grid>
        </Grid>

        {/* Weinstein Stage */}
        {data.summary.weinsteinStage && (
          <Box
            mt={2.5}
            p={1.5}
            borderRadius={1}
            sx={{ background: WEINSTEIN_COLORS[data.summary.weinsteinStage]?.bg ?? 'transparent' }}
          >
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <Chip
                label={data.summary.weinsteinLabel}
                color={WEINSTEIN_COLORS[data.summary.weinsteinStage]?.color}
                size="small"
                sx={{ fontWeight: 700 }}
              />
              {data.summary.sma150Last !== null && (
                <Typography variant="caption" color="text.secondary">
                  SMA 150 (30-week): ${data.summary.sma150Last.toFixed(2)}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {{
                  '1': 'Weinstein: Wait for Stage 2 breakout above SMA150 with volume.',
                  '2': 'Weinstein: Confirmed uptrend — hold or add on pullbacks to SMA150.',
                  '3': 'Weinstein: Distribution phase. Reduce exposure, tighten stops.',
                  '4': 'Weinstein: Downtrend. Avoid new longs until Stage 1 base forms.',
                }[data.summary.weinsteinStage]}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Gemini AI Analysis */}
      <GeminiInsightPanel
        ticker={data.ticker}
        context="technical"
        data={JSON.stringify(data.summary)}
      />
    </>
  );
}

import { useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Divider,
  Chip,
  Slider,
  RadioGroup,
  Radio,
  FormControlLabel,
  Collapse,
  IconButton,
  Stack,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
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

// ── Types ─────────────────────────────────────────────────

interface ForecastPoint {
  date: string;
  predicted: number;
  upper?: number;
  lower?: number;
}

interface BacktestMetrics {
  rmse: number;
  mape: number;
  directionalAccuracy: number;
}

interface MonteCarloStats {
  date: string;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

interface MonteCarloData {
  numSimulations: number;
  dailyStats: MonteCarloStats[];
  summary: {
    expectedPrice: number;
    probAboveCurrentPrice: number;
    maxSimulated: number;
    minSimulated: number;
  };
  samplePaths: number[][];
}

interface PredictionData {
  ticker: string;
  currentPrice: number;
  historical: { date: string; close: number }[];
  predictions: {
    linearRegression: {
      forecast: ForecastPoint[];
      r2: number;
      trend: 'up' | 'down' | 'flat';
    };
    movingAverage: {
      forecast: ForecastPoint[];
    };
    lstm: {
      forecast: ForecastPoint[];
      trainLoss: number;
    };
    ensemble?: {
      forecast: ForecastPoint[];
      confidence: number;
      baseModelWeights: Record<string, number>;
      backtestMetrics: BacktestMetrics;
    };
  };
  monteCarlo?: MonteCarloData;
  disclaimer: string;
}

// ── Constants ─────────────────────────────────────────────

const HORIZONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
];

const panelSx = {
  p: 4,
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.1)',
};

const ENSEMBLE_COLOR = '#c9a84c';

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Model Builder Types & Constants ───────────────────────

type WeightMode = 'learned' | 'equal' | 'custom';
type BandWidth  = 'conservative' | 'moderate' | 'aggressive';
type MCDepth    = 'fast' | 'standard' | 'deep';
type Regime     = 'trending' | 'ranging' | 'volatile';

interface BuilderState {
  regime: Regime | null;
  enabledModels: { holtWinters: boolean; lstm: boolean; gru: boolean; dense: boolean };
  weightMode: WeightMode;
  customWeights: { holtWinters: number; lstm: number; gru: number; dense: number };
  sentimentPct: number;
  bandWidth: BandWidth;
  mcDepth: MCDepth;
}

const CUSTOM_LINE_COLOR = '#ff4081';

const REGIME_PRESETS: Record<Regime, Partial<BuilderState>> = {
  trending: {
    enabledModels: { holtWinters: true, lstm: true, gru: true, dense: true },
    weightMode: 'custom',
    customWeights: { holtWinters: 50, lstm: 30, gru: 10, dense: 10 },
    sentimentPct: 60,
    bandWidth: 'moderate',
    mcDepth: 'standard',
  },
  ranging: {
    enabledModels: { holtWinters: false, lstm: true, gru: true, dense: true },
    weightMode: 'custom',
    customWeights: { holtWinters: 0, lstm: 40, gru: 40, dense: 20 },
    sentimentPct: 50,
    bandWidth: 'moderate',
    mcDepth: 'standard',
  },
  volatile: {
    enabledModels: { holtWinters: true, lstm: true, gru: true, dense: true },
    weightMode: 'equal',
    customWeights: { holtWinters: 25, lstm: 25, gru: 25, dense: 25 },
    sentimentPct: 50,
    bandWidth: 'aggressive',
    mcDepth: 'deep',
  },
};

const BAND_MULTIPLIER: Record<BandWidth, number> = {
  conservative: 1.5,
  moderate:     1.0,
  aggressive:   0.6,
};

const MC_DEPTH_SIMS: Record<MCDepth, number> = {
  fast:     500,
  standard: 1000,
  deep:     3000,
};

// ── Custom tooltip for Monte Carlo chart ──────────────────

function McTooltip({ active, payload, label, dailyStats }: {
  active?: boolean;
  payload?: any[];
  label?: string;
  dailyStats: MonteCarloStats[];
}) {
  if (!active || !payload?.length || !label) return null;
  const stat = dailyStats.find((s) => s.date === label);
  if (!stat) return null;
  return (
    <Box sx={{ ...CHART_TOOLTIP_STYLE, p: 1.5, minWidth: 170 }}>
      <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
        {label}
      </Typography>
      {[
        { label: 'P95', value: stat.p95, color: 'rgba(61,142,247,0.9)' },
        { label: 'P75', value: stat.p75, color: '#c9a84c' },
        { label: 'Median', value: stat.median, color: '#c9a84c', bold: true },
        { label: 'P25', value: stat.p25, color: '#c9a84c' },
        { label: 'P5', value: stat.p5, color: 'rgba(61,142,247,0.9)' },
      ].map(({ label: l, value, color, bold }) => (
        <Box key={l} display="flex" justifyContent="space-between" gap={2}>
          <Typography variant="caption" sx={{ color, fontWeight: bold ? 700 : 400 }}>{l}</Typography>
          <Typography variant="caption" fontWeight={bold ? 700 : 600}>${fmt(value)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Model Builder Panel ───────────────────────────────────

function ModelBuilderPanel({
  ticker,
  horizon,
  currentPrice,
  standardForecast,
  standardMetrics,
}: {
  ticker: string;
  horizon: number;
  currentPrice: number;
  standardForecast: ForecastPoint[];
  standardMetrics: PredictionData['predictions']['ensemble'];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionData | null>(null);

  const [state, setState] = useState<BuilderState>({
    regime: null,
    enabledModels: { holtWinters: true, lstm: true, gru: true, dense: true },
    weightMode: 'learned',
    customWeights: { holtWinters: 25, lstm: 25, gru: 25, dense: 25 },
    sentimentPct: 50,
    bandWidth: 'moderate',
    mcDepth: 'standard',
  });

  function applyRegime(regime: Regime) {
    setState((prev) => ({ ...prev, ...REGIME_PRESETS[regime], regime }));
  }

  function toggleModel(key: keyof BuilderState['enabledModels']) {
    setState((prev) => {
      const next = { ...prev.enabledModels, [key]: !prev.enabledModels[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return { ...prev, enabledModels: next, regime: null };
    });
  }

  function setCustomWeight(key: keyof BuilderState['customWeights'], value: number) {
    setState((prev) => ({
      ...prev,
      regime: null,
      customWeights: { ...prev.customWeights, [key]: value },
    }));
  }

  async function handleRun() {
    setLoading(true);
    setRunError(null);
    try {
      const { enabledModels, customWeights, weightMode, sentimentPct, mcDepth } = state;
      const totalW = customWeights.holtWinters + customWeights.lstm + customWeights.gru + customWeights.dense || 1;

      const body: Record<string, unknown> = {
        horizon,
        sentimentOverride: sentimentPct / 100,
        numSimulations:    MC_DEPTH_SIMS[mcDepth],
        enabledModels,
      };

      if (weightMode === 'custom') {
        body.customWeights = {
          holtWinters: enabledModels.holtWinters ? customWeights.holtWinters / totalW : 0,
          lstm:        enabledModels.lstm        ? customWeights.lstm        / totalW : 0,
          gru:         enabledModels.gru         ? customWeights.gru         / totalW : 0,
          dense:       enabledModels.dense       ? customWeights.dense       / totalW : 0,
        };
      } else if (weightMode === 'equal') {
        const count = Object.values(enabledModels).filter(Boolean).length || 1;
        const eq = 1 / count;
        body.customWeights = {
          holtWinters: enabledModels.holtWinters ? eq : 0,
          lstm:        enabledModels.lstm        ? eq : 0,
          gru:         enabledModels.gru         ? eq : 0,
          dense:       enabledModels.dense       ? eq : 0,
        };
      }

      const resp = await fetch(`/api/predict/${ticker}/custom`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? 'Request failed');
      setResult(await resp.json());
    } catch (e: any) {
      setRunError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const sectionLabel = (n: string) => (
    <Typography
      variant="caption"
      fontWeight={700}
      sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', display: 'block', mb: 1.5 }}
    >
      {n}
    </Typography>
  );

  const optionCard = (
    active: boolean,
    onClick: () => void,
    title: string,
    sub: string,
  ) => (
    <Box
      onClick={onClick}
      sx={{
        flex: '1 1 120px',
        minWidth: 120,
        p: 1.5,
        textAlign: 'center',
        border: active ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.15)',
        borderRadius: 2,
        cursor: 'pointer',
        background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
        transition: 'all 0.15s ease',
        '&:hover': { borderColor: 'rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.04)' },
      }}
    >
      <Typography variant="body2" fontWeight={600}>{title}</Typography>
      <Typography variant="caption" color="text.secondary">{sub}</Typography>
    </Box>
  );

  return (
    <Paper variant="outlined" sx={{ ...panelSx, mb: 3, border: '1px solid rgba(201,168,76,0.2)' }}>
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((o) => !o)}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <AutoFixHighIcon sx={{ color: '#c9a84c', fontSize: 22 }} />
          <Box>
            <Typography variant="caption" fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', display: 'block' }}>
              Experimental
            </Typography>
            <Typography variant="h6" fontWeight={700}>Build Your Own Model</Typography>
          </Box>
        </Box>
        <IconButton size="small" sx={{ color: '#c9a84c' }}>
          <ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }} />
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)', my: 3 }} />

        {/* ── 01 Market Regime ─────────────────────────────── */}
        {sectionLabel('01 — Market Regime')}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Quick presets that configure all parameters below. Fine-tune individually afterwards.
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          {([
            { key: 'trending' as Regime,  title: 'Trending Market', sub: 'HW-heavy · bullish bias'      },
            { key: 'ranging'  as Regime,  title: 'Ranging Market',  sub: 'LSTM + GRU · HW off'          },
            { key: 'volatile' as Regime,  title: 'High Volatility', sub: 'Equal weights · deep MC'      },
          ] as const).map(({ key, title, sub }) => (
            <Box
              key={key}
              onClick={() => applyRegime(key)}
              sx={{
                flex: '1 1 140px', minWidth: 140, p: 2,
                border: state.regime === key ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.15)',
                borderRadius: 2, cursor: 'pointer',
                background: state.regime === key ? 'rgba(201,168,76,0.08)' : 'transparent',
                transition: 'all 0.15s ease',
                '&:hover': { borderColor: 'rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.04)' },
              }}
            >
              <Typography variant="body2" fontWeight={600}>{title}</Typography>
              <Typography variant="caption" color="text.secondary">{sub}</Typography>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ borderColor: 'rgba(201,168,76,0.07)', mb: 3 }} />

        {/* ── 02 Models & Weights ───────────────────────────── */}
        {sectionLabel('02 — Model Selection & Weights')}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
          {([
            { key: 'holtWinters' as const, label: 'Holt-Winters' },
            { key: 'lstm'        as const, label: 'Bi-LSTM'      },
            { key: 'gru'         as const, label: 'GRU'          },
            { key: 'dense'       as const, label: 'Dense'        },
          ]).map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              onClick={() => toggleModel(key)}
              variant={state.enabledModels[key] ? 'filled' : 'outlined'}
              sx={{
                borderColor: state.enabledModels[key] ? '#c9a84c' : 'rgba(201,168,76,0.25)',
                color: state.enabledModels[key] ? '#0b1426' : '#7a8ba5',
                bgcolor: state.enabledModels[key] ? '#c9a84c' : 'transparent',
                fontWeight: 600,
                '&:hover': { opacity: 0.85 },
              }}
            />
          ))}
        </Stack>

        <RadioGroup row value={state.weightMode}
          onChange={(_e, v) => setState((p) => ({ ...p, weightMode: v as WeightMode, regime: null }))}
          sx={{ mb: 2 }}>
          {([
            { value: 'learned', label: 'Learned (meta-learner)' },
            { value: 'equal',   label: 'Equal split'            },
            { value: 'custom',  label: 'Custom weights'         },
          ] as const).map(({ value, label }) => (
            <FormControlLabel key={value} value={value}
              control={<Radio size="small" sx={{ color: '#c9a84c', '&.Mui-checked': { color: '#c9a84c' } }} />}
              label={<Typography variant="body2">{label}</Typography>}
            />
          ))}
        </RadioGroup>

        {state.weightMode === 'custom' && (() => {
          const totalW = Object.values(state.customWeights).reduce((a, b) => a + b, 0) || 1;
          return (
            <Box sx={{ pl: 1, pr: 2, mb: 2.5 }}>
              {([
                { key: 'holtWinters' as const, label: 'Holt-Winters' },
                { key: 'lstm'        as const, label: 'Bi-LSTM'      },
                { key: 'gru'         as const, label: 'GRU'          },
                { key: 'dense'       as const, label: 'Dense'        },
              ]).map(({ key, label }) => {
                const disabled = !state.enabledModels[key];
                const normalized = disabled ? 0 : (state.customWeights[key] / totalW * 100);
                return (
                  <Box key={key} sx={{ mb: 1.5, opacity: disabled ? 0.35 : 1 }}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" fontWeight={600}>{label}</Typography>
                      <Typography variant="caption" fontWeight={700}
                        sx={{ color: disabled ? 'text.disabled' : '#c9a84c' }}>
                        {disabled ? '0% (off)' : `${normalized.toFixed(0)}%`}
                      </Typography>
                    </Box>
                    <Slider value={disabled ? 0 : state.customWeights[key]} min={0} max={100}
                      disabled={disabled}
                      onChange={(_e, v) => setCustomWeight(key, v as number)}
                      sx={{ color: '#c9a84c', '& .MuiSlider-thumb': { width: 14, height: 14 }, '& .MuiSlider-rail': { opacity: 0.3 } }}
                    />
                  </Box>
                );
              })}
              <Typography variant="caption" color="text.secondary">
                Percentages shown are normalized across enabled models.
              </Typography>
            </Box>
          );
        })()}

        <Divider sx={{ borderColor: 'rgba(201,168,76,0.07)', mb: 3 }} />

        {/* ── 03 Bias & Risk ───────────────────────────────── */}
        {sectionLabel('03 — Market Bias & Risk')}

        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" fontWeight={600}>Sentiment Bias</Typography>
            <Typography variant="body2" fontWeight={700} sx={{
              color: state.sentimentPct < 35 ? '#ff5252' : state.sentimentPct > 65 ? '#00c853' : '#c9a84c',
            }}>
              {state.sentimentPct < 35 ? 'Bearish' : state.sentimentPct > 65 ? 'Bullish' : 'Neutral'}{' '}
              ({state.sentimentPct})
            </Typography>
          </Box>
          <Slider value={state.sentimentPct} min={0} max={100}
            onChange={(_e, v) => setState((p) => ({ ...p, sentimentPct: v as number, regime: null }))}
            sx={{
              color: state.sentimentPct < 35 ? '#ff5252' : state.sentimentPct > 65 ? '#00c853' : '#c9a84c',
              '& .MuiSlider-thumb': { width: 16, height: 16 },
            }}
          />
          <Box display="flex" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">Bearish</Typography>
            <Typography variant="caption" color="text.secondary">Bullish</Typography>
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight={600} mb={1}>Confidence Band Width</Typography>
          <Stack direction="row" spacing={1}>
            {([
              { key: 'conservative' as BandWidth, title: 'Conservative', sub: '1.5×' },
              { key: 'moderate'     as BandWidth, title: 'Moderate',     sub: '1.0×' },
              { key: 'aggressive'   as BandWidth, title: 'Aggressive',   sub: '0.6×' },
            ] as const).map(({ key, title, sub }) =>
              optionCard(state.bandWidth === key, () => setState((p) => ({ ...p, bandWidth: key })), title, sub)
            )}
          </Stack>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight={600} mb={1}>Monte Carlo Depth</Typography>
          <Stack direction="row" spacing={1}>
            {([
              { key: 'fast'     as MCDepth, title: 'Fast',     sub: '500 paths'   },
              { key: 'standard' as MCDepth, title: 'Standard', sub: '1,000 paths' },
              { key: 'deep'     as MCDepth, title: 'Deep',     sub: '3,000 paths' },
            ] as const).map(({ key, title, sub }) =>
              optionCard(state.mcDepth === key, () => setState((p) => ({ ...p, mcDepth: key })), title, sub)
            )}
          </Stack>
        </Box>

        <Divider sx={{ borderColor: 'rgba(201,168,76,0.07)', mb: 3 }} />

        {/* ── 04 Run & Compare ─────────────────────────────── */}
        {sectionLabel('04 — Run & Compare')}

        <Button
          variant="contained"
          fullWidth
          disabled={loading}
          onClick={handleRun}
          sx={{
            mb: 3, py: 1.5, fontSize: '1rem', fontWeight: 700,
            bgcolor: '#c9a84c', color: '#0b1426',
            '&:hover': { bgcolor: '#a88a3a' },
            '&:disabled': { bgcolor: 'rgba(201,168,76,0.2)', color: 'rgba(201,168,76,0.4)' },
          }}
        >
          {loading ? (
            <Box display="flex" alignItems="center" gap={1.5}>
              <CircularProgress size={18} sx={{ color: '#c9a84c' }} />
              Training custom model…
            </Box>
          ) : 'Run My Model'}
        </Button>

        {runError && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setRunError(null)}>{runError}</Alert>}

        {/* Comparison results */}
        {result && (() => {
          const customForecast = result.predictions.ensemble?.forecast ?? [];
          const customEns      = result.predictions.ensemble;
          const bandMult       = BAND_MULTIPLIER[state.bandWidth];

          const compData = customForecast.map((cp, i) => {
            const sp = standardForecast[i];
            const upOff   = cp.upper  != null ? (cp.upper  - cp.predicted) * bandMult : 0;
            const downOff = cp.lower  != null ? (cp.predicted - cp.lower)  * bandMult : 0;
            return {
              date:        cp.date,
              standard:    sp?.predicted,
              stdUpper:    sp?.upper,
              stdLower:    sp?.lower,
              custom:      cp.predicted,
              customUpper: cp.upper  != null ? cp.predicted + upOff   : undefined,
              customLower: cp.lower  != null ? cp.predicted - downOff : undefined,
            };
          });

          const customEnd   = customForecast.length  ? customForecast[customForecast.length - 1].predicted    : currentPrice;
          const standardEnd = standardForecast.length ? standardForecast[standardForecast.length - 1].predicted : currentPrice;
          const customPct   = (customEnd   - currentPrice) / currentPrice * 100;
          const standardPct = (standardEnd - currentPrice) / currentPrice * 100;

          return (
            <>
              {/* Legend */}
              <Box display="flex" gap={3} mb={2}>
                <Box display="flex" alignItems="center" gap={0.75}>
                  <Box sx={{ width: 24, height: 3, bgcolor: CUSTOM_LINE_COLOR, borderRadius: 1 }} />
                  <Typography variant="caption" fontWeight={600}>Custom</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.75}>
                  <Box sx={{ width: 24, height: 3, bgcolor: ENSEMBLE_COLOR, borderRadius: 1 }} />
                  <Typography variant="caption" fontWeight={600}>Standard</Typography>
                </Box>
              </Box>

              {/* Comparison chart */}
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={compData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" minTickGap={40} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name]} />
                  <ReferenceLine y={currentPrice} stroke="rgba(201,168,76,0.3)" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="stdUpper"    stroke="none" fill="rgba(201,168,76,0.1)"  legendType="none" />
                  <Area type="monotone" dataKey="stdLower"    stroke="none" fill="rgba(201,168,76,0.1)"  legendType="none" />
                  <Area type="monotone" dataKey="customUpper" stroke="none" fill="rgba(255,64,129,0.1)"  legendType="none" />
                  <Area type="monotone" dataKey="customLower" stroke="none" fill="rgba(255,64,129,0.1)"  legendType="none" />
                  <Line type="monotone" dataKey="standard" stroke={ENSEMBLE_COLOR} strokeWidth={2} strokeDasharray="6 3" dot={false} name="Standard" />
                  <Line type="monotone" dataKey="custom" stroke={CUSTOM_LINE_COLOR} strokeWidth={2.5} dot={false} name="Custom" />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Side-by-side metric cards */}
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <Card sx={{ ...panelSx, border: '1px solid rgba(255,64,129,0.2)' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}
                        sx={{ textTransform: 'uppercase', display: 'block', mb: 1.5 }}>
                        Final Price Forecast
                      </Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-end">
                        <Box>
                          <Typography variant="caption" sx={{ color: CUSTOM_LINE_COLOR, fontWeight: 700, display: 'block' }}>CUSTOM</Typography>
                          <Typography variant="h5" fontWeight={700} sx={{ color: CUSTOM_LINE_COLOR }}>${fmt(customEnd)}</Typography>
                          <Typography variant="body2" fontWeight={600} color={customPct >= 0 ? 'success.main' : 'error.main'}>
                            {customPct >= 0 ? '+' : ''}{customPct.toFixed(2)}%
                          </Typography>
                        </Box>
                        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(201,168,76,0.1)', mx: 2 }} />
                        <Box textAlign="right">
                          <Typography variant="caption" sx={{ color: ENSEMBLE_COLOR, fontWeight: 700, display: 'block' }}>STANDARD</Typography>
                          <Typography variant="h5" fontWeight={700} sx={{ color: ENSEMBLE_COLOR }}>${fmt(standardEnd)}</Typography>
                          <Typography variant="body2" fontWeight={600} color={standardPct >= 0 ? 'success.main' : 'error.main'}>
                            {standardPct >= 0 ? '+' : ''}{standardPct.toFixed(2)}%
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card sx={{ ...panelSx, border: '1px solid rgba(255,64,129,0.2)' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}
                        sx={{ textTransform: 'uppercase', display: 'block', mb: 1.5 }}>
                        Model Quality
                      </Typography>
                      {customEns && standardMetrics && (
                        <Box>
                          <Box mb={1.5}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="caption">Confidence</Typography>
                              <Box display="flex" gap={2}>
                                <Typography variant="caption" sx={{ color: CUSTOM_LINE_COLOR, fontWeight: 700 }}>
                                  {(customEns.confidence * 100).toFixed(0)}%
                                </Typography>
                                <Typography variant="caption" sx={{ color: ENSEMBLE_COLOR, fontWeight: 700 }}>
                                  {(standardMetrics.confidence * 100).toFixed(0)}%
                                </Typography>
                              </Box>
                            </Box>
                            <Box position="relative" height={6} borderRadius={3} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                              <Box position="absolute" left={0} top={0} height="100%" borderRadius={3}
                                sx={{ width: `${customEns.confidence * 100}%`, bgcolor: CUSTOM_LINE_COLOR, opacity: 0.85 }} />
                            </Box>
                          </Box>
                          {[
                            {
                              label: 'RMSE',
                              custom: `$${customEns.backtestMetrics.rmse.toFixed(2)}`,
                              std: `$${standardMetrics.backtestMetrics.rmse.toFixed(2)}`,
                            },
                            {
                              label: 'Dir. Accuracy',
                              custom: `${(customEns.backtestMetrics.directionalAccuracy * 100).toFixed(1)}%`,
                              std: `${(standardMetrics.backtestMetrics.directionalAccuracy * 100).toFixed(1)}%`,
                            },
                          ].map(({ label, custom, std }) => (
                            <Box key={label} display="flex" justifyContent="space-between" mt={0.75}>
                              <Typography variant="caption" color="text.secondary">{label}</Typography>
                              <Box display="flex" gap={2}>
                                <Typography variant="caption" sx={{ color: CUSTOM_LINE_COLOR, fontWeight: 600 }}>{custom}</Typography>
                                <Typography variant="caption" sx={{ color: ENSEMBLE_COLOR, fontWeight: 600 }}>{std}</Typography>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </>
          );
        })()}
      </Collapse>
    </Paper>
  );
}

// ── Page component ────────────────────────────────────────

export default function StockPredictionPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const [horizon, setHorizon] = useState(7);

  const { data, loading, error } = useApi<PredictionData>(
    ticker ? `/predict/${ticker}` : null,
    { horizon },
  );

  if (loading && !data) return <PageLoader />;

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) return null;

  // ── Build ensemble prediction chart data ───────────────
  const chartData: any[] = data.historical.map((h) => ({
    date: h.date,
    historical: h.close,
  }));

  const lrForecast = data.predictions.linearRegression.forecast;
  const maForecast = data.predictions.movingAverage.forecast;
  const lstmForecast = data.predictions.lstm.forecast;
  const ensForecast = data.predictions.ensemble?.forecast ?? [];

  const lastHistorical = data.historical[data.historical.length - 1];
  if (lastHistorical) {
    chartData[chartData.length - 1].lr = lastHistorical.close;
    chartData[chartData.length - 1].ma = lastHistorical.close;
    chartData[chartData.length - 1].lstm = lastHistorical.close;
    if (ensForecast.length > 0) {
      chartData[chartData.length - 1].ensemble = lastHistorical.close;
    }
  }

  const maxLen = Math.max(lrForecast.length, maForecast.length, lstmForecast.length, ensForecast.length);
  for (let i = 0; i < maxLen; i++) {
    const point: any = {
      date: ensForecast[i]?.date || lrForecast[i]?.date || maForecast[i]?.date || lstmForecast[i]?.date,
    };
    if (lrForecast[i]) point.lr = lrForecast[i].predicted;
    if (maForecast[i]) point.ma = maForecast[i].predicted;
    if (lstmForecast[i]) {
      point.lstm = lstmForecast[i].predicted;
      point.lstmUpper = lstmForecast[i].upper;
      point.lstmLower = lstmForecast[i].lower;
    }
    if (ensForecast[i]) {
      point.ensemble = ensForecast[i].predicted;
      point.ensUpper = ensForecast[i].upper;
      point.ensLower = ensForecast[i].lower;
    }
    chartData.push(point);
  }

  // ── Build Monte Carlo chart data ───────────────────────
  const mc = data.monteCarlo;

  // For Recharts confidence bands we use stackId + transparent base layer:
  // stackId="outer" → Area(outerBase: p5, transparent) + Area(outerBand: p95-p5, blue)
  // stackId="inner" → Area(innerBase: p25, transparent) + Area(innerBand: p75-p25, gold)
  // This creates shaded bands between the percentiles without masking issues.
  const mcChartData: Record<string, number | string>[] = mc
    ? mc.dailyStats.map((stat, dayIdx) => {
        const point: Record<string, number | string> = {
          date: stat.date,
          outerBase: stat.p5,
          outerBand: stat.p95 - stat.p5,
          innerBase: stat.p25,
          innerBand: stat.p75 - stat.p25,
          median: stat.median,
        };
        mc.samplePaths.forEach((path, pathIdx) => {
          point[`path_${pathIdx}`] = path[dayIdx] ?? 0;
        });
        return point;
      })
    : [];

  // Y-axis domain: span from slightly below p5_min to slightly above p95_max
  const mcMinY = mc
    ? Math.min(...mc.dailyStats.map((s) => s.p5)) * 0.99
    : 0;
  const mcMaxY = mc
    ? Math.max(...mc.dailyStats.map((s) => s.p95)) * 1.01
    : 0;

  // 50 sample path lines (no animation, very thin, semi-transparent)
  const mcSamplePathLines = mc
    ? mc.samplePaths.map((_, i) => (
        <Line
          key={`path_${i}`}
          type="monotone"
          dataKey={`path_${i}`}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.6}
          dot={false}
          legendType="none"
          isAnimationActive={false}
        />
      ))
    : [];

  // ── Model summary card values ──────────────────────────
  const lrEnd = lrForecast.length > 0 ? lrForecast[lrForecast.length - 1].predicted : data.currentPrice;
  const maEnd = maForecast.length > 0 ? maForecast[maForecast.length - 1].predicted : data.currentPrice;
  const lstmEnd = lstmForecast.length > 0 ? lstmForecast[lstmForecast.length - 1].predicted : data.currentPrice;
  const ensEnd = ensForecast.length > 0 ? ensForecast[ensForecast.length - 1].predicted : data.currentPrice;
  const ens = data.predictions.ensemble;

  return (
    <>
      <Button component={RouterLink} to={`/stocks/${ticker}`} sx={{ mb: 1 }}>
        &larr; Back to {ticker}
      </Button>

      {/* Disclaimer */}
      <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
        {data.disclaimer}
      </Alert>

      <Typography variant="h4" gutterBottom fontWeight={700}>
        Price Prediction — {data.ticker}
      </Typography>

      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6">
          Current: <strong>${fmt(data.currentPrice)}</strong>
        </Typography>
        <ToggleButtonGroup
          value={horizon}
          exclusive
          onChange={(_e, v) => { if (v != null) setHorizon(v); }}
          size="small"
        >
          {HORIZONS.map((h) => (
            <ToggleButton key={h.value} value={h.value}>{h.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Prediction Chart */}
      <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
        <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 1, display: 'block' }}>
          Prediction Chart
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(5)}
              interval="preserveStartEnd"
              minTickGap={50}
              tick={{ fill: CHART_AXIS_COLOR }}
              fontSize={11}
            />
            <YAxis domain={['auto', 'auto']} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, undefined]}
            />
            <Legend />
            <ReferenceLine y={data.currentPrice} stroke="rgba(201,168,76,0.4)" strokeDasharray="3 3" label={{ value: 'Current', fill: CHART_AXIS_COLOR, fontSize: 11 }} />

            {ens && (
              <Area type="monotone" dataKey="ensUpper" stroke="none" fill="rgba(201,168,76,0.12)" name="Ensemble Band" />
            )}
            {ens && (
              <Area type="monotone" dataKey="ensLower" stroke="none" fill="rgba(201,168,76,0.12)" legendType="none" />
            )}
            <Area type="monotone" dataKey="lstmUpper" stroke="none" fill="rgba(0,200,83,0.1)" name="LSTM Band" />
            <Area type="monotone" dataKey="lstmLower" stroke="none" fill="rgba(0,200,83,0.1)" legendType="none" />

            <Line type="monotone" dataKey="historical" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Historical" />
            <Line type="monotone" dataKey="lr" stroke={CHART_COLORS[1]} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Holt-Winters" />
            <Line type="monotone" dataKey="ma" stroke={CHART_COLORS[4]} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="GRU" />
            <Line type="monotone" dataKey="lstm" stroke={CHART_COLORS[2]} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Bi-LSTM" />
            {ens && (
              <Line type="monotone" dataKey="ensemble" stroke={ENSEMBLE_COLOR} strokeWidth={3} strokeDasharray="8 4" dot={false} name="Ensemble" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Paper>

      {/* ── Monte Carlo Simulation Panel ──────────────────── */}
      {mc && (
        <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', display: 'block' }}
          >
            Monte Carlo Simulation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            {mc.numSimulations.toLocaleString()} simulated price paths via Geometric Brownian Motion — shaded bands show P5–P95 (outer) and P25–P75 (inner) confidence intervals
          </Typography>

          {/* Summary stat cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ ...panelSx, border: '1px solid rgba(201,168,76,0.15)' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                    Expected Price
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: ENSEMBLE_COLOR, mt: 1 }}>
                    ${fmt(mc.summary.expectedPrice)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={mc.summary.expectedPrice >= data.currentPrice ? 'success.main' : 'error.main'}
                  >
                    {mc.summary.expectedPrice >= data.currentPrice ? '+' : ''}
                    {(((mc.summary.expectedPrice - data.currentPrice) / data.currentPrice) * 100).toFixed(2)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    Mean of all {mc.numSimulations.toLocaleString()} final prices
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Card sx={{ ...panelSx, border: '1px solid rgba(201,168,76,0.15)' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                    Probability Up
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{
                      mt: 1,
                      color: mc.summary.probAboveCurrentPrice >= 0.5 ? '#00c853' : '#ff5252',
                    }}
                  >
                    {(mc.summary.probAboveCurrentPrice * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    of paths end above ${fmt(data.currentPrice)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    in {horizon} trading day{horizon !== 1 ? 's' : ''}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Card sx={{ ...panelSx, border: '1px solid rgba(201,168,76,0.15)' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                    Simulated Range
                  </Typography>
                  <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                    ${fmt(mc.summary.minSimulated)} – ${fmt(mc.summary.maxSimulated)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    extreme min – max at horizon end
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)', my: 1 }} />
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Median</Typography>
                    <Typography variant="caption" fontWeight={600}>
                      ${fmt(mc.dailyStats[mc.dailyStats.length - 1]?.median ?? 0)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">P25–P75</Typography>
                    <Typography variant="caption" fontWeight={600}>
                      ${fmt(mc.dailyStats[mc.dailyStats.length - 1]?.p25 ?? 0)} – ${fmt(mc.dailyStats[mc.dailyStats.length - 1]?.p75 ?? 0)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Monte Carlo chart */}
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={mcChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)}
                interval="preserveStartEnd"
                minTickGap={40}
                tick={{ fill: CHART_AXIS_COLOR }}
                fontSize={11}
              />
              <YAxis
                domain={[mcMinY, mcMaxY]}
                tick={{ fill: CHART_AXIS_COLOR }}
                fontSize={11}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                content={(props: any) => (
                  <McTooltip
                    active={props.active}
                    payload={props.payload}
                    label={props.label}
                    dailyStats={mc.dailyStats}
                  />
                )}
              />
              <Legend />

              {/* 50 sample paths — rendered first (behind bands) */}
              {mcSamplePathLines}

              {/* Outer confidence band: P5 to P95 (blue) */}
              <Area
                stackId="outer"
                type="monotone"
                dataKey="outerBase"
                stroke="none"
                fill="transparent"
                legendType="none"
                isAnimationActive={false}
              />
              <Area
                stackId="outer"
                type="monotone"
                dataKey="outerBand"
                stroke="none"
                fill="rgba(61,142,247,0.14)"
                name="P5–P95"
                isAnimationActive={false}
              />

              {/* Inner confidence band: P25 to P75 (gold) */}
              <Area
                stackId="inner"
                type="monotone"
                dataKey="innerBase"
                stroke="none"
                fill="transparent"
                legendType="none"
                isAnimationActive={false}
              />
              <Area
                stackId="inner"
                type="monotone"
                dataKey="innerBand"
                stroke="none"
                fill="rgba(201,168,76,0.28)"
                name="P25–P75"
                isAnimationActive={false}
              />

              {/* Median line */}
              <Line
                type="monotone"
                dataKey="median"
                stroke={ENSEMBLE_COLOR}
                strokeWidth={2.5}
                dot={false}
                name="Median"
                isAnimationActive={false}
              />

              {/* Current price reference */}
              <ReferenceLine
                y={data.currentPrice}
                stroke="rgba(201,168,76,0.5)"
                strokeDasharray="4 4"
                label={{ value: 'Current', fill: CHART_AXIS_COLOR, fontSize: 10 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Model Details */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ ...panelSx, height: '100%' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                Holt-Winters
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: CHART_COLORS[1], mt: 1 }}>
                ${fmt(lrEnd)}
              </Typography>
              <Typography variant="body2" color={lrEnd >= data.currentPrice ? 'success.main' : 'error.main'}>
                {lrEnd >= data.currentPrice ? '+' : ''}{((lrEnd - data.currentPrice) / data.currentPrice * 100).toFixed(2)}%
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                R² = {data.predictions.linearRegression.r2.toFixed(4)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Trend: {data.predictions.linearRegression.trend}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Triple exponential smoothing with grid-searched parameters for level, trend, and weekly seasonality.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ ...panelSx, height: '100%' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                GRU Network
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: CHART_COLORS[4], mt: 1 }}>
                ${fmt(maEnd)}
              </Typography>
              <Typography variant="body2" color={maEnd >= data.currentPrice ? 'success.main' : 'error.main'}>
                {maEnd >= data.currentPrice ? '+' : ''}{((maEnd - data.currentPrice) / data.currentPrice * 100).toFixed(2)}%
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                2-layer GRU with Huber loss, 23-feature input, 20-day window. Robust to outliers.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ ...panelSx, height: '100%' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                Bidirectional LSTM
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: CHART_COLORS[2], mt: 1 }}>
                ${fmt(lstmEnd)}
              </Typography>
              <Typography variant="body2" color={lstmEnd >= data.currentPrice ? 'success.main' : 'error.main'}>
                {lstmEnd >= data.currentPrice ? '+' : ''}{((lstmEnd - data.currentPrice) / data.currentPrice * 100).toFixed(2)}%
              </Typography>
              {data.predictions.lstm.trainLoss >= 0 && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Train Loss: {data.predictions.lstm.trainLoss.toFixed(6)}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Forward + backward LSTM (48+32 units), 23-feature input, 30-day window.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{
            ...panelSx,
            height: '100%',
            border: '1px solid rgba(201,168,76,0.3)',
          }}>
            <CardContent>
              <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', color: ENSEMBLE_COLOR }}>
                Stacked Ensemble
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: ENSEMBLE_COLOR, mt: 1 }}>
                ${fmt(ensEnd)}
              </Typography>
              <Typography variant="body2" color={ensEnd >= data.currentPrice ? 'success.main' : 'error.main'}>
                {ensEnd >= data.currentPrice ? '+' : ''}{((ensEnd - data.currentPrice) / data.currentPrice * 100).toFixed(2)}%
              </Typography>

              {ens && (
                <>
                  <Box mt={1.5}>
                    <Typography variant="caption" color="text.secondary">
                      Confidence
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={ens.confidence * 100}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'rgba(201,168,76,0.15)',
                          '& .MuiLinearProgress-bar': { bgcolor: ENSEMBLE_COLOR },
                        }}
                      />
                      <Typography variant="caption" fontWeight={700} color={ENSEMBLE_COLOR}>
                        {(ens.confidence * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                  </Box>

                  <Box mt={1}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Dir. Accuracy: {(ens.backtestMetrics.directionalAccuracy * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      RMSE: ${ens.backtestMetrics.rmse.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      MAPE: {(ens.backtestMetrics.mape * 100).toFixed(1)}%
                    </Typography>
                  </Box>

                  <Box mt={1}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Weights: {Object.entries(ens.baseModelWeights)
                        .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
                        .join(', ')}
                    </Typography>
                  </Box>
                </>
              )}

              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Meta-learner combining 4 base models with learned weights and confidence estimation.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Build Your Own Model */}
      {ens && (
        <ModelBuilderPanel
          ticker={data.ticker}
          horizon={horizon}
          currentPrice={data.currentPrice}
          standardForecast={ensForecast}
          standardMetrics={ens}
        />
      )}

      {/* Gemini AI */}
      <GeminiInsightPanel
        ticker={data.ticker}
        context="prediction"
        data={`Holt-Winters: $${fmt(lrEnd)}, GRU: $${fmt(maEnd)}, Bi-LSTM: $${fmt(lstmEnd)}, Ensemble: $${fmt(ensEnd)}${ens ? ` (confidence: ${(ens.confidence * 100).toFixed(0)}%, dir accuracy: ${(ens.backtestMetrics.directionalAccuracy * 100).toFixed(0)}%)` : ''}${mc ? `, Monte Carlo: expected $${fmt(mc.summary.expectedPrice)}, ${(mc.summary.probAboveCurrentPrice * 100).toFixed(1)}% prob up` : ''}`}
      />
    </>
  );
}

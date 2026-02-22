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
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
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
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_GRID_COLOR,
  CHART_AXIS_COLOR,
} from '../theme';

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
  disclaimer: string;
}

const HORIZONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
];

const panelSx = {
  p: 3,
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.1)',
};

const ENSEMBLE_COLOR = '#c9a84c';

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StockPredictionPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const [horizon, setHorizon] = useState(7);

  const { data, loading, error } = useApi<PredictionData>(
    ticker ? `/predict/${ticker}` : null,
    { horizon },
  );

  if (loading && !data) {
    return (
      <Box textAlign="center" mt={8}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Training prediction models... This may take a few seconds.
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) return null;

  // Build chart data: historical + predictions
  const chartData: any[] = data.historical.map((h) => ({
    date: h.date,
    historical: h.close,
  }));

  // Add predictions starting from after the last historical date
  const lrForecast = data.predictions.linearRegression.forecast;
  const maForecast = data.predictions.movingAverage.forecast;
  const lstmForecast = data.predictions.lstm.forecast;
  const ensForecast = data.predictions.ensemble?.forecast ?? [];

  // Connect predictions to last historical point
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

  // Model summary cards
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

            {/* Ensemble confidence band (gold) */}
            {ens && (
              <Area type="monotone" dataKey="ensUpper" stroke="none" fill="rgba(201,168,76,0.12)" name="Ensemble Band" />
            )}
            {ens && (
              <Area type="monotone" dataKey="ensLower" stroke="none" fill="rgba(201,168,76,0.12)" legendType="none" />
            )}

            {/* LSTM confidence band */}
            <Area type="monotone" dataKey="lstmUpper" stroke="none" fill="rgba(0,200,83,0.1)" name="LSTM Band" />
            <Area type="monotone" dataKey="lstmLower" stroke="none" fill="rgba(0,200,83,0.1)" legendType="none" />

            {/* Historical */}
            <Line type="monotone" dataKey="historical" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Historical" />

            {/* Predictions (dashed) */}
            <Line type="monotone" dataKey="lr" stroke={CHART_COLORS[1]} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Holt-Winters" />
            <Line type="monotone" dataKey="ma" stroke={CHART_COLORS[4]} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="GRU" />
            <Line type="monotone" dataKey="lstm" stroke={CHART_COLORS[2]} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Bi-LSTM" />

            {/* Ensemble (gold, thick, prominent dash) */}
            {ens && (
              <Line type="monotone" dataKey="ensemble" stroke={ENSEMBLE_COLOR} strokeWidth={3} strokeDasharray="8 4" dot={false} name="Ensemble" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Paper>

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

      {/* Gemini AI */}
      <GeminiInsightPanel
        ticker={data.ticker}
        context="prediction"
        data={`Holt-Winters: $${fmt(lrEnd)}, GRU: $${fmt(maEnd)}, Bi-LSTM: $${fmt(lstmEnd)}, Ensemble: $${fmt(ensEnd)}${ens ? ` (confidence: ${(ens.confidence * 100).toFixed(0)}%, dir accuracy: ${(ens.backtestMetrics.directionalAccuracy * 100).toFixed(0)}%)` : ''}`}
      />
    </>
  );
}

import { useState } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import useApi from '../hooks/useApi';
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_GRID_COLOR,
  CHART_AXIS_COLOR,
  getChartLineColor,
} from '../theme';

interface SP500ChartData {
  points: { date: string; value: number }[];
  period: string;
}

const PERIODS = ['1W', '1M', '3M', '6M', '1Y', '5Y'];

export default function SP500IndexChart() {
  const [period, setPeriod] = useState('1M');

  const { data, loading } = useApi<SP500ChartData>(
    '/market/sp500-chart',
    { period },
    5_000,
  );

  const points = data?.points ?? [];
  const latest = points.length > 0 ? points[points.length - 1].value : 0;
  const first = points.length > 0 ? points[0].value : 0;
  const change = latest - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            S&P 500
          </Typography>
          {points.length > 0 && (
            <Box display="flex" alignItems="baseline" gap={1}>
              <Typography variant="h5" fontWeight={700}>
                {latest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography
                variant="body2"
                color={isPositive ? 'success.main' : 'error.main'}
              >
                {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
              </Typography>
            </Box>
          )}
        </Box>
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
      </Box>

      {loading && points.length === 0 ? (
        <Box textAlign="center" py={4}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={points}>
            <defs>
              <linearGradient id="sp500Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={getChartLineColor(first, latest)} stopOpacity={0.3} />
                <stop offset="95%" stopColor={getChartLineColor(first, latest)} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(5)}
              interval="preserveStartEnd"
              minTickGap={60}
              tick={{ fill: CHART_AXIS_COLOR }}
              fontSize={11}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: CHART_AXIS_COLOR }}
              fontSize={11}
              tickFormatter={(v: number) => v.toLocaleString()}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => [
                Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                'S&P 500',
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={getChartLineColor(first, latest)}
              strokeWidth={2}
              fill="url(#sp500Gradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
}

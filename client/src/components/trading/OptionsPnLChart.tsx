import {
  Box,
  Typography,
  Paper,
  Skeleton,
} from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import useApi from '../../hooks/useApi';
import { CHART_TOOLTIP_STYLE, CHART_GRID_COLOR, CHART_AXIS_COLOR } from '../../theme';

interface PnLChartData {
  contractId: number;
  ticker: string;
  type: 'CALL' | 'PUT';
  side: 'BUY' | 'SELL';
  strike: number;
  premium: number;
  breakeven: number;
  data: { price: number; pnl: number }[];
}

interface OptionsPnLChartProps {
  contractId: number;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OptionsPnLChart({ contractId }: OptionsPnLChartProps) {
  const { data: chart, loading } = useApi<PnLChartData>(
    `/options/pnl-chart/${contractId}`,
  );

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={300} />
      </Paper>
    );
  }

  if (!chart || !chart.data.length) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No P&amp;L data available.
        </Typography>
      </Paper>
    );
  }

  const maxPnL = Math.max(...chart.data.map((d) => d.pnl));
  const minPnL = Math.min(...chart.data.map((d) => d.pnl));

  // Split data into positive and negative for dual-area rendering
  const positiveData = chart.data.map((d) => ({
    price: d.price,
    pnl: d.pnl >= 0 ? d.pnl : 0,
  }));
  const negativeData = chart.data.map((d) => ({
    price: d.price,
    pnl: d.pnl < 0 ? d.pnl : 0,
  }));

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        P&amp;L at Expiration — {chart.ticker} {chart.type} ${fmt(chart.strike)}
      </Typography>

      <Box role="img" aria-label={`P&L chart for ${chart.ticker} ${chart.type}`}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chart.data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00C805" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00C805" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="pnlRed" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#ff5252" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ff5252" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />

            <XAxis
              dataKey="price"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }}
              tickFormatter={(v: number) => `$${v}`}
            />
            <YAxis
              domain={[minPnL * 1.1, maxPnL * 1.1]}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }}
              tickFormatter={(v: number) => `$${v}`}
            />

            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [`$${fmt(value ?? 0)}`, 'P&L']}
              labelFormatter={(label: any) => `Stock Price: $${fmt(Number(label) || 0)}`}
            />

            {/* Breakeven line */}
            <ReferenceLine
              x={chart.breakeven}
              stroke="#ffab00"
              strokeDasharray="5 5"
              label={{
                value: `BE: $${fmt(chart.breakeven)}`,
                fill: '#ffab00',
                fontSize: 11,
                position: 'top',
              }}
            />

            {/* Zero line */}
            <ReferenceLine y={0} stroke="#7a8ba5" strokeWidth={1} />

            {/* Strike reference */}
            <ReferenceLine
              x={chart.strike}
              stroke="#7a8ba5"
              strokeDasharray="3 3"
              label={{
                value: `Strike: $${fmt(chart.strike)}`,
                fill: '#7a8ba5',
                fontSize: 11,
                position: 'insideTopLeft',
              }}
            />

            {/* Profit area (green) */}
            <Area
              data={positiveData}
              type="monotone"
              dataKey="pnl"
              stroke="#00C805"
              fill="url(#pnlGreen)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            {/* Loss area (red) */}
            <Area
              data={negativeData}
              type="monotone"
              dataKey="pnl"
              stroke="#ff5252"
              fill="url(#pnlRed)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      {/* Legend */}
      <Box display="flex" gap={3} mt={1} justifyContent="center">
        <Typography variant="caption" color="text.secondary">
          Max Profit: <span style={{ color: '#00C805', fontWeight: 600 }}>${fmt(maxPnL)}</span>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Max Loss: <span style={{ color: '#ff5252', fontWeight: 600 }}>${fmt(minPnL)}</span>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Breakeven: <span style={{ color: '#ffab00', fontWeight: 600 }}>${fmt(chart.breakeven)}</span>
        </Typography>
      </Box>
    </Paper>
  );
}

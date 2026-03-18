import { Box, Typography } from '@mui/material';
import PageLoader from '../ui/PageLoader';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import useApi from '../../hooks/useApi';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, CHART_GRID_COLOR, CHART_AXIS_COLOR, getChartLineColor } from '../../theme';

interface HistoryPoint {
  date: string;
  totalValue: number;
}

interface BenchmarkPoint {
  date: string;
  value: number;
}

interface HistoryResponse {
  portfolioId: number;
  startingCash: number;
  history: HistoryPoint[];
  benchmark: BenchmarkPoint[];
}

export default function PortfolioChart({ portfolioId }: { portfolioId: number }) {
  const { data, loading } = useApi<HistoryResponse>(
    `/portfolios/${portfolioId}/history`,
  );

  if (loading) return <PageLoader variant="chart" />;

  if (!data || data.history.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" py={2}>
        Execute some trades to see your portfolio performance chart.
      </Typography>
    );
  }

  const startingCash = data.startingCash;

  const benchmarkMap = new Map(data.benchmark.map((b) => [b.date, b.value]));
  const chartData = data.history.map((h) => ({
    date: h.date,
    totalValue: h.totalValue,
    benchmark: benchmarkMap.get(h.date) ?? null,
  }));

  const hasBenchmark = data.benchmark.length > 0;

  return (
    <Box sx={{ width: '100%', height: 300, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Portfolio Value Over Time
      </Typography>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis dataKey="date" fontSize={12} tick={{ fill: CHART_AXIS_COLOR }} />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            fontSize={12}
            tick={{ fill: CHART_AXIS_COLOR }}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value, name) => [
              `$${Number(value).toLocaleString()}`,
              name === 'benchmark' ? 'S&P 500' : 'Portfolio',
            ]}
          />
          {hasBenchmark && <Legend />}
          <ReferenceLine
            y={startingCash}
            stroke="rgba(0,200,5,0.4)"
            strokeDasharray="3 3"
            label={{ value: 'Start', position: 'right', fontSize: 11, fill: CHART_AXIS_COLOR }}
          />
          <Line
            type="monotone"
            dataKey="totalValue"
            name="Portfolio"
            stroke={chartData.length >= 2 ? getChartLineColor(chartData[0].totalValue, chartData[chartData.length - 1].totalValue) : CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          {hasBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name="S&P 500"
              stroke={CHART_COLORS[1]}
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

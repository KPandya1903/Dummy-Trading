import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
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
import apiClient from '../apiClient';
import PageLoader from './ui/PageLoader';
import ChartEmptyState from './ui/ChartEmptyState';
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_GRID_COLOR,
  CHART_AXIS_COLOR,
  getChartLineColor,
} from '../theme';

interface HistoryResponse {
  portfolioId: number;
  startingCash: number;
  history: { date: string; totalValue: number }[];
  benchmark: { date: string; value: number }[];
}

interface ChartPoint {
  date: string;
  totalValue: number;
  benchmark: number | null;
}

const PERIOD_DAYS: Record<string, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
};

interface Props {
  portfolioIds: number[];
  totalStartingCash: number;
}

export default function DashboardPerformanceChart({
  portfolioIds,
  totalStartingCash,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [hasBenchmark, setHasBenchmark] = useState(false);
  const [period, setPeriod] = useState('1M');
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [mode, setMode] = useState<'$' | '%'>('$');

  useEffect(() => {
    if (portfolioIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      try {
        const responses = await Promise.all(
          portfolioIds.map((id) =>
            apiClient
              .get<HistoryResponse>(`/portfolios/${id}/history`)
              .then((r) => r.data),
          ),
        );

        if (cancelled) return;

        // Merge history by date
        const dateMap = new Map<string, number>();
        let benchmarkRaw: { date: string; value: number }[] = [];
        let benchmarkStartCash = 0;

        for (const resp of responses) {
          for (const point of resp.history) {
            dateMap.set(
              point.date,
              (dateMap.get(point.date) || 0) + point.totalValue,
            );
          }
          // Use first portfolio with benchmark data
          if (resp.benchmark.length > 0 && benchmarkRaw.length === 0) {
            benchmarkRaw = resp.benchmark;
            benchmarkStartCash = resp.startingCash;
          }
        }

        // Cash from portfolios with no history (no trades yet)
        const emptyPortfolioCash = responses
          .filter((r) => r.history.length === 0)
          .reduce((sum, r) => sum + r.startingCash, 0);

        // Re-normalize benchmark to total starting cash
        const benchmarkMap = new Map<string, number>();
        if (benchmarkRaw.length > 0 && benchmarkStartCash > 0) {
          const scale = totalStartingCash / benchmarkStartCash;
          for (const b of benchmarkRaw) {
            benchmarkMap.set(b.date, b.value * scale);
          }
        }

        const merged: ChartPoint[] = [...dateMap.entries()]
          .map(([date, value]) => ({
            date,
            totalValue: value + emptyPortfolioCash,
            benchmark: benchmarkMap.get(date) ?? null,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setChartData(merged);
        setHasBenchmark(benchmarkMap.size > 0);
      } catch {
        // Silently fail — chart will show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [portfolioIds.join(','), totalStartingCash]);

  if (loading) return <PageLoader variant="chart" />;

  if (chartData.length === 0) {
    return <ChartEmptyState message="Your performance chart will update daily starting tomorrow" height={260} />;
  }

  // Filter by period
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (PERIOD_DAYS[period] || 30));
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const filtered = chartData.filter((d) => d.date >= cutoffStr);
  const displayData = filtered.length > 0 ? filtered : chartData;

  // Convert to % mode if needed
  const finalData =
    mode === '%'
      ? displayData.map((d) => ({
          date: d.date,
          totalValue:
            totalStartingCash > 0
              ? Math.round(
                  ((d.totalValue - totalStartingCash) / totalStartingCash) *
                    10000,
                ) / 100
              : 0,
          benchmark:
            d.benchmark != null && totalStartingCash > 0
              ? Math.round(
                  ((d.benchmark - totalStartingCash) / totalStartingCash) *
                    10000,
                ) / 100
              : null,
        }))
      : displayData;

  return (
    <Box>
      {/* Period tabs */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1}
      >
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_e, v) => {
            if (v) setPeriod(v);
          }}
          size="small"
        >
          {Object.keys(PERIOD_DAYS).map((p) => (
            <ToggleButton key={p} value={p}>
              {p}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_e, v) => {
            if (v) setMode(v);
          }}
          size="small"
        >
          <ToggleButton value="$">$</ToggleButton>
          <ToggleButton value="%">%</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Chart */}
      <Box role="img" aria-label={`Portfolio performance chart — ${period} period, ${mode === '%' ? 'percentage' : 'dollar'} mode`}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={finalData}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis
            dataKey="date"
            fontSize={11}
            tick={{ fill: CHART_AXIS_COLOR }}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(v: number) =>
              mode === '%' ? `${v.toFixed(1)}%` : `$${(v / 1000).toFixed(0)}k`
            }
            fontSize={11}
            tick={{ fill: CHART_AXIS_COLOR }}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value, name) => [
              mode === '%'
                ? `${Number(value).toFixed(2)}%`
                : `$${Number(value).toLocaleString()}`,
              name === 'benchmark' ? 'S&P 500' : 'Portfolio',
            ]}
          />
          {showBenchmark && hasBenchmark && <Legend />}
          {mode === '$' && (
            <ReferenceLine
              y={totalStartingCash}
              stroke="rgba(0,200,5,0.4)"
              strokeDasharray="3 3"
              label={{
                value: 'Start',
                position: 'right',
                fontSize: 11,
                fill: CHART_AXIS_COLOR,
              }}
            />
          )}
          {mode === '%' && (
            <ReferenceLine
              y={0}
              stroke="rgba(0,200,5,0.4)"
              strokeDasharray="3 3"
            />
          )}
          <Line
            type="monotone"
            dataKey="totalValue"
            name="Portfolio"
            stroke={finalData.length >= 2 ? getChartLineColor(finalData[0].totalValue, finalData[finalData.length - 1].totalValue) : CHART_COLORS[0]}
            strokeWidth={2}
            dot={displayData.length < 30 ? { r: 2 } : false}
            activeDot={{ r: 4 }}
          />
          {showBenchmark && hasBenchmark && (
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

      {/* Benchmark checkbox */}
      {hasBenchmark && (
        <FormControlLabel
          control={
            <Checkbox
              checked={showBenchmark}
              onChange={(e) => setShowBenchmark(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="caption" color="text.secondary">
              S&P 500
            </Typography>
          }
          sx={{ ml: 0, mt: 0.5 }}
        />
      )}
    </Box>
  );
}

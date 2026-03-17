import { useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, Skeleton } from '@mui/material';
import {
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Customized, Line, usePlotArea,
} from 'recharts';
import useApi from '../hooks/useApi';

interface OHLCPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number;
}
interface SP500ChartData { points: OHLCPoint[]; period: string; }

const PERIODS = ['1W', '1M', '3M', '6M', '1Y', '5Y'] as const;

// Recharts 3 changed the API: Customized no longer injects xAxisMap/yAxisMap.
// Instead, use usePlotArea() hook and compute the scale manually.
function CandlesLayer({ data }: { data?: OHLCPoint[] }) {
  const plotArea = usePlotArea();

  if (!data?.length || !plotArea) return null;

  const { x: plotX, y: plotY, width: plotW, height: plotH } = plotArea;

  // X: categorical band scale — distribute n candles evenly across plot width
  const n = data.length;
  const slotW = plotW / n;
  const candleW = slotW * 0.7;
  const halfW = candleW / 2;

  // Y: linear scale mirroring the explicit YAxis domain prop
  const allValues = data.flatMap(p => [p.high, p.low]);
  const dataYMin = Math.min(...allValues) * 0.999;
  const dataYMax = Math.max(...allValues) * 1.001;
  const yRange = dataYMax - dataYMin;

  const yOf = (v: number) => plotY + plotH * (1 - (v - dataYMin) / yRange);

  return (
    <g>
      {data.map((d, i) => {
        const bullish = d.close >= d.open;
        const color   = bullish ? '#00C805' : '#ff4d4d';
        const cx      = plotX + (i + 0.5) * slotW;
        const yHigh   = yOf(d.high);
        const yLow    = yOf(d.low);
        const yTop    = yOf(Math.max(d.open, d.close));
        const yBot    = yOf(Math.min(d.open, d.close));
        const bodyH   = Math.max(yBot - yTop, 1);

        return (
          <g key={i}>
            {/* Wick */}
            <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
            {/* Body */}
            <rect
              x={cx - halfW}
              y={yTop}
              width={candleW}
              height={bodyH}
              fill={color}
              fillOpacity={0.85}
              stroke={color}
              strokeWidth={0.5}
            />
          </g>
        );
      })}
    </g>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as OHLCPoint;
  if (!d) return null;
  const bullish = d.close >= d.open;
  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Box sx={{ bgcolor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 1, p: 1.5, minWidth: 130 }}>
      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{d.date}</Typography>
      {[['O', d.open], ['H', d.high], ['L', d.low], ['C', d.close]].map(([label, val]) => (
        <Box key={label as string} display="flex" justifyContent="space-between" gap={2}>
          <Typography variant="caption" color="text.disabled">{label}</Typography>
          <Typography variant="caption" color={bullish ? '#00C805' : '#ff4d4d'} fontWeight={600}>
            {fmt(val as number)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function SP500CandlestickChart() {
  const [period, setPeriod] = useState('1M');
  const { data, loading } = useApi<SP500ChartData>('/market/sp500-chart', { period }, 5_000);

  const points  = data?.points ?? [];
  const last    = points[points.length - 1];
  const first   = points[0];
  const change    = last && first ? last.close - first.open : 0;
  const changePct = last && first && first.open ? (change / first.open) * 100 : 0;
  const bullish   = change >= 0;

  const tickInterval = Math.max(1, Math.floor(points.length / 8));
  const allValues = points.flatMap(p => [p.high, p.low]);
  const yMin = allValues.length ? Math.min(...allValues) * 0.999 : 'auto';
  const yMax = allValues.length ? Math.max(...allValues) * 1.001 : 'auto';

  return (
    <Box>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600} letterSpacing={1}>
            S&P 500
          </Typography>
          {last ? (
            <Box display="flex" alignItems="baseline" gap={1.5}>
              <Typography variant="h4" fontWeight={700} sx={{ fontFamily: '"Playfair Display", serif' }}>
                {last.close.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="body2" color={bullish ? 'success.main' : 'error.main'} fontWeight={600}>
                {bullish ? '+' : ''}{change.toFixed(2)} ({bullish ? '+' : ''}{changePct.toFixed(2)}%)
              </Typography>
            </Box>
          ) : (
            <Skeleton width={200} height={40} />
          )}
        </Box>
        <ToggleButtonGroup value={period} exclusive onChange={(_e, v) => { if (v) setPeriod(v); }} size="small">
          {PERIODS.map((p) => (
            <ToggleButton key={p} value={p} sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>{p}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {loading && !data ? (
        <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1 }} />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#555', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: '#555', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={62}
              tickFormatter={(v) => v.toLocaleString()}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333', strokeWidth: 1 }} />
            {/* Hidden line ensures Recharts computes axis layout before CandlesLayer renders */}
            <Line dataKey="close" stroke="transparent" dot={false} isAnimationActive={false} legendType="none" />
            {/* CandlesLayer uses usePlotArea() hook; data is passed via Customized props */}
            <Customized component={CandlesLayer} data={points} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
}

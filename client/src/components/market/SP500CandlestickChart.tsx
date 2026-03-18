import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, Skeleton } from '@mui/material';
import useApi from '../../hooks/useApi';

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

const MARGIN = { top: 10, right: 10, bottom: 24, left: 68 };

interface TooltipState {
  x: number;
  y: number;
  point: OHLCPoint;
}

function PureCandleChart({ points }: { points: OHLCPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const height = 280;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  const { yMin, yMax, yTicks, xTicks } = useMemo(() => {
    if (!points.length) return { yMin: 0, yMax: 1, yTicks: [], xTicks: [] };
    const allHigh = points.map(p => p.high);
    const allLow  = points.map(p => p.low);
    const rawMin  = Math.min(...allLow);
    const rawMax  = Math.max(...allHigh);
    const pad     = (rawMax - rawMin) * 0.05;
    const yMin    = rawMin - pad;
    const yMax    = rawMax + pad;

    // ~5 y-ticks
    const step = (yMax - yMin) / 5;
    const yTicks: number[] = [];
    for (let i = 0; i <= 5; i++) yTicks.push(yMin + step * i);

    // ~8 x-ticks
    const interval = Math.max(1, Math.floor(points.length / 8));
    const xTicks = points.filter((_, i) => i % interval === 0);

    return { yMin, yMax, yTicks, xTicks };
  }, [points]);

  const slotW = points.length > 0 ? plotW / points.length : 0;
  const candleW = Math.max(1, slotW * 0.7);

  const xOf = (i: number) => MARGIN.left + (i + 0.5) * slotW;
  const yOf = useCallback(
    (v: number) => MARGIN.top + plotH * (1 - (v - yMin) / (yMax - yMin)),
    [plotH, yMin, yMax],
  );

  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx   = e.clientX - rect.left - MARGIN.left;
    const idx  = Math.round(mx / slotW - 0.5);
    if (idx < 0 || idx >= points.length) { setTooltip(null); return; }
    setTooltip({ x: xOf(idx), y: e.clientY - rect.top, point: points[idx] });
  }, [points, slotW, xOf]);

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{ display: 'block' }}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={MARGIN.left} y1={yOf(v)}
            x2={MARGIN.left + plotW} y2={yOf(v)}
            stroke="#1e1e1e" strokeDasharray="3 3"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={MARGIN.left - 6} y={yOf(v)}
            textAnchor="end" dominantBaseline="middle"
            fill="#555" fontSize={11}
          >
            {v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((p, i) => {
          const idx = points.indexOf(p);
          return (
            <text
              key={i}
              x={xOf(idx)}
              y={MARGIN.top + plotH + 16}
              textAnchor="middle"
              fill="#555" fontSize={11}
            >
              {p.date.slice(5)}
            </text>
          );
        })}

        {/* Candles */}
        {points.map((d, i) => {
          const bullish = d.close >= d.open;
          const color   = bullish ? '#00C805' : '#ff4d4d';
          const cx      = xOf(i);
          const yHigh   = yOf(d.high);
          const yLow    = yOf(d.low);
          const yTop    = yOf(Math.max(d.open, d.close));
          const yBot    = yOf(Math.min(d.open, d.close));
          const bodyH   = Math.max(yBot - yTop, 1);

          return (
            <g key={i}>
              <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
              <rect
                x={cx - candleW / 2}
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

        {/* Tooltip crosshair line */}
        {tooltip && (
          <line
            x1={tooltip.x} y1={MARGIN.top}
            x2={tooltip.x} y2={MARGIN.top + plotH}
            stroke="#333" strokeWidth={1}
          />
        )}
      </svg>

      {/* Tooltip box */}
      {tooltip && (() => {
        const d = tooltip.point;
        const bullish = d.close >= d.open;
        const color = bullish ? '#00C805' : '#ff4d4d';
        // Position tooltip to the left if near right edge
        const tipLeft = tooltip.x + 12 + 140 > width ? tooltip.x - 152 : tooltip.x + 12;
        return (
          <Box sx={{
            position: 'absolute',
            top: Math.max(0, tooltip.y - 60),
            left: tipLeft,
            bgcolor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 1,
            p: 1.5,
            minWidth: 130,
            pointerEvents: 'none',
          }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{d.date}</Typography>
            {([['O', d.open], ['H', d.high], ['L', d.low], ['C', d.close]] as [string, number][]).map(([label, val]) => (
              <Box key={label} display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.disabled">{label}</Typography>
                <Typography variant="caption" color={color} fontWeight={600}>{fmt(val)}</Typography>
              </Box>
            ))}
          </Box>
        );
      })()}
    </Box>
  );
}

export default function SP500CandlestickChart() {
  const [period, setPeriod] = useState('1M');
  const { data, loading } = useApi<SP500ChartData>('/market/sp500-chart', { period }, 60_000);

  const points  = data?.points ?? [];
  const last    = points[points.length - 1];
  const first   = points[0];
  const change    = last && first ? last.close - first.open : 0;
  const changePct = last && first && first.open ? (change / first.open) * 100 : 0;
  const bullish   = change >= 0;

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
        <PureCandleChart points={points} />
      )}
    </Box>
  );
}

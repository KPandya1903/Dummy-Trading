import { Typography, Paper } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '../../theme';

interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
  sector?: string;
}

interface SectorChartProps {
  positions: Position[];
  currentPrices: Record<string, number>;
}

export default function SectorChart({ positions, currentPrices }: SectorChartProps) {
  if (positions.length === 0) return null;

  // Aggregate market value by sector
  const sectorMap: Record<string, number> = {};
  for (const p of positions) {
    const sector = p.sector || 'Other';
    const mktPrice = currentPrices[p.ticker] ?? p.avgCost;
    const value = p.shares * mktPrice;
    sectorMap[sector] = (sectorMap[sector] || 0) + value;
  }

  const data = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Sector Breakdown
      </Typography>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={50}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {data.map((_entry, idx) => (
              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [
              `$${Number(value).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} (${((Number(value) / total) * 100).toFixed(1)}%)`,
              'Value',
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Paper>
  );
}

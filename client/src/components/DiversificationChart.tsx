import { Box, Typography } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '../theme';

interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
}

interface Props {
  positions: Position[];
  currentPrices: Record<string, number>;
  cashRemaining: number;
}

export default function DiversificationChart({ positions, currentPrices, cashRemaining }: Props) {
  if (positions.length === 0) return null;

  const slices = positions.map((p) => {
    const mktPrice = currentPrices[p.ticker] ?? p.avgCost;
    return { name: p.ticker, value: Math.round(p.shares * mktPrice * 100) / 100 };
  });

  if (cashRemaining > 0) {
    slices.push({ name: 'Cash', value: Math.round(cashRemaining * 100) / 100 });
  }

  const total = slices.reduce((s, e) => s + e.value, 0);

  return (
    <Box sx={{ width: '100%', height: 320, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Portfolio Diversification
      </Typography>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(1)}%`
            }
          >
            {slices.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [
              `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((Number(value) / total) * 100).toFixed(1)}%)`,
              '',
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}

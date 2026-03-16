import {
  Box,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import useApi from '../hooks/useApi';

interface RiskMetrics {
  sharpeRatio:    number | null;
  maxDrawdownPct: number | null;
  beta:           number | null;
  winRatePct:     number | null;
  tradeCount:     number;
  dataPointCount: number;
  note:           string;
}

const panelSx = {
  p: 2.5,
  flex: '1 1 140px',
  minWidth: 140,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.12)',
};

function valueColor(
  color: 'success' | 'warning' | 'error' | 'neutral',
): string {
  if (color === 'success') return '#00C805';
  if (color === 'warning') return '#ffab00';
  if (color === 'error')   return '#ff5252';
  return '#e8eaf0';
}

interface MetricCardProps {
  label:    string;
  value:    string;
  sublabel: string;
  color:    'success' | 'warning' | 'error' | 'neutral';
  tooltip:  string;
}

function MetricCard({ label, value, sublabel, color, tooltip }: MetricCardProps) {
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <Paper variant="outlined" sx={panelSx}>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8ba5', display: 'block', mb: 0.75 }}
        >
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ color: valueColor(color) }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          {sublabel}
        </Typography>
      </Paper>
    </Tooltip>
  );
}

function fmt(n: number | null, digits = 2, suffix = ''): string {
  if (n === null) return '—';
  return `${n.toFixed(digits)}${suffix}`;
}

export default function PortfolioRiskMetrics({ portfolioId }: { portfolioId: number }): JSX.Element | null {
  const { data, loading, error } = useApi<RiskMetrics>(`/portfolios/${portfolioId}/risk`);

  if (error) return null;

  if (loading || !data) {
    return (
      <Box mb={4}>
        <Skeleton variant="text" width={140} height={24} sx={{ mb: 1.5 }} />
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {[0, 1, 2, 3].map((i) => (
            <Paper key={i} variant="outlined" sx={{ ...panelSx, minHeight: 100 }}>
              <Skeleton variant="text" width={80} height={12} sx={{ mb: 1 }} />
              <Skeleton variant="text" width={60} height={28} />
              <Skeleton variant="text" width={100} height={12} sx={{ mt: 0.5 }} />
            </Paper>
          ))}
        </Stack>
      </Box>
    );
  }

  // Sharpe color
  const sharpe = data.sharpeRatio;
  const sharpeColor: MetricCardProps['color'] =
    sharpe === null ? 'neutral' : sharpe >= 1 ? 'success' : sharpe >= 0 ? 'warning' : 'error';

  // Drawdown color
  const dd = data.maxDrawdownPct;
  const ddColor: MetricCardProps['color'] =
    dd === null ? 'neutral' : dd < 10 ? 'success' : dd < 25 ? 'warning' : 'error';

  // Beta color
  const beta = data.beta;
  const betaColor: MetricCardProps['color'] =
    beta === null ? 'neutral' : Math.abs(beta - 1) < 0.2 ? 'neutral' : beta > 1 ? 'warning' : 'success';

  // Win rate color
  const wr = data.winRatePct;
  const wrColor: MetricCardProps['color'] =
    wr === null ? 'neutral' : wr >= 60 ? 'success' : wr >= 40 ? 'warning' : 'error';

  return (
    <Box mb={4}>
      <Typography variant="h6" gutterBottom fontWeight={700}>
        Risk Metrics
      </Typography>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <MetricCard
          label="Sharpe Ratio"
          value={fmt(sharpe)}
          sublabel="Annualized (risk-free = 0)"
          color={sharpeColor}
          tooltip="Return per unit of risk. Sharpe > 1 is good, > 2 is excellent. Negative means underperformed risk-free."
        />
        <MetricCard
          label="Max Drawdown"
          value={dd !== null ? `-${dd.toFixed(1)}%` : '—'}
          sublabel="Peak-to-trough loss"
          color={ddColor}
          tooltip="Largest peak-to-trough decline in portfolio value. Lower is better."
        />
        <MetricCard
          label="Beta vs S&P 500"
          value={fmt(beta)}
          sublabel="Market sensitivity"
          color={betaColor}
          tooltip="1.0 = moves exactly with S&P 500. >1 = more volatile than market, <1 = more defensive."
        />
        <MetricCard
          label="Win Rate"
          value={wr !== null ? `${wr.toFixed(0)}%` : '—'}
          sublabel={data.tradeCount > 0 ? `${data.tradeCount} closed trade${data.tradeCount !== 1 ? 's' : ''}` : 'No sells yet'}
          color={wrColor}
          tooltip="Percentage of sell trades closed at a profit vs. average cost basis."
        />
      </Stack>

      {data.note && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {data.note}
        </Typography>
      )}
    </Box>
  );
}

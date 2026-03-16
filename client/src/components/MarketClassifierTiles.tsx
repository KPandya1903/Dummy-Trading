import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Link,
} from '@mui/material';
import PageLoader from './ui/PageLoader';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CategoryIcon from '@mui/icons-material/Category';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import PaymentsIcon from '@mui/icons-material/Payments';
import SavingsIcon from '@mui/icons-material/Savings';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import useApi from '../hooks/useApi';

interface ClassifierStock {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  metric: number | null;
  metricLabel: string;
}

interface Classifier {
  id: string;
  label: string;
  icon: string;
  stocks: ClassifierStock[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  trending_up: <TrendingUpIcon fontSize="small" />,
  trending_down: <TrendingDownIcon fontSize="small" />,
  bar_chart: <BarChartIcon fontSize="small" />,
  account_balance: <AccountBalanceIcon fontSize="small" />,
  flash_on: <FlashOnIcon fontSize="small" />,
  category: <CategoryIcon fontSize="small" />,
  arrow_upward: <ArrowUpwardIcon fontSize="small" />,
  payments: <PaymentsIcon fontSize="small" />,
  savings: <SavingsIcon fontSize="small" />,
  rocket_launch: <RocketLaunchIcon fontSize="small" />,
};

function formatMetric(value: number | null, label: string): string {
  if (value == null) return '—';
  if (label.includes('Volume')) {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return String(value);
  }
  if (label.includes('Mkt Cap')) return `$${value.toFixed(1)}B`;
  if (label.includes('%') || label.includes('Change') || label.includes('Yield') || label.includes('52W')) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
  return value.toFixed(2);
}

export default function MarketClassifierTiles() {
  const { data, loading } = useApi<{ classifiers: Classifier[] }>(
    '/market/classifiers',
    undefined,
    5_000,
  );

  if (loading && !data) return <PageLoader variant="cards" />;

  const classifiers = data?.classifiers ?? [];

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
        pb: 1,
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,200,5,0.3)',
          borderRadius: 3,
        },
      }}
    >
      {classifiers.map((c) => (
        <Paper
          key={c.id}
          variant="outlined"
          sx={{
            minWidth: 220,
            maxWidth: 260,
            flexShrink: 0,
            p: 2,
            background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
            border: '1px solid rgba(0,200,5,0.1)',
            '&:hover': {
              border: '1px solid rgba(0,200,5,0.3)',
            },
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1.5}>
            <Box sx={{ color: 'primary.main' }}>{ICON_MAP[c.icon] || null}</Box>
            <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {c.label}
            </Typography>
          </Box>

          {c.stocks.map((s) => (
            <Box
              key={s.ticker}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              py={0.4}
            >
              <Link
                component={RouterLink}
                to={`/stocks/${s.ticker}`}
                underline="hover"
                color="text.primary"
                fontWeight={600}
                fontSize={13}
              >
                {s.ticker}
              </Link>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Chip
                  label={formatMetric(s.metric, s.metricLabel)}
                  size="small"
                  variant="outlined"
                  color={
                    s.metricLabel.includes('Change') || s.metricLabel.includes('Yield')
                      ? s.changePct >= 0 ? 'success' : 'error'
                      : 'default'
                  }
                  sx={{ fontSize: 11, height: 22 }}
                />
              </Box>
            </Box>
          ))}
        </Paper>
      ))}
    </Box>
  );
}

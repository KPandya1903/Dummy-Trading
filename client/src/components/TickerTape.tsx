import { Box, Typography } from '@mui/material';
import useApi from '../hooks/useApi';

interface MarketEntry {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
}

export default function TickerTape() {
  const { data: entries } = useApi<MarketEntry[]>(
    '/market/top',
    { by: 'changePct', limit: 15 },
    5_000,
  );

  if (!entries || entries.length === 0) return null;

  // Duplicate entries for seamless loop
  const items = [...entries, ...entries];
  const duration = entries.length * 1.5;

  return (
    <Box
      sx={{
        overflow: 'hidden',
        bgcolor: '#060e1a',
        color: 'text.primary',
        py: 0.5,
        position: 'relative',
        borderBottom: '1px solid rgba(201,168,76,0.08)',
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 40,
          zIndex: 1,
        },
        '&::before': { left: 0, background: 'linear-gradient(to right, #060e1a, transparent)' },
        '&::after': { right: 0, background: 'linear-gradient(to left, #060e1a, transparent)' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 4,
          whiteSpace: 'nowrap',
          animation: `ticker-scroll ${duration}s linear infinite`,
          '@keyframes ticker-scroll': {
            '0%': { transform: 'translateX(0)' },
            '100%': { transform: 'translateX(-50%)' },
          },
        }}
      >
        {items.map((e, i) => (
          <Box key={`${e.ticker}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" fontWeight="bold" color="primary.main">
              {e.ticker}
            </Typography>
            <Typography variant="caption">${e.price.toFixed(2)}</Typography>
            <Typography
              variant="caption"
              sx={{ color: e.change >= 0 ? 'success.main' : 'error.main' }}
            >
              {e.change >= 0 ? '+' : ''}
              {e.changePct.toFixed(2)}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

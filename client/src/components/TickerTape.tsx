import { useState } from 'react';
import { Box, Typography, IconButton, useMediaQuery } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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
    1_000,
  );

  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [paused, setPaused] = useState(false);

  if (!entries || entries.length === 0) return null;

  const items = [...entries, ...entries];
  const duration = entries.length * 1.5;
  const animated = !prefersReducedMotion && !paused;

  return (
    <Box
      aria-label="Live market ticker"
      sx={{
        overflow: 'hidden',
        bgcolor: '#0d0d0d',
        color: 'text.primary',
        py: 0.5,
        position: 'relative',
        borderBottom: '1px solid rgba(0,200,5,0.08)',
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 40,
          zIndex: 1,
        },
        '&::before': { left: 0, background: 'linear-gradient(to right, #0d0d0d, transparent)' },
        '&::after': { right: 32, width: 32, background: 'linear-gradient(to left, #0d0d0d, transparent)' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 4,
          whiteSpace: 'nowrap',
          animation: animated ? `ticker-scroll ${duration}s linear infinite` : 'none',
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

      <IconButton
        size="small"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? 'Resume ticker' : 'Pause ticker'}
        sx={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 2,
          color: 'text.disabled',
          p: 0.5,
          '&:hover': { color: 'text.secondary' },
        }}
      >
        {paused
          ? <PlayArrowIcon sx={{ fontSize: 16 }} />
          : <PauseIcon sx={{ fontSize: 16 }} />
        }
      </IconButton>
    </Box>
  );
}

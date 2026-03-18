import { Box, Typography, Tooltip, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { HEATMAP_COLORS } from '../../theme';

interface MarketEntry {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap?: number | null;
}

function getColor(changePct: number): string {
  const g = HEATMAP_COLORS.green;
  const r = HEATMAP_COLORS.red;
  if (changePct >= 3) return g[4];
  if (changePct >= 2) return g[3];
  if (changePct >= 1) return g[2];
  if (changePct >= 0.5) return g[1];
  if (changePct >= 0) return g[0];
  if (changePct >= -0.5) return r[4];
  if (changePct >= -1) return r[3];
  if (changePct >= -2) return r[2];
  if (changePct >= -3) return r[1];
  return r[0];
}

export default function MarketHeatmap({ entries }: { entries: MarketEntry[] }) {
  const navigate = useNavigate();

  // Use real market cap for proportional sizing
  const totalWeight = entries.reduce((sum, e) => sum + (e.marketCap ?? 1), 0);

  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Box
        role="list"
        aria-label="Market heatmap"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
          minHeight: 200,
        }}
      >
        {entries.map((e) => {
          const weight = e.marketCap ?? 1;
          const pct = (weight / totalWeight) * 100;

          return (
            <Tooltip
              key={e.ticker}
              title={
                <>
                  <strong>{e.ticker}</strong> — {e.name}
                  <br />
                  ${e.price.toFixed(2)} ({e.changePct >= 0 ? '+' : ''}
                  {e.changePct.toFixed(2)}%)
                  {e.marketCap != null && (
                    <>
                      <br />
                      Mkt Cap: ${e.marketCap.toFixed(1)}B
                    </>
                  )}
                </>
              }
              arrow
            >
              <Box
                role="listitem"
                aria-label={`${e.ticker}: ${e.changePct >= 0 ? '+' : ''}${e.changePct.toFixed(2)}%`}
                tabIndex={0}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') navigate(`/stocks/${e.ticker}`); }}
                onClick={() => navigate(`/stocks/${e.ticker}`)}
                sx={{
                  bgcolor: getColor(e.changePct),
                  color: 'white',
                  flexBasis: `${Math.max(pct - 0.5, 5)}%`,
                  flexGrow: 1,
                  minWidth: 60,
                  minHeight: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1,
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  '&:hover': { opacity: 0.85 },
                }}
              >
                <Typography variant="body2" fontWeight="bold">
                  {e.ticker}
                </Typography>
                <Typography variant="caption">
                  {e.changePct >= 0 ? '+' : ''}
                  {e.changePct.toFixed(2)}%
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Paper>
  );
}

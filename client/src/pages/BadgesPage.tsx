import {
  Typography,
  Box,
  Alert,
  CircularProgress,
  Grid,
  Paper,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LockIcon from '@mui/icons-material/Lock';
import useApi from '../hooks/useApi';

interface BadgeInfo {
  badge: string;
  description: string;
  earned: boolean;
  unlockedAt: string | null;
}

const BADGE_EMOJI: Record<string, string> = {
  FIRST_TRADE: 'First Trade',
  DIVERSIFIER: 'Diversifier',
  TEN_PERCENT: '10% Return',
  BEAT_MARKET: 'Beat the Market',
  DAY_TRADER: 'Day Trader',
  DIAMOND_HANDS: 'Diamond Hands',
  FULL_PORTFOLIO: 'Fully Invested',
};

export default function BadgesPage() {
  const { data: badges, loading, error } = useApi<BadgeInfo[]>('/badges');

  if (loading) {
    return (
      <Box textAlign="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!badges) return null;

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Achievements
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {earnedCount} of {badges.length} badges earned
      </Typography>

      <Grid container spacing={2}>
        {badges.map((b) => (
          <Grid item xs={6} sm={4} md={3} key={b.badge}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                textAlign: 'center',
                opacity: b.earned ? 1 : 0.3,
                bgcolor: b.earned ? 'rgba(201,168,76,0.08)' : 'transparent',
                transition: 'opacity 0.3s',
              }}
            >
              <Box sx={{ fontSize: 40, mb: 1 }}>
                {b.earned ? (
                  <EmojiEventsIcon sx={{ fontSize: 48, color: 'warning.main' }} />
                ) : (
                  <LockIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                )}
              </Box>
              <Typography variant="subtitle2" fontWeight="bold">
                {BADGE_EMOJI[b.badge] || b.badge}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {b.description}
              </Typography>
              {b.earned && b.unlockedAt && (
                <Typography variant="caption" color="success.main" display="block" mt={0.5}>
                  Earned {new Date(b.unlockedAt).toLocaleDateString()}
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </>
  );
}

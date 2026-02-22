import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import useApi from '../hooks/useApi';

interface LeaderboardEntry {
  portfolioId: number;
  portfolioName: string;
  userEmail: string;
  totalValue: number;
  startingCash: number;
  returnPct: number;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function LeaderboardPage() {
  const { data: entries, loading, error } = useApi<LeaderboardEntry[]>(
    '/leaderboard',
  );

  if (loading) {
    return (
      <Box textAlign="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Leaderboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Portfolio</TableCell>
              <TableCell>User</TableCell>
              <TableCell align="right">Total Value</TableCell>
              <TableCell align="right">Return %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries?.map((e, i) => (
              <TableRow key={e.portfolioId}>
                <TableCell>
                  {i === 0 ? (
                    <Chip
                      icon={<EmojiEventsIcon />}
                      label="#1"
                      size="small"
                      color="warning"
                    />
                  ) : (
                    `#${i + 1}`
                  )}
                </TableCell>
                <TableCell>{e.portfolioName}</TableCell>
                <TableCell>{e.userEmail}</TableCell>
                <TableCell align="right">${fmt(e.totalValue)}</TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    component="span"
                    color={
                      e.returnPct > 0
                        ? 'success.main'
                        : e.returnPct < 0
                          ? 'error.main'
                          : 'text.primary'
                    }
                    fontWeight="bold"
                  >
                    {e.returnPct > 0 ? '+' : ''}
                    {e.returnPct}%
                  </Typography>
                </TableCell>
              </TableRow>
            ))}

            {entries?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No portfolios yet. Be the first to create one!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

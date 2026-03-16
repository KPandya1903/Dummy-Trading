import { useParams, Link as RouterLink } from 'react-router-dom';
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
  Button,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import useApi from '../hooks/useApi';
import PageLoader from '../components/ui/PageLoader';

interface GroupDetail {
  id: number;
  name: string;
  startingCash: number;
  joinCode: string;
  startDate: string | null;
  endDate: string | null;
  maxTradesPerDay: number | null;
  allowedTickers: string | null;
  createdAt: string;
  myPortfolioId: number | null;
  members: {
    userId: number;
    email: string;
    role: string;
    joinedAt: string;
  }[];
}

interface LeaderboardEntry {
  portfolioId: number;
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

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: group, loading, error } = useApi<GroupDetail>(`/groups/${id}`);
  const { data: leaderboard, loading: lbLoading } = useApi<LeaderboardEntry[]>(
    `/groups/${id}/leaderboard`,
  );

  if (loading) return <PageLoader />;

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!group) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(group.joinCode);
  };

  return (
    <>
      <Button component={RouterLink} to="/groups" sx={{ mb: 1 }}>
        &larr; All Groups
      </Button>

      <Typography variant="h4" gutterBottom>
        {group.name}
      </Typography>

      {/* ── Group info ─────────────────────────────────── */}
      <Stack
        direction="row"
        spacing={3}
        mb={4}
        flexWrap="wrap"
        useFlexGap
        sx={{
          '& > *': {
            minWidth: 140,
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          },
        }}
      >
        <Box>
          <Typography variant="overline">Starting Cash</Typography>
          <Typography variant="h6">${fmt(group.startingCash)}</Typography>
        </Box>
        <Box>
          <Typography variant="overline">Members</Typography>
          <Typography variant="h6">{group.members.length}</Typography>
        </Box>
        <Box>
          <Typography variant="overline">Join Code</Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h6" fontFamily="monospace">
              {group.joinCode}
            </Typography>
            <Tooltip title="Copy code">
              <IconButton size="small" onClick={handleCopy}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Stack>

      {/* ── Group rules ─────────────────────────────────── */}
      {(group.startDate || group.endDate || group.maxTradesPerDay || group.allowedTickers) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Competition Rules
          </Typography>
          <Stack spacing={0.5}>
            {group.startDate && (
              <Typography variant="body2">
                Start: {new Date(group.startDate).toLocaleDateString()}
              </Typography>
            )}
            {group.endDate && (
              <Typography variant="body2">
                End: {new Date(group.endDate).toLocaleDateString()}
              </Typography>
            )}
            {group.maxTradesPerDay != null && (
              <Typography variant="body2">
                Max trades/day: {group.maxTradesPerDay}
              </Typography>
            )}
            {group.allowedTickers && (
              <Typography variant="body2">
                Allowed tickers: {group.allowedTickers}
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      {/* ── My portfolio link ──────────────────────────── */}
      {group.myPortfolioId && (
        <Button
          variant="contained"
          component={RouterLink}
          to={`/portfolios/${group.myPortfolioId}`}
          sx={{ mb: 3 }}
        >
          View My Portfolio
        </Button>
      )}

      {/* ── Leaderboard ────────────────────────────────── */}
      <Typography variant="h6" gutterBottom>
        Leaderboard
      </Typography>

      {lbLoading ? (
        <Box textAlign="center" py={4}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>User</TableCell>
                <TableCell align="right">Total Value</TableCell>
                <TableCell align="right">Return %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaderboard?.map((e, i) => (
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

              {leaderboard?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No trades yet. Start trading to see rankings!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Members list ───────────────────────────────── */}
      <Typography variant="h6" gutterBottom>
        Members
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Joined</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {group.members.map((m) => (
              <TableRow key={m.userId}>
                <TableCell>{m.email}</TableCell>
                <TableCell>
                  <Chip
                    label={m.role}
                    size="small"
                    color={m.role === 'OWNER' ? 'primary' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  {new Date(m.joinedAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

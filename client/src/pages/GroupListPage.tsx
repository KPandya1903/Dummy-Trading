import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
  Button,
  TextField,
  Stack,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Box,
  Chip,
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import apiClient from '../apiClient';
import useApi from '../hooks/useApi';

interface Group {
  id: number;
  name: string;
  startingCash: number;
  joinCode: string;
  role: string;
  memberCount: number;
  createdAt: string;
}

export default function GroupListPage() {
  const { data: groups, loading, error, refetch } = useApi<Group[]>('/groups');

  // ── Create dialog ────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [startingCash, setStartingCash] = useState('100000');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [maxTradesPerDay, setMaxTradesPerDay] = useState('');
  const [allowedTickers, setAllowedTickers] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Join dialog ──────────────────────────────────────────
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await apiClient.post('/groups', {
        name: groupName,
        startingCash: Number(startingCash),
        ...(startDateStr && { startDate: startDateStr }),
        ...(endDateStr && { endDate: endDateStr }),
        ...(maxTradesPerDay && { maxTradesPerDay: Number(maxTradesPerDay) }),
        ...(allowedTickers.trim() && { allowedTickers: allowedTickers.trim() }),
      });
      setCreateOpen(false);
      setGroupName('');
      setStartingCash('100000');
      refetch();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError('');
    try {
      await apiClient.post('/groups/join', { joinCode });
      setJoinOpen(false);
      setJoinCode('');
      refetch();
    } catch (err: any) {
      setJoinError(err.response?.data?.error || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">My Groups</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setJoinOpen(true)}>
            Join Group
          </Button>
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            + New Group
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        {groups?.map((g) => (
          <Card key={g.id} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <Typography variant="h6">{g.name}</Typography>
                <Chip
                  label={g.role}
                  size="small"
                  color={g.role === 'OWNER' ? 'primary' : 'default'}
                  variant="outlined"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Starting cash: ${g.startingCash.toLocaleString()} &middot;{' '}
                {g.memberCount} member{g.memberCount !== 1 ? 's' : ''} &middot;{' '}
                Code: {g.joinCode}
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                size="small"
                component={Link}
                to={`/groups/${g.id}`}
                startIcon={<GroupIcon />}
              >
                View Group
              </Button>
            </CardActions>
          </Card>
        ))}

        {groups?.length === 0 && (
          <Typography color="text.secondary">
            No groups yet. Create one or join with a code.
          </Typography>
        )}
      </Stack>

      {/* ── Create group dialog ──────────────────────────── */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ component: 'form', onSubmit: handleCreate }}
      >
        <DialogTitle>Create Group</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField
              label="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Starting cash ($)"
              type="number"
              value={startingCash}
              onChange={(e) => setStartingCash(e.target.value)}
              fullWidth
              helperText="Fixed for all members. Cannot be changed after creation."
            />
            <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1 }}>
              Optional Rules
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start date"
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End date"
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <TextField
              label="Max trades per day"
              type="number"
              value={maxTradesPerDay}
              onChange={(e) => setMaxTradesPerDay(e.target.value)}
              fullWidth
              helperText="Leave blank for unlimited"
            />
            <TextField
              label="Allowed tickers"
              value={allowedTickers}
              onChange={(e) => setAllowedTickers(e.target.value)}
              fullWidth
              helperText="Comma-separated, e.g. AAPL,MSFT,GOOGL. Leave blank for all."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={creating}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Join group dialog ────────────────────────────── */}
      <Dialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ component: 'form', onSubmit: handleJoin }}
      >
        <DialogTitle>Join Group</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {joinError && <Alert severity="error">{joinError}</Alert>}
            <TextField
              label="Join code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
              fullWidth
              autoFocus
              placeholder="e.g. A7K2M9X4"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinOpen(false)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={joining}>
            {joining ? 'Joining...' : 'Join'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

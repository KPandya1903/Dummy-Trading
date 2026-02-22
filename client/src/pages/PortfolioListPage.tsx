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
  DialogContentText,
  DialogActions,
  Alert,
  CircularProgress,
  Box,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import apiClient from '../apiClient';
import useApi from '../hooks/useApi';

interface Portfolio {
  id: number;
  name: string;
  startingCash: number;
  createdAt: string;
}

export default function PortfolioListPage() {
  const { data: portfolios, loading, error, refetch } = useApi<Portfolio[]>(
    '/portfolios',
  );

  // ── Create dialog state ────────────────────────────────
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [startingCash, setStartingCash] = useState('100000');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Delete dialog state ───────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/portfolios/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await apiClient.post('/portfolios', {
        name,
        startingCash: Number(startingCash),
      });
      setOpen(false);
      setName('');
      setStartingCash('100000');
      refetch();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create portfolio');
    } finally {
      setCreating(false);
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
        <Typography variant="h4">My Portfolios</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          + New Portfolio
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ── Portfolio cards ────────────────────────────── */}
      <Stack spacing={2}>
        {portfolios?.map((p) => (
          <Card key={p.id} variant="outlined">
            <CardContent>
              <Typography variant="h6">{p.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Starting cash: ${p.startingCash.toLocaleString()} &middot; Created{' '}
                {new Date(p.createdAt).toLocaleDateString()}
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" component={Link} to={`/portfolios/${p.id}`}>
                View Details
              </Button>
              <Button size="small" component={Link} to={`/portfolios/${p.id}/trades`}>
                Trade History
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteTarget(p)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </CardActions>
          </Card>
        ))}

        {portfolios?.length === 0 && (
          <Typography color="text.secondary">
            No portfolios yet. Click "+ New Portfolio" to get started.
          </Typography>
        )}
      </Stack>

      {/* ── Create portfolio dialog ───────────────────── */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ component: 'form', onSubmit: handleCreate }}
      >
        <DialogTitle>Create Portfolio</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField
              label="Portfolio name"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={creating}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation dialog ──────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Portfolio</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{deleteTarget?.name}"? All trades in this portfolio will be
            permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

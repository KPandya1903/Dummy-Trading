import { useState } from 'react';
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
  Button,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Tooltip,
  IconButton,
  Breadcrumbs,
  Link as MuiLink,
} from '@mui/material';
import RateReviewIcon from '@mui/icons-material/RateReview';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import useApi from '../../hooks/useApi';
import apiClient from '../../apiClient';
import PageLoader from '../../components/ui/PageLoader';

interface Trade {
  id: number;
  ticker: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executedAt: string;
  note: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export default function TradeHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const { data: trades, loading, error, refetch } = useApi<Trade[]>('/trades', {
    portfolioId: id,
  });

  // ── Delete state ──────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);
  const [deletingTrade, setDeletingTrade] = useState(false);

  const handleDeleteTrade = async () => {
    if (!deleteTarget) return;
    setDeletingTrade(true);
    try {
      await apiClient.delete(`/trades/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeletingTrade(false);
    }
  };

  // ── Review modal state ─────────────────────────────────
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTrade, setReviewTrade] = useState<Trade | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [saving, setSaving] = useState(false);

  const openReview = (trade: Trade) => {
    setReviewTrade(trade);
    setReviewNote(trade.reviewNote || '');
    setReviewError('');
    setReviewOpen(true);
  };

  const handleSaveReview = async () => {
    if (!reviewTrade) return;
    if (!reviewNote.trim()) {
      setReviewError('Review note cannot be empty');
      return;
    }

    setSaving(true);
    setReviewError('');
    try {
      await apiClient.patch(`/trades/${reviewTrade.id}/review`, {
        reviewNote: reviewNote.trim(),
      });
      setReviewOpen(false);
      refetch();
    } catch (err: any) {
      setReviewError(err.response?.data?.error || 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader variant="table" />;

  return (
    <>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <MuiLink component={RouterLink} to="/portfolios" color="inherit" underline="hover">
          Portfolios
        </MuiLink>
        <MuiLink component={RouterLink} to={`/portfolios/${id}`} color="inherit" underline="hover">
          Portfolio
        </MuiLink>
        <Typography color="text.primary">Trade History</Typography>
      </Breadcrumbs>

      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="h4">Trade History</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => {
            const token = localStorage.getItem('token');
            const url = `${apiClient.defaults.baseURL}/trades/export?portfolioId=${id}`;
            fetch(url, { headers: { Authorization: `Bearer ${token}` } })
              .then((r) => r.blob())
              .then((blob) => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `trades-portfolio-${id}.csv`;
                a.click();
                URL.revokeObjectURL(a.href);
              });
          }}
          disabled={!trades || trades.length === 0}
        >
          Export CSV
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Ticker</TableCell>
              <TableCell>Side</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Entry Note</TableCell>
              <TableCell align="center">Review</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {trades?.map((t) => {
              const isReviewed = !!t.reviewNote;

              return (
                <TableRow
                  key={t.id}
                  sx={
                    isReviewed
                      ? {
                          bgcolor: 'rgba(0,200,5,0.06)',
                          borderLeft: 3,
                          borderColor: 'primary.main',
                        }
                      : undefined
                  }
                >
                  <TableCell>
                    {new Date(t.executedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip label={t.ticker} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t.side}
                      size="small"
                      color={t.side === 'BUY' ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">{t.quantity}</TableCell>
                  <TableCell align="right">${t.price.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    ${(t.quantity * t.price).toFixed(2)}
                  </TableCell>
                  <TableCell>{t.note || '—'}</TableCell>
                  <TableCell align="center">
                    {isReviewed ? (
                      <Tooltip
                        title={
                          <>
                            <strong>Review:</strong> {t.reviewNote}
                            <br />
                            <em>
                              {new Date(t.reviewedAt!).toLocaleDateString()}
                            </em>
                          </>
                        }
                        arrow
                      >
                        <Chip
                          icon={<RateReviewIcon />}
                          label="Reviewed"
                          size="small"
                          color="success"
                          variant="outlined"
                          onClick={() => openReview(t)}
                          sx={{ cursor: 'pointer' }}
                        />
                      </Tooltip>
                    ) : (
                      <Button size="small" onClick={() => openReview(t)}>
                        Add Review
                      </Button>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}

            {trades?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  No trades yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Review dialog ─────────────────────────────── */}
      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {reviewTrade?.reviewNote ? 'Edit Review' : 'Add Review'} &mdash;{' '}
          {reviewTrade?.side} {reviewTrade?.quantity} {reviewTrade?.ticker}
        </DialogTitle>
        <DialogContent>
          {reviewTrade?.note && (
            <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
              <strong>Original note:</strong> {reviewTrade.note}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" mb={1}>
            Reflect on this trade: Was your thesis correct? What would you do
            differently?
          </Typography>

          {reviewError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {reviewError}
            </Alert>
          )}

          <TextField
            autoFocus
            label="Review note"
            multiline
            rows={4}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveReview}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Review'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete trade dialog ──────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Trade</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete {deleteTarget?.side} {deleteTarget?.quantity} x{' '}
            {deleteTarget?.ticker}? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteTrade}
            disabled={deletingTrade}
          >
            {deletingTrade ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Link,
} from '@mui/material';
import PageLoader from './ui/PageLoader';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import apiClient from '../apiClient';

interface GeminiResult {
  text: string;
  sources: { title: string; url: string }[];
}

export default function GeminiInsightPanel({
  ticker,
  context,
  data,
}: {
  ticker: string;
  context: 'technical' | 'fundamental' | 'prediction' | 'news';
  data?: string;
}) {
  const [result, setResult] = useState<GeminiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLoggedIn = !!localStorage.getItem('token');

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post<GeminiResult>('/gemini/analyze', {
        ticker,
        context,
        data,
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate AI analysis');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) return null;

  if (!result && !loading) {
    return (
      <Button
        variant="outlined"
        size="small"
        startIcon={<AutoAwesomeIcon />}
        onClick={handleAnalyze}
        sx={{ mt: 1 }}
      >
        Ask AI
      </Button>
    );
  }

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <Typography variant="body2" color="error" mt={1}>
        {error}
      </Typography>
    );
  }

  if (!result) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        mt: 2,
        background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
        border: '1px solid rgba(0,200,5,0.15)',
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <AutoAwesomeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5' }}
        >
          AI Analysis
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, mb: 1 }}>
        {result.text}
      </Typography>

      {result.sources.length > 0 && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Sources:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
            {result.sources.slice(0, 5).map((s, i) => (
              <Link
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener"
                underline="hover"
                fontSize={12}
                color="primary.main"
              >
                {s.title}
              </Link>
            ))}
          </Box>
        </Box>
      )}

      <Button
        size="small"
        onClick={handleAnalyze}
        startIcon={<AutoAwesomeIcon />}
        sx={{ mt: 1 }}
      >
        Refresh
      </Button>
    </Paper>
  );
}

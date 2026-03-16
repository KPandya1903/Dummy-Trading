import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Link,
} from '@mui/material';
import PageLoader from './ui/PageLoader';
import useApi from '../hooks/useApi';

interface NewsResponse {
  ticker: string;
  aiSummary: string;
  aiSentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  sources: { title: string; url: string }[];
  articles: { headline: string; source: string; url: string; publishedAt: string }[];
}

const SENTIMENT_COLORS: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  positive: 'success',
  negative: 'error',
  mixed: 'warning',
  neutral: 'default',
};

export default function StockNewsPanel({ ticker }: { ticker: string }) {
  const [show, setShow] = useState(false);
  const { data, loading } = useApi<NewsResponse>(
    show ? `/news/${ticker}` : null,
  );

  if (!show) {
    return (
      <Button
        variant="outlined"
        size="small"
        onClick={() => setShow(true)}
        sx={{ mt: 2 }}
      >
        Load AI News Summary
      </Button>
    );
  }

  if (loading) return <PageLoader />;

  if (!data) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mt: 2,
        background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
        border: '1px solid rgba(0,200,5,0.1)',
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5' }}
        >
          AI News Summary
        </Typography>
        <Chip
          label={data.aiSentiment}
          size="small"
          color={SENTIMENT_COLORS[data.aiSentiment]}
          sx={{ height: 20, fontSize: 11 }}
        />
      </Box>

      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, mb: 2 }}>
        {data.aiSummary}
      </Typography>

      {data.sources.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Sources:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
            {data.sources.slice(0, 5).map((s, i) => (
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
    </Paper>
  );
}

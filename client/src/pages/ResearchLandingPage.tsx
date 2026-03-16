import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  TextField,
  Autocomplete,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CircularProgress,
  Alert,
} from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import TimelineIcon from '@mui/icons-material/Timeline';
import LanguageIcon from '@mui/icons-material/Language';
import apiClient from '../apiClient';

interface SearchResult {
  ticker: string;
  name: string;
}

const POPULAR_STOCKS = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'META', name: 'Meta Platforms' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
];

const panelSx = {
  p: 3,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.1)',
};

const FEATURES = [
  {
    icon: <AutoStoriesIcon sx={{ fontSize: 40, color: '#00C805' }} />,
    title: 'Curated Narratives',
    desc: 'Each market event is analyzed as a curated story with full context, sources, and impact assessment.',
  },
  {
    icon: <TimelineIcon sx={{ fontSize: 40, color: '#00C805' }} />,
    title: 'Price Correlation',
    desc: 'See exactly how events impacted stock prices with before/after analysis and mini charts.',
  },
  {
    icon: <LanguageIcon sx={{ fontSize: 40, color: '#00C805' }} />,
    title: 'Multi-Source Intelligence',
    desc: 'News, earnings, social sentiment, macro factors, geopolitics, supply chain, and analyst ratings — all in one place.',
  },
];

export default function ResearchLandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchQuery.length < 1) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/search', { params: { q: searchQuery } });
        setOptions(data.slice(0, 10));
      } catch {
        setOptions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResearch = async (ticker: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.post('/research', { ticker });
      navigate(`/research/${data.researchId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start research');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Deep Research
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        AI-powered comprehensive stock analysis with curated event narratives, price correlations, and multi-source intelligence. Analysis builds incrementally — each request discovers new stories.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Search */}
      <Paper variant="outlined" sx={{ ...panelSx, mb: 4, position: 'relative' }}>
        <Autocomplete
          freeSolo
          options={options}
          getOptionLabel={(opt) =>
            typeof opt === 'string' ? opt : `${opt.ticker} — ${opt.name}`
          }
          onInputChange={(_e, value) => setSearchQuery(value)}
          onChange={(_e, value) => {
            if (value && typeof value !== 'string') {
              handleResearch(value.ticker);
            }
          }}
          disabled={loading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search for a company to research..."
              variant="outlined"
              fullWidth
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  handleResearch(searchQuery.trim().toUpperCase());
                }
              }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading && <CircularProgress size={20} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Paper>

      {/* Features */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {FEATURES.map((f) => (
          <Grid item xs={12} md={4} key={f.title}>
            <Paper variant="outlined" sx={{ ...panelSx, textAlign: 'center', height: '100%' }}>
              {f.icon}
              <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                {f.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {f.desc}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Popular Stocks */}
      <Typography variant="h6" gutterBottom fontWeight={600}>
        Popular Stocks
      </Typography>
      <Grid container spacing={2}>
        {POPULAR_STOCKS.map((s) => (
          <Grid item xs={6} sm={3} key={s.ticker}>
            <Card sx={{ ...panelSx }}>
              <CardActionArea onClick={() => handleResearch(s.ticker)} disabled={loading}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {s.ticker}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.name}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}

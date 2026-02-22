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
} from '@mui/material';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import apiClient from '../apiClient';
import StockNewsPanel from '../components/StockNewsPanel';

interface SearchResult {
  ticker: string;
  name: string;
}

const TRENDING_STOCKS = [
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
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.1)',
};

export default function NewsLandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<SearchResult[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

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

  return (
    <>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Stock News
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        AI-powered real-time news and sentiment analysis for any stock, powered by Gemini with Google Search grounding.
      </Typography>

      {/* Search */}
      <Paper variant="outlined" sx={{ ...panelSx, mb: 4 }}>
        <Autocomplete
          freeSolo
          options={options}
          getOptionLabel={(opt) =>
            typeof opt === 'string' ? opt : `${opt.ticker} — ${opt.name}`
          }
          onInputChange={(_e, value) => setSearchQuery(value)}
          onChange={(_e, value) => {
            if (value && typeof value !== 'string') {
              setSelectedTicker(value.ticker);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search for a stock ticker..."
              variant="outlined"
              fullWidth
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setSelectedTicker(searchQuery.trim().toUpperCase());
                }
              }}
            />
          )}
        />
      </Paper>

      {/* News panel for selected ticker */}
      {selectedTicker && (
        <Box sx={{ mb: 4 }}>
          <StockNewsPanel ticker={selectedTicker} />
        </Box>
      )}

      {/* Quick select grid */}
      {!selectedTicker && (
        <>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Trending Stocks
          </Typography>
          <Grid container spacing={2}>
            {TRENDING_STOCKS.map((s) => (
              <Grid item xs={6} sm={3} key={s.ticker}>
                <Card sx={{ ...panelSx }}>
                  <CardActionArea onClick={() => setSelectedTicker(s.ticker)}>
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <NewspaperIcon sx={{ color: '#c9a84c', mb: 0.5 }} />
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
      )}
    </>
  );
}

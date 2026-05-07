import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Alert, Paper, Box, TextField, Divider } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient from '../../apiClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const { data } = await apiClient.post('/auth/google', {
          access_token: tokenResponse.access_token,
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', String(data.userId));
        navigate('/');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Google sign-in failed');
      }
    },
    onError: () => setError('Google sign-in was cancelled'),
    flow: 'implicit',
  });

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', String(data.userId));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 5, mt: 10, maxWidth: 400, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h5" color="primary.main" fontWeight={700} sx={{ mb: 1 }}>
        Dummy Trading
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Sign in to access your portfolio
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleEmailLogin} sx={{ mb: 2 }}>
        <TextField
          label="Email"
          type="email"
          fullWidth
          size="small"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mb: 1.5 }}
          required
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          size="small"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          sx={{ py: 1.5 }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </Box>

      <Divider sx={{ my: 2 }}>
        <Typography variant="caption" color="text.disabled">or</Typography>
      </Divider>

      <Button
        variant="outlined"
        fullWidth
        size="large"
        startIcon={<GoogleIcon />}
        onClick={() => googleLogin()}
        sx={{
          borderColor: '#4285F4',
          color: '#4285F4',
          py: 1.5,
          '&:hover': { borderColor: '#4285F4', bgcolor: 'rgba(66,133,244,0.08)' },
        }}
      >
        Continue with Google
      </Button>

      <Box mt={3}>
        <Typography variant="caption" color="text.disabled">
          Demo: kunj@demo.com / Demo1234!
        </Typography>
      </Box>
    </Paper>
  );
}

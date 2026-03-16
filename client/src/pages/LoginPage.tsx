import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  TextField,
  Typography,
  Alert,
  Stack,
  Paper,
  Divider,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient from '../apiClient';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch(`${API}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });
        if (!res.ok) throw new Error('Google sign-in failed');
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', String(data.userId));
        navigate('/');
      } catch (err: any) {
        setError(err.message);
      }
    },
    onError: () => setError('Google sign-in was cancelled'),
    flow: 'implicit',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        await apiClient.post('/auth/register', { email, password });
      }

      const { data } = await apiClient.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', String(data.userId));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <Paper sx={{ p: 4, mt: 8, maxWidth: 420, mx: 'auto' }}>
      <Typography
        variant="h5"
        color="primary.main"
        fontWeight={700}
        textAlign="center"
        sx={{ mb: 1 }}
      >
        Dummy Trading
      </Typography>
      <Typography variant="h4" gutterBottom textAlign="center">
        {isRegister ? 'Register' : 'Login'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" fullWidth size="large">
            {isRegister ? 'Register' : 'Login'}
          </Button>
          <Button size="small" onClick={() => setIsRegister(!isRegister)}>
            {isRegister
              ? 'Already have an account? Login'
              : "Don't have an account? Register"}
          </Button>

          <Divider sx={{ my: 1 }}>or</Divider>

          <Button
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<GoogleIcon />}
            onClick={() => googleLogin()}
            sx={{ borderColor: '#4285F4', color: '#4285F4', '&:hover': { borderColor: '#4285F4', bgcolor: 'rgba(66,133,244,0.08)' } }}
          >
            Continue with Google
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}

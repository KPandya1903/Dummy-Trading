import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Stack,
  Paper,
} from '@mui/material';
import apiClient from '../apiClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);

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
        </Stack>
      </form>
    </Paper>
  );
}

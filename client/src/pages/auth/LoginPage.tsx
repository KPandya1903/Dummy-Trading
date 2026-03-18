import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Alert, Paper, Box } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient from '../../apiClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

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
          No account needed — your profile is created automatically
        </Typography>
      </Box>
    </Paper>
  );
}

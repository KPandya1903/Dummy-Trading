import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Avatar, Button, TextField, Divider,
  Grid, Chip, CircularProgress, Alert, Stack,
} from '@mui/material';
import {
  Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon,
  Google as GoogleIcon, EmojiEvents, SwapHoriz, AccountBalance,
  CalendarToday, LocationOn, Person,
} from '@mui/icons-material';
import { useGoogleLogin } from '@react-oauth/google';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface ProfileData {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  hasGoogleConnected: boolean;
  createdAt: string;
  stats: {
    portfolioCount: number;
    tradeCount: number;
    badgeCount: number;
  };
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, textAlign: 'center', flex: 1, minWidth: 100 }}
    >
      <Box sx={{ color: 'primary.main', mb: 0.5 }}>{icon}</Box>
      <Typography variant="h6" fontWeight={700}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  }
  return email[0].toUpperCase();
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({ name: '', bio: '', location: '' });

  const token = localStorage.getItem('token');

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data: ProfileData = await res.json();
      setProfile(data);
      setForm({ name: data.name ?? '', bio: data.bio ?? '', location: data.location ?? '' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${API}/api/users/me`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      await fetchProfile();
      setEditing(false);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Exchange access token for ID token via userinfo, then post credential
        // We send the access_token to backend for Google profile fetch
        const res = await fetch(`${API}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });
        if (!res.ok) throw new Error('Google connect failed');
        await fetchProfile();
      } catch (e: any) {
        setSaveError('Google connect failed: ' + e.message);
      }
    },
    onError: () => setSaveError('Google sign-in was cancelled'),
    flow: 'implicit',
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" pt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !profile) {
    return <Alert severity="error">{error || 'Profile not found'}</Alert>;
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <Box maxWidth={700} mx="auto">
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Profile
      </Typography>

      {/* Header card */}
      <Paper
        variant="outlined"
        sx={{
          p: 3, mb: 3,
          background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
          border: '1px solid rgba(0,200,5,0.1)',
        }}
      >
        <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
          <Avatar
            src={profile.avatarUrl ?? undefined}
            sx={{ width: 80, height: 80, bgcolor: 'primary.main', color: '#000', fontSize: '1.75rem', fontWeight: 700 }}
          >
            {getInitials(profile.name, profile.email)}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="h5" fontWeight={700}>
              {profile.name ?? profile.email}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {profile.email}
            </Typography>
            <Box display="flex" gap={1} mt={1} flexWrap="wrap">
              {profile.location && (
                <Chip
                  icon={<LocationOn sx={{ fontSize: 14 }} />}
                  label={profile.location}
                  size="small"
                  variant="outlined"
                />
              )}
              <Chip
                icon={<CalendarToday sx={{ fontSize: 14 }} />}
                label={`Joined ${memberSince}`}
                size="small"
                variant="outlined"
              />
              {profile.hasGoogleConnected && (
                <Chip
                  icon={<GoogleIcon sx={{ fontSize: 14 }} />}
                  label="Google connected"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={editing ? <CancelIcon /> : <EditIcon />}
            onClick={() => { setEditing(!editing); setSaveError(''); }}
          >
            {editing ? 'Cancel' : 'Edit'}
          </Button>
        </Box>
      </Paper>

      {/* Stats row */}
      <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap">
        <StatCard icon={<AccountBalance />} label="Portfolios" value={profile.stats.portfolioCount} />
        <StatCard icon={<SwapHoriz />} label="Trades" value={profile.stats.tradeCount} />
        <StatCard icon={<EmojiEvents />} label="Badges" value={profile.stats.badgeCount} />
      </Stack>

      {/* Edit form */}
      {editing && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Edit Profile
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Display Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              size="small"
              InputProps={{ startAdornment: <Person sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} /> }}
            />
            <TextField
              label="Bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="Tell other traders about yourself..."
            />
            <TextField
              label="Location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              fullWidth
              size="small"
              placeholder="e.g. New York, USA"
              InputProps={{ startAdornment: <LocationOn sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} /> }}
            />
            {saveError && <Alert severity="error">{saveError}</Alert>}
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                Save Changes
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Bio display (when not editing) */}
      {!editing && profile.bio && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Bio</Typography>
          <Typography variant="body2">{profile.bio}</Typography>
        </Paper>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Google Connect */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Connected Accounts
        </Typography>
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <GoogleIcon sx={{ color: '#4285F4', fontSize: 28 }} />
            <Box>
              <Typography variant="body2" fontWeight={600}>Google</Typography>
              <Typography variant="caption" color="text.secondary">
                {profile.hasGoogleConnected
                  ? 'Connected — you can sign in with Google'
                  : 'Connect to enable one-tap Google sign-in'}
              </Typography>
            </Box>
          </Box>
          {!profile.hasGoogleConnected && (
            <Button
              variant="outlined"
              startIcon={<GoogleIcon />}
              onClick={() => googleLogin()}
              sx={{ borderColor: '#4285F4', color: '#4285F4', '&:hover': { borderColor: '#4285F4', bgcolor: 'rgba(66,133,244,0.08)' } }}
            >
              Connect Google
            </Button>
          )}
          {profile.hasGoogleConnected && (
            <Chip label="Connected" color="success" size="small" />
          )}
        </Box>
      </Paper>
    </Box>
  );
}

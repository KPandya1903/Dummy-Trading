import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import TickerTape from './TickerTape';
import AlertBadge from './AlertBadge';

export default function Layout() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  const navButtonSx = {
    color: 'text.secondary',
    fontWeight: 500,
    '&:hover': { color: 'primary.main' },
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              color: 'primary.main',
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            Dummy Trading
          </Typography>

          <Button sx={navButtonSx} component={Link} to="/market">
            Market
          </Button>
          <Button sx={navButtonSx} component={Link} to="/compare">
            Compare
          </Button>
          <Button sx={navButtonSx} component={Link} to="/analysis">
            Analysis
          </Button>
          <Button sx={navButtonSx} component={Link} to="/prediction">
            Prediction
          </Button>
          <Button sx={navButtonSx} component={Link} to="/news">
            News
          </Button>
          <Button sx={navButtonSx} component={Link} to="/research">
            Research
          </Button>

          {isLoggedIn ? (
            <>
              <Button sx={navButtonSx} component={Link} to="/">
                Dashboard
              </Button>
              <Button sx={navButtonSx} component={Link} to="/portfolios">
                Portfolios
              </Button>
              <Button sx={navButtonSx} component={Link} to="/groups">
                Groups
              </Button>
              <Button sx={navButtonSx} component={Link} to="/watchlist">
                Watchlist
              </Button>
              <Button sx={navButtonSx} component={Link} to="/leaderboard">
                Leaderboard
              </Button>
              <Button sx={navButtonSx} component={Link} to="/badges">
                Badges
              </Button>
              <AlertBadge />
              <Button sx={navButtonSx} onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button sx={navButtonSx} component={Link} to="/login">
              Login
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <TickerTape />

      <Container maxWidth="lg">
        <Box sx={{ mt: 3, mb: 4 }}>
          <Outlet />
        </Box>
      </Container>
    </>
  );
}

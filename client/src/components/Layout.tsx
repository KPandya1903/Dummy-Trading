import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Fade,
} from '@mui/material';
import {
  KeyboardArrowDown,
  MoreHoriz,
  AccountCircle,
  ShowChart,
  TrendingUp,
  Article,
  Science,
  CompareArrows,
  Visibility,
  Group,
  EmojiEvents,
  MilitaryTech,
  FilterList,
  Waves,
} from '@mui/icons-material';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import TickerTape from './TickerTape';
import AlertBadge from './AlertBadge';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = !!localStorage.getItem('token');

  const [exploreAnchor, setExploreAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setAccountAnchor(null);
    navigate('/login');
  };

  const closeExplore = () => setExploreAnchor(null);
  const closeMore = () => setMoreAnchor(null);
  const closeAccount = () => setAccountAnchor(null);

  const navButtonSx = {
    color: 'text.secondary',
    fontWeight: 500,
    '&:hover': { color: 'primary.main' },
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          {/* ── Brand ── */}
          <Typography
            variant="h6"
            component={Link}
            to={isLoggedIn ? '/' : '/market'}
            sx={{
              mr: 3,
              color: 'primary.main',
              fontWeight: 700,
              letterSpacing: 1,
              textDecoration: 'none',
            }}
          >
            Dummy Trading
          </Typography>

          {/* ── Primary nav ── */}
          {isLoggedIn && (
            <Button sx={navButtonSx} component={Link} to="/">
              Dashboard
            </Button>
          )}
          <Button sx={navButtonSx} component={Link} to="/market">
            Market
          </Button>
          {isLoggedIn && (
            <Button sx={navButtonSx} component={Link} to="/portfolios">
              Portfolios
            </Button>
          )}

          {/* ── Explore dropdown ── */}
          <Button
            sx={navButtonSx}
            onClick={(e) => setExploreAnchor(e.currentTarget)}
            endIcon={<KeyboardArrowDown sx={{ fontSize: 18 }} />}
          >
            Explore
          </Button>
          <Menu
            anchorEl={exploreAnchor}
            open={!!exploreAnchor}
            onClose={closeExplore}
            TransitionComponent={Fade}
          >
            <MenuItem component={Link} to="/analysis" onClick={closeExplore}>
              <ListItemIcon><ShowChart fontSize="small" /></ListItemIcon>
              <ListItemText>Technical Analysis</ListItemText>
            </MenuItem>
            <MenuItem component={Link} to="/prediction" onClick={closeExplore}>
              <ListItemIcon><TrendingUp fontSize="small" /></ListItemIcon>
              <ListItemText>Price Prediction</ListItemText>
            </MenuItem>
            <MenuItem component={Link} to="/compare" onClick={closeExplore}>
              <ListItemIcon><CompareArrows fontSize="small" /></ListItemIcon>
              <ListItemText>Compare Stocks</ListItemText>
            </MenuItem>
            <MenuItem component={Link} to="/screener" onClick={closeExplore}>
              <ListItemIcon><FilterList fontSize="small" /></ListItemIcon>
              <ListItemText>Stock Screener</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem component={Link} to="/news" onClick={closeExplore}>
              <ListItemIcon><Article fontSize="small" /></ListItemIcon>
              <ListItemText>AI News</ListItemText>
            </MenuItem>
            <MenuItem component={Link} to="/research" onClick={closeExplore}>
              <ListItemIcon><Science fontSize="small" /></ListItemIcon>
              <ListItemText>Deep Research</ListItemText>
            </MenuItem>
          </Menu>

          {/* ── Spacer ── */}
          <Box sx={{ flexGrow: 1 }} />

          {/* ── Right side: More menu + Alert + Account ── */}
          {isLoggedIn && (
            <>
              <IconButton
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                onClick={(e) => setMoreAnchor(e.currentTarget)}
              >
                <MoreHoriz />
              </IconButton>
              <Menu
                anchorEl={moreAnchor}
                open={!!moreAnchor}
                onClose={closeMore}
                TransitionComponent={Fade}
              >
                <MenuItem component={Link} to="/watchlist" onClick={closeMore}>
                  <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
                  <ListItemText>Watchlist</ListItemText>
                </MenuItem>
                <MenuItem component={Link} to="/groups" onClick={closeMore}>
                  <ListItemIcon><Group fontSize="small" /></ListItemIcon>
                  <ListItemText>Groups</ListItemText>
                </MenuItem>
                <MenuItem component={Link} to="/leaderboard" onClick={closeMore}>
                  <ListItemIcon><EmojiEvents fontSize="small" /></ListItemIcon>
                  <ListItemText>Leaderboard</ListItemText>
                </MenuItem>
                <MenuItem component={Link} to="/badges" onClick={closeMore}>
                  <ListItemIcon><MilitaryTech fontSize="small" /></ListItemIcon>
                  <ListItemText>Badges</ListItemText>
                </MenuItem>
              </Menu>
              <AlertBadge />
            </>
          )}

          <IconButton
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            onClick={(e) => setAccountAnchor(e.currentTarget)}
          >
            <AccountCircle />
          </IconButton>
          <Menu
            anchorEl={accountAnchor}
            open={!!accountAnchor}
            onClose={closeAccount}
            TransitionComponent={Fade}
          >
            {isLoggedIn ? (
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            ) : (
              <MenuItem component={Link} to="/login" onClick={closeAccount}>
                Login
              </MenuItem>
            )}
          </Menu>
        </Toolbar>
      </AppBar>

      <TickerTape />

      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 6 }}>
          <Fade in timeout={300} key={location.pathname}>
            <Box>
              <Outlet />
            </Box>
          </Fade>
        </Box>
      </Container>
    </>
  );
}

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
  Drawer,
  List,
  ListItemButton,
  ListSubheader,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  BarChart,
  AccountBalance,
} from '@mui/icons-material';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import TickerTape from './TickerTape';
import AlertBadge from './AlertBadge';

const EXPLORE_PATHS = ['/analysis', '/prediction', '/compare', '/screener', '/news', '/research'];
const MORE_PATHS = ['/watchlist', '/groups', '/leaderboard', '/badges'];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isLoggedIn = !!localStorage.getItem('token');

  const [exploreAnchor, setExploreAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setAccountAnchor(null);
    navigate('/login');
  };

  const closeExplore = () => setExploreAnchor(null);
  const closeMore = () => setMoreAnchor(null);
  const closeAccount = () => setAccountAnchor(null);
  const closeDrawer = () => setDrawerOpen(false);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const isExploreActive = EXPLORE_PATHS.some((p) => location.pathname.startsWith(p));
  const isMoreActive = MORE_PATHS.some((p) => location.pathname.startsWith(p));

  const navSx = (path: string) => ({
    color: isActive(path) ? 'primary.main' : 'text.secondary',
    fontWeight: isActive(path) ? 700 : 500,
    borderBottom: '2px solid',
    borderColor: isActive(path) ? 'primary.main' : 'transparent',
    borderRadius: 0,
    '&:hover': { color: 'primary.main' },
  });

  const dropdownSx = (active: boolean) => ({
    color: active ? 'primary.main' : 'text.secondary',
    fontWeight: active ? 700 : 500,
    borderBottom: '2px solid',
    borderColor: active ? 'primary.main' : 'transparent',
    borderRadius: 0,
    '&:hover': { color: 'primary.main' },
  });

  return (
    <>
      {/* ── Skip to content ── */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed',
          top: -9999,
          left: 8,
          zIndex: 9999,
          bgcolor: 'background.paper',
          color: 'primary.main',
          px: 2,
          py: 1,
          borderRadius: 1,
          fontWeight: 700,
          fontSize: '0.875rem',
          textDecoration: 'none',
          border: '2px solid',
          borderColor: 'primary.main',
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Box>

      <AppBar position="static">
        <Toolbar>
          {/* ── Hamburger (mobile only) ── */}
          <IconButton
            sx={{ display: { xs: 'flex', sm: 'none' }, mr: 1, color: 'text.secondary' }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <MenuIcon />
          </IconButton>

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

          {/* ── Primary nav (desktop) ── */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
            {isLoggedIn && (
              <Button sx={navSx('/')} component={Link} to="/">
                Dashboard
              </Button>
            )}
            <Button sx={navSx('/market')} component={Link} to="/market">
              Market
            </Button>
            {isLoggedIn && (
              <Button sx={navSx('/portfolios')} component={Link} to="/portfolios">
                Portfolios
              </Button>
            )}

            {/* ── Explore dropdown ── */}
            <Button
              sx={dropdownSx(isExploreActive)}
              onClick={(e) => setExploreAnchor(e.currentTarget)}
              endIcon={<KeyboardArrowDown sx={{ fontSize: 18 }} />}
              aria-haspopup="true"
              aria-expanded={!!exploreAnchor}
              aria-controls="explore-menu"
            >
              Explore
            </Button>
          </Box>

          <Menu
            id="explore-menu"
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
                sx={{ color: isMoreActive ? 'primary.main' : 'text.secondary', '&:hover': { color: 'primary.main' } }}
                onClick={(e) => setMoreAnchor(e.currentTarget)}
                aria-haspopup="true"
                aria-expanded={!!moreAnchor}
                aria-controls="more-menu"
                aria-label="More options"
              >
                <MoreHoriz />
              </IconButton>
              <Menu
                id="more-menu"
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
            aria-label="Account menu"
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

      {/* ── Mobile Drawer ── */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: 280, bgcolor: 'background.paper' } }}
      >
        <Box sx={{ pt: 2, pb: 1, px: 2 }}>
          <Typography variant="h6" color="primary.main" fontWeight={700} letterSpacing={1}>
            Dummy Trading
          </Typography>
        </Box>
        <Divider />
        <List dense>
          {isLoggedIn && (
            <ListItemButton
              component={Link}
              to="/"
              selected={isActive('/')}
              onClick={closeDrawer}
              sx={{ '&.Mui-selected': { borderLeft: '3px solid', borderColor: 'primary.main', color: 'primary.main' } }}
            >
              <ListItemIcon><DashboardIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
          )}
          <ListItemButton
            component={Link}
            to="/market"
            selected={isActive('/market')}
            onClick={closeDrawer}
            sx={{ '&.Mui-selected': { borderLeft: '3px solid', borderColor: 'primary.main', color: 'primary.main' } }}
          >
            <ListItemIcon><BarChart fontSize="small" /></ListItemIcon>
            <ListItemText primary="Market" />
          </ListItemButton>
          {isLoggedIn && (
            <ListItemButton
              component={Link}
              to="/portfolios"
              selected={isActive('/portfolios')}
              onClick={closeDrawer}
              sx={{ '&.Mui-selected': { borderLeft: '3px solid', borderColor: 'primary.main', color: 'primary.main' } }}
            >
              <ListItemIcon><AccountBalance fontSize="small" /></ListItemIcon>
              <ListItemText primary="Portfolios" />
            </ListItemButton>
          )}

          <ListSubheader sx={{ bgcolor: 'transparent', color: 'text.disabled', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
            EXPLORE
          </ListSubheader>
          {[
            { to: '/analysis', icon: <ShowChart fontSize="small" />, label: 'Technical Analysis' },
            { to: '/prediction', icon: <TrendingUp fontSize="small" />, label: 'Price Prediction' },
            { to: '/compare', icon: <CompareArrows fontSize="small" />, label: 'Compare Stocks' },
            { to: '/screener', icon: <FilterList fontSize="small" />, label: 'Stock Screener' },
            { to: '/news', icon: <Article fontSize="small" />, label: 'AI News' },
            { to: '/research', icon: <Science fontSize="small" />, label: 'Deep Research' },
          ].map(({ to, icon, label }) => (
            <ListItemButton
              key={to}
              component={Link}
              to={to}
              selected={isActive(to)}
              onClick={closeDrawer}
              sx={{ '&.Mui-selected': { borderLeft: '3px solid', borderColor: 'primary.main', color: 'primary.main' } }}
            >
              <ListItemIcon>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}

          {isLoggedIn && (
            <>
              <ListSubheader sx={{ bgcolor: 'transparent', color: 'text.disabled', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
                MORE
              </ListSubheader>
              {[
                { to: '/watchlist', icon: <Visibility fontSize="small" />, label: 'Watchlist' },
                { to: '/groups', icon: <Group fontSize="small" />, label: 'Groups' },
                { to: '/leaderboard', icon: <EmojiEvents fontSize="small" />, label: 'Leaderboard' },
                { to: '/badges', icon: <MilitaryTech fontSize="small" />, label: 'Badges' },
              ].map(({ to, icon, label }) => (
                <ListItemButton
                  key={to}
                  component={Link}
                  to={to}
                  selected={isActive(to)}
                  onClick={closeDrawer}
                  sx={{ '&.Mui-selected': { borderLeft: '3px solid', borderColor: 'primary.main', color: 'primary.main' } }}
                >
                  <ListItemIcon>{icon}</ListItemIcon>
                  <ListItemText primary={label} />
                </ListItemButton>
              ))}
            </>
          )}

          <Divider sx={{ my: 1 }} />
          {isLoggedIn ? (
            <ListItemButton onClick={() => { handleLogout(); closeDrawer(); }}>
              <ListItemText primary="Logout" primaryTypographyProps={{ color: 'error.main' }} />
            </ListItemButton>
          ) : (
            <ListItemButton component={Link} to="/login" onClick={closeDrawer}>
              <ListItemIcon><AccountCircle fontSize="small" /></ListItemIcon>
              <ListItemText primary="Login" />
            </ListItemButton>
          )}
        </List>
      </Drawer>

      <TickerTape />

      <Container maxWidth="lg" id="main-content">
        <Box sx={{ mt: 4, mb: 6 }}>
          <Box
            key={location.pathname}
            sx={{
              '@keyframes pageEnter': {
                from: { opacity: 0, transform: 'translateY(6px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
              animation: 'pageEnter 0.25s ease-out',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Container>
    </>
  );
}

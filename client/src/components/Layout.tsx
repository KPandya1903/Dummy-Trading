import { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Divider,
  Typography,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  AppBar,
  Toolbar,
  useMediaQuery,
  Fade,
  Menu,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Dashboard as DashboardIcon,
  BarChart,
  AccountBalance,
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
  AccountCircle,
  Menu as MenuIcon,
  SwapHoriz,
  Home,
} from '@mui/icons-material';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import TickerTape from './TickerTape';
import AlertBadge from './AlertBadge';
import PageLoader from './ui/PageLoader';

const SIDEBAR_WIDTH = 240;

const PRIMARY_NAV = [
  { to: '/', icon: <DashboardIcon sx={{ fontSize: 18 }} />, label: 'Dashboard', auth: true },
  { to: '/market', icon: <BarChart sx={{ fontSize: 18 }} />, label: 'Market', auth: false },
  { to: '/portfolios', icon: <AccountBalance sx={{ fontSize: 18 }} />, label: 'Portfolios', auth: true },
];

const EXPLORE_NAV = [
  { to: '/analysis', icon: <ShowChart sx={{ fontSize: 18 }} />, label: 'Technical Analysis' },
  { to: '/prediction', icon: <TrendingUp sx={{ fontSize: 18 }} />, label: 'Price Prediction' },
  { to: '/compare', icon: <CompareArrows sx={{ fontSize: 18 }} />, label: 'Compare Stocks' },
  { to: '/screener', icon: <FilterList sx={{ fontSize: 18 }} />, label: 'Stock Screener' },
  { to: '/news', icon: <Article sx={{ fontSize: 18 }} />, label: 'AI News' },
  { to: '/research', icon: <Science sx={{ fontSize: 18 }} />, label: 'Deep Research' },
];

const MORE_NAV = [
  { to: '/watchlist', icon: <Visibility sx={{ fontSize: 18 }} />, label: 'Watchlist' },
  { to: '/groups', icon: <Group sx={{ fontSize: 18 }} />, label: 'Groups' },
  { to: '/leaderboard', icon: <EmojiEvents sx={{ fontSize: 18 }} />, label: 'Leaderboard' },
  { to: '/badges', icon: <MilitaryTech sx={{ fontSize: 18 }} />, label: 'Badges' },
];

const BOTTOM_NAV = [
  { to: '/', icon: <Home />, label: 'Home', auth: true },
  { to: '/market', icon: <BarChart />, label: 'Market', auth: false },
  { to: '/trade', icon: <SwapHoriz />, label: 'Trade', auth: true },
  { to: '/watchlist', icon: <Visibility />, label: 'Watch', auth: true },
  { to: '/portfolios', icon: <AccountBalance />, label: 'Portfolio', auth: true },
];

const navItemSx = {
  mx: 1,
  mb: 0.25,
  borderRadius: 1.5,
  py: 0.75,
  '& .MuiListItemIcon-root': { minWidth: 34, color: 'text.disabled' },
  '& .MuiListItemText-primary': { fontSize: '0.8125rem', fontWeight: 500, color: 'text.secondary' },
  '&:hover': {
    bgcolor: 'rgba(255,255,255,0.04)',
    '& .MuiListItemText-primary': { color: 'text.primary' },
    '& .MuiListItemIcon-root': { color: 'text.secondary' },
  },
  '&.Mui-selected': {
    bgcolor: 'rgba(0,200,5,0.08)',
    borderLeft: '2px solid',
    borderColor: 'primary.main',
    ml: '7px',
    '& .MuiListItemIcon-root': { color: 'primary.main' },
    '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 600 },
    '&:hover': { bgcolor: 'rgba(0,200,5,0.12)' },
  },
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isLoggedIn = !!localStorage.getItem('token');

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setAccountAnchor(null);
    navigate('/login');
  };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const bottomNavValue = BOTTOM_NAV.findIndex((item) => isActive(item.to));

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography
          component={Link}
          to={isLoggedIn ? '/' : '/market'}
          sx={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'primary.main',
            textDecoration: 'none',
            letterSpacing: 0.5,
          }}
        >
          Dummy Trading
        </Typography>
      </Box>

      {/* Nav list */}
      <List dense sx={{ flex: 1, overflowY: 'auto', pt: 1, pb: 1 }}>
        {PRIMARY_NAV.filter((item) => !item.auth || isLoggedIn).map(({ to, icon, label }) => (
          <ListItemButton
            key={to}
            component={Link}
            to={to}
            selected={isActive(to)}
            onClick={() => setMobileOpen(false)}
            sx={navItemSx}
          >
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}

        <Divider sx={{ my: 1 }} />

        <ListSubheader
          sx={{
            bgcolor: 'transparent',
            color: 'text.disabled',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            lineHeight: '28px',
            px: 2,
          }}
        >
          EXPLORE
        </ListSubheader>

        {EXPLORE_NAV.map(({ to, icon, label }) => (
          <ListItemButton
            key={to}
            component={Link}
            to={to}
            selected={isActive(to)}
            onClick={() => setMobileOpen(false)}
            sx={navItemSx}
          >
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}

        {isLoggedIn && (
          <>
            <Divider sx={{ my: 1 }} />
            <ListSubheader
              sx={{
                bgcolor: 'transparent',
                color: 'text.disabled',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                lineHeight: '28px',
                px: 2,
              }}
            >
              MORE
            </ListSubheader>

            {MORE_NAV.map(({ to, icon, label }) => (
              <ListItemButton
                key={to}
                component={Link}
                to={to}
                selected={isActive(to)}
                onClick={() => setMobileOpen(false)}
                sx={navItemSx}
              >
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            ))}
          </>
        )}
      </List>

      {/* Account / Logout */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 1, flexShrink: 0 }}>
        {isLoggedIn ? (
          <ListItemButton
            onClick={handleLogout}
            sx={{ borderRadius: 1.5, '& .MuiListItemText-primary': { color: 'error.main', fontSize: '0.8125rem' } }}
          >
            <ListItemText primary="Logout" />
          </ListItemButton>
        ) : (
          <ListItemButton
            component={Link}
            to="/login"
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 34 }}>
              <AccountCircle sx={{ fontSize: 18, color: 'text.disabled' }} />
            </ListItemIcon>
            <ListItemText primary="Login" primaryTypographyProps={{ fontSize: '0.8125rem' }} />
          </ListItemButton>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Skip to content */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed', top: -9999, left: 8, zIndex: 9999,
          bgcolor: 'background.paper', color: 'primary.main',
          px: 2, py: 1, borderRadius: 1, fontWeight: 700, fontSize: '0.875rem',
          textDecoration: 'none', border: '2px solid', borderColor: 'primary.main',
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Box>

      {/* Desktop: permanent sidebar */}
      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
              bgcolor: 'background.default',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Mobile: temporary drawer */}
      {!isDesktop && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: 280, bgcolor: 'background.default' } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Right: content column */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Mobile top bar */}
        {!isDesktop && (
          <AppBar position="static">
            <Toolbar sx={{ minHeight: '52px !important', px: 1.5 }}>
              <IconButton
                sx={{ color: 'text.secondary', mr: 0.5 }}
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
              >
                <MenuIcon />
              </IconButton>
              <Typography
                component={Link}
                to={isLoggedIn ? '/' : '/market'}
                sx={{ flex: 1, fontSize: '1rem', fontWeight: 700, color: 'primary.main', textDecoration: 'none' }}
              >
                Dummy Trading
              </Typography>
              {isLoggedIn && <AlertBadge />}
              <IconButton
                sx={{ color: 'text.secondary' }}
                onClick={(e) => setAccountAnchor(e.currentTarget)}
                aria-label="Account menu"
              >
                <AccountCircle />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}

        {/* Desktop slim top bar (alerts + account only) */}
        {isDesktop && (
          <Box
            sx={{
              height: 48,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              px: 3,
              gap: 1,
              flexShrink: 0,
            }}
          >
            {isLoggedIn && <AlertBadge />}
            <IconButton
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              onClick={(e) => setAccountAnchor(e.currentTarget)}
              aria-label="Account menu"
            >
              <AccountCircle />
            </IconButton>
          </Box>
        )}

        {/* Account menu */}
        <Menu
          anchorEl={accountAnchor}
          open={!!accountAnchor}
          onClose={() => setAccountAnchor(null)}
          TransitionComponent={Fade}
        >
          {isLoggedIn ? (
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          ) : (
            <MenuItem component={Link} to="/login" onClick={() => setAccountAnchor(null)}>
              Login
            </MenuItem>
          )}
        </Menu>

        {/* Ticker tape */}
        <TickerTape />

        {/* Page content */}
        <Box
          component="main"
          id="main-content"
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2, sm: 3, md: 4 },
            pt: 4,
            pb: { xs: 10, md: 6 },
          }}
        >
          <Box
            key={location.pathname}
            sx={{
              '@keyframes pageEnter': {
                from: { opacity: 0, transform: 'translateY(6px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
              animation: 'pageEnter 0.2s ease-out',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </Box>
        </Box>

        {/* Mobile bottom navigation */}
        {!isDesktop && (
          <BottomNavigation
            value={bottomNavValue}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.default',
              zIndex: 1200,
            }}
          >
            {BOTTOM_NAV.filter((item) => !item.auth || isLoggedIn).map(({ to, icon, label }) => (
              <BottomNavigationAction
                key={to}
                label={label}
                icon={icon}
                component={Link}
                to={to}
                sx={{
                  color: 'text.disabled',
                  minWidth: 0,
                  '&.Mui-selected': { color: 'primary.main' },
                  '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem' },
                }}
              />
            ))}
          </BottomNavigation>
        )}
      </Box>
    </Box>
  );
}

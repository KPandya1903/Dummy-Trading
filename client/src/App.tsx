import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/layout/Layout';
import PageLoader from './components/ui/PageLoader';

const LoginPage            = lazy(() => import('./pages/auth/LoginPage'));
const PortfolioListPage    = lazy(() => import('./pages/trading/PortfolioListPage'));
const PortfolioDetailPage  = lazy(() => import('./pages/trading/PortfolioDetailPage'));
const TradeHistoryPage     = lazy(() => import('./pages/trading/TradeHistoryPage'));
const WatchlistPage        = lazy(() => import('./pages/watchlist/WatchlistPage'));
const LeaderboardPage      = lazy(() => import('./pages/social/LeaderboardPage'));
const MarketPage           = lazy(() => import('./pages/market/MarketPage'));
const GroupListPage        = lazy(() => import('./pages/social/GroupListPage'));
const GroupDetailPage      = lazy(() => import('./pages/social/GroupDetailPage'));
const TradePage            = lazy(() => import('./pages/trading/TradePage'));
const StockDetailPage      = lazy(() => import('./pages/market/StockDetailPage'));
const DashboardPage        = lazy(() => import('./pages/dashboard/DashboardPage'));
const BadgesPage           = lazy(() => import('./pages/social/BadgesPage'));
const StockComparisonPage  = lazy(() => import('./pages/market/StockComparisonPage'));
const StockAnalysisPage    = lazy(() => import('./pages/analysis/StockAnalysisPage'));
const StockPredictionPage  = lazy(() => import('./pages/analysis/StockPredictionPage'));
const AnalysisLandingPage  = lazy(() => import('./pages/analysis/AnalysisLandingPage'));
const PredictionLandingPage = lazy(() => import('./pages/analysis/PredictionLandingPage'));
const NewsLandingPage      = lazy(() => import('./pages/content/NewsLandingPage'));
const ResearchLandingPage  = lazy(() => import('./pages/content/ResearchLandingPage'));
const ResearchReportPage   = lazy(() => import('./pages/content/ResearchReportPage'));
const ScreenerPage         = lazy(() => import('./pages/analysis/ScreenerPage'));
const ProfilePage          = lazy(() => import('./pages/auth/ProfilePage'));
const OptionsChainPage     = lazy(() => import('./pages/trading/OptionsChainPage'));

function RequireAuth() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/stocks/:ticker" element={<StockDetailPage />} />
          <Route path="/stocks/:ticker/options" element={<OptionsChainPage />} />
          <Route path="/analysis" element={<AnalysisLandingPage />} />
          <Route path="/stocks/:ticker/analysis" element={<StockAnalysisPage />} />
          <Route path="/compare" element={<StockComparisonPage />} />
          <Route path="/prediction" element={<PredictionLandingPage />} />
          <Route path="/predict/:ticker" element={<StockPredictionPage />} />
          <Route path="/news" element={<NewsLandingPage />} />
          <Route path="/research" element={<ResearchLandingPage />} />
          <Route path="/research/:id" element={<ResearchReportPage />} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/portfolios" element={<PortfolioListPage />} />
            <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
            <Route path="/portfolios/:id/trades" element={<TradeHistoryPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/groups" element={<GroupListPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/trade" element={<TradePage />} />
            <Route path="/badges" element={<BadgesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
  );
}

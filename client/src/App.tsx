import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import PageLoader from './components/ui/PageLoader';

const LoginPage            = lazy(() => import('./pages/LoginPage'));
const PortfolioListPage    = lazy(() => import('./pages/PortfolioListPage'));
const PortfolioDetailPage  = lazy(() => import('./pages/PortfolioDetailPage'));
const TradeHistoryPage     = lazy(() => import('./pages/TradeHistoryPage'));
const WatchlistPage        = lazy(() => import('./pages/WatchlistPage'));
const LeaderboardPage      = lazy(() => import('./pages/LeaderboardPage'));
const MarketPage           = lazy(() => import('./pages/MarketPage'));
const GroupListPage        = lazy(() => import('./pages/GroupListPage'));
const GroupDetailPage      = lazy(() => import('./pages/GroupDetailPage'));
const TradePage            = lazy(() => import('./pages/TradePage'));
const StockDetailPage      = lazy(() => import('./pages/StockDetailPage'));
const DashboardPage        = lazy(() => import('./pages/DashboardPage'));
const BadgesPage           = lazy(() => import('./pages/BadgesPage'));
const StockComparisonPage  = lazy(() => import('./pages/StockComparisonPage'));
const StockAnalysisPage    = lazy(() => import('./pages/StockAnalysisPage'));
const StockPredictionPage  = lazy(() => import('./pages/StockPredictionPage'));
const AnalysisLandingPage  = lazy(() => import('./pages/AnalysisLandingPage'));
const PredictionLandingPage = lazy(() => import('./pages/PredictionLandingPage'));
const NewsLandingPage      = lazy(() => import('./pages/NewsLandingPage'));
const ResearchLandingPage  = lazy(() => import('./pages/ResearchLandingPage'));
const ResearchReportPage   = lazy(() => import('./pages/ResearchReportPage'));
const ScreenerPage         = lazy(() => import('./pages/ScreenerPage'));

function RequireAuth() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/stocks/:ticker" element={<StockDetailPage />} />
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

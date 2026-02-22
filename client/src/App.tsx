import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import PortfolioListPage from './pages/PortfolioListPage';
import PortfolioDetailPage from './pages/PortfolioDetailPage';
import TradeHistoryPage from './pages/TradeHistoryPage';
import WatchlistPage from './pages/WatchlistPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MarketPage from './pages/MarketPage';
import GroupListPage from './pages/GroupListPage';
import GroupDetailPage from './pages/GroupDetailPage';
import TradePage from './pages/TradePage';
import StockDetailPage from './pages/StockDetailPage';
import DashboardPage from './pages/DashboardPage';
import BadgesPage from './pages/BadgesPage';
import StockComparisonPage from './pages/StockComparisonPage';
import StockAnalysisPage from './pages/StockAnalysisPage';
import StockPredictionPage from './pages/StockPredictionPage';
import AnalysisLandingPage from './pages/AnalysisLandingPage';
import PredictionLandingPage from './pages/PredictionLandingPage';
import NewsLandingPage from './pages/NewsLandingPage';
import ResearchLandingPage from './pages/ResearchLandingPage';
import ResearchReportPage from './pages/ResearchReportPage';

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
        <Route path="/analysis" element={<AnalysisLandingPage />} />
        <Route path="/stocks/:ticker/analysis" element={<StockAnalysisPage />} />
        <Route path="/compare" element={<StockComparisonPage />} />
        <Route path="/prediction" element={<PredictionLandingPage />} />
        <Route path="/predict/:ticker" element={<StockPredictionPage />} />
        <Route path="/news" element={<NewsLandingPage />} />
        <Route path="/research" element={<ResearchLandingPage />} />
        <Route path="/research/:id" element={<ResearchReportPage />} />
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
  );
}

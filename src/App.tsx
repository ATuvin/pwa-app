import { Suspense, useEffect, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useUserStore } from '@/store/userStore';
import Layout from './components/Layout';
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ShiftPage = lazy(() => import('./pages/ShiftPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const DailyReportPage = lazy(() => import('./pages/DailyReportPage'));
const SummaryReportsPage = lazy(() => import('./pages/SummaryReportsPage'));
const MonthlySummaryPage = lazy(() => import('./pages/MonthlySummaryPage'));
const SelectPartOperationPage = lazy(() => import('./pages/SelectPartOperationPage'));
const PeriodSummaryPage = lazy(() => import('./pages/PeriodSummaryPage'));
const MachinesPage = lazy(() => import('./pages/MachinesPage'));
const PartsPage = lazy(() => import('./pages/PartsPage'));

const theme = createTheme({
  palette: {
    primary: {
      main: '#2196F3',
    },
    secondary: {
      main: '#FF9800',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function App() {
  const { loadProfile } = useUserStore();

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="shift" element={<ShiftPage />} />
              <Route path="shift/:date" element={<ShiftPage />} />
              <Route path="machines" element={<MachinesPage />} />
              <Route path="parts" element={<PartsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/daily" element={<DailyReportPage />} />
              <Route path="reports/summary" element={<SummaryReportsPage />} />
              <Route path="reports/summary/select" element={<SelectPartOperationPage />} />
              <Route path="reports/summary/month" element={<MonthlySummaryPage />} />
              <Route path="reports/summary/period" element={<PeriodSummaryPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;


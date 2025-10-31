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
      main: '#4a90e2',
    },
    secondary: {
      main: '#e74c3c',
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
  components: {
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          position: 'relative',
          padding: '6px',
          backgroundColor: '#3a3a3a',
          borderRadius: '12px',
          border: 'none',
          boxShadow: `
            0 4px 8px rgba(0, 0, 0, 0.2),
            0 2px 4px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.2)
          `,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '3px',
            left: '3px',
            right: '3px',
            bottom: '3px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '-1px',
            left: '-1px',
            right: '-1px',
            bottom: '-1px',
            background: `
              linear-gradient(135deg, 
                rgba(255, 255, 255, 0.12) 0%, 
                rgba(0, 0, 0, 0.08) 50%,
                rgba(255, 255, 255, 0.12) 100%
              )
            `,
            borderRadius: '13px',
            zIndex: -1,
            opacity: 0.5,
          },
          '& .MuiCardContent-root': {
            backgroundColor: theme.palette.background.paper,
            borderRadius: '6px',
            padding: theme.spacing(2),
            border: '1px solid rgba(0, 0, 0, 0.05)',
          },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme, ownerState }) => {
          // Применяем стиль только к Paper с variant="outlined" или без variant (elevation=0)
          if (ownerState.variant === 'outlined' || (ownerState.elevation === undefined && ownerState.variant === undefined)) {
            return {
              position: 'relative',
              padding: '6px',
              backgroundColor: '#3a3a3a',
              borderRadius: '12px',
              border: 'none',
              boxShadow: `
                0 4px 8px rgba(0, 0, 0, 0.2),
                0 2px 4px rgba(0, 0, 0, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.1),
                inset 0 -1px 0 rgba(0, 0, 0, 0.2)
              `,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '3px',
                left: '3px',
                right: '3px',
                bottom: '3px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                pointerEvents: 'none',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '-1px',
                left: '-1px',
                right: '-1px',
                bottom: '-1px',
                background: `
                  linear-gradient(135deg, 
                    rgba(255, 255, 255, 0.12) 0%, 
                    rgba(0, 0, 0, 0.08) 50%,
                    rgba(255, 255, 255, 0.12) 100%
                  )
                `,
                borderRadius: '13px',
                zIndex: -1,
                opacity: 0.5,
              },
              '& > *:first-of-type': {
                backgroundColor: `${theme.palette.background.paper} !important`,
                borderRadius: '6px',
                position: 'relative',
                zIndex: 1,
                minHeight: '100%',
                padding: `${theme.spacing(3)} !important`,
                boxSizing: 'border-box',
              },
            };
          }
          return {};
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: ({ ownerState, theme }) => {
          const colors = {
            main: '#4a90e2',
            dark: '#357abd',
            darker: '#2968a3',
            darkest: '#1f5492',
            darkest2: '#163d7a',
            hover: { main: '#5aa0f2', light: '#4590cd', dark: '#3578b3', darker: '#2a5f9a', darkest: '#1f4782' },
            active: { main: '#357abd', light: '#2968a3', dark: '#1f5492', darker: '#163d7a', darkest: '#0d2761' },
          };

          // Цвета для неактивных кнопок (серые)
          const inactiveColors = {
            main: '#9e9e9e',
            dark: '#757575',
            darker: '#616161',
            darkest: '#424242',
            darkest2: '#212121',
            hover: { main: '#b0b0b0', light: '#9e9e9e', dark: '#757575', darker: '#616161', darkest: '#424242' },
          };

          const isSelected = ownerState.selected;
          const colorsToUse = isSelected ? colors : inactiveColors;

          return {
            background: `linear-gradient(180deg, ${colorsToUse.main} 0%, ${colorsToUse.dark} 25%, ${colorsToUse.darker} 50%, ${colorsToUse.darkest} 75%, ${colorsToUse.darkest2} 100%) !important`,
            backgroundImage: `
              radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 40%, transparent 70%),
              radial-gradient(ellipse at 50% 80%, rgba(0,0,0,0.2) 0%, transparent 60%),
              linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 20%, transparent 40%, transparent 60%, rgba(0,0,0,0.2) 80%, rgba(0,0,0,0.3) 100%),
              linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)
            `,
            color: '#fff !important',
            fontWeight: 'normal',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(255,255,255,0.2)',
            boxShadow: `
              inset 0 4px 8px rgba(255,255,255,0.6),
              inset 0 -4px 8px rgba(0,0,0,0.5),
              inset 0 2px 0 rgba(255,255,255,0.7),
              inset 0 -2px 0 rgba(0,0,0,0.6),
              0 4px 8px rgba(0,0,0,0.4),
              0 2px 4px rgba(0,0,0,0.3)
            `,
            border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.4)',
            borderLeft: '1px solid rgba(255,255,255,0.3)',
            borderBottom: '1px solid rgba(0,0,0,0.4)',
            borderRight: '1px solid rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '8px',
            transform: 'translateY(0)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: 'auto',
            padding: '8px 12px',
            margin: '0 4px',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
              transition: 'left 0.6s ease',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '5%',
              left: '15%',
              right: '15%',
              height: '40%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              borderRadius: '50%',
              pointerEvents: 'none',
            },
            '&:hover': {
              background: `linear-gradient(180deg, ${colorsToUse.hover.main} 0%, ${colorsToUse.hover.light} 25%, ${colorsToUse.hover.dark} 50%, ${colorsToUse.hover.darker} 75%, ${colorsToUse.hover.darkest} 100%) !important`,
              boxShadow: `
                inset 0 4px 8px rgba(255,255,255,0.7),
                inset 0 -4px 8px rgba(0,0,0,0.6),
                inset 0 2px 0 rgba(255,255,255,0.8),
                inset 0 -2px 0 rgba(0,0,0,0.7),
                0 6px 12px rgba(0,0,0,0.5),
                0 3px 6px rgba(0,0,0,0.4)
              `,
              transform: 'translateY(-2px)',
              color: '#fff !important',
              '&::before': {
                left: '100%',
              },
            },
            '&.Mui-selected': {
              backgroundColor: 'transparent !important',
              background: `linear-gradient(180deg, ${colors.main} 0%, ${colors.dark} 25%, ${colors.darker} 50%, ${colors.darkest} 75%, ${colors.darkest2} 100%) !important`,
            },
          };
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState, theme }) => {
          if (ownerState.variant !== 'contained') return {};
          
          const colorMap: Record<string, any> = {
            primary: {
              main: '#4a90e2',
              dark: '#357abd',
              darker: '#2968a3',
              darkest: '#1f5492',
              darkest2: '#163d7a',
              darkest3: '#0d2761',
              hover: { main: '#5aa0f2', light: '#4590cd', dark: '#3578b3', darker: '#2a5f9a', darkest: '#1f4782' },
              active: { main: '#357abd', light: '#2968a3', dark: '#1f5492', darker: '#163d7a', darkest: '#0d2761' },
            },
            secondary: {
              main: '#e74c3c',
              dark: '#c0392b',
              darker: '#a93226',
              darkest: '#922b21',
              darkest2: '#7b241c',
              darkest3: '#641e16',
              hover: { main: '#f55a4a', light: '#d54839', dark: '#b93d2e', darker: '#a03224', darkest: '#87271a' },
              active: { main: '#c0392b', light: '#a93226', dark: '#922b21', darker: '#7b241c', darkest: '#641e16' },
            },
            success: {
              main: '#27ae60',
              dark: '#219e50',
              darker: '#1b8e40',
              darkest: '#157e30',
              darkest2: '#0f6e20',
              darkest3: '#095e10',
              hover: { main: '#37be70', light: '#32ae65', dark: '#2d9e5a', darker: '#288e4f', darkest: '#237e44' },
              active: { main: '#219e50', light: '#1b8e40', dark: '#157e30', darker: '#0f6e20', darkest: '#095e10' },
            },
          };
          
          const colorKey = ownerState.color || 'primary';
          const colors = colorMap[colorKey] || colorMap.primary;
          
          return {
            background: `linear-gradient(180deg, ${colors.main} 0%, ${colors.dark} 25%, ${colors.darker} 50%, ${colors.darkest} 75%, ${colors.darkest2} 100%)`,
            backgroundImage: `
              radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 40%, transparent 70%),
              radial-gradient(ellipse at 50% 80%, rgba(0,0,0,0.2) 0%, transparent 60%),
              linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 20%, transparent 40%, transparent 60%, rgba(0,0,0,0.2) 80%, rgba(0,0,0,0.3) 100%),
              linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)
            `,
            backgroundColor: colors.dark,
            color: '#fff',
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(255,255,255,0.2)',
            boxShadow: `
              inset 0 4px 8px rgba(255,255,255,0.6),
              inset 0 -4px 8px rgba(0,0,0,0.5),
              inset 0 2px 0 rgba(255,255,255,0.7),
              inset 0 -2px 0 rgba(0,0,0,0.6),
              0 6px 12px rgba(0,0,0,0.6),
              0 3px 6px rgba(0,0,0,0.4),
              0 1px 3px rgba(0,0,0,0.3)
            `,
            border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.4)',
            borderLeft: '1px solid rgba(255,255,255,0.3)',
            borderBottom: '1px solid rgba(0,0,0,0.4)',
            borderRight: '1px solid rgba(0,0,0,0.3)',
            padding: '14px 28px',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '6px',
            transform: 'translateY(0)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
              transition: 'left 0.6s ease',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '5%',
              left: '15%',
              right: '15%',
              height: '40%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              borderRadius: '50%',
              pointerEvents: 'none',
            },
            '&:hover': {
              background: `linear-gradient(180deg, ${colors.hover.main} 0%, ${colors.hover.light} 25%, ${colors.hover.dark} 50%, ${colors.hover.darker} 75%, ${colors.hover.darkest} 100%)`,
              boxShadow: `
                inset 0 4px 8px rgba(255,255,255,0.7),
                inset 0 -4px 8px rgba(0,0,0,0.6),
                inset 0 2px 0 rgba(255,255,255,0.8),
                inset 0 -2px 0 rgba(0,0,0,0.7),
                0 8px 16px rgba(0,0,0,0.7),
                0 4px 8px rgba(0,0,0,0.5),
                0 2px 4px rgba(0,0,0,0.4)
              `,
              transform: 'translateY(-2px)',
              '&::before': {
                left: '100%',
              },
            },
            '&:active': {
              transform: 'translateY(1px)',
              boxShadow: `
                inset 0 6px 12px rgba(0,0,0,0.7),
                inset 0 3px 6px rgba(0,0,0,0.6),
                inset 0 -2px 4px rgba(255,255,255,0.3),
                0 2px 4px rgba(0,0,0,0.5),
                0 1px 2px rgba(0,0,0,0.4)
              `,
              background: `linear-gradient(180deg, ${colors.active.main} 0%, ${colors.active.light} 25%, ${colors.active.dark} 50%, ${colors.active.darker} 75%, ${colors.active.darkest} 100%)`,
            },
          };
        },
      },
    },
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
        basename="/pwa-app"
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


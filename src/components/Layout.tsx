import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Paper,
} from '@mui/material';
import {
  Home,
  Work,
  Assessment,
  Settings,
} from '@mui/icons-material';
import { useUserStore } from '@/store/userStore';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUserStore();

  const navigationItems = [
    { label: 'Главная', icon: <Home />, path: '/' },
    { label: 'Смена', icon: <Work />, path: '/shift' },
    { label: 'Отчеты', icon: <Assessment />, path: '/reports' },
    { label: 'Настройки', icon: <Settings />, path: '/machines' },
  ];

  // Определяем активную вкладку на основе текущего пути
  const currentIndex = navigationItems.findIndex(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );
  const value = currentIndex >= 0 ? currentIndex : 0;

  const handleNavigation = (_event: React.SyntheticEvent, newValue: number) => {
    navigate(navigationItems[newValue].path);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Смена+ v0.5 b
          </Typography>
          {profile && (
            <Typography variant="body2">
              {profile.fullName}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          pb: 10, // Отступ для нижней навигации
        }}
      >
        <Outlet />
      </Box>

      <Paper
        sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}
        elevation={3}
      >
        <BottomNavigation
          value={value}
          onChange={handleNavigation}
          showLabels
        >
          {navigationItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}


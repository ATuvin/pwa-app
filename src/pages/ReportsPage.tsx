import { Container, Typography, Box, Button, Stack, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm">
      <Typography variant="h4" component="h1" gutterBottom>
        Отчеты
      </Typography>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Button variant="contained" size="large" onClick={() => navigate('/reports/daily')}>
            Отчет за день
          </Button>
          <Button variant="outlined" size="large" onClick={() => navigate('/reports/summary')}>
            Сводные отчеты
          </Button>
        </Stack>
      </Paper>
      <Box sx={{ mt: 2 }} />
    </Container>
  );
}


import { Container, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function SummaryReportsPage() {
  const navigate = useNavigate();
  const [chooseOpen, setChooseOpen] = useState(false);
  const [mode, setMode] = useState<'jobs' | 'machines' | 'allParts'>('jobs');
  const openChooser = () => setChooseOpen(true);
  const closeChooser = () => setChooseOpen(false);
  return (
    <Container maxWidth="sm">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography variant="h5" component="h1">
          Сводные отчеты
        </Typography>
        <Button size="small" onClick={() => navigate(-1)}>Закрыть</Button>
      </div>
      {/* Фрейм с кнопками */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1} alignItems="center">
          <Button variant="outlined" size="large" sx={{ width: 240, height: 48 }} onClick={() => { setMode('jobs'); openChooser(); }}>Наряды</Button>
          <Button variant="outlined" size="large" sx={{ width: 240, height: 48 }} onClick={() => { setMode('machines'); openChooser(); }}>Станки</Button>
          <Button variant="outlined" size="large" sx={{ width: 240, height: 48 }} onClick={() => { setMode('allParts'); openChooser(); }}>Все детали</Button>
          <Button variant="outlined" size="large" sx={{ width: 240, height: 48 }} onClick={() => navigate('/reports/summary/select')}>Выбранные детали</Button>
        </Stack>
      </Paper>

      <Dialog open={chooseOpen} onClose={closeChooser} maxWidth="xs" fullWidth>
        <DialogTitle>Сформировать отчет</DialogTitle>
        <DialogContent>
          Выберите тип сводного отчета
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { closeChooser(); navigate(`/reports/summary/period?mode=${mode}`); }}>За период</Button>
          <Button variant="contained" onClick={() => { closeChooser(); navigate(`/reports/summary/month?mode=${mode}`); }}>За месяц</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}



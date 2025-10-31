import { Container, Typography, Paper, Button, Stack, TextField } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { format } from 'date-fns';
import { useUserStore } from '@/store/userStore';
import { exportJobsSummary, exportMachinesSummary, exportAllDetailsSummary, exportSelectedDetailsSummary } from '@/utils/reports';

export default function PeriodSummaryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as 'jobs' | 'machines' | 'allParts' | 'selected') || 'jobs';
  const partId = searchParams.get('partId') || undefined;
  const opId = searchParams.get('opId') || undefined;
  const today = new Date();
  const [startDate, setStartDate] = useState<string>(format(today, 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState<string>(format(today, 'yyyy-MM-dd'));
  const { profile } = useUserStore();
  return (
    <Container maxWidth="md">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography variant="h5" component="h1">
          Отчет за выбранный период
        </Typography>
        <Button size="small" onClick={() => navigate(-1)}>Закрыть</Button>
      </div>
      <Paper variant="outlined">
        <Stack spacing={2} maxWidth={420}>
          <TextField
            label="Дата начала"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Дата окончания"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            onClick={() => {
              const s = new Date(startDate).toISOString();
              const e = new Date(endDate).toISOString();
              if (mode === 'machines') {
                exportMachinesSummary(s, e, profile?.shiftNumber || 1);
              } else if (mode === 'allParts') {
                exportAllDetailsSummary(s, e, profile?.shiftNumber || 1);
              } else if (mode === 'selected' && partId && opId) {
                exportSelectedDetailsSummary(s, e, profile?.shiftNumber || 1, partId, opId);
              } else {
                exportJobsSummary(s, e, profile?.shiftNumber || 1);
              }
            }}
          >
            Сформировать отчет
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}



import { Container, Typography, Paper, Button, Stack, TextField } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useUserStore } from '@/store/userStore';
import { exportJobsSummary, exportMachinesSummary, exportAllDetailsSummary, exportSelectedDetailsSummary } from '@/utils/reports';

export default function MonthlySummaryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as 'jobs' | 'machines' | 'allParts' | 'selected') || 'jobs';
  const partId = searchParams.get('partId') || undefined;
  const opId = searchParams.get('opId') || undefined;
  const [month, setMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const { profile } = useUserStore();
  return (
    <Container maxWidth="md">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography variant="h5" component="h1">
          Отчет за месяц
        </Typography>
        <Button size="small" onClick={() => navigate(-1)}>Закрыть</Button>
      </div>
      <Paper variant="outlined">
        <Stack spacing={2} maxWidth={360}>
          <TextField
            label="Месяц"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            onClick={() => {
              const first = startOfMonth(new Date(`${month}-01`));
              const last = endOfMonth(new Date(`${month}-01`));
              if (mode === 'machines') {
                exportMachinesSummary(first.toISOString(), last.toISOString(), profile?.shiftNumber || 1);
              } else if (mode === 'allParts') {
                exportAllDetailsSummary(first.toISOString(), last.toISOString(), profile?.shiftNumber || 1);
              } else if (mode === 'selected' && partId && opId) {
                exportSelectedDetailsSummary(first.toISOString(), last.toISOString(), profile?.shiftNumber || 1, partId, opId);
              } else {
                exportJobsSummary(first.toISOString(), last.toISOString(), profile?.shiftNumber || 1);
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



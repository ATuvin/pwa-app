import { useEffect, useMemo, useState } from 'react';
import { useNavigate, createSearchParams } from 'react-router-dom';
import { Container, Typography, Paper, Box, Button, FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import { db } from '@/services/database';

export default function SelectPartOperationPage() {
  const navigate = useNavigate();
  const [parts, setParts] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [operations, setOperations] = useState<Array<{ id: string; name: string; partId: string }>>([]);
  const [partId, setPartId] = useState<string>('');
  const [opId, setOpId] = useState<string>('');

  useEffect(() => {
    (async () => {
      const [p, o] = await Promise.all([db.parts.toArray(), db.operations.toArray()]);
      setParts(p.map(x => ({ id: String(x.id), name: x.name, description: x.description || '' })));
      setOperations(o.map(x => ({ id: String(x.id), name: x.name, partId: String(x.partId) })));
    })();
  }, []);

  const opsForPart = useMemo(() => operations.filter(o => o.partId === partId), [operations, partId]);

  const disabled = !partId || !opId;

  return (
    <Container maxWidth="md">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography variant="h5" component="h1">
          Выбор детали и операции
        </Typography>
        <Button size="small" onClick={() => navigate(-1)}>Закрыть</Button>
      </div>
      <Paper variant="outlined">
        <Stack spacing={2} sx={{ p: 3, maxWidth: 360 }}>
          <FormControl fullWidth>
            <InputLabel id="part-label">Деталь</InputLabel>
            <Select labelId="part-label" label="Деталь" value={partId} onChange={e => { setPartId(String(e.target.value)); setOpId(''); }}>
              {parts.map(p => (
                <MenuItem key={p.id} value={p.id}>{`${p.description} — ${p.name}`}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={!partId}>
            <InputLabel id="op-label">Операция</InputLabel>
            <Select labelId="op-label" label="Операция" value={opId} onChange={e => setOpId(String(e.target.value))}>
              {opsForPart.map(o => (
                <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box display="flex" gap={2} width="100%">
            <Button variant="contained" disabled={disabled} onClick={() => navigate({ pathname: '/reports/summary/month', search: `?${createSearchParams({ mode: 'selected', partId, opId })}` })}>За месяц</Button>
            <Button variant="contained" disabled={disabled} onClick={() => navigate({ pathname: '/reports/summary/period', search: `?${createSearchParams({ mode: 'selected', partId, opId })}` })}>За период</Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}


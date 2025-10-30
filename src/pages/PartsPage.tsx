import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Card,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { db } from '@/services/database';
import type { Part, Operation } from '@/models';

export default function PartsPage() {
  const [tab, setTab] = useState(0);
  const [parts, setParts] = useState<Part[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [openPart, setOpenPart] = useState(false);
  const [openOperation, setOpenOperation] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [partForm, setPartForm] = useState({ name: '', description: '' });
  const [operationForm, setOperationForm] = useState({
    name: '',
    partId: 0,
    machineTime: 0,
    additionalTime: 0,
  });

  useEffect(() => {
    loadParts();
    loadOperations();
  }, []);

  const loadParts = async () => {
    const allParts = await db.parts.toArray();
    const sorted = [...allParts].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    setParts(sorted);
  };

  const loadOperations = async () => {
    const allOperations = await db.operations.toArray();
    const sorted = [...allOperations].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    setOperations(sorted);
  };

  const handleOpenPart = (part?: Part) => {
    if (part) {
      setEditingPart(part);
      setPartForm({
        name: part.name,
        description: part.description || '',
      });
    } else {
      setEditingPart(null);
      setPartForm({ name: '', description: '' });
    }
    setOpenPart(true);
  };

  const handleSavePart = async () => {
    if (editingPart?.id) {
      await db.parts.update(editingPart.id, partForm);
    } else {
      await db.parts.add(partForm);
    }
    await loadParts();
    setOpenPart(false);
  };

  const handleDeletePart = async (id: number) => {
    if (confirm('Вы уверены, что хотите удалить эту деталь?')) {
      await db.parts.delete(id);
      await loadParts();
    }
  };

  const handleOpenOperation = (operation?: Operation) => {
    if (operation) {
      setEditingOperation(operation);
      setOperationForm({
        name: operation.name,
        partId: operation.partId,
        machineTime: operation.machineTime,
        additionalTime: operation.additionalTime,
      });
    } else {
      setEditingOperation(null);
      setOperationForm({
        name: '',
        partId: parts.length > 0 ? parts[0].id || 0 : 0,
        machineTime: 0,
        additionalTime: 0,
      });
    }
    setOpenOperation(true);
  };

  const handleSaveOperation = async () => {
    if (editingOperation?.id) {
      await db.operations.update(editingOperation.id, operationForm);
    } else {
      // Приводим тип к Operation без дополнительных полей
      const newOperation: Operation = {
        name: operationForm.name,
        partId: operationForm.partId,
        machineTime: operationForm.machineTime,
        additionalTime: operationForm.additionalTime,
      } as Operation;
      await db.operations.add(newOperation);
    }
    await loadOperations();
    setOpenOperation(false);
  };

  const handleDeleteOperation = async (id: number) => {
    if (confirm('Вы уверены, что хотите удалить эту операцию?')) {
      await db.operations.delete(id);
      await loadOperations();
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        Детали и операции
      </Typography>

      <Card>
        <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)}>
          <Tab label="Детали" />
          <Tab label="Операции" />
        </Tabs>

        {tab === 0 && (
          <Box p={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Детали</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenPart()}
              >
                Добавить деталь
              </Button>
            </Box>

            {parts.length === 0 ? (
              <Alert severity="info">Пока нет добавленных деталей</Alert>
            ) : (
              <List>
                {parts.map((part) => (
                  <ListItem
                    key={part.id}
                    secondaryAction={
                      <Box>
                        <IconButton
                          edge="end"
                          onClick={() => handleOpenPart(part)}
                          sx={{ mr: 1 }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeletePart(part.id!)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={part.name}
                      secondary={part.description || 'Нет описания'}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {tab === 1 && (
          <Box p={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Операции</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenOperation()}
                disabled={parts.length === 0}
              >
                Добавить операцию
              </Button>
            </Box>

            {parts.length === 0 ? (
              <Alert severity="warning">
                Сначала добавьте детали, чтобы создать операции
              </Alert>
            ) : operations.length === 0 ? (
              <Alert severity="info">Пока нет добавленных операций</Alert>
            ) : (
              <List>
                {operations.map((operation) => {
                  const part = parts.find((p) => p.id === operation.partId);
                  return (
                    <ListItem
                      key={operation.id}
                      secondaryAction={
                        <Box>
                          <IconButton
                            edge="end"
                            onClick={() => handleOpenOperation(operation)}
                            sx={{ mr: 1 }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteOperation(operation.id!)}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={operation.name}
                        secondary={
                          operation.description
                            ? `${operation.description} | Деталь: ${part?.name || 'Неизвестно'} | Машинное время: ${operation.machineTime}ч | Доп. время: ${operation.additionalTime}ч`
                            : `Деталь: ${part?.name || 'Неизвестно'} | Машинное время: ${operation.machineTime}ч | Доп. время: ${operation.additionalTime}ч`
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        )}
      </Card>

      {/* Диалог детали */}
      <Dialog open={openPart} onClose={() => setOpenPart(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPart ? 'Редактировать деталь' : 'Добавить деталь'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название"
                value={partForm.name}
                onChange={(e) => setPartForm({ ...partForm, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={partForm.description}
                onChange={(e) =>
                  setPartForm({ ...partForm, description: e.target.value })
                }
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPart(false)}>Отмена</Button>
          <Button
            onClick={handleSavePart}
            variant="contained"
            disabled={!partForm.name}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог операции */}
      <Dialog
        open={openOperation}
        onClose={() => setOpenOperation(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingOperation ? 'Редактировать операцию' : 'Добавить операцию'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название"
                value={operationForm.name}
                onChange={(e) =>
                  setOperationForm({ ...operationForm, name: e.target.value })
                }
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Деталь"
                value={operationForm.partId || ''}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    partId: Number(e.target.value) || 0,
                  })
                }
                required
                error={operationForm.partId === 0}
                InputLabelProps={{
                  htmlFor: 'operation-part-select',
                }}
                SelectProps={{
                  id: 'operation-part-select',
                }}
              >
                {parts.map((part) => (
                  <MenuItem key={part.id} value={part.id || ''}>
                    {part.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Машинное время (ч)"
                value={operationForm.machineTime || ''}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    machineTime: Number(e.target.value) || 0,
                  })
                }
                inputProps={{ min: 0, step: 0.1 }}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Доп. время (ч)"
                value={operationForm.additionalTime || ''}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    additionalTime: Number(e.target.value) || 0,
                  })
                }
                inputProps={{ min: 0, step: 0.1 }}
                required
              />
            </Grid>
            {/* Поле описания операции отсутствует в модели Operation и убрано */}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenOperation(false)}>Отмена</Button>
          <Button
            onClick={handleSaveOperation}
            variant="contained"
            disabled={!operationForm.name || operationForm.partId === 0}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}


import { useState, useEffect, useRef } from 'react';
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
  CardContent,
  Tabs,
  Tab,
  Divider,
  Collapse,
} from '@mui/material';
import { Add, Edit, Delete, Save } from '@mui/icons-material';
import { db } from '@/services/database';
import { useUserStore } from '@/store/userStore';
import type { Machine, MachineType, ShiftNumber, Part, Operation } from '@/models';

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [open, setOpen] = useState(false);
  const [openPart, setOpenPart] = useState(false);
  const [openOperation, setOpenOperation] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [currentPartForOperations, setCurrentPartForOperations] = useState<Part | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'lathe' as MachineType,
  });
  const [partForm, setPartForm] = useState({ name: '', description: '' });
  const [operationForm, setOperationForm] = useState({
    name: '',
    partId: 0,
    operationType: 'lathe' as MachineType,
    machineTime: 0, // В минутах для ввода
    additionalTime: 0, // В минутах для ввода
    description: '',
  });
  const [tabValue, setTabValue] = useState(0);
  const [showMilling, setShowMilling] = useState(false);
  const [showLathe, setShowLathe] = useState(false);
  const { profile, saveProfile, isLoading } = useUserStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profileFormData, setProfileFormData] = useState({
    fullName: '',
    shiftNumber: 1 as ShiftNumber,
    baseCoefficient: 480, // 8 часов = 480 минут
  });

  useEffect(() => {
    loadMachines();
    loadParts();
    loadOperations();
  }, []);

  useEffect(() => {
    if (profile) {
      setProfileFormData({
        fullName: profile.fullName,
        shiftNumber: profile.shiftNumber,
        baseCoefficient: profile.baseCoefficient,
      });
    }
  }, [profile]);

  const loadMachines = async () => {
    const allMachines = await db.machines.toArray();
    // Сортировка по алфавиту (без учета регистра)
    const sorted = [...allMachines].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    setMachines(sorted);
  };

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

  const handleOpen = (machine?: Machine) => {
    if (machine) {
      setEditingMachine(machine);
      setFormData({
        name: machine.name,
        type: machine.type,
      });
    } else {
      setEditingMachine(null);
      setFormData({
        name: '',
        type: 'lathe',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingMachine(null);
  };

  const handleSave = async () => {
    if (editingMachine?.id) {
      await db.machines.update(editingMachine.id, formData);
    } else {
      await db.machines.add(formData);
    }
    await loadMachines();
    handleClose();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Вы уверены, что хотите удалить этот станок?')) {
      await db.machines.delete(id);
      await loadMachines();
    }
  };

  const handleOpenPart = (part?: Part) => {
    if (part) {
      setEditingPart(part);
      setCurrentPartForOperations(part);
      setPartForm({
        name: part.name,
        description: part.description || '',
      });
    } else {
      setEditingPart(null);
      setCurrentPartForOperations(null);
      setPartForm({ name: '', description: '' });
    }
    setOpenPart(true);
  };

  const handleClosePart = () => {
    setOpenPart(false);
    setEditingPart(null);
    setCurrentPartForOperations(null);
  };

  const handleSavePart = async () => {
    if (editingPart?.id) {
      await db.parts.update(editingPart.id, partForm);
      await loadParts();
    } else {
      await db.parts.add(partForm);
      await loadParts();
    }
    // Закрываем диалог после сохранения
    handleClosePart();
  };

  const handleDeletePart = async (id: number) => {
    if (confirm('Вы уверены, что хотите удалить эту деталь? Все связанные операции также будут удалены.')) {
      // Удаляем связанные операции
      const relatedOperations = await db.operations.where('partId').equals(id).toArray();
      for (const op of relatedOperations) {
        if (op.id) {
          await db.operations.delete(op.id);
        }
      }
      await db.parts.delete(id);
      await loadParts();
      await loadOperations();
    }
  };

  const handleOpenOperation = (operation?: Operation, partId?: number) => {
    // Avoid keeping focus inside an element that will become aria-hidden
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') {
      active.blur();
    }
    if (operation) {
      setEditingOperation(operation);
      setOperationForm({
        name: operation.name,
        partId: operation.partId,
        operationType: operation.operationType || 'lathe',
        machineTime: operation.machineTime,
        additionalTime: operation.additionalTime,
        description: operation.description || '',
      });
    } else {
      setEditingOperation(null);
      setOperationForm({
        name: '',
        partId: partId || (parts.length > 0 ? parts[0].id || 0 : 0),
        operationType: 'lathe',
        machineTime: 0,
        additionalTime: 0,
        description: '',
      });
    }
    setOpenOperation(true);
  };

  const handleCloseOperation = () => {
    setOpenOperation(false);
    setEditingOperation(null);
  };

  const handleSaveOperation = async () => {
    const operationData = {
      ...operationForm,
      machineTime: operationForm.machineTime,
      additionalTime: operationForm.additionalTime,
    };
    if (editingOperation?.id) {
      await db.operations.update(editingOperation.id, operationData);
    } else {
      await db.operations.add(operationData);
    }
    await loadOperations();
    handleCloseOperation();
    // Обновление будет видно автоматически, так как мы используем operations из state
  };

  const handleDeleteOperation = async (id: number) => {
    if (confirm('Вы уверены, что хотите удалить эту операцию?')) {
      await db.operations.delete(id);
      await loadOperations();
    }
  };

  const handleProfileChange = (field: string, value: string | number) => {
    setProfileFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfile({
      ...profileFormData,
      baseCoefficient: profileFormData.baseCoefficient,
      id: profile?.id,
    });
  };

  const handleExportData = async () => {
    const [profiles, machinesExport, partsExport, operationsExport, workShifts, monthlyReports, periodReports] = await Promise.all([
      db.profiles.toArray(),
      db.machines.toArray(),
      db.parts.toArray(),
      db.operations.toArray(),
      db.workShifts.toArray(),
      db.monthlyReports.toArray(),
      db.periodReports.toArray(),
    ]);

    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      profiles,
      machines: machinesExport,
      parts: partsExport,
      operations: operationsExport,
      workShifts,
      monthlyReports,
      periodReports,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-app-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data: {
        version?: number;
        profiles?: any[];
        machines?: any[];
        parts?: any[];
        operations?: any[];
        workShifts?: any[];
        monthlyReports?: any[];
        periodReports?: any[];
      } = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('Некорректный файл');

      const confirmClear = confirm('Импорт заменит текущие данные. Продолжить?');
      if (!confirmClear) return;

      await db.transaction('rw', [db.profiles, db.machines, db.parts, db.operations, db.workShifts, db.monthlyReports, db.periodReports], async () => {
        await Promise.all([
          db.profiles.clear(),
          db.machines.clear(),
          db.parts.clear(),
          db.operations.clear(),
          db.workShifts.clear(),
          db.monthlyReports.clear(),
          db.periodReports.clear(),
        ]);

        if (Array.isArray(data.profiles) && data.profiles.length) await db.profiles.bulkAdd(data.profiles);
        if (Array.isArray(data.machines) && data.machines.length) await db.machines.bulkAdd(data.machines);
        if (Array.isArray(data.parts) && data.parts.length) await db.parts.bulkAdd(data.parts);
        if (Array.isArray(data.operations) && data.operations.length) await db.operations.bulkAdd(data.operations);
        if (Array.isArray(data.workShifts) && data.workShifts.length) await db.workShifts.bulkAdd(data.workShifts);
        if (Array.isArray(data.monthlyReports) && data.monthlyReports.length) await db.monthlyReports.bulkAdd(data.monthlyReports);
        if (Array.isArray(data.periodReports) && data.periodReports.length) await db.periodReports.bulkAdd(data.periodReports);
      });

      await Promise.all([loadMachines(), loadParts(), loadOperations()]);
      alert('Импорт успешно выполнен');
    } catch (err) {
      console.error(err);
      alert('Не удалось импортировать данные. Проверьте файл.');
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        Настройки
      </Typography>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label="Профиль" />
        <Tab label="Станки" />
        <Tab label="Детали" />
      </Tabs>

      {tabValue === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Профиль пользователя
            </Typography>
            <form onSubmit={handleProfileSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="ФИО"
                    value={profileFormData.fullName}
                    onChange={(e) => handleProfileChange('fullName', e.target.value)}
                    required
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Номер смены"
                    value={profileFormData.shiftNumber}
                    onChange={(e) =>
                      handleProfileChange('shiftNumber', Number(e.target.value) as ShiftNumber)
                    }
                    required
                    InputLabelProps={{
                      htmlFor: 'shift-number-select',
                    }}
                    SelectProps={{
                      id: 'shift-number-select',
                    }}
                  >
                    <MenuItem value={1}>Смена 1</MenuItem>
                    <MenuItem value={2}>Смена 2</MenuItem>
                    <MenuItem value={3}>Смена 3</MenuItem>
                    <MenuItem value={4}>Смена 4</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Базовое время (минуты)"
                    value={profileFormData.baseCoefficient}
                    onChange={(e) =>
                      handleProfileChange('baseCoefficient', Number(e.target.value))
                    }
                    inputProps={{ min: 60, step: 1 }}
                    required
                    helperText="Базовое время для расчета коэффициента выработки"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" justifyContent="flex-end" gap={2}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<Save />}
                      disabled={isLoading}
                    >
                      Сохранить
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>

            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" component="h3" gutterBottom>
                Импорт/Экспорт данных
              </Typography>
              <Box display="flex" gap={2}>
                <Button variant="outlined" onClick={handleExportData}>
                  Экспортировать JSON
                </Button>
                <Button variant="outlined" color="secondary" onClick={triggerImport}>
                  Импортировать JSON
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={handleImportFileChange}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {tabValue === 1 && (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h2">
              Станки
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpen()}
            >
              Добавить станок
            </Button>
          </Box>

          {machines.length === 0 ? (
            <Alert severity="info">Пока нет добавленных станков</Alert>
          ) : (
            <>
              <Box display="flex" gap={2} mb={2}>
                <Button variant="outlined" onClick={() => setShowMilling(!showMilling)}>
                  Фрезерные
                </Button>
                <Button variant="outlined" onClick={() => setShowLathe(!showLathe)}>
                  Токарные
                </Button>
              </Box>

              <Collapse in={showMilling} unmountOnExit>
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Фрезерные
                    </Typography>
                    <List>
                      {machines
                        .filter((m) => m.type === 'milling')
                        .map((machine) => (
                          <ListItem
                            key={machine.id}
                            secondaryAction={
                              <Box>
                                <IconButton
                                  edge="end"
                                  onClick={() => handleOpen(machine)}
                                  sx={{ mr: 1 }}
                                >
                                  <Edit />
                                </IconButton>
                                <IconButton
                                  edge="end"
                                  onClick={() => handleDelete(machine.id!)}
                                >
                                  <Delete />
                                </IconButton>
                              </Box>
                            }
                          >
                            <ListItemText primary={machine.name} secondary={'Фрезерный'} />
                          </ListItem>
                        ))}
                    </List>
                  </CardContent>
                </Card>
              </Collapse>

              <Collapse in={showLathe} unmountOnExit>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Токарные
                    </Typography>
                    <List>
                      {machines
                        .filter((m) => m.type === 'lathe')
                        .map((machine) => (
                          <ListItem
                            key={machine.id}
                            secondaryAction={
                              <Box>
                                <IconButton
                                  edge="end"
                                  onClick={() => handleOpen(machine)}
                                  sx={{ mr: 1 }}
                                >
                                  <Edit />
                                </IconButton>
                                <IconButton
                                  edge="end"
                                  onClick={() => handleDelete(machine.id!)}
                                >
                                  <Delete />
                                </IconButton>
                              </Box>
                            }
                          >
                            <ListItemText primary={machine.name} secondary={'Токарный'} />
                          </ListItem>
                        ))}
                    </List>
                  </CardContent>
                </Card>
              </Collapse>
            </>
          )}
        </>
      )}

      {tabValue === 2 && (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h2">
              Детали и операции
            </Typography>
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
            <Box>
              {parts.map((part) => {
                const partOperations = operations.filter((op) => op.partId === part.id);
                return (
                  <Card key={part.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box flex={1}>
                          <Typography variant="h6" component="h3">
                            {part.name}
                          </Typography>
                          {part.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {part.description}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Операций: {partOperations.length}
                          </Typography>
                        </Box>
                        <Box>
                          <IconButton
                            onClick={() => handleOpenPart(part)}
                            sx={{ mr: 1 }}
                            size="small"
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeletePart(part.id!)}
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingMachine ? 'Редактировать станок' : 'Добавить станок'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Тип"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as MachineType })
                }
                required
                InputLabelProps={{
                  htmlFor: 'machine-type-select',
                }}
                SelectProps={{
                  id: 'machine-type-select',
                }}
              >
                <MenuItem value="lathe">Токарный</MenuItem>
                <MenuItem value="milling">Фрезерный</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Отмена</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.name}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог детали */}
      <Dialog open={openPart} onClose={handleClosePart} maxWidth="md" fullWidth>
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

          {editingPart && currentPartForOperations && (
            <Box sx={{ mt: 4 }}>
              <Divider sx={{ mb: 2 }} />
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Операции
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => {
                    const active = document.activeElement as HTMLElement | null;
                    if (active && typeof active.blur === 'function') {
                      active.blur();
                    }
                    setOperationForm({
                      name: '',
                      partId: currentPartForOperations.id || 0,
                      operationType: 'lathe',
                      machineTime: 0,
                      additionalTime: 0,
                      description: '',
                    });
                    setEditingOperation(null);
                    setOpenOperation(true);
                  }}
                >
                  Добавить операцию
                </Button>
              </Box>

              {(() => {
                const partOperations = operations.filter(
                  (op) => op.partId === currentPartForOperations.id
                );
                return partOperations.length === 0 ? (
                  <Alert severity="info">Нет операций для этой детали</Alert>
                ) : (
                  <List>
                    {partOperations.map((operation) => (
                      <ListItem
                        key={operation.id}
                        secondaryAction={
                          <Box>
                            <IconButton
                              edge="end"
                              onClick={() => handleOpenOperation(operation)}
                              sx={{ mr: 0.5 }}
                              size="small"
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              edge="end"
                              onClick={() => handleDeleteOperation(operation.id!)}
                              size="small"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={operation.name}
                          secondary={
                            `Тип: ${operation.operationType === 'lathe' ? 'Токарная' : 'Фрезерная'} | Машинное: ${operation.machineTime} мин | Доп.: ${operation.additionalTime} мин | Время операции: ${operation.machineTime + operation.additionalTime} мин${operation.description ? ` | ${operation.description}` : ''}`
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePart}>Отмена</Button>
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
        onClose={handleCloseOperation}
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
                label="Название/номер"
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
                label="Тип операции"
                value={operationForm.operationType}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    operationType: e.target.value as MachineType,
                  })
                }
                required
              >
                <MenuItem value="lathe">Токарная</MenuItem>
                <MenuItem value="milling">Фрезерная</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={operationForm.description}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    description: e.target.value,
                  })
                }
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Машинное время (мин)"
                value={operationForm.machineTime || ''}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    machineTime: Number(e.target.value) || 0,
                  })
                }
                inputProps={{ min: 0, step: 1 }}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Доп. время (мин)"
                value={operationForm.additionalTime || ''}
                onChange={(e) =>
                  setOperationForm({
                    ...operationForm,
                    additionalTime: Number(e.target.value) || 0,
                  })
                }
                inputProps={{ min: 0, step: 1 }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Время операции"
                value={`${operationForm.machineTime + operationForm.additionalTime} мин`}
                InputProps={{
                  readOnly: true,
                }}
                helperText="Машинное время + Дополнительное время"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOperation}>Отмена</Button>
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


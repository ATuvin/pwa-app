import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Alert,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { useUserStore } from '@/store/userStore';
import { db } from '@/services/database';
import type { Machine, Part, Operation, CompletedOperation, WorkShift, ShiftType, MachineType } from '@/models';
import { getShiftTypeForDate } from '@/utils/calendar';
import { calculateShiftCoefficient } from '@/utils/calculations';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function ShiftPage() {
  const { profile } = useUserStore();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [machines, setMachines] = useState<Machine[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [completedOperations, setCompletedOperations] = useState<CompletedOperation[]>([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overtimeDialogOpen, setOvertimeDialogOpen] = useState(false);
  const [filledDates, setFilledDates] = useState<Set<string>>(new Set());
  const [currentShiftId, setCurrentShiftId] = useState<number | undefined>(undefined);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [coefficient, setCoefficient] = useState<number>(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [operationMode, setOperationMode] = useState<MachineType | null>(null);
  
  const [newOperation, setNewOperation] = useState({
    machineId: 0,
    partId: 0,
    operationId: 0,
    quantity: 0,
    machineTime: 0,
    additionalTime: 0,
    isSetup: false,
  });


  useEffect(() => {
    loadData();
    loadAllFilledDates();
  }, []);

  // Синхронизируем календарь с выбранной датой
  useEffect(() => {
    const selected = new Date(selectedDate);
    setCalendarDate(selected);
  }, [selectedDate]);

  // Загружаем сохраненную смену при изменении даты
  useEffect(() => {
    loadSavedShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, profile]);

  // Рассчитываем коэффициент при изменении операций
  useEffect(() => {
    calculateCoefficient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedOperations, profile]);

  const handleOpenDialog = (index: number | null = null, mode?: MachineType) => {
    // Если редактирование - сразу открываем диалог
    if (index !== null && completedOperations[index]) {
      const op = completedOperations[index];
      const opMeta = operations.find(o => o.id === op.operationId);
      setNewOperation({
        machineId: op.machineId,
        partId: opMeta?.partId || 0,
        operationId: op.operationId,
        quantity: op.isSetup ? 1 : op.quantity,
        machineTime: op.isSetup && typeof op.actualTime === 'number' ? op.actualTime : (opMeta ? opMeta.machineTime : 0),
        additionalTime: op.isSetup && typeof op.actualTime === 'number' ? 0 : (opMeta ? opMeta.additionalTime : 0),
        isSetup: !!op.isSetup,
      });
      setEditingIndex(index);
      // Режим определяем по типу станка текущей операции
      const machineForEdit = machines.find((m) => m.id === op.machineId);
      setOperationMode(machineForEdit?.type || null);
      setDialogOpen(true);
      return;
    }

    // Устанавливаем режим при добавлении новой операции
    setOperationMode(mode || null);

    // Проверяем, не является ли дата будущей
    const shiftDate = new Date(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    shiftDate.setHours(0, 0, 0, 0);

    if (shiftDate > today) {
      alert('Нельзя добавлять данные на будущие даты');
      return;
    }

    // Если добавление новой операции - проверяем выходной день
    if (profile) {
      const shiftType = getShiftTypeForDate(shiftDate, profile.shiftNumber);

      if (shiftType === 'dayoff' && !isOvertime) {
        // Спрашиваем о подработке перед открытием диалога
        setOvertimeDialogOpen(true);
        return;
      }
    }

    // Открываем диалог для добавления операции
    setNewOperation({
      machineId: 0,
      partId: 0,
      operationId: 0,
      quantity: 0,
      machineTime: 0,
      additionalTime: 0,
      isSetup: false,
    });
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingIndex(null);
    setOperationMode(null);
  };

  const handleMachineChange = (machineId: number) => {
    setNewOperation({
      ...newOperation,
      machineId: machineId || 0,
      partId: 0,
      operationId: 0,
      quantity: 0,
      machineTime: 0,
      additionalTime: 0,
      isSetup: false,
    });
  };

  const handlePartChange = (partId: number) => {
    setNewOperation({
      ...newOperation,
      partId: partId || 0,
      operationId: 0,
      quantity: 0,
      machineTime: 0,
      additionalTime: 0,
      isSetup: false,
    });
  };

  const loadData = async () => {
    const [allMachines, allParts, allOperations] = await Promise.all([
      db.machines.toArray(),
      db.parts.toArray(),
      db.operations.toArray(),
    ]);
    setMachines(allMachines);
    setParts(allParts);
    setOperations(allOperations);
  };

  const loadSavedShift = async () => {
    if (!profile) return;
    
    const shiftDate = new Date(selectedDate);
    const startOfDay = new Date(shiftDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(shiftDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const savedShift = await db.workShifts
      .where('date')
      .between(startOfDay.toISOString(), endOfDay.toISOString(), true, true)
      .filter(shift => shift.shiftNumber === profile.shiftNumber)
      .first();
    
    if (savedShift) {
      setCompletedOperations(savedShift.completedOperations || []);
      setCurrentShiftId(savedShift.id);
      setIsOvertime(savedShift.isOvertime);
    } else {
      setCompletedOperations([]);
      setCurrentShiftId(undefined);
      setIsOvertime(false);
    }
  };

  const loadAllFilledDates = async () => {
    if (!profile) return;
    
    const shifts = await db.workShifts
      .filter(shift => shift.shiftNumber === profile.shiftNumber)
      .toArray();
    
    const uniqueDates = new Set(shifts.map(shift => shift.date.split('T')[0]));
    setFilledDates(uniqueDates);
  };

  const calculateCoefficient = async () => {
    if (!profile || completedOperations.length === 0) {
      setCoefficient(0);
      return;
    }

    const shiftDate = new Date(selectedDate);
    const shiftType = getShiftTypeForDate(shiftDate, profile.shiftNumber) as ShiftType;

    if (!shiftType) {
      setCoefficient(0);
      return;
    }

    const workShift: WorkShift = {
      date: shiftDate.toISOString(),
      shiftNumber: profile.shiftNumber,
      shiftType,
      duration: 660,
      isOvertime: false,
      completedOperations,
    };

    const coeff = await calculateShiftCoefficient(workShift, profile.baseCoefficient);
    setCoefficient(coeff);
  };

  // Фильтрация списков по типу операции/станка
  const filteredMachines = operationMode
    ? machines.filter((m) => m.type === operationMode)
    : machines;

  const availableOperations = newOperation.partId
    ? operations
        .filter(
          (op) =>
            op.partId === newOperation.partId && (!operationMode || op.operationType === operationMode)
        )
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true, sensitivity: 'base' }))
    : [];

  const canAddOperation =
    newOperation.machineId > 0 &&
    newOperation.partId > 0 &&
    newOperation.operationId > 0 &&
    (newOperation.isSetup ? true : newOperation.quantity > 0);

  const handleAddOperation = () => {
    if (!canAddOperation) return;

    const completedOp: CompletedOperation = {
      machineId: newOperation.machineId,
      operationId: newOperation.operationId,
      quantity: newOperation.isSetup ? 1 : newOperation.quantity,
      actualTime: (newOperation.machineTime + newOperation.additionalTime) * (newOperation.isSetup ? 1 : newOperation.quantity),
      isSetup: newOperation.isSetup,
    };

    let updatedOperations;
    if (editingIndex !== null) {
      // Редактируем существующую операцию
      updatedOperations = [...completedOperations];
      updatedOperations[editingIndex] = completedOp;
    } else {
      // Добавляем новую операцию
      updatedOperations = [...completedOperations, completedOp];
    }
    
    setCompletedOperations(updatedOperations);
    saveShift(updatedOperations);
    handleCloseDialog();
  };

  const handleOvertimeConfirm = () => {
    setIsOvertime(true);
    setOvertimeDialogOpen(false);
    
    // Открываем диалог для добавления операции после подтверждения подработки
    setNewOperation({
      machineId: 0,
      partId: 0,
      operationId: 0,
      quantity: 0,
      machineTime: 0,
      additionalTime: 0,
      isSetup: false,
    });
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const handleOvertimeCancel = () => {
    setOvertimeDialogOpen(false);
  };

  const handleDeleteOperation = (index: number) => {
    const updatedOperations = completedOperations.filter((_, i) => i !== index);
    setCompletedOperations(updatedOperations);
    saveShift(updatedOperations);
  };

  const saveShift = async (operationsToSave: CompletedOperation[] = completedOperations) => {
    if (!profile) return;

    const shiftDate = new Date(selectedDate);
    const shiftType = getShiftTypeForDate(shiftDate, profile.shiftNumber) as ShiftType;

    if (!shiftType) {
      // Если выходной, но есть операции - не сохраняем
      return;
    }

    if (operationsToSave.length === 0 && currentShiftId) {
      // Если операций нет, но есть сохраненная смена - удаляем её
      await db.workShifts.delete(currentShiftId);
      setCurrentShiftId(undefined);
      loadAllFilledDates();
      return;
    }

    if (operationsToSave.length === 0) {
      // Если операций нет и смены нет - не сохраняем
      return;
    }

    const workShift: WorkShift = {
      date: shiftDate.toISOString(),
      shiftNumber: profile.shiftNumber,
      shiftType: shiftType || 'day',
      duration: 660,
      isOvertime: isOvertime || false,
      completedOperations: operationsToSave,
    };

    if (currentShiftId) {
      // Обновляем существующую смену
      await db.workShifts.update(currentShiftId, workShift);
    } else {
      // Создаем новую смену
      const newId = await db.workShifts.add(workShift);
      setCurrentShiftId(newId as number);
    }
    
    // Обновляем список заполненных дат
    loadAllFilledDates();
  };

  // Календарь - получаем все дни для отображения
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDayType = (date: Date) => {
    if (!profile) return 'dayoff';
    return getShiftTypeForDate(date, profile.shiftNumber);
  };

  const getDayColor = (dayType: string) => {
    switch (dayType) {
      case 'day':
        return '#4CAF50';
      case 'night':
        return '#2196F3';
      case 'dayoff':
        return '#f5f5f5';
      default:
        return '#ffffff';
    }
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === calendarDate.getMonth() && date.getFullYear() === calendarDate.getFullYear();
  };

  const handlePreviousMonth = () => {
    setCalendarDate(subMonths(calendarDate, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(addMonths(calendarDate, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
  };

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  if (!profile) {
    return (
      <Container maxWidth="md">
        <Alert severity="warning">
          Необходимо заполнить профиль пользователя
        </Alert>
      </Container>
    );
  }


  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        Рабочая смена
      </Typography>

      <Card sx={{ mt: 2, mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Дата смены: {format(new Date(selectedDate), 'dd.MM.yyyy')} 
                {profile && (() => {
                  const shiftType = getShiftTypeForDate(new Date(selectedDate), profile.shiftNumber);
                  switch (shiftType) {
                    case 'day':
                      return ' - Дневная смена';
                    case 'night':
                      return ' - Ночная смена';
                    case 'dayoff':
                      return ' - Выходной день';
                    default:
                      return '';
                  }
                })()}
              </Typography>
              <Box sx={{ p: 2, mt: 2 }}>
                {/* Заголовки дней недели */}
                <Grid container spacing={0.5} sx={{ mb: 1 }}>
                  {weekDays.map((day) => (
                    <Grid item xs={12 / 7} key={day}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          py: 0.5,
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                        }}
                      >
                        {day}
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                {/* Ячейки календаря с числами */}
                <Grid container spacing={0.5}>
                  {calendarDays.map((date, index) => {
                    const dayType = getDayType(date);
                    const isCurrentMonthDay = isCurrentMonth(date);
                    const isSelected = format(date, 'yyyy-MM-dd') === selectedDate;
                    const isFilled = filledDates.has(format(date, 'yyyy-MM-dd'));

                    return (
                      <Grid item xs={12 / 7} key={index}>
                        <Box
                          onClick={() => handleDateClick(date)}
                          sx={{
                            aspectRatio: '1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isCurrentMonthDay ? getDayColor(dayType) : 'transparent',
                            borderRadius: 1,
                            border: isSelected ? '2px solid #2196F3' : isFilled ? '2px solid #FF9800' : '1px solid #e0e0e0',
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8,
                            },
                            position: 'relative',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: isSelected || isFilled ? 'bold' : 'normal',
                              color: isCurrentMonthDay ? (dayType === 'dayoff' ? 'text.secondary' : 'white') : 'text.disabled',
                            }}
                          >
                            {format(date, 'd')}
                          </Typography>
                          {isFilled && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: '#FF9800',
                              }}
                            />
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>

                {/* Кнопки навигации по месяцам */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button size="small" onClick={handlePreviousMonth}>
                    ←
                  </Button>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {format(calendarDate, 'LLLL yyyy', { locale: ru })}
                  </Typography>
                  <Button size="small" onClick={handleNextMonth}>
                    →
                  </Button>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleOpenDialog(null, 'milling')}
                  fullWidth
                  size="large"
                >
                  Фрезерные операции
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Add />}
                  onClick={() => handleOpenDialog(null, 'lathe')}
                  fullWidth
                  size="large"
                >
                  Токарные операции
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Диалог подтверждения подработки */}
      <Dialog 
        open={overtimeDialogOpen} 
        onClose={handleOvertimeCancel}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreen}
      >
        <DialogTitle>Подтверждение подработки</DialogTitle>
        <DialogContent>
          <Typography>
            Выбранная дата является выходным днем. Это подработка?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOvertimeCancel}>
            Отмена
          </Button>
          <Button variant="contained" onClick={handleOvertimeConfirm} color="primary">
            Да, это подработка
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог добавления/редактирования операции */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth fullScreen={fullScreen}>
        <DialogTitle>{editingIndex !== null ? 'Редактировать операцию' : 'Добавить операцию'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Станок"
                value={newOperation.machineId || ''}
                onChange={(e) => handleMachineChange(Number(e.target.value) || 0)}
                required
              >
                {filteredMachines.map((machine) => (
                  <MenuItem key={machine.id} value={machine.id || ''}>
                    {machine.name} ({machine.type === 'lathe' ? 'Токарный' : 'Фрезерный'})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Деталь"
                value={newOperation.partId || ''}
                onChange={(e) => handlePartChange(Number(e.target.value) || 0)}
                disabled={!newOperation.machineId}
                required
              >
                {parts.map((part) => (
                  <MenuItem key={part.id} value={part.id || ''}>
                    {part.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                select
                label="Операция"
                value={newOperation.operationId || ''}
                onChange={(e) => {
                  const opId = Number(e.target.value) || 0;
                  const op = operations.find(o => o.id === opId);
                  setNewOperation({
                    ...newOperation,
                    operationId: opId,
                    machineTime: op ? op.machineTime : 0,
                    additionalTime: op ? op.additionalTime : 0,
                  });
                }}
                disabled={!newOperation.partId}
                required
                helperText={
                  !newOperation.partId
                    ? 'Сначала выберите деталь'
                    : availableOperations.length === 0
                    ? 'Для выбранной детали нет операций'
                    : ''
                }
              >
                {availableOperations.map((operation) => (
                  <MenuItem key={operation.id} value={operation.id || ''}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {operation.name}
                      </Typography>
                      {operation.description && (
                        <Typography variant="caption" color="text.secondary">
                          {operation.description}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {/* Поля времени под полем Операция */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Машинное время (мин)"
                value={newOperation.machineTime || ''}
                onChange={(e) =>
                  setNewOperation({
                    ...newOperation,
                    machineTime: Number(e.target.value) || 0,
                  })
                }
                disabled={!newOperation.operationId}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Доп. время (мин)"
                value={newOperation.additionalTime || ''}
                onChange={(e) =>
                  setNewOperation({
                    ...newOperation,
                    additionalTime: Number(e.target.value) || 0,
                  })
                }
                disabled={!newOperation.operationId}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Количество"
                value={newOperation.quantity || ''}
                onChange={(e) =>
                  setNewOperation({
                    ...newOperation,
                    quantity: Number(e.target.value) || 0,
                  })
                }
                disabled={!newOperation.operationId}
                inputProps={{ min: 1 }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="setup-checkbox"
                  checked={newOperation.isSetup}
                  onChange={(e) =>
                    setNewOperation({
                      ...newOperation,
                      isSetup: e.target.checked,
                      quantity: e.target.checked ? 1 : newOperation.quantity,
                    })
                  }
                  style={{ marginRight: 8 }}
                  disabled={!newOperation.operationId}
                />
                <label htmlFor="setup-checkbox">Наладка</label>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button 
            variant="contained" 
            onClick={handleAddOperation} 
            disabled={!canAddOperation}
            startIcon={editingIndex !== null ? <Edit /> : <Add />}
          >
            {editingIndex !== null ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Операции за {format(new Date(selectedDate), 'dd.MM.yyyy')}
            </Typography>
          </Box>

          {completedOperations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Операции не добавлены. Нажмите кнопку "Добавить операцию" выше, чтобы начать.
              </Typography>
            </Box>
          ) : (() => {
            // Группируем операции по станкам, сохраняя исходный индекс
            type OpWithIndex = { op: typeof completedOperations[number]; index: number };
            const operationsByMachine = new Map<number, OpWithIndex[]>();
            
            completedOperations.forEach((op, idx) => {
              if (!operationsByMachine.has(op.machineId)) {
                operationsByMachine.set(op.machineId, []);
              }
              operationsByMachine.get(op.machineId)!.push({ op, index: idx });
            });

            return (
              <Grid container spacing={2}>
                {Array.from(operationsByMachine.entries()).map(([machineId, machineOperations]) => {
                  const machine = machines.find((m) => m.id === machineId);

                  return (
                    <Grid item xs={12} key={machineId}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box>
                              <Typography variant="h6" fontWeight="bold">
                                {machine?.name || 'Неизвестный станок'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {machine?.type === 'lathe' ? 'Токарный' : 'Фрезерный'}
                              </Typography>
                            </Box>
                          </Box>
                          
                          {machineOperations.map(({ op: completedOp, index: globalIndex }, localIndex) => {
                            const operation = operations.find((o) => o.id === completedOp.operationId);
                            const part = parts.find((p) => p.id === operation?.partId);

                            // Рассчитываем время операции в минутах
                            const operationTime = typeof completedOp.actualTime === 'number'
                              ? completedOp.actualTime
                              : operation
                                ? (operation.machineTime + operation.additionalTime) * completedOp.quantity
                                : 0;

                            return (
                              <Box 
                                key={localIndex}
                                sx={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  py: 1,
                                  borderBottom: localIndex < machineOperations.length - 1 ? '1px solid #e0e0e0' : 'none'
                                }}
                              >
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body1" fontWeight="medium">
                                    {part?.name || 'Неизвестная деталь'}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Операция: {operation?.name || 'Неизвестная операция'}{completedOp.isSetup ? ' (Наладка)' : ''}
                                  </Typography>
                                  <Typography variant="body2" color="primary" sx={{ mt: 0.5 }}>
                                    Количество: {completedOp.quantity} шт. | Время: {operationTime.toFixed(0)} мин
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <IconButton
                                    onClick={() => handleOpenDialog(globalIndex)}
                                    color="primary"
                                    size="small"
                                  >
                                    <Edit />
                                  </IconButton>
                                  <IconButton
                                    onClick={() => handleDeleteOperation(globalIndex)}
                                    color="error"
                                    size="small"
                                  >
                                    <Delete />
                                  </IconButton>
                                </Box>
                              </Box>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            );
          })()}
        </CardContent>
      </Card>

      {/* Карточка коэффициента выработки */}
      {completedOperations.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Коэффициент выработки
            </Typography>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold', mt: 2 }}>
              {coefficient.toFixed(2)}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}


import { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Chip,
  IconButton,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useUserStore } from '@/store/userStore';
import { db } from '@/services/database';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getShiftTypeForDate, isWorkingDay } from '@/utils/calendar';
import { calculatePeriodCoefficient } from '@/utils/calculations';
import { BarChart } from '@mui/x-charts/BarChart';
import { isHoliday, preloadHolidays } from '@/utils/holidays';

export default function DashboardPage() {
  const { profile } = useUserStore();
  const [thisMonthShifts, setThisMonthShifts] = useState(0); // фактически отработано по календарю до сегодня
  const [monthCoefficient, setMonthCoefficient] = useState(0);
  const [plannedMonthShifts, setPlannedMonthShifts] = useState(0);
  const [dailyCoefficients, setDailyCoefficients] = useState<Array<{ date: Date; coef: number | null }>>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  // Праздники подгружаем без локального состояния, чтобы не провоцировать лишние рендеры

  useEffect(() => {
    if (profile) {
      loadMonthShifts();
    }
  }, [profile, currentDate]);

  useEffect(() => {
    // Загружаем праздничные дни для текущего года и соседних годов
    const loadHolidays = async () => {
      const year = currentDate.getFullYear();
      const prevYear = year - 1;
      const nextYear = year + 1;
      
      try {
        await Promise.all([
          preloadHolidays(year),
          preloadHolidays(prevYear),
          preloadHolidays(nextYear),
        ]);
      } catch (error) {
        console.error('Error loading holidays:', error);
      }
    };
    
    loadHolidays();
  }, [currentDate]);

  const loadMonthShifts = async () => {
    if (!profile) return;

    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const today = new Date();
    const endForActual = today < end ? today : end;

    const shifts = await db.workShifts
      .where('date')
      .between(start.toISOString(), end.toISOString(), true, true)
      .filter(shift => shift.shiftNumber === profile.shiftNumber)
      .toArray();

    // Фактически отработанные смены по графику (до текущего дня включительно)
    let actualWorked = 0;
    if (endForActual >= start) {
      for (let d = new Date(start); d <= endForActual; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        if (isWorkingDay(d, profile.shiftNumber)) actualWorked++;
      }
    }
    setThisMonthShifts(actualWorked);

    // Считаем коэффициент за текущий месяц
    const coef = await calculatePeriodCoefficient(shifts, profile.baseCoefficient);
    setMonthCoefficient(coef);

    // Формируем список рабочих дней месяца
    const workDates: Array<{ date: Date; coef: number | null }> = [];
    const keyToIndex: Record<string, number> = {};
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      if (isWorkingDay(d, profile.shiftNumber)) {
        const entry = { date: new Date(d), coef: null as number | null };
        const key = format(d, 'yyyy-MM-dd');
        keyToIndex[key] = workDates.length;
        workDates.push(entry);
      }
    }

    // Заполняем коэффициенты для тех рабочих дней, по которым есть сохраненные смены
    for (const shift of shifts) {
      const key = format(new Date(shift.date), 'yyyy-MM-dd');
      const idx = keyToIndex[key];
      if (idx !== undefined) {
        const c = await calculatePeriodCoefficient([shift], profile.baseCoefficient);
        workDates[idx].coef = c;
      }
    }
    setDailyCoefficients(workDates);

    // Считаем плановое количество смен за месяц (по графику)
    let planned = 0;
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      if (isWorkingDay(d, profile.shiftNumber)) planned++;
    }
    setPlannedMonthShifts(planned);
  };

  // Получаем все дни для отображения в календаре (включая дни предыдущего и следующего месяцев)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Понедельник - первый день недели
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDayType = (date: Date) => {
    if (!profile) return 'dayoff';
    return getShiftTypeForDate(date, profile.shiftNumber);
  };

  const getDayColor = (dayType: string) => {
    switch (dayType) {
      case 'day':
        return '#4CAF50'; // Зеленый для дневной смены
      case 'night':
        return '#2196F3'; // Синий для ночной смены
      case 'dayoff':
        return '#f5f5f5'; // Светло-серый для выходного
      default:
        return '#ffffff';
    }
  };

  const getDayLabel = (dayType: string) => {
    switch (dayType) {
      case 'day':
        return 'Д';
      case 'night':
        return 'Н';
      case 'dayoff':
        return 'В';
      default:
        return '';
    }
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  if (!profile) {
    return null;
  }

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        Добро пожаловать, {profile.fullName}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={handlePreviousMonth} size="small">
                  <ChevronLeft />
                </IconButton>
                <Typography variant="h6" sx={{ textAlign: 'center', minWidth: 150 }}>
                  {format(currentDate, 'LLLL yyyy', { locale: ru })}
                </Typography>
                <IconButton onClick={handleNextMonth} size="small">
                  <ChevronRight />
                </IconButton>
              </Box>

              {/* Заголовки дней недели */}
              <Grid container spacing={0.5} sx={{ mb: 1 }}>
                {weekDays.map((day) => (
                  <Grid item xs={12 / 7} key={day}>
                    <Box
                      sx={{
                        textAlign: 'center',
                        py: 1,
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                        color: 'text.secondary',
                      }}
                    >
                      {day}
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {/* Календарь */}
              <Grid container spacing={0.5}>
                {calendarDays.map((date, index) => {
                  const dayType = getDayType(date);
                  const isCurrentMonthDay = isCurrentMonth(date);
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  const isHolidayDay = isHoliday(date);

                  return (
                    <Grid item xs={12 / 7} key={index}>
                      <Box
                        sx={{
                          aspectRatio: '1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: getDayColor(dayType),
                          borderRadius: 1,
                          border: isToday ? '2px solid #FF9800' : '1px solid #e0e0e0',
                          opacity: isCurrentMonthDay ? 1 : 0.5,
                          cursor: 'pointer',
                          '&:hover': {
                            opacity: isCurrentMonthDay ? 0.8 : 0.6,
                          },
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isToday ? 'bold' : 'normal',
                            color: isHolidayDay ? '#f44336' : (isCurrentMonthDay ? 'text.primary' : 'text.secondary'),
                          }}
                        >
                          {format(date, 'd')}
                        </Typography>
                        <Chip
                          label={getDayLabel(dayType)}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            mt: 0.5,
                            backgroundColor: dayType === 'dayoff' ? 'transparent' : 'rgba(255, 255, 255, 0.8)',
                            color: dayType === 'dayoff' ? 'text.secondary' : 'text.primary',
                          }}
                        />
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'nowrap' }}>
            <Box sx={{ flex: '1 1 50%' }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Коэффициент за текущий месяц
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="h5">
                      {monthCoefficient.toFixed(2)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1 1 50%' }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Смен за текущий месяц
                  </Typography>
                  <Box display="flex" justifyContent="flex-start" alignItems="baseline">
                    <Typography variant="h5">
                      {thisMonthShifts} из {plannedMonthShifts}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Grid>

        {/* График коэффициентов по дням выбранного месяца */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Коэффициенты по дням
              </Typography>
              {dailyCoefficients.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Нет данных за выбранный месяц
                </Typography>
              ) : (() => {
                const data = dailyCoefficients.map((d) => (d.coef == null ? null : Number(d.coef.toFixed(2))));
                const red = data.map((v) => (v == null ? 0 : v < 0.8 ? v : 0));
                const yellow = data.map((v) => (v == null ? 0 : v >= 0.8 && v <= 1.3 ? v : 0));
                const green = data.map((v) => (v == null ? 0 : v > 1.3 ? v : 0));

                return (
                  <BarChart
                    height={240}
                    series={[
                      { data: red, color: '#f44336', stack: 'coef' },
                      { data: yellow, color: '#FFC107', stack: 'coef' },
                      { data: green, color: '#4CAF50', stack: 'coef' },
                    ]}
                    xAxis={[{ scaleType: 'band', data: dailyCoefficients.map(d => format(d.date, 'd', { locale: ru })), tickLabelInterval: () => true }]}
                    yAxis={[{ min: 0 }]}
                    margin={{ left: 56, right: 16, top: 16, bottom: 24 }}
                    slotProps={{ legend: { hidden: true } }}
                  />
                );
              })()}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}


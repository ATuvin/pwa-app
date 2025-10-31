import { useEffect, useState } from 'react';
import { Container, Typography, Paper, Stack, Button, Box, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useUserStore } from '@/store/userStore';
import { exportDailyReport } from '@/utils/reports';
import { getShiftTypeForDate } from '@/utils/calendar';
import { db } from '@/services/database';

export default function DailyReportPage() {
  const navigate = useNavigate();
  const { profile } = useUserStore();
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [filledDates, setFilledDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCalendarDate(new Date(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    const loadFilled = async () => {
      if (!profile) return;
      const shifts = await db.workShifts
        .filter(shift => shift.shiftNumber === profile.shiftNumber)
        .toArray();
      const uniqueDates = new Set(shifts.map(shift => shift.date.split('T')[0]));
      setFilledDates(uniqueDates);
    };
    loadFilled();
  }, [profile]);

  // Календарные вычисления (как в Рабочая смена)
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const isCurrentMonth = (date: Date) => date.getMonth() === calendarDate.getMonth() && date.getFullYear() === calendarDate.getFullYear();
  const getDayType = (date: Date) => (profile ? getShiftTypeForDate(date, profile.shiftNumber) : 'dayoff');
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
  const handlePreviousMonth = () => setCalendarDate(subMonths(calendarDate, 1));
  const handleNextMonth = () => setCalendarDate(addMonths(calendarDate, 1));
  const handleDateClick = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h5" component="h1">
          Отчет за день
        </Typography>
        <Button size="small" onClick={() => navigate(-1)}>Закрыть</Button>
      </Box>
      <Paper variant="outlined">
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            Дата: {format(new Date(selectedDate), 'dd.MM.yyyy')}
          </Typography>

          <Box sx={{ p: 1 }}>
            <Grid container spacing={0.5} sx={{ mb: 1 }}>
              {weekDays.map((day) => (
                <Grid item xs={12 / 7} key={day}>
                  <Box sx={{ textAlign: 'center', py: 0.5, fontWeight: 'bold', fontSize: '0.75rem', color: 'text.secondary' }}>
                    {day}
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={0.5}>
              {calendarDays.map((date, idx) => {
                const dayType = getDayType(date);
                const isMonthDay = isCurrentMonth(date);
                const isSelected = format(date, 'yyyy-MM-dd') === selectedDate;
                const isFilled = filledDates.has(format(date, 'yyyy-MM-dd'));
                return (
                  <Grid item xs={12 / 7} key={idx}>
                    <Box
                      onClick={() => handleDateClick(date)}
                      sx={{
                        aspectRatio: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isMonthDay ? getDayColor(dayType) : 'transparent',
                        borderRadius: 1,
                        border: isSelected ? '2px solid #2196F3' : isFilled ? '2px solid #FF9800' : '1px solid #e0e0e0',
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.8 },
                        position: 'relative',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isSelected || isFilled ? 'bold' : 'normal',
                          color: isMonthDay ? (dayType === 'dayoff' ? 'text.secondary' : 'white') : 'text.disabled',
                        }}
                      >
                        {format(date, 'd')}
                      </Typography>
                      {isFilled && (
                        <Box sx={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FF9800' }} />
                      )}
                    </Box>
                  </Grid>
                );
              })}
            </Grid>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button size="small" onClick={handlePreviousMonth}>←</Button>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {format(calendarDate, 'LLLL yyyy', { locale: ru })}
              </Typography>
              <Button size="small" onClick={handleNextMonth}>→</Button>
            </Box>
          </Box>

          <Button
            variant="contained"
            onClick={() => {
              if (!profile) return;
              exportDailyReport(selectedDate, profile.shiftNumber);
            }}
          >
            Создать отчет
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}



import { addDays, differenceInDays } from 'date-fns';
import type { ShiftNumber, ShiftType } from '@/models';

// Константы для графика работы
const SHIFT_CYCLE_DAYS = 16;
const WORK_SHIFT_HOURS = 11; // 12 часов минус 1 час обеда

// График Смены 1 (базовый)
// День 1-2: Дневная (08:00-20:00)
// День 3-4: Выходные
// День 5-6: Дневная
// День 7-8: Выходные
// День 9-10: Ночная (20:00-08:00)
// День 11-12: Выходные
// День 13-14: Ночная
// День 15-16: Выходные
const SHIFT_1_PATTERN: Array<{ type: ShiftType | 'dayoff'; days: number }> = [
  { type: 'day', days: 2 },
  { type: 'dayoff', days: 2 },
  { type: 'day', days: 2 },
  { type: 'dayoff', days: 2 },
  { type: 'night', days: 2 },
  { type: 'dayoff', days: 2 },
  { type: 'night', days: 2 },
  { type: 'dayoff', days: 2 },
];

/**
 * Получить смещение для смены относительно Смены 1
 */
function getShiftOffset(shiftNumber: ShiftNumber): number {
  switch (shiftNumber) {
    case 1:
      return 0;
    case 2:
      return -8; // Начинается с ночных смен (сдвиг на -8 дней)
    case 3:
      return 2; // Начинается в день 3 Смены 1 (первый выходной) с дневной
    case 4:
      return 2; // Начинается в день 3 Смены 1 с ночной
    default:
      return 0;
  }
}

/**
 * Базовая дата для расчета цикла
 * Требования:
 * - 27-28 октября = ночные смены (дни 9-10 цикла - первые ночные)
 * - 29-30 октября = выходные (дни 11-12 цикла)
 * - 31 октября - 1 ноября = ночные смены (дни 13-14 цикла - вторые ночные)
 * 
 * Установка: 23 октября = день 5 цикла (дневная)
 * Тогда: 27 октября = день 9 (ночная) ✓
 */
const BASE_CYCLE_DATE = new Date(2025, 9, 23); // 23 октября 2025
const BASE_CYCLE_DAY = 5; // 23 октября = день 5 цикла (дневная)

/**
 * Определить день цикла для даты с использованием базовой точки отсчета
 */
function getCycleDay(date: Date, shiftNumber: ShiftNumber): number {
  // Находим разницу в днях от базовой даты
  const daysFromBase = differenceInDays(date, BASE_CYCLE_DATE);
  
  // Базовая дата имеет день цикла BASE_CYCLE_DAY (1-based), преобразуем в 0-based
  const baseCycleDayZeroBased = BASE_CYCLE_DAY - 1;
  
  // Вычисляем день цикла для текущей даты
  const offset = getShiftOffset(shiftNumber);
  const cycleDayZeroBased = ((baseCycleDayZeroBased + offset + daysFromBase) % SHIFT_CYCLE_DAYS + SHIFT_CYCLE_DAYS) % SHIFT_CYCLE_DAYS;
  
  return cycleDayZeroBased + 1; // Возвращаем 1-based
}

/**
 * Определить тип дня (дневная смена, ночная смена или выходной)
 */
function getDayTypeFromCycleDay(cycleDay: number): ShiftType | 'dayoff' {
  let currentDay = 0;
  for (const segment of SHIFT_1_PATTERN) {
    if (cycleDay <= currentDay + segment.days) {
      return segment.type;
    }
    currentDay += segment.days;
  }
  return 'dayoff';
}

/**
 * Определить тип смены для даты и номера смены
 */
export function getShiftTypeForDate(date: Date, shiftNumber: ShiftNumber): ShiftType | 'dayoff' {
  const cycleDay = getCycleDay(date, shiftNumber);
  return getDayTypeFromCycleDay(cycleDay);
}

/**
 * Проверить, является ли дата рабочим днем
 */
export function isWorkingDay(date: Date, shiftNumber: ShiftNumber): boolean {
  const dayType = getShiftTypeForDate(date, shiftNumber);
  return dayType !== 'dayoff';
}

/**
 * Проверить, является ли дата выходным днем
 */
export function isDayOff(date: Date, shiftNumber: ShiftNumber): boolean {
  return !isWorkingDay(date, shiftNumber);
}

/**
 * Получить тип смены (дневная/ночная) для даты
 */
export function getShiftType(date: Date, shiftNumber: ShiftNumber): ShiftType | null {
  const dayType = getShiftTypeForDate(date, shiftNumber);
  return dayType === 'dayoff' ? null : dayType;
}

/**
 * Получить длительность смены (по умолчанию 11 часов)
 */
export function getDefaultShiftDuration(): number {
  return WORK_SHIFT_HOURS;
}

/**
 * Получить календарь рабочих дней за период
 */
export function getWorkDaysInPeriod(
  startDate: Date,
  endDate: Date,
  shiftNumber: ShiftNumber
): Array<{ date: Date; shiftType: ShiftType }> {
  const workDays: Array<{ date: Date; shiftType: ShiftType }> = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const shiftType = getShiftType(currentDate, shiftNumber);
    if (shiftType) {
      workDays.push({ date: new Date(currentDate), shiftType });
    }
    currentDate = addDays(currentDate, 1);
  }

  return workDays;
}


import { isSameDay } from 'date-fns';
import { getCachedHolidays } from '@/services/calendarApi';

// Кэш праздничных дней по годам
const holidaysCache = new Map<number, Date[]>();

/**
 * Загрузить праздничные дни для указанного года из API
 */
async function loadHolidaysForYear(year: number): Promise<Date[]> {
  // Проверяем локальный кэш
  if (holidaysCache.has(year)) {
    return holidaysCache.get(year)!;
  }
  
  try {
    // Загружаем из API с кэшированием
    const holidays = await getCachedHolidays(year);
    
    // Сохраняем в локальный кэш
    holidaysCache.set(year, holidays);
    
    return holidays;
  } catch (error) {
    console.error(`Failed to load holidays for year ${year}:`, error);
    // Возвращаем пустой массив - работаем только через API
    return [];
  }
}

/**
 * Проверить, является ли дата праздничным днем (синхронная версия для совместимости)
 * Возвращает false если данные еще не загружены
 */
export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = holidaysCache.get(year);
  
  if (!holidays) {
    // Данные не загружены, возвращаем false
    // В компоненте нужно вызвать loadHolidaysForYear для нужного года
    return false;
  }
  
  return holidays.some(holiday => isSameDay(date, holiday));
}

/**
 * Предзагрузить праздничные дни для указанного года
 */
export async function preloadHolidays(year: number): Promise<void> {
  await loadHolidaysForYear(year);
}

/**
 * Проверить, является ли дата праздничным днем (асинхронная версия)
 */
export async function isHolidayAsync(date: Date): Promise<boolean> {
  const year = date.getFullYear();
  const holidays = await loadHolidaysForYear(year);
  return holidays.some(holiday => isSameDay(date, holiday));
}

/**
 * Получить праздничные дни за период (асинхронная версия)
 */
export async function getHolidaysInPeriod(startDate: Date, endDate: Date): Promise<Date[]> {
  const holidays: Date[] = [];
  let currentDate = new Date(startDate);
  
  // Получаем все уникальные года в периоде
  const years = new Set<number>();
  let date = new Date(startDate);
  while (date <= endDate) {
    years.add(date.getFullYear());
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
  
  // Предзагружаем праздничные дни для всех годов в периоде
  await Promise.all(Array.from(years).map(year => preloadHolidays(year)));

  while (currentDate <= endDate) {
    if (isHoliday(currentDate)) {
      holidays.push(new Date(currentDate));
    }
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return holidays;
}


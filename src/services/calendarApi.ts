/**
 * Сервис для работы с API производственного календаря РФ
 * API: https://calendar.kuzyak.in/
 * Формат ответа:
 * {
 *   "year": 2025,
 *   "holidays": [{"date": "2025-01-01T00:00:00.000Z", "name": "Новый год"}, ...],
 *   "shortDays": [{"date": "2025-03-07T00:00:00.000Z", "name": "..."}, ...],
 *   "status": 200
 * }
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://calendar.kuzyak.in';

// Интерфейс для элемента праздника/сокращенного дня из API
interface HolidayItem {
  date: string; // ISO строка даты: "2025-01-01T00:00:00.000Z"
  name: string; // Название праздника
}

// Интерфейс ответа от API
interface CalendarApiResponse {
  year: number;
  holidays: HolidayItem[];
  shortDays?: HolidayItem[]; // Сокращенные дни (опционально)
  status: number;
}

/**
 * Получить праздничные дни для указанного года
 */
export async function getHolidays(year: number): Promise<Date[] | null> {
  try {
    const url = `${API_BASE_URL}/api/calendar/${year}/holidays`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Проверяем Content-Type перед парсингом JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Response is not JSON');
    }
    
    const data: CalendarApiResponse = await response.json();
    
    // Проверяем структуру ответа
    if (!data || typeof data !== 'object' || !Array.isArray(data.holidays)) {
      throw new Error('Invalid response format');
    }
    
    // Объединяем праздники и сокращенные дни (сокращенные дни перед праздниками тоже выходные)
    const allHolidayItems = [...data.holidays];
    if (data.shortDays && Array.isArray(data.shortDays)) {
      allHolidayItems.push(...data.shortDays);
    }
    
    // Преобразуем ISO строки в Date объекты
    const dates = allHolidayItems
      .map((item) => {
        if (item.date) {
          const date = new Date(item.date);
          return date;
        }
        return null;
      })
      .filter((date): date is Date => date !== null && !isNaN(date.getTime()));
    
    // Возвращаем массив дат или null, если массив пуст
    return dates.length > 0 ? dates : null;
  } catch (error) {
    console.error(`Error fetching holidays for year ${year}:`, error);
    return null;
  }
}

/**
 * Кэш для праздничных дней
 */
const holidaysCache = new Map<number, Date[]>();

/**
 * Получить праздничные дни с кэшированием
 */
export async function getCachedHolidays(year: number): Promise<Date[]> {
  // Проверяем кэш
  if (holidaysCache.has(year)) {
    return holidaysCache.get(year)!;
  }
  
  // Загружаем из API
  const holidays = await getHolidays(year);
  
  // Если API вернул данные (не null), сохраняем в кэш и возвращаем
  if (holidays !== null && holidays.length > 0) {
    holidaysCache.set(year, holidays);
    return holidays;
  }
  
  // Если API недоступен, возвращаем пустой массив (работаем только через API)
  throw new Error(`Failed to load holidays for year ${year} from API`);
}

/**
 * Очистить кэш
 */
export function clearHolidaysCache(year?: number): void {
  if (year !== undefined) {
    holidaysCache.delete(year);
  } else {
    holidaysCache.clear();
  }
}


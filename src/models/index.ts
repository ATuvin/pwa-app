// Модели данных приложения

export type ShiftNumber = 1 | 2 | 3 | 4;
export type ShiftType = 'day' | 'night';
export type MachineType = 'lathe' | 'milling';

// Профиль пользователя
export interface UserProfile {
  id?: number;
  fullName: string;
  shiftNumber: ShiftNumber;
  baseCoefficient: number; // Базовое время для расчета коэффициента выработки (в минутах)
}

// Станок
export interface Machine {
  id?: number;
  name: string;
  type: MachineType;
}

// Деталь
export interface Part {
  id?: number;
  name: string;
  description?: string;
}

// Операция
export interface Operation {
  id?: number;
  name: string;
  partId: number; // Ссылка на деталь
  operationType: MachineType; // Тип операции (токарная/фрезерная)
  machineTime: number; // Машинное время в минутах
  additionalTime: number; // Дополнительное время в минутах
  description?: string; // Описание операции
}

// Данные о выполненной операции на станке
export interface CompletedOperation {
  id?: number;
  machineId: number;
  operationId: number;
  quantity: number; // Количество изготовленных деталей
  actualTime?: number; // Фактическое время (если редактировалось)
  isSetup?: boolean; // Наладка станка под операцию
}

// Рабочая смена
export interface WorkShift {
  id?: number;
  date: string; // ISO date string
  shiftNumber: ShiftNumber;
  shiftType: ShiftType; // дневная или ночная
  duration: number; // Длительность смены (в минутах, обычно 660)
  isOvertime: boolean; // Является ли подработкой
  completedOperations: CompletedOperation[]; // Данные о выполненных операциях
}

// Месячный отчет
export interface MonthlyReport {
  id?: number;
  month: number; // 1-12
  year: number;
  baseCoefficient: number; // Может отличаться от профиля (в минутах)
  workShifts: WorkShift[];
  calculatedCoefficients: {
    perMachine: Record<number, number>; // Коэффициент по каждому станку
    perShift: Record<number, number>; // Коэффициент по каждой смене
    monthly: number; // Общий коэффициент за месяц
  };
  salary: number; // Заработная плата
  createdAt?: string;
}

// Отчет за период
export interface PeriodReport {
  id?: number;
  startDate: string;
  endDate: string;
  baseCoefficient: number; // В минутах
  workShifts: WorkShift[];
  calculatedCoefficients: {
    perMachine: Record<number, number>;
    perShift: Record<number, number>;
    period: number;
  };
  salary: number;
  createdAt?: string;
}


import Dexie, { Table } from 'dexie';
import type {
  UserProfile,
  Machine,
  Part,
  Operation,
  WorkShift,
  MonthlyReport,
  PeriodReport,
} from '@/models';

// Класс базы данных
export class SalaryDatabase extends Dexie {
  profiles!: Table<UserProfile, number>;
  machines!: Table<Machine, number>;
  parts!: Table<Part, number>;
  operations!: Table<Operation, number>;
  workShifts!: Table<WorkShift, number>;
  monthlyReports!: Table<MonthlyReport, number>;
  periodReports!: Table<PeriodReport, number>;

  constructor() {
    super('SalaryDatabase');
    
    this.version(1).stores({
      profiles: '++id',
      machines: '++id',
      parts: '++id',
      operations: '++id',
      workShifts: '++id, date, shiftNumber',
      monthlyReports: '++id, year, month',
      periodReports: '++id, startDate, endDate',
    });
  }
}

export const db = new SalaryDatabase();


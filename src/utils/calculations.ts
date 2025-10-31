import type { WorkShift, Operation } from '@/models';
import { db } from '@/services/database';

/**
 * Рассчитать расчетное время операции в минутах
 * Расчетное время = Машинное время + Дополнительное время
 */
export function calculateOperationTime(operation: Operation): number {
  return operation.machineTime + operation.additionalTime;
}

/**
 * Рассчитать коэффициент выработки за смену
 * Коэффициент = Общее время изготовленных деталей / Базовый коэффициент
 * Общее время = Сумма (Количество деталей × Время операции) по всем операциям
 */
export async function calculateShiftCoefficient(
  workShift: WorkShift,
  baseCoefficient: number
): Promise<number> {
  let totalTime = 0;

  // Суммируем время по всем операциям
  for (const completedOp of workShift.completedOperations) {
    if (typeof completedOp.actualTime === 'number') {
      // Если задано фактическое время по операции (в минутах), используем его
      totalTime += completedOp.actualTime;
      continue;
    }

    const operation = await db.operations.get(completedOp.operationId);
    if (!operation) continue;
    const operationTime = calculateOperationTime(operation); // Время одной детали в минутах
    totalTime += completedOp.quantity * operationTime; // Время всех деталей этой операции
  }

  // Коэффициент = Общее время / Базовая норма
  return baseCoefficient > 0 ? totalTime / baseCoefficient : 0;
}

/**
 * Рассчитать коэффициент выработки за период
 * Коэффициент = (Общее время всех деталей) / (Базовый коэффициент * Количество смен)
 */
export async function calculatePeriodCoefficient(
  workShifts: WorkShift[],
  baseCoefficient: number
): Promise<number> {
  let totalTime = 0;

  for (const shift of workShifts) {
    const shiftCoefficient = await calculateShiftCoefficient(shift, baseCoefficient);
    totalTime += shiftCoefficient * baseCoefficient;
  }

  const shiftCount = workShifts.length;
  return baseCoefficient > 0 && shiftCount > 0
    ? totalTime / (baseCoefficient * shiftCount)
    : 0;
}



// Генерация PDF через pdfmake, загружаемый динамически с CDN, чтобы гарантировать vfs со шрифтами (кириллица)
import ExcelJS from 'exceljs';
import type { MonthlyReport, PeriodReport, CompletedOperation, Part, UserProfile } from '@/models';
import { db } from '@/services/database';
import { format, eachDayOfInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getShiftTypeForDate } from '@/utils/calendar';
// Временный безопасный перенос: возвращаем текст без модификации,
// чтобы избежать асинхронных промисов в ячейках PDF
const h = (s: string | number | undefined | null) => String(s ?? '');

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(s);
  });
}

type PdfMakeCreate = (docDefinition: unknown) => { download: (filename?: string) => void };
type PdfMakeGlobal = { createPdf: PdfMakeCreate; vfs?: Record<string, string> };
async function ensurePdfMakeFromCdn(): Promise<void> {
  const w = globalThis as unknown as { pdfMake?: PdfMakeGlobal };
  if (w.pdfMake?.vfs && typeof w.pdfMake.createPdf === 'function') return;
  // Загружаем pdfmake и vfs_fonts с CDN
  await loadScript('https://cdn.jsdelivr.net/npm/pdfmake@0.2.9/build/pdfmake.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/pdfmake@0.2.9/build/vfs_fonts.min.js');
  if (!w.pdfMake?.vfs) throw new Error('pdfmake vfs not found (CDN)');
}

export async function exportToPDF(report: MonthlyReport | PeriodReport): Promise<void> {
  await ensurePdfMakeFromCdn();
  const w = globalThis as unknown as { pdfMake: PdfMakeGlobal };

  const periodText = 'month' in report
    ? `Период: ${report.month}/${report.year}`
    : `Период: ${report.startDate} - ${report.endDate}`;

  const coefText = 'monthly' in report.calculatedCoefficients
    ? report.calculatedCoefficients.monthly.toFixed(2)
    : report.calculatedCoefficients.period.toFixed(2);

  const shiftsBody = [
    [{ text: 'Дата', bold: true }, { text: 'Тип смены', bold: true }, { text: 'Длительность', bold: true }, { text: 'Подработка', bold: true }],
    ...report.workShifts.map((s) => [
      s.date,
      s.shiftType === 'day' ? 'Дневная' : 'Ночная',
      `${s.duration} мин`,
      s.isOvertime ? 'Да' : 'Нет',
    ]),
  ];

  const docDefinition = {
    pageSize: 'A5',
    pageOrientation: 'landscape',
    pageMargins: [36, 36, 36, 36],
    content: [
      { text: 'Отчет', style: 'header' },
      { text: periodText, margin: [0, 8, 0, 0] },
      { text: `Количество смен: ${report.workShifts.length}` },
      { text: `Базовый коэффициент: ${report.baseCoefficient} мин` },
      { text: `Коэффициент за период: ${coefText}` },
      { text: `Заработная плата: ${report.salary.toFixed(2)} руб.` },
      { text: ' ', margin: [0, 10, 0, 0] },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto'],
          body: shiftsBody,
        },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: { header: { fontSize: 18, bold: true } },
    defaultStyle: { font: 'Roboto' },
  } as const;

  w.pdfMake.createPdf(docDefinition).download(`report_${Date.now()}.pdf`);
}

export async function exportDailyReport(dateIso: string, shiftNumber: number): Promise<void> {
  await ensurePdfMakeFromCdn();
  const w = globalThis as unknown as { pdfMake: PdfMakeGlobal };

  const day = new Date(dateIso);
  const start = new Date(day); start.setHours(0,0,0,0);
  const end = new Date(day); end.setHours(23,59,59,999);

  const [machines, operations, parts, profile] = await Promise.all([
    db.machines.toArray(),
    db.operations.toArray(),
    db.parts.toArray(),
    db.profiles.toArray().then(a => (a[0] as UserProfile | undefined) || undefined),
  ]);

  // Все операции за день (все смены этого дня)
  const dayStr = format(day, 'yyyy-MM-dd');
  const sameDayShifts = await db.workShifts
    .filter(s => (s.date || '').split('T')[0] === dayStr)
    .toArray();
  const completed: CompletedOperation[] = sameDayShifts.flatMap(s => s.completedOperations || []);

  // Группировка по станкам, расчет по шаблону Untitled-1.json
  type Row = { index: number; partName: string; drawingNo: string; opNo: string; qty: number; mach: number; add: number; perPiece: number; total: number };
  const perMachine = new Map<number, Row[]>();
  let totalTime = 0;

for (const co of completed) {
    const opMeta = operations.find(o => o.id === co.operationId);
    if (!opMeta) continue;
    const part = parts.find(p => p.id === opMeta.partId);
    const settingsMachine = opMeta.machineTime || 0;
    const settingsAdd = opMeta.additionalTime || 0;
    const settingsTotal = settingsMachine + settingsAdd;
    const qty = co.isSetup ? 1 : co.quantity;
    const perPieceFromRecord = typeof co.actualTime === 'number' && qty > 0 ? co.actualTime / qty : undefined;
    // Персональное время на деталь: преимущественно из записи; иначе из настроек
    const perPiece = typeof perPieceFromRecord === 'number' ? perPieceFromRecord : settingsTotal;
    // Разделяем на машинное и добавленное, сохраняя пропорцию из настроек, если она есть
    let machPerPiece = perPiece;
    let addPerPiece = 0;
    if (settingsTotal > 0) {
      const scale = perPiece / settingsTotal;
      machPerPiece = settingsMachine * scale;
      addPerPiece = settingsAdd * scale;
    }
    const total = typeof co.actualTime === 'number' ? co.actualTime : qty * perPiece;
    totalTime += total;
    const rows = perMachine.get(co.machineId) || [];
    const drawingPrefixed = (co.isSetup ? 'Наладка ' : '') + (part?.name || '');
    rows.push({
      index: rows.length + 1,
      // Название детали берём из описания, № чертежа берём из названия
      partName: part?.description || '',
      drawingNo: drawingPrefixed,
      opNo: String(opMeta.name),
      qty,
      // Колонки раздельно: машинное и добавленное; "время детали" = сумма
      mach: machPerPiece,
      add: addPerPiece,
      perPiece: perPiece,
      total,
    });
    perMachine.set(co.machineId, rows);
  }

  const shiftType = getShiftTypeForDate(day, shiftNumber as any);
  const shiftTypeText = shiftType === 'night' ? 'ночная смена' : 'дневная смена';
  // header date text is composed inline in the header columns below

  // Содержимое PDF
  const content: Array<unknown> = [];
  // Заголовок по центру (увеличенный размер)
  content.push({ text: h('НАРЯД-ЗАКАЗ'), alignment: 'center', bold: true, fontSize: 18, margin: [0, 0, 0, 0] });
  // Пустая строка после заголовка
  content.push({ text: ' ', margin: [0, 4, 0, 0] });
  // Одна строка: слева оператор (ФИО подчеркнуто), справа дата (подчеркнуты число, месяц и две цифры года)
  const dayNum = format(day, 'd', { locale: ru });
  const monthName = format(day, 'MMMM', { locale: ru });
  const year4 = format(day, 'yyyy', { locale: ru });
  const yearFirst2 = year4.slice(0, 2);
  const yearLast2 = year4.slice(2);
  content.push({
    columns: [
      {
        alignment: 'left',
        text: [ 'Оператор: ', { text: h(profile?.fullName || ''), decoration: 'underline' } ],
      },
      {
        alignment: 'right',
        text: [
          { text: 'от "' },
          { text: dayNum, decoration: 'underline' },
          { text: '" ' },
          { text: monthName + ' ', decoration: 'underline' },
          { text: yearFirst2 },
          { text: yearLast2, decoration: 'underline' },
          { text: ' г.' },
          { text: `(${shiftTypeText})` },
        ],
      },
    ],
    margin: [0, 0, 0, 8],
  });

  // Шапка таблицы
  const headerFill = '#eeeeee';
  const baseHeaderCell = { bold: true, fillColor: headerFill, alignment: 'center' as const };
  const headerRow = [
    { text: '№', ...baseHeaderCell },
    { text: h('Название детали'), ...baseHeaderCell },
    { text: h('№ чертежа'), ...baseHeaderCell },
    { text: h('№ операции'), ...baseHeaderCell },
    { text: h('кол-во'), ...baseHeaderCell },
    { text: h('Машинное время'), ...baseHeaderCell },
    { text: h('Доб. время'), ...baseHeaderCell },
    { text: h('Время детали'), ...baseHeaderCell },
    { text: h('Общее время'), ...baseHeaderCell },
  ];

  // Единая таблица: шапка -> название станка -> строки
  const tableBody: Array<Array<string | { text: string; bold?: boolean; colSpan?: number; margin?: [number,number,number,number] }>> = [];
  tableBody.push(headerRow as Array<{ text: string; bold?: boolean }>);
  for (const [machineId, rows] of perMachine.entries()) {
    const machine = machines.find(m => m.id === machineId);
    const machineTitle = `${machine?.name || 'Станок'} (${machine?.type === 'lathe' ? 'токарный' : 'фрезерный'})`;
    tableBody.push([
      { text: h(machineTitle), bold: true, colSpan: 9, margin: [0, 4, 0, 2] }, '', '', '', '', '', '', '', ''
    ]);
    for (const r of rows) {
      tableBody.push([
        String(r.index)+'.',
        h(r.partName),
        h(r.drawingNo),
        h(r.opNo),
        `${r.qty} шт.`,
        `${Number(r.mach).toFixed(0)} мин.`,
        `${Number(r.add).toFixed(0)} мин.`,
        `${Number(r.perPiece).toFixed(0)} мин.`,
        `${Number(r.total).toFixed(0)} мин.`,
      ]);
    }
  }
  content.push({
    table: {
      headerRows: 1,
      widths: ['auto','*','auto','auto',50,60,60,60,60],
      body: tableBody,
      heights: (rowIndex: number) => (rowIndex === 0 ? 36 : undefined),
    },
    layout: {
      paddingTop: (i: number) => (i === 0 ? 12 : 4),
      paddingBottom: (i: number) => (i === 0 ? 2 : 4),
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#e0e0e0',
      vLineColor: () => '#e0e0e0',
    },
  });

  if (completed.length === 0) {
    content.push({ text: 'Данные за выбранный день отсутствуют', margin: [0, 6, 0, 0] });
  }

  // Итого
  content.push({ text: ' ' });
  content.push({ columns: [ { text: 'Общее время выработки за смену (мин.)', alignment: 'left' }, { text: String(totalTime), alignment: 'right' } ] });
  if (profile) {
    const coef = profile.baseCoefficient > 0 ? totalTime / profile.baseCoefficient : 0;
    content.push({ columns: [ { text: 'Коэффициент выработки', alignment: 'left' }, { text: coef.toFixed(2), alignment: 'right' } ] });
  }

  const docDefinition = {
    pageSize: 'A5',
    pageOrientation: 'landscape',
    // одинаковые поля слева/справа (и сверху/снизу)
    pageMargins: [36, 36, 36, 36],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    footer: (_currentPage: number, _pageCount: number) => ({
      margin: [28, 0, 28, 16],
      layout: 'noBorders',
      table: {
        widths: ['*', 'auto'],
        body: [[
          { text: h('Выдал: Савин В.В.'), alignment: 'left' },
          {
            alignment: 'right',
            table: {
              widths: ['auto', 240],
              body: [[
                { text: h('Проверил:'), border: [false, false, false, false], margin: [0, 0, 6, 0] },
                { text: ' ', border: [false, false, false, true], margin: [0, 0, 0, 2] },
              ]],
            },
            layout: 'noBorders',
          },
        ]],
      },
    }),
  } as const;

  w.pdfMake.createPdf(docDefinition).download(`daily_${format(day, 'yyyyMMdd')}.pdf`);
}

export async function exportJobsSummary(startIso: string, endIso: string, _shiftNumber: number): Promise<void> {
  await ensurePdfMakeFromCdn();
  const w = globalThis as unknown as { pdfMake: PdfMakeGlobal };

  const start = new Date(startIso);
  const end = new Date(endIso);
  const [machines, operations, parts, profile] = await Promise.all([
    db.machines.toArray(),
    db.operations.toArray(),
    db.parts.toArray(),
    db.profiles.toArray().then(a => (a[0] as UserProfile | undefined) || undefined),
  ]);

  const days = eachDayOfInterval({ start, end });

  const content: Array<any> = [];
  let periodTitle: string;
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const monthName = format(start, 'LLLL', { locale: ru }).toUpperCase();
    periodTitle = `${monthName} ${format(start, 'yyyy', { locale: ru })} г.`;
  } else {
    periodTitle = `${format(start, 'd MMMM yyyy', { locale: ru })} — ${format(end, 'd MMMM yyyy', { locale: ru })}`;
  }
  content.push({ text: h(`ОТЧЕТ ПО РАБОТАМ ЗА ${periodTitle}`), alignment: 'center', bold: true, fontSize: 16, margin: [0, 0, 0, 0] });
  // Пустая строка и ФИО оператора
  content.push({ text: ' ', margin: [0, 4, 0, 0] });
  if (profile?.fullName) {
    content.push({ text: h(`Оператор: ${profile.fullName}`), margin: [0, 0, 0, 6] });
  }

  // Заголовок таблицы (как в ежедневном отчете)
  const headerFill = '#eeeeee';
  const baseHeaderCell = { bold: true, fillColor: headerFill, alignment: 'center' as const };
  const headerRow = [
    { text: '№', ...baseHeaderCell },
    { text: h('Название детали'), ...baseHeaderCell },
    { text: h('№ чертежа'), ...baseHeaderCell },
    { text: h('№ операции'), ...baseHeaderCell },
    { text: h('кол-во'), ...baseHeaderCell },
    { text: h('Машинное время'), ...baseHeaderCell },
    { text: h('Доб. время'), ...baseHeaderCell },
    { text: h('Время детали'), ...baseHeaderCell },
    { text: h('Общее время'), ...baseHeaderCell },
  ];

  let grandTotal = 0;
  let includedShiftCount = 0;
  for (const day of days) {
    // Дата блока
    const dayStrDate = format(day, 'yyyy-MM-dd');
    const sameDayShifts = await db.workShifts
      .filter(s => (s.date || '').split('T')[0] === dayStrDate && (!profile || s.shiftNumber === profile.shiftNumber))
      .toArray();

    // Включаем в отчет только дни, по которым есть сохраненные смены
    if (sameDayShifts.length === 0) continue;

    const completed: CompletedOperation[] = sameDayShifts.flatMap(s => s.completedOperations || []);

    type Row = { index: number; partName: string; drawingNo: string; opNo: string; qty: number; mach: number; add: number; perPiece: number; total: number };
    const perMachine = new Map<number, Row[]>();
    let blockTotal = 0;

    for (const co of completed) {
      const opMeta = operations.find(o => o.id === co.operationId);
      if (!opMeta) continue;
      const part = parts.find(p => p.id === opMeta.partId);
      const settingsMachine = opMeta.machineTime || 0;
      const settingsAdd = opMeta.additionalTime || 0;
      const settingsTotal = settingsMachine + settingsAdd;
      const qty = co.isSetup ? 1 : co.quantity;
      const perPieceFromRecord = typeof co.actualTime === 'number' && qty > 0 ? co.actualTime / qty : undefined;
      const perPiece = typeof perPieceFromRecord === 'number' ? perPieceFromRecord : settingsTotal;
      let machPerPiece = perPiece;
      let addPerPiece = 0;
      if (settingsTotal > 0) {
        const scale = perPiece / settingsTotal;
        machPerPiece = settingsMachine * scale;
        addPerPiece = settingsAdd * scale;
      }
      const total = typeof co.actualTime === 'number' ? co.actualTime : qty * perPiece;
      blockTotal += total;
      const rows = perMachine.get(co.machineId) || [];
      rows.push({
        index: rows.length + 1,
        partName: part?.description || '',
        drawingNo: (co.isSetup ? 'Наладка ' : '') + (part?.name || ''),
        opNo: String(opMeta.name),
        qty,
        mach: machPerPiece,
        add: addPerPiece,
        perPiece,
        total,
      });
      perMachine.set(co.machineId, rows);
    }

    const tableBody: Array<Array<string | { text: string; bold?: boolean; colSpan?: number; margin?: [number,number,number,number] }>> = [];
    tableBody.push(headerRow as Array<{ text: string; bold?: boolean }>);
    // Дата должна быть под шапкой таблицы
    tableBody.push([{ text: format(day, 'd MMMM yyyy', { locale: ru }), colSpan: 9, margin: [0, 4, 0, 2] }, '', '', '', '', '', '', '', '']);
    for (const [machineId, rows] of perMachine.entries()) {
      const machine = machines.find(m => m.id === machineId);
      const machineTitle = `${machine?.name || 'Станок'} (${machine?.type === 'lathe' ? 'токарный' : 'фрезерный'})`;
      tableBody.push([{ text: h(machineTitle), bold: true, colSpan: 9, margin: [0, 4, 0, 2] }, '', '', '', '', '', '', '', '']);
      for (const r of rows) {
        tableBody.push([
          String(r.index)+'.',
          h(r.partName),
          h(r.drawingNo),
          h(r.opNo),
          `${r.qty} шт.`,
          `${Number(r.mach).toFixed(0)} мин.`,
          `${Number(r.add).toFixed(0)} мин.`,
          `${Number(r.perPiece).toFixed(0)} мин.`,
          `${Number(r.total).toFixed(0)} мин.`,
        ]);
      }
    }
    content.push({
      table: { headerRows: 1, widths: ['auto','*','auto','auto',50,60,60,60,60], body: tableBody },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#e0e0e0',
        vLineColor: () => '#e0e0e0',
      },
    });

    grandTotal += blockTotal;
    // Считаем именно количество сохраненных смен как на главной
    includedShiftCount += sameDayShifts.length;
  }

  // Итоговый блок
  const coef = profile && profile.baseCoefficient > 0 && includedShiftCount > 0
    ? grandTotal / (profile.baseCoefficient * includedShiftCount)
    : 0;
  content.push({ text: ' ', margin: [0, 8, 0, 0] });
  content.push({
    table: {
      widths: ['*', 'auto'],
      body: [
        [ { text: 'Общее время за период (мин.)', bold: true }, String(Math.round(grandTotal)) ],
        [ { text: 'Коэффициент выработки', bold: true }, coef.toFixed(2) ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#e0e0e0',
      vLineColor: () => '#e0e0e0',
    },
  });

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    // Поля листа со всех сторон
    pageMargins: [36, 36, 36, 36],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10 },
  } as const;

  w.pdfMake.createPdf(docDefinition).download(`jobs_${format(start, 'yyyyMMdd')}_${format(end, 'yyyyMMdd')}.pdf`);
}

export async function exportMachinesSummary(startIso: string, endIso: string, _shiftNumber: number): Promise<void> {
  await ensurePdfMakeFromCdn();
  const w = globalThis as unknown as { pdfMake: PdfMakeGlobal };

  const start = new Date(startIso);
  const end = new Date(endIso);
  const [machines, operations, parts, profile] = await Promise.all([
    db.machines.toArray(),
    db.operations.toArray(),
    db.parts.toArray(),
    db.profiles.toArray().then(a => (a[0] as UserProfile | undefined) || undefined),
  ]);

  // Собираем смены периода текущего номера смены
  const shifts = await db.workShifts
    .where('date')
    .between(start.toISOString(), end.toISOString(), true, true)
    .filter(s => !profile || s.shiftNumber === profile.shiftNumber)
    .toArray();

  type Agg = { partName: string; drawingNo: string; opNo: string; qty: number; perPiece: number; total: number };
  // machineId -> (operationId + setup/work) -> aggregated row
  const byMachine = new Map<number, Map<string, Agg>>();
  let grandTotal = 0;

  for (const shift of shifts) {
    for (const co of shift.completedOperations) {
      const opMeta = operations.find(o => o.id === co.operationId);
      if (!opMeta) continue;
      const part = parts.find(p => p.id === opMeta.partId);
      const qty = co.isSetup ? 1 : co.quantity;
      const perPiece = typeof co.actualTime === 'number' && qty > 0
        ? co.actualTime / qty
        : (opMeta.machineTime + opMeta.additionalTime);
      const total = typeof co.actualTime === 'number' ? co.actualTime : qty * perPiece;
      grandTotal += total;

      const machineMap = byMachine.get(co.machineId) || new Map<string, Agg>();
      const key = `${opMeta.id}-${co.isSetup ? 'setup' : 'work'}`;
      const current = machineMap.get(key) || {
        partName: part?.description || '',
        drawingNo: (co.isSetup ? 'Наладка ' : '') + (part?.name || ''),
        opNo: String(opMeta.name),
        qty: 0,
        perPiece: 0,
        total: 0,
      };
      const prevQty = current.qty;
      const prevMinutes = current.perPiece * prevQty;
      current.qty = prevQty + qty;
      current.total += total;
      const newMinutes = perPiece * qty;
      const newQty = current.qty;
      current.perPiece = newQty > 0 ? (prevMinutes + newMinutes) / newQty : 0;
      machineMap.set(key, current);
      byMachine.set(co.machineId, machineMap);
    }
  }

  const content: Array<any> = [];
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const monthTitle = `ОТЧЕТ ПО СТАНКАМ ЗА ${format(start, 'LLLL yyyy', { locale: ru })} г.`;
    content.push({ text: h(monthTitle), alignment: 'center', bold: true, fontSize: 16, margin: [0, 0, 0, 0] });
  } else {
    const p1 = 'ОТЧЕТ ПО СТАНКАМ ЗА ПЕРИОД';
    const p2 = `с ${format(start, 'd MMMM yyyy', { locale: ru })} г. по ${format(end, 'd MMMM yyyy', { locale: ru })} г.`;
    content.push({ text: h(p1), alignment: 'center', bold: true, fontSize: 16, margin: [0, 0, 0, 0] });
    content.push({ text: h(p2), alignment: 'center', bold: false, fontSize: 12, margin: [0, 2, 0, 0] });
  }
  content.push({ text: ' ', margin: [0, 4, 0, 0] });
  if (profile?.fullName) content.push({ text: h(`Оператор: ${profile.fullName}`), margin: [0, 0, 0, 6] });

  const headerFill = '#eeeeee';
  const baseHeaderCell = { bold: true, fillColor: headerFill, alignment: 'center' as const };
  const headerRow = [
    { text: '№', ...baseHeaderCell },
    { text: 'Деталь', ...baseHeaderCell },
    { text: '№ чертежа', ...baseHeaderCell },
    { text: '№ операции', ...baseHeaderCell },
    { text: 'Кол-во', ...baseHeaderCell },
    { text: 'Время операции', ...baseHeaderCell },
    { text: 'Минуты', ...baseHeaderCell },
  ];
  // Фиксируем суммарную ширину таблицы ≈ 455pt (безопасный зазор при полях 36 и внешнем отступе 24):
  // №(24) + Деталь(100) + №чертежа(85) + №операции(58) + Кол-во(52) + Время операции(78) + Минуты(58) = 455
  const widthsMachines = [24, 100, 85, 58, 52, 78, 58] as const;

  for (const [machineId, map] of byMachine.entries()) {
    const machine = machines.find(m => m.id === machineId);
    const title = `${machine?.name || 'Станок'} (${machine?.type === 'lathe' ? 'токарный' : 'фрезерный'})`;
    const body: any[] = [headerRow];
    let i = 1;
    for (const agg of map.values()) {
      const perPiece = agg.perPiece > 0 ? agg.perPiece : (agg.total / (agg.qty || 1));
      body.push([
        String(i)+'.',
        h(agg.partName),
        h(agg.drawingNo),
        h(agg.opNo),
        `${agg.qty} шт.`,
        `${Math.round(perPiece)} мин.`,
        `${Math.round(agg.total)} мин.`,
      ]);
      i++;
    }
    content.push({ text: h(title), bold: true, margin: [0, 6, 0, 2] });
    content.push({ table: { headerRows: 1, widths: widthsMachines as any, body }, margin: [24, 0, 24, 0], layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#e0e0e0', vLineColor: () => '#e0e0e0' } });
  }

  // Итог
  const coef = profile && profile.baseCoefficient > 0 && shifts.length > 0
    ? grandTotal / (profile.baseCoefficient * shifts.length)
    : 0;
  content.push({ text: ' ', margin: [0, 8, 0, 0] });
  content.push({ table: { widths: ['*', 'auto'], body: [[{ text: 'Общее время за период (мин.)', bold: true }, String(Math.round(grandTotal))], [{ text: 'Коэффициент выработки', bold: true }, coef.toFixed(2)] ] }, margin: [24, 0, 24, 0], layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#e0e0e0', vLineColor: () => '#e0e0e0' } });

  const docDefinition = { pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [36, 36, 36, 36], content, defaultStyle: { font: 'Roboto', fontSize: 10 } } as const;
  w.pdfMake.createPdf(docDefinition).download(`machines_${format(start, 'yyyyMMdd')}_${format(end, 'yyyyMMdd')}.pdf`);
}

export async function exportAllDetailsSummary(startIso: string, endIso: string, _shiftNumber: number): Promise<void> {
  await ensurePdfMakeFromCdn();
  const w = globalThis as unknown as { pdfMake: PdfMakeGlobal };

  const start = new Date(startIso);
  const end = new Date(endIso);
  const [operations, parts, profile] = await Promise.all([
    db.operations.toArray(),
    db.parts.toArray(),
    db.profiles.toArray().then(a => (a[0] as UserProfile | undefined) || undefined),
  ]);

  // Фильтруем смены периода текущего номера смены
  const shifts = await db.workShifts
    .where('date')
    .between(start.toISOString(), end.toISOString(), true, true)
    .filter(s => !profile || s.shiftNumber === profile.shiftNumber)
    .toArray();

  type Agg = { partName: string; drawingNo: string; opNo: string; qty: number; perPiece: number; total: number };
  const map = new Map<string, Agg>(); // key: partId-opId-(setup|work)

  for (const shift of shifts) {
    for (const co of shift.completedOperations) {
      const opMeta = operations.find(o => o.id === co.operationId);
      if (!opMeta) continue;
      const part = parts.find(p => p.id === opMeta.partId);
      const qty = co.isSetup ? 1 : co.quantity;
      const perPiece = typeof co.actualTime === 'number' && qty > 0
        ? co.actualTime / qty
        : (opMeta.machineTime + opMeta.additionalTime);
      const total = typeof co.actualTime === 'number' ? co.actualTime : qty * perPiece;
      // Разделяем наладки отдельно от основной операции
      const key = `${opMeta.partId}-${opMeta.id}-${co.isSetup ? 'setup' : 'work'}`;
      const current = (map.get(key) as Agg) || ({
        partName: part?.description || '',
        drawingNo: (co.isSetup ? 'Наладка ' : '') + (part?.name || ''),
        opNo: String(opMeta.name),
        qty: 0,
        perPiece: 0,
        total: 0,
      } as Agg);
      current.qty += qty;
      current.total += total;
      // Пересчитываем время операции как взвешенное среднее, чтобы корректно агрегировать
      const prevMinutes = current.perPiece * Math.max(current.qty - qty, 0);
      const newMinutes = perPiece * qty;
      const newQty = current.qty;
      current.perPiece = newQty > 0 ? (prevMinutes + newMinutes) / newQty : 0;
      map.set(key, current);
    }
  }

  const content: Array<any> = [];
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const monthTitle = `ОТЧЕТ ПО ДЕТАЛЯМ ЗА ${format(start, 'LLLL yyyy', { locale: ru })} г.`;
    content.push({ text: h(monthTitle), alignment: 'center', bold: true, fontSize: 16 });
  } else {
    content.push({ text: h('ОТЧЕТ ПО ДЕТАЛЯМ ЗА ПЕРИОД'), alignment: 'center', bold: true, fontSize: 16 });
    content.push({ text: h(`с ${format(start, 'd MMMM yyyy', { locale: ru })} г. по ${format(end, 'd MMMM yyyy', { locale: ru })} г.`), alignment: 'center', margin: [0, 2, 0, 0] });
  }
  content.push({ text: ' ', margin: [0, 4, 0, 0] });
  if (profile?.fullName) content.push({ text: h(`Оператор: ${profile.fullName}`), margin: [0, 0, 0, 6] });

  const headerFill = '#eeeeee';
  const baseHeaderCell = { bold: true, fillColor: headerFill, alignment: 'center' as const };
  const headerRow = [
    { text: '№', ...baseHeaderCell },
    { text: 'Деталь', ...baseHeaderCell },
    { text: '№ чертежа', ...baseHeaderCell },
    { text: '№ операции', ...baseHeaderCell },
    { text: 'Кол-во', ...baseHeaderCell },
    { text: 'Время операции', ...baseHeaderCell },
    { text: 'Минуты', ...baseHeaderCell },
  ];
  // Безопасные фиксированные ширины (сумма ~472pt) + внешний отступ 24 слева/справа
  // Используем те же безопасные ширины, что помогли в отчете по станкам (сумма ~455pt)
  const widths = [24, 100, 85, 58, 52, 78, 58] as const;

  const body: any[] = [headerRow];
  let i = 1;
  let totalMinutes = 0;
  for (const agg of map.values()) {
    totalMinutes += agg.total;
    body.push([
      String(i)+'.',
      h(agg.partName),
      h(agg.drawingNo),
      h(agg.opNo),
      `${agg.qty} шт.`,
      `${Math.round(agg.perPiece)} мин.`,
      `${Math.round(agg.total)} мин.`,
    ]);
    i++;
  }
  content.push({ table: { headerRows: 1, widths: widths as any, body }, margin: [24, 0, 24, 0], layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#e0e0e0', vLineColor: () => '#e0e0e0' } });

  // Итого по всем деталям — сумма минут
  content.push({ text: ' ', margin: [0, 8, 0, 0] });
  content.push({
    table: {
      widths: ['*', 'auto'],
      body: [[{ text: 'Общее время за период (мин.)', bold: true }, String(Math.round(totalMinutes))]],
    },
    margin: [24, 0, 24, 0],
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#e0e0e0', vLineColor: () => '#e0e0e0' },
  });

  const docDefinition = { pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [36, 36, 36, 36], content, defaultStyle: { font: 'Roboto', fontSize: 10 } } as const;
  w.pdfMake.createPdf(docDefinition).download(`details_${format(start, 'yyyyMMdd')}_${format(end, 'yyyyMMdd')}.pdf`);
}

export async function exportSelectedDetailsSummary(startIso: string, endIso: string, _shiftNumber: number, partId: string, opId: string): Promise<void> {
  await ensurePdfMakeFromCdn();
  const w = globalThis as unknown as { pdfMake: PdfMakeGlobal };

  const start = new Date(startIso);
  const end = new Date(endIso);
  const [operations, parts, machines, profile] = await Promise.all([
    db.operations.toArray(),
    db.parts.toArray(),
    db.machines.toArray(),
    db.profiles.toArray().then(a => (a[0] as UserProfile | undefined) || undefined),
  ]);
  const opMetaTarget = operations.find(o => String(o.id) === String(opId) && String(o.partId) === String(partId));
  const partTarget = parts.find(p => String(p.id) === String(partId));

  const shifts = await db.workShifts
    .where('date')
    .between(start.toISOString(), end.toISOString(), true, true)
    .filter(s => !profile || s.shiftNumber === profile.shiftNumber)
    .toArray();

  const machineById = new Map<number, string>(machines.map(m => [m.id as number, m.name]));

  type Row = { date: string; machine: string; qty: number; perPiece: number; total: number; isSetup: boolean };
  const rows: Row[] = [];
  let totalAll = 0;
  let totalQty = 0;
  for (const shift of shifts) {
    for (const co of shift.completedOperations) {
      if (String(co.operationId) !== String(opId)) continue;
      const qty = co.isSetup ? 1 : co.quantity;
      const perPiece = typeof co.actualTime === 'number' && qty > 0
        ? co.actualTime / qty
        : (opMetaTarget?.machineTime || 0) + (opMetaTarget?.additionalTime || 0);
      const total = typeof co.actualTime === 'number' ? co.actualTime : qty * perPiece;
      totalAll += total;
      totalQty += qty;
      const machineName = machineById.get(co.machineId as number) || 'Станок';
      rows.push({ date: format(new Date(shift.date), 'd MMMM yyyy', { locale: ru }), machine: machineName, qty, perPiece, total, isSetup: !!co.isSetup });
    }
  }

  const content: any[] = [];
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const monthTitle = `ОТЧЕТ ПО ВЫБРАННЫМ ДЕТАЛЯМ ЗА ${format(start, 'LLLL yyyy', { locale: ru })} г.`;
    content.push({ text: h(monthTitle), alignment: 'center', bold: true, fontSize: 16 });
  } else {
    content.push({ text: h('ОТЧЕТ ПО ВЫБРАННЫМ ДЕТАЛЯМ ЗА ПЕРИОД'), alignment: 'center', bold: true, fontSize: 16 });
    content.push({ text: h(`с ${format(start, 'd MMMM yyyy', { locale: ru })} г. по ${format(end, 'd MMMM yyyy', { locale: ru })} г.`), alignment: 'center', margin: [0, 2, 0, 0] });
  }
  content.push({ text: ' ', margin: [0, 4, 0, 0] });
  if (profile?.fullName) content.push({ text: h(`Оператор: ${profile.fullName}`), margin: [0, 0, 0, 6] });
  if (partTarget) content.push({ text: h(`Деталь: ${partTarget.description}  |  № чертежа: ${partTarget.name}`), margin: [0, 0, 0, 6] });
  if (opMetaTarget) content.push({ text: h(`Операция: ${opMetaTarget.name}`), margin: [0, 0, 0, 8] });

  const headerFill = '#eeeeee';
  const baseHeaderCell = { bold: true, fillColor: headerFill, alignment: 'center' as const };
  const headerRow = [
    { text: '№', ...baseHeaderCell },
    { text: 'Дата', ...baseHeaderCell },
    { text: 'Станок', ...baseHeaderCell },
    { text: 'Кол-во', ...baseHeaderCell },
    { text: 'Время операции', ...baseHeaderCell },
    { text: 'Минуты', ...baseHeaderCell },
  ];
  // Безопасные ширины с запасом (сумма ≈ 449pt) + внешние отступы 24 слева/справа
  // №(24) + Дата(120) + Станок(120) + Кол-во(60) + Время операции(70) + Минуты(55) = 449
  const widths = [24, 120, 120, 60, 70, 55] as const;

  const body: any[] = [headerRow];
  let i = 1;
  for (const r of rows) {
    body.push([
      String(i)+'.',
      h(`${r.isSetup ? 'Наладка — ' : ''}${r.date}`),
      h(r.machine),
      `${r.qty} шт.`,
      `${Math.round(r.perPiece)} мин.`,
      `${Math.round(r.total)} мин.`,
    ]);
    i++;
  }
  content.push({ table: { headerRows: 1, widths: widths as any, body }, margin: [24, 0, 24, 0], layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#e0e0e0', vLineColor: () => '#e0e0e0', paddingLeft: () => 2, paddingRight: () => 2 } });

  content.push({ text: ' ', margin: [0, 8, 0, 0] });
  content.push({ table: { widths: ['*', 'auto'], body: [
    [{ text: 'Общее количество за период (шт.)', bold: true }, String(totalQty)],
    [{ text: 'Общее время за период (мин.)', bold: true }, String(Math.round(totalAll))],
  ] }, margin: [24, 0, 24, 0], layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#e0e0e0', vLineColor: () => '#e0e0e0' } });

  const docDefinition = { pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [36, 36, 36, 36], content, defaultStyle: { font: 'Roboto', fontSize: 10 } } as const;
  w.pdfMake.createPdf(docDefinition).download(`selected_${format(start, 'yyyyMMdd')}_${format(end, 'yyyyMMdd')}.pdf`);
}

export async function exportDailyReportExcel(dateIso: string, shiftNumber: number): Promise<void> {
  const day = new Date(dateIso);
  const start = new Date(day); start.setHours(0,0,0,0);
  const end = new Date(day); end.setHours(23,59,59,999);

  let savedShift = await db.workShifts
    .where('date')
    .between(start.toISOString(), end.toISOString(), true, true)
    .filter(s => s.shiftNumber === shiftNumber)
    .first();
  const [machines, operations, parts, profile] = await Promise.all([
    db.machines.toArray(),
    db.operations.toArray(),
    db.parts.toArray(),
    db.profiles.toArray().then(a => (a[0] as UserProfile | undefined) || undefined),
  ]);

  // Fallback: если по номеру смены не нашли, берем любую смену за день
  if (!savedShift) {
    savedShift = await db.workShifts
      .where('date')
      .between(start.toISOString(), end.toISOString(), true, true)
      .first();
  }
  // Последняя попытка: поиск по локальной дате (на случай смещения по времени)
  if (!savedShift) {
    const dayStr = format(day, 'yyyy-MM-dd');
    const allShifts = await db.workShifts.toArray();
    savedShift = allShifts.find(s => (s.date || '').split('T')[0] === dayStr && s.shiftNumber === shiftNumber)
      || allShifts.find(s => (s.date || '').split('T')[0] === dayStr);
  }

  // Собираем все операции за день (все смены этого дня, не только по номеру)
  const dayStr = format(day, 'yyyy-MM-dd');
  const sameDayShifts = await db.workShifts
    .filter(s => (s.date || '').split('T')[0] === dayStr)
    .toArray();
  const completed: CompletedOperation[] = sameDayShifts.flatMap(s => s.completedOperations || []);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Отчет за смену');

  // Настройка ширины колонок: 6-9 одинаковой ширины
  ws.columns = [
    { width: 8 },   // A №
    { width: 28 },  // B Название детали
    { width: 24 },  // C № чертежа
    { width: 18 },  // D № операции
    { width: 18 },  // E кол-во (увеличено для "99 шт.")
    { width: 20 },  // F Машинное
    { width: 20 },  // G Добавленное
    { width: 20 },  // H Время детали
    { width: 20 },  // I Общее время
  ];

  // Заголовок: Оператор и дата/тип смены
  const shiftType = getShiftTypeForDate(day, shiftNumber as any);
  const shiftTypeText = shiftType === 'night' ? 'ночная смена' : 'дневная смена';
  const dateText = `"${format(day, 'd', { locale: ru })}" ${format(day, 'MMMM yyyy', { locale: ru })} г. (${shiftTypeText})`;
  ws.addRow(['НАРЯД-ЗАКАЗ', '', '', '', `Оператор: ${profile?.fullName || ''}`, '', '', '', '']);
  ws.addRow(['', '', '', '', dateText, '', '', '', '']);
  ws.addRow([]);

  // Шапка таблицы
  const headerRow = ws.addRow([
    'Отчет о работе ',
    'Название детали',
    '№ чертежа',
    '№ операции',
    'кол-во',
    'Машинное время',
    'Доб. время',
    'Время детали',
    'Общее время',
  ]);
  headerRow.font = { bold: true };
  // Повернуть заголовки для F:I на 90 градусов
  for (let c = 6; c <= 9; c++) {
    const cell = headerRow.getCell(c);
    cell.alignment = { textRotation: 90, vertical: 'bottom', horizontal: 'center', wrapText: true } as any;
  }

  // Группировка по станкам
  const perMachine = new Map<number, CompletedOperation[]>();
  for (const co of completed) {
    perMachine.set(co.machineId, [...(perMachine.get(co.machineId) || []), co]);
  }

  let totalTime = 0;
  for (const [machineId, rows] of perMachine.entries()) {
    const machine = machines.find(m => m.id === machineId);
    const titleRow = ws.addRow([`${machine?.name || 'Станок'} (${machine?.type === 'lathe' ? 'токарный' : 'фрезерный'}) `]);
    titleRow.font = { bold: true };
    ws.mergeCells(`A${titleRow.number}:I${titleRow.number}`);
    let counter = 1;
    for (const co of rows) {
      const opMeta = operations.find(o => o.id === co.operationId);
      if (!opMeta) continue;
      const part: Part | undefined = parts.find(p => p.id === opMeta.partId);
      const settingsMachine = opMeta.machineTime || 0;
      const settingsAdd = opMeta.additionalTime || 0;
      const settingsTotal = settingsMachine + settingsAdd;
      const qty = co.isSetup ? 1 : co.quantity;
      const perPieceFromRecord = typeof co.actualTime === 'number' && qty > 0 ? co.actualTime / qty : undefined;
      const perPiece = typeof perPieceFromRecord === 'number' ? perPieceFromRecord : settingsTotal;
      let machPerPiece = perPiece;
      let addPerPiece = 0;
      if (settingsTotal > 0) {
        const scale = perPiece / settingsTotal;
        machPerPiece = settingsMachine * scale;
        addPerPiece = settingsAdd * scale;
      }
      const total = typeof co.actualTime === 'number' ? co.actualTime : qty * perPiece;
      totalTime += total;
      ws.addRow([
        `${counter}.`,
        // Название детали из описания, № чертежа из названия
        part?.description || '',
        (co.isSetup ? 'Наладка ' : '') + (part?.name || ''),
        opMeta.name,
        `${qty} шт.`,
        // Разделяем время на машинное и добавленное по пропорции из настроек
        `${Math.round(machPerPiece)} мин.`,
        `${Math.round(addPerPiece)} мин.`,
        `${Math.round(perPiece)} мин.`,
        `${Math.round(total)} мин.`,
      ]);
      counter++;
    }
  }

  ws.addRow({});
  ws.addRow(['', '', '', 'Общее время выработки за смену (мин.)', '', '', '', '', totalTime]);

  // Коэффициент выработки, если есть профиль
  if (profile) {
    // Коэффициент = totalTime / baseCoefficient
    const coef = profile.baseCoefficient > 0 ? totalTime / profile.baseCoefficient : 0;
    ws.addRow(['', '', '', 'Коэффициент выработки', '', '', '', '', Number(coef.toFixed(2))]);
  }

  // Если операций не было, добавим пометку
  if (completed.length === 0) {
    ws.addRow({});
    ws.addRow(['', '', '', '', 'Данные за выбранный день отсутствуют']);
  }


  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily_${format(day, 'yyyyMMdd')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Экспорт отчета в Excel
 */
export async function exportToExcel(report: MonthlyReport | PeriodReport): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Отчет');
  
  // Заголовки
  worksheet.addRow(['Отчет']);
  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').font = { size: 16, bold: true };
  
  if ('month' in report) {
    worksheet.addRow(['Период', `${report.month}/${report.year}`]);
  } else {
    worksheet.addRow(['Период', `${report.startDate} - ${report.endDate}`]);
  }
  
  worksheet.addRow(['Количество смен', report.workShifts.length]);
  worksheet.addRow(['Базовый коэффициент', `${report.baseCoefficient} мин`]);
  
  if ('monthly' in report.calculatedCoefficients) {
    worksheet.addRow([
      'Коэффициент за период',
      report.calculatedCoefficients.monthly.toFixed(2),
    ]);
  } else {
    worksheet.addRow([
      'Коэффициент за период',
      report.calculatedCoefficients.period.toFixed(2),
    ]);
  }
  
  worksheet.addRow(['Заработная плата', `${report.salary.toFixed(2)} руб.`]);
  
  // Таблица смен
  worksheet.addRow([]);
  worksheet.addRow(['Дата', 'Тип смены', 'Длительность', 'Подработка']);
  
  report.workShifts.forEach((shift) => {
    worksheet.addRow([
      shift.date,
      shift.shiftType === 'day' ? 'Дневная' : 'Ночная',
      `${shift.duration} мин`,
      shift.isOvertime ? 'Да' : 'Нет',
    ]);
  });
  
  // Форматирование колонок
  worksheet.columns.forEach((column) => {
    column.width = 20;
  });
  
  // Сохранение файла
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `report_${Date.now()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Открыть диалог для отправки отчета
 */
export async function shareReport(
  report: MonthlyReport | PeriodReport,
  format: 'pdf' | 'excel'
): Promise<void> {
  if (format === 'pdf') {
    await exportToPDF(report);
  } else {
    await exportToExcel(report);
  }
}


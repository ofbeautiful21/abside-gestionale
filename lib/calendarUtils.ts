// lib/calendarUtils.ts
import type {
  GridConfig,
  Appuntamento,
  CalendarBlock,
  Operatrice,
} from '@/types';

export const SLOT_MIN = 15;

export function totalSlots(cfg: GridConfig) {
  return ((cfg.dayEndHour - cfg.dayStartHour) * 60) / SLOT_MIN;
}

export function slotToMins(slot: number, cfg: GridConfig) {
  return cfg.dayStartHour * 60 + slot * SLOT_MIN;
}

export function dateToSlot(date: Date, cfg: GridConfig) {
  const mins = date.getHours() * 60 + date.getMinutes();
  return Math.floor((mins - cfg.dayStartHour * 60) / SLOT_MIN);
}

export function slotToDate(slot: number, cfg: GridConfig, base: Date): Date {
  const d = new Date(base);
  const m = cfg.dayStartHour * 60 + slot * SLOT_MIN;
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

export function slotToStr(slot: number, cfg: GridConfig): string {
  const m = slotToMins(slot, cfg);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(
    m % 60
  ).padStart(2, '0')}`;
}

export function buildLabels(cfg: GridConfig) {
  return Array.from({ length: totalSlots(cfg) }, (_, i) => {
    const mins = slotToMins(i, cfg) % 60;
    return {
      slot: i,
      label: mins === 0 || mins === 30 ? slotToStr(i, cfg) : '',
      isHour: mins === 0,
      isHalf: mins === 30,
    };
  });
}

export function buildBlocks(
  appts: Appuntamento[],
  ops: Operatrice[],
  cfg: GridConfig
): CalendarBlock[] {
  const idx = new Map(ops.map((o, i) => [o.id, i]));
  return appts
    .filter((a) => a.stato !== 'disdetto')
    .map((a) => {
      const start = new Date(a.data_ora_inizio);
      const end = new Date(a.data_ora_fine);
      const startSlot = dateToSlot(start, cfg);
      const spanSlots = Math.max(1, dateToSlot(end, cfg) - startSlot);
      return {
        appuntamento: a,
        startSlot,
        spanSlots,
        colIndex: idx.get(a.id_operatrice) ?? -1,
      };
    })
    .filter((b) => b.colIndex >= 0 && b.startSlot >= 0);
}

export function hexAlpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function contrastColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
    ? '#1a1a2e'
    : '#ffffff';
}

export function blockColors(block: CalendarBlock, cfg: GridConfig) {
  const a = block.appuntamento;
  const base =
    cfg.colorScheme === 'stato'
      ? cfg.statoColors[a.stato]
      : a.operatrice?.colore ?? '#6366F1';
  return {
    bg: hexAlpha(base, 0.14),
    border: hexAlpha(base, 0.9),
    text: '#1a1a2e',
    dot: base,
  };
}

export function formatDate(d: Date) {
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hasConflict(
  appts: Appuntamento[],
  opId: string,
  start: Date,
  end: Date,
  excludeId?: string
) {
  return appts
    .filter(
      (a) =>
        a.id_operatrice === opId && a.stato !== 'disdetto' && a.id !== excludeId
    )
    .some(
      (a) =>
        new Date(a.data_ora_inizio) < end && new Date(a.data_ora_fine) > start
    );
}

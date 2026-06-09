// types/index.ts — Tutti i tipi del progetto

export type OperatriceStato = 'attiva' | 'inattiva';
export type AppuntamentoStato = 'confermato' | 'disdetto' | 'in_attesa';
export type ColorScheme = 'operatrice' | 'stato';
export type MemoColor =
  | '#fef9c3'
  | '#fce7f3'
  | '#dbeafe'
  | '#dcfce7'
  | '#ffe4e6'
  | '#ede9fe'
  | '#ffedd5';
export type MemoScope = 'day' | 'global';

export interface Operatrice {
  id: string;
  nome: string;
  colore: string;
  stato: OperatriceStato;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoriaServizio {
  id: string;
  nome: string;
  created_at: string;
  updated_at: string;
}

export interface Servizio {
  id: string;
  nome: string;
  durata_minuti: number;
  prezzo: number;
  id_categoria: string;
  attivo: boolean;
  created_at: string;
  updated_at: string;
  categoria?: CategoriaServizio;
}

export interface Appuntamento {
  id: string;
  id_cliente: string;
  id_operatrice: string;
  id_servizio: string;
  data_ora_inizio: string;
  data_ora_fine: string;
  stato: AppuntamentoStato;
  note: string | null;
  created_at: string;
  updated_at: string;
  cliente?: Pick<Cliente, 'id' | 'nome' | 'cognome' | 'telefono'>;
  operatrice?: Pick<Operatrice, 'id' | 'nome' | 'colore'>;
  servizio?: Pick<Servizio, 'id' | 'nome' | 'durata_minuti' | 'prezzo'>;
}

export interface Memo {
  id: string;
  data_riferimento: string;
  testo: string;
  created_at: string;
  updated_at: string;
}

export interface MemoWidget {
  id: string;
  testo: string;
  color: MemoColor;
  scope: MemoScope;
  data_riferimento: string | null;
  posX: number;
  posY: number;
  width: number;
  archived: boolean;
  zIndex: number;
  created_at: string;
  updated_at: string;
}

export interface CalendarBlock {
  appuntamento: Appuntamento;
  startSlot: number;
  spanSlots: number;
  colIndex: number;
}

export interface SlotClickInfo {
  operatriceId: string;
  startTime: Date;
}

export interface GridConfig {
  slotHeight: number;
  colMinWidth: number;
  gridLineColor: string;
  gridLineOpacity: number;
  hourLineWidth: number;
  halfHourLineWidth: number;
  quarterLineVisible: boolean;
  blockBorderRadius: number;
  blockPadding: number;
  blockOpacity: number;
  showClientName: boolean;
  showServiceName: boolean;
  showTimeRange: boolean;
  showPrice: boolean;
  colorScheme: ColorScheme;
  statoColors: { confermato: string; in_attesa: string; disdetto: string };
  dayStartHour: number;
  dayEndHour: number;
  blockFontSize: number;
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  slotHeight: 28,
  colMinWidth: 160,
  gridLineColor: '#e0dbd4',
  gridLineOpacity: 0.8,
  hourLineWidth: 1,
  halfHourLineWidth: 0.5,
  quarterLineVisible: true,
  blockBorderRadius: 6,
  blockPadding: 5,
  blockOpacity: 1,
  showClientName: true,
  showServiceName: true,
  showTimeRange: true,
  showPrice: false,
  colorScheme: 'operatrice',
  statoColors: {
    confermato: '#3d8a6e',
    in_attesa: '#c17d2c',
    disdetto: '#c94040',
  },
  dayStartHour: 8,
  dayEndHour: 20,
  blockFontSize: 11,
};

export type ClienteInput = {
  nome: string;
  cognome: string;
  telefono?: string;
  note?: string;
};
export type ServizioInput = {
  nome: string;
  durata_minuti: number;
  prezzo: number;
  id_categoria: string;
  attivo?: boolean;
};

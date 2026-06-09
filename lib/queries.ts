// lib/queries.ts — Tutte le query Supabase
import { getSupabase } from './supabase';
import type {
  Cliente,
  ClienteInput,
  CategoriaServizio,
  Servizio,
  ServizioInput,
  Appuntamento,
  Memo,
  AppuntamentoStato,
} from '@/types';

const db = () => getSupabase();

// ── OPERATRICI ────────────────────────────────────────────────
export async function fetchOperatrici() {
  const { data, error } = await db()
    .from('operatrici')
    .select('*')
    .eq('stato', 'attiva')
    .order('nome');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── APPUNTAMENTI ──────────────────────────────────────────────
export async function fetchAppuntamentiDelGiorno(date: Date) {
  const s = date.toISOString().split('T')[0];
  const { data, error } = await db()
    .from('appuntamenti')
    .select(
      '*, cliente:clienti(id,nome,cognome,telefono), operatrice:operatrici(id,nome,colore), servizio:servizi(id,nome,durata_minuti,prezzo)'
    )
    .gte('data_ora_inizio', `${s}T00:00:00`)
    .lte('data_ora_inizio', `${s}T23:59:59`)
    .order('data_ora_inizio');
  if (error) throw new Error(error.message);
  return (data as unknown as Appuntamento[]) ?? [];
}

export async function createAppuntamento(
  values: {
    id_cliente: string;
    id_operatrice: string;
    id_servizio: string;
    data: string;
    ora_inizio: string;
    stato: AppuntamentoStato;
    note: string;
  },
  durata: number
) {
  const start = new Date(`${values.data}T${values.ora_inizio}:00`);
  const end = new Date(start.getTime() + durata * 60000);
  const { data, error } = await db()
    .from('appuntamenti')
    .insert({
      id_cliente: values.id_cliente,
      id_operatrice: values.id_operatrice,
      id_servizio: values.id_servizio,
      data_ora_inizio: start.toISOString(),
      data_ora_fine: end.toISOString(),
      stato: values.stato,
      note: values.note || null,
    })
    .select(
      '*, cliente:clienti(id,nome,cognome,telefono), operatrice:operatrici(id,nome,colore), servizio:servizi(id,nome,durata_minuti,prezzo)'
    )
    .single();
  if (error) {
    if (error.message.includes('Sovrapposizione'))
      throw new Error(
        "⚠️ L'operatrice ha già un appuntamento in questo orario."
      );
    throw new Error(error.message);
  }
  return data as unknown as Appuntamento;
}

export async function updateStatoAppuntamento(
  id: string,
  stato: AppuntamentoStato
) {
  const { error } = await db()
    .from('appuntamenti')
    .update({ stato })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ── CLIENTI ───────────────────────────────────────────────────
export async function fetchClienti(search?: string) {
  let q = db().from('clienti').select('*').order('cognome').order('nome');
  if (search?.trim())
    q = q.or(
      `cognome.ilike.%${search}%,nome.ilike.%${search}%,telefono.ilike.%${search}%`
    );
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as Cliente[]) ?? [];
}

export async function searchClienti(q: string) {
  const { data, error } = await db()
    .from('clienti')
    .select('id,nome,cognome,telefono')
    .or(`cognome.ilike.%${q}%,nome.ilike.%${q}%`)
    .order('cognome')
    .limit(20);
  if (error) throw new Error(error.message);
  return (
    (data as Pick<Cliente, 'id' | 'nome' | 'cognome' | 'telefono'>[]) ?? []
  );
}

export async function createCliente(input: ClienteInput) {
  const { data, error } = await db()
    .from('clienti')
    .insert({
      nome: input.nome.trim(),
      cognome: input.cognome.trim(),
      telefono: input.telefono?.trim() || null,
      note: input.note?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Cliente;
}

export async function updateCliente(id: string, input: Partial<ClienteInput>) {
  const p: Record<string, unknown> = {};
  if (input.nome !== undefined) p.nome = input.nome.trim();
  if (input.cognome !== undefined) p.cognome = input.cognome.trim();
  if (input.telefono !== undefined) p.telefono = input.telefono.trim() || null;
  if (input.note !== undefined) p.note = input.note.trim() || null;
  const { data, error } = await db()
    .from('clienti')
    .update(p)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Cliente;
}

export async function deleteCliente(id: string) {
  const { error } = await db().from('clienti').delete().eq('id', id);
  if (error) {
    if (error.code === '23503')
      throw new Error('Il cliente ha appuntamenti associati.');
    throw new Error(error.message);
  }
}

// ── CATEGORIE ─────────────────────────────────────────────────
export async function fetchCategorie() {
  const { data, error } = await db()
    .from('categorie_servizi')
    .select('*')
    .order('nome');
  if (error) throw new Error(error.message);
  return (data as CategoriaServizio[]) ?? [];
}

export async function createCategoria(nome: string) {
  const { data, error } = await db()
    .from('categorie_servizi')
    .insert({ nome: nome.trim() })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Categoria già esistente.');
    throw new Error(error.message);
  }
  return data as CategoriaServizio;
}

export async function updateCategoria(id: string, nome: string) {
  const { data, error } = await db()
    .from('categorie_servizi')
    .update({ nome: nome.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CategoriaServizio;
}

export async function deleteCategoria(id: string) {
  const { error } = await db().from('categorie_servizi').delete().eq('id', id);
  if (error) {
    if (error.code === '23503')
      throw new Error('La categoria ha servizi associati.');
    throw new Error(error.message);
  }
}

// ── SERVIZI ───────────────────────────────────────────────────
export async function fetchServizi() {
  const { data, error } = await db()
    .from('servizi')
    .select('*, categoria:categorie_servizi(id,nome)')
    .order('nome');
  if (error) throw new Error(error.message);
  return (data as unknown as Servizio[]) ?? [];
}

export async function fetchServiziAttivi() {
  const { data, error } = await db()
    .from('servizi')
    .select('*, categoria:categorie_servizi(id,nome)')
    .eq('attivo', true)
    .order('nome');
  if (error) throw new Error(error.message);
  return (data as unknown as Servizio[]) ?? [];
}

export async function createServizio(input: ServizioInput) {
  const { data, error } = await db()
    .from('servizi')
    .insert({
      nome: input.nome.trim(),
      durata_minuti: input.durata_minuti,
      prezzo: input.prezzo,
      id_categoria: input.id_categoria,
      attivo: input.attivo ?? true,
    })
    .select('*, categoria:categorie_servizi(id,nome)')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Nome servizio già esistente.');
    throw new Error(error.message);
  }
  return data as unknown as Servizio;
}

export async function updateServizio(
  id: string,
  input: Partial<ServizioInput>
) {
  const p: Record<string, unknown> = {};
  if (input.nome !== undefined) p.nome = input.nome.trim();
  if (input.durata_minuti !== undefined) p.durata_minuti = input.durata_minuti;
  if (input.prezzo !== undefined) p.prezzo = input.prezzo;
  if (input.id_categoria !== undefined) p.id_categoria = input.id_categoria;
  if (input.attivo !== undefined) p.attivo = input.attivo;
  const { data, error } = await db()
    .from('servizi')
    .update(p)
    .eq('id', id)
    .select('*, categoria:categorie_servizi(id,nome)')
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Servizio;
}

export async function deleteServizio(id: string) {
  const { error } = await db().from('servizi').delete().eq('id', id);
  if (error) {
    if (error.code === '23503')
      throw new Error('Servizio con appuntamenti associati.');
    throw new Error(error.message);
  }
}

// ── MEMO ──────────────────────────────────────────────────────
export async function fetchMemo(date: Date) {
  const s = date.toISOString().split('T')[0];
  const { data, error } = await db()
    .from('memo')
    .select('*')
    .eq('data_riferimento', s)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data as Memo[]) ?? [];
}

export async function createMemo(testo: string, date: Date) {
  const { data, error } = await db()
    .from('memo')
    .insert({
      testo: testo.trim(),
      data_riferimento: date.toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Memo;
}

export async function updateMemo(id: string, testo: string) {
  const { data, error } = await db()
    .from('memo')
    .update({ testo: testo.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Memo;
}

export async function deleteMemo(id: string) {
  const { error } = await db().from('memo').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  fetchClienti,
  createCliente,
  updateCliente,
  deleteCliente,
} from '@/lib/queries';
import { Toast, useToast, Confirm, Spinner, Empty } from '@/components/ui';
import type { Cliente, ClienteInput } from '@/types';

const EMPTY: ClienteInput = { nome: '', cognome: '', telefono: '', note: '' };

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast, ok, err, clear } = useToast();
  const [confirm, setConfirm] = useState<{ id: string; label: string } | null>(
    null
  );
  const [panel, setPanel] = useState<{
    mode: 'add' | 'edit';
    cliente?: Cliente;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      setClienti(await fetchClienti(q));
    } catch (e) {
      err((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await deleteCliente(confirm.id);
      setClienti((p) => p.filter((c) => c.id !== confirm.id));
      ok('Cliente eliminato.');
    } catch (e) {
      err((e as Error).message);
    } finally {
      setConfirm(null);
    }
  };

  const initials = (c: Cliente) =>
    `${c.nome[0] ?? ''}${c.cognome[0] ?? ''}`.toUpperCase();

  return (
    <div className="sec">
      <div className="sec-head">
        <div>
          <h1 className="sec-title">Clienti</h1>
          <p className="sec-sub">
            {loading ? '…' : `${clienti.length} clienti`}
          </p>
        </div>
        <div className="sec-actions">
          <div className="search-wrap">
            <svg
              className="search-ico"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="search-inp"
              placeholder="Cerca per cognome, nome, telefono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clr" onClick={() => setSearch('')}>
                ×
              </button>
            )}
          </div>
          <button className="btn-add" onClick={() => setPanel({ mode: 'add' })}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuovo cliente
          </button>
        </div>
      </div>

      <div className="sec-body">
        {loading ? (
          <div className="loading">
            <Spinner size={24} />
          </div>
        ) : clienti.length === 0 ? (
          <Empty
            icon="👤"
            title={search ? 'Nessun risultato.' : 'Nessun cliente ancora.'}
            sub={search ? 'Prova altri termini.' : 'Aggiungi il primo cliente.'}
          />
        ) : (
          <div className="tbl-wrap">
            <table className="dtbl">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefono</th>
                  <th>Note</th>
                  <th style={{ textAlign: 'right' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {clienti.map((c) => (
                  <ClienteRow
                    key={c.id}
                    cliente={c}
                    initials={initials(c)}
                    expanded={expandedId === c.id}
                    onToggle={() =>
                      setExpandedId((p) => (p === c.id ? null : c.id))
                    }
                    onEdit={() => setPanel({ mode: 'edit', cliente: c })}
                    onDelete={() =>
                      setConfirm({ id: c.id, label: `${c.cognome} ${c.nome}` })
                    }
                    onNoteSaved={(note) => {
                      setClienti((p) =>
                        p.map((x) => (x.id === c.id ? { ...x, note } : x))
                      );
                      ok('Note salvate.');
                    }}
                    onError={err}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {panel && (
        <ClientePanel
          mode={panel.mode}
          cliente={panel.cliente}
          onClose={() => setPanel(null)}
          onSaved={(saved) => {
            if (panel.mode === 'add')
              setClienti((p) =>
                [...p, saved].sort((a, b) => a.cognome.localeCompare(b.cognome))
              );
            else
              setClienti((p) => p.map((c) => (c.id === saved.id ? saved : c)));
            ok(
              panel.mode === 'add' ? 'Cliente aggiunto.' : 'Cliente aggiornato.'
            );
            setPanel(null);
          }}
          onError={err}
        />
      )}

      {confirm && (
        <Confirm
          msg={`Eliminare ${confirm.label}? L'operazione è irreversibile.`}
          onOk={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={clear} />}
    </div>
  );
}

// ── Riga tabella con note espandibili ─────────────────────────
function ClienteRow({
  cliente: c,
  initials,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onNoteSaved,
  onError,
}: {
  cliente: Cliente;
  initials: string;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNoteSaved: (note: string) => void;
  onError: (m: string) => void;
}) {
  const [draft, setDraft] = useState(c.note ?? '');
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    setSaving(true);
    try {
      await updateCliente(c.id, { note: draft });
      onNoteSaved(draft);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr style={{ background: expanded ? 'var(--gold-p)' : undefined }}>
        <td>
          <div className="c-cell">
            <div className="c-av">{initials}</div>
            <span className="c-name">
              {c.cognome} {c.nome}
            </span>
          </div>
        </td>
        <td>
          <span className="c-tel">{c.telefono ?? '—'}</span>
        </td>
        <td>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 99,
              border: `1px solid ${c.note ? 'var(--gold-l)' : 'var(--s200)'}`,
              background: c.note ? 'var(--gold-p)' : 'transparent',
              fontSize: 11,
              fontWeight: 500,
              color: c.note ? 'var(--amber)' : 'var(--s500)',
              cursor: 'pointer',
            }}
            onClick={onToggle}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {c.note ? 'Vedi note' : 'Aggiungi'}
          </button>
        </td>
        <td>
          <div className="row-acts">
            <button className="act-btn" onClick={onEdit} title="Modifica">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button className="act-btn del" onClick={onDelete} title="Elimina">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="notes-row">
          <td colSpan={4}>
            <div className="notes-panel">
              <p className="notes-lbl">
                Note per{' '}
                <strong>
                  {c.cognome} {c.nome}
                </strong>
              </p>
              <textarea
                className="notes-ta"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Allergie, preferenze estetiche, trattamenti passati…"
                rows={4}
              />
              <div className="notes-foot">
                <span className="notes-hint">
                  Visibili durante la prenotazione.
                </span>
                <button
                  className="btn-save-note"
                  onClick={saveNote}
                  disabled={saving}
                >
                  {saving ? <Spinner size={12} /> : 'Salva note'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Pannello add/edit ─────────────────────────────────────────
function ClientePanel({
  mode,
  cliente,
  onClose,
  onSaved,
  onError,
}: {
  mode: 'add' | 'edit';
  cliente?: Cliente;
  onClose: () => void;
  onSaved: (c: Cliente) => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState<ClienteInput>(
    cliente
      ? {
          nome: cliente.nome,
          cognome: cliente.cognome,
          telefono: cliente.telefono ?? '',
          note: cliente.note ?? '',
        }
      : EMPTY
  );
  const [errs, setErrs] = useState<Partial<Record<keyof ClienteInput, string>>>(
    {}
  );
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: typeof errs = {};
    if (!form.cognome.trim()) e.cognome = 'Cognome obbligatorio';
    if (!form.nome.trim()) e.nome = 'Nome obbligatorio';
    if (form.telefono && !/^\+?[\d\s\-]{6,20}$/.test(form.telefono))
      e.telefono = 'Formato non valido';
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved =
        mode === 'add'
          ? await createCliente(form)
          : await updateCliente(cliente!.id, form);
      onSaved(saved);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof ClienteInput, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sp-hdr">
          <h2 className="sp-title">
            {mode === 'add' ? 'Nuovo cliente' : 'Modifica cliente'}
          </h2>
          <button className="sp-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={submit} className="sp-body" noValidate>
          <div className="f-row2">
            <div className="f-group">
              <label className="f-lbl">
                Cognome <span className="req">*</span>
              </label>
              <input
                className={`f-inp ${errs.cognome ? 'err' : ''}`}
                value={form.cognome}
                onChange={(e) => set('cognome', e.target.value)}
                placeholder="Rossi"
                autoFocus
              />
              {errs.cognome && <span className="f-err">{errs.cognome}</span>}
            </div>
            <div className="f-group">
              <label className="f-lbl">
                Nome <span className="req">*</span>
              </label>
              <input
                className={`f-inp ${errs.nome ? 'err' : ''}`}
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Maria"
              />
              {errs.nome && <span className="f-err">{errs.nome}</span>}
            </div>
          </div>
          <div className="f-group">
            <label className="f-lbl">Telefono</label>
            <input
              className={`f-inp ${errs.telefono ? 'err' : ''}`}
              value={form.telefono}
              onChange={(e) => set('telefono', e.target.value)}
              placeholder="+39 347 123 4567"
              type="tel"
            />
            {errs.telefono && <span className="f-err">{errs.telefono}</span>}
          </div>
          <div className="f-group">
            <label className="f-lbl">Note cliente</label>
            <textarea
              className="f-ta"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Allergie, preferenze, annotazioni…"
              rows={4}
            />
          </div>
          <div className="sp-foot">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner size={14} />}
              {mode === 'add' ? 'Aggiungi cliente' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

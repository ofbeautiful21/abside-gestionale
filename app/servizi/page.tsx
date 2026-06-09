'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  fetchCategorie,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  fetchServizi,
  createServizio,
  updateServizio,
  deleteServizio,
} from '@/lib/queries';
import { Toast, useToast, Confirm, Spinner, Empty } from '@/components/ui';
import type { CategoriaServizio, Servizio, ServizioInput } from '@/types';

const DURATE = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180];

export default function ServiziPage() {
  const [categorie, setCategorie] = useState<CategoriaServizio[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const { toast, ok, err, clear } = useToast();
  const [confirm, setConfirm] = useState<{
    type: 'cat' | 'svc';
    id: string;
    label: string;
  } | null>(null);
  const [editingCat, setEditingCat] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [svcPanel, setSvcPanel] = useState<{
    mode: 'add' | 'edit';
    servizio?: Servizio;
    categoriaId?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, svcs] = await Promise.all([
        fetchCategorie(),
        fetchServizi(),
      ]);
      setCategorie(cats);
      setServizi(svcs);
      setOpenCats(new Set(cats.map((c) => c.id)));
    } catch (e) {
      err((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCat = (id: string) =>
    setOpenCats((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const handleAddCategoria = async () => {
    if (!newCatName.trim()) return;
    try {
      const cat = await createCategoria(newCatName);
      setCategorie((p) =>
        [...p, cat].sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setOpenCats((p) => new Set([...p, cat.id]));
      setNewCatName('');
      setAddingCat(false);
      ok('Categoria aggiunta.');
    } catch (e) {
      err((e as Error).message);
    }
  };

  const handleUpdateCategoria = async () => {
    if (!editingCat) return;
    try {
      const u = await updateCategoria(editingCat.id, editingCat.nome);
      setCategorie((p) => p.map((c) => (c.id === u.id ? u : c)));
      setEditingCat(null);
      ok('Categoria aggiornata.');
    } catch (e) {
      err((e as Error).message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === 'cat') {
        await deleteCategoria(confirm.id);
        setCategorie((p) => p.filter((c) => c.id !== confirm.id));
        setServizi((p) => p.filter((s) => s.id_categoria !== confirm.id));
        ok('Categoria eliminata.');
      } else {
        await deleteServizio(confirm.id);
        setServizi((p) => p.filter((s) => s.id !== confirm.id));
        ok('Servizio eliminato.');
      }
    } catch (e) {
      err((e as Error).message);
    } finally {
      setConfirm(null);
    }
  };

  const svciDiCategoria = (catId: string) =>
    servizi.filter((s) => s.id_categoria === catId);

  return (
    <div className="sec">
      <div className="sec-head">
        <div>
          <h1 className="sec-title">Servizi</h1>
          <p className="sec-sub">
            {loading
              ? '…'
              : `${categorie.length} categorie · ${servizi.length} servizi`}
          </p>
        </div>
        <button className="btn-add" onClick={() => setAddingCat(true)}>
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
          Nuova categoria
        </button>
      </div>

      <div className="sec-body">
        {loading ? (
          <div className="loading">
            <Spinner size={24} />
          </div>
        ) : (
          <div className="cat-list">
            {addingCat && (
              <div
                style={{
                  background: 'white',
                  border: '1.5px dashed var(--gold)',
                  borderRadius: 'var(--r)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <input
                  className="f-inp"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nome categoria (es. Viso, Corpo, Unghie…)"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategoria();
                    if (e.key === 'Escape') {
                      setAddingCat(false);
                      setNewCatName('');
                    }
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                  }}
                >
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setAddingCat(false);
                      setNewCatName('');
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleAddCategoria}
                    disabled={!newCatName.trim()}
                  >
                    Aggiungi
                  </button>
                </div>
              </div>
            )}

            {categorie.length === 0 && !addingCat ? (
              <Empty
                icon="📂"
                title="Nessuna categoria."
                sub="Crea la prima categoria per organizzare i servizi."
              />
            ) : (
              categorie.map((cat) => {
                const isOpen = openCats.has(cat.id);
                const svcList = svciDiCategoria(cat.id);
                const isEditing = editingCat?.id === cat.id;

                return (
                  <div key={cat.id} className="cat-block">
                    <div className="cat-hdr">
                      <button
                        className="cat-toggle"
                        onClick={() => toggleCat(cat.id)}
                      >
                        <svg
                          className={`chevron ${isOpen ? 'open' : 'closed'}`}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        {isEditing ? (
                          <input
                            style={{
                              border: 'none',
                              borderBottom: '2px solid var(--gold)',
                              background: 'transparent',
                              fontSize: 14,
                              fontWeight: 600,
                              outline: 'none',
                              flex: 1,
                            }}
                            value={editingCat.nome}
                            onChange={(e) =>
                              setEditingCat({
                                ...editingCat,
                                nome: e.target.value,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                handleUpdateCategoria();
                              }
                              if (e.key === 'Escape') setEditingCat(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="cat-name">{cat.nome}</span>
                        )}
                        <span className="cat-cnt">{svcList.length} serv.</span>
                      </button>
                      <div
                        className="cat-acts"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing ? (
                          <>
                            <button
                              className="act-btn"
                              onClick={handleUpdateCategoria}
                              title="Salva"
                              style={{
                                color: 'var(--green)',
                                borderColor: 'var(--green)',
                              }}
                            >
                              ✓
                            </button>
                            <button
                              className="act-btn"
                              onClick={() => setEditingCat(null)}
                              title="Annulla"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="act-btn"
                              onClick={() =>
                                setEditingCat({ id: cat.id, nome: cat.nome })
                              }
                              title="Rinomina"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              className="act-btn add"
                              onClick={() =>
                                setSvcPanel({
                                  mode: 'add',
                                  categoriaId: cat.id,
                                })
                              }
                              title="Aggiungi servizio"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </button>
                            <button
                              className="act-btn del"
                              onClick={() =>
                                setConfirm({
                                  type: 'cat',
                                  id: cat.id,
                                  label: cat.nome,
                                })
                              }
                              title="Elimina"
                            >
                              <svg
                                width="12"
                                height="12"
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
                          </>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="svc-list">
                        {svcList.length === 0 ? (
                          <div
                            style={{
                              padding: '12px 18px',
                              fontSize: 13,
                              color: 'var(--s400)',
                            }}
                          >
                            Nessun servizio.{' '}
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--gold)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                              onClick={() =>
                                setSvcPanel({
                                  mode: 'add',
                                  categoriaId: cat.id,
                                })
                              }
                            >
                              Aggiungine uno →
                            </button>
                          </div>
                        ) : (
                          svcList.map((s) => (
                            <div
                              key={s.id}
                              className="svc-row"
                              style={{ opacity: s.attivo ? 1 : 0.5 }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="svc-name">{s.nome}</p>
                                <div className="svc-meta">
                                  <span className="bdg bdg-d">
                                    ⏱ {s.durata_minuti} min
                                  </span>
                                  <span className="bdg bdg-p">
                                    € {s.prezzo.toFixed(2)}
                                  </span>
                                  {!s.attivo && (
                                    <span className="bdg bdg-off">
                                      Non attivo
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="svc-acts">
                                <button
                                  className={`toggle-track ${
                                    s.attivo ? 'on' : ''
                                  }`}
                                  onClick={async () => {
                                    try {
                                      const u = await updateServizio(s.id, {
                                        attivo: !s.attivo,
                                      });
                                      setServizi((p) =>
                                        p.map((x) => (x.id === u.id ? u : x))
                                      );
                                    } catch (e) {
                                      err((e as Error).message);
                                    }
                                  }}
                                  title={s.attivo ? 'Disattiva' : 'Attiva'}
                                  role="switch"
                                  aria-checked={s.attivo}
                                >
                                  <span className="toggle-thumb" />
                                </button>
                                <button
                                  className="act-btn"
                                  onClick={() =>
                                    setSvcPanel({ mode: 'edit', servizio: s })
                                  }
                                  title="Modifica"
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  className="act-btn del"
                                  onClick={() =>
                                    setConfirm({
                                      type: 'svc',
                                      id: s.id,
                                      label: s.nome,
                                    })
                                  }
                                  title="Elimina"
                                >
                                  <svg
                                    width="12"
                                    height="12"
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
                            </div>
                          ))
                        )}
                        <button
                          className="add-svc-btn"
                          onClick={() =>
                            setSvcPanel({ mode: 'add', categoriaId: cat.id })
                          }
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Aggiungi servizio
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {svcPanel && (
        <ServizioPanel
          mode={svcPanel.mode}
          servizio={svcPanel.servizio}
          categoriaId={svcPanel.categoriaId}
          categorie={categorie}
          onClose={() => setSvcPanel(null)}
          onSaved={(saved) => {
            if (svcPanel.mode === 'add') setServizi((p) => [...p, saved]);
            else
              setServizi((p) => p.map((s) => (s.id === saved.id ? saved : s)));
            ok(
              svcPanel.mode === 'add'
                ? 'Servizio aggiunto.'
                : 'Servizio aggiornato.'
            );
            setSvcPanel(null);
          }}
          onError={err}
        />
      )}

      {confirm && (
        <Confirm
          msg={`Eliminare "${confirm.label}"? L'operazione è irreversibile.`}
          onOk={handleConfirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={clear} />}
    </div>
  );
}

// ── Pannello servizio ─────────────────────────────────────────
function ServizioPanel({
  mode,
  servizio,
  categoriaId,
  categorie,
  onClose,
  onSaved,
  onError,
}: {
  mode: 'add' | 'edit';
  servizio?: Servizio;
  categoriaId?: string;
  categorie: CategoriaServizio[];
  onClose: () => void;
  onSaved: (s: Servizio) => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState<ServizioInput>(
    servizio
      ? {
          nome: servizio.nome,
          durata_minuti: servizio.durata_minuti,
          prezzo: servizio.prezzo,
          id_categoria: servizio.id_categoria,
          attivo: servizio.attivo,
        }
      : {
          nome: '',
          durata_minuti: 60,
          prezzo: 0,
          id_categoria: categoriaId ?? categorie[0]?.id ?? '',
          attivo: true,
        }
  );
  const [errs, setErrs] = useState<
    Partial<Record<keyof ServizioInput, string>>
  >({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: typeof errs = {};
    if (!form.nome.trim()) e.nome = 'Nome obbligatorio';
    if (!form.id_categoria) e.id_categoria = 'Categoria obbligatoria';
    if (form.prezzo < 0) e.prezzo = 'Prezzo non valido';
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved =
        mode === 'add'
          ? await createServizio(form)
          : await updateServizio(servizio!.id, form);
      onSaved(saved);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof ServizioInput>(k: K, v: ServizioInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sp-hdr">
          <h2 className="sp-title">
            {mode === 'add' ? 'Nuovo servizio' : 'Modifica servizio'}
          </h2>
          <button className="sp-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={submit} className="sp-body" noValidate>
          <div className="f-group">
            <label className="f-lbl">
              Nome servizio <span className="req">*</span>
            </label>
            <input
              className={`f-inp ${errs.nome ? 'err' : ''}`}
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Trattamento viso rigenerante"
              autoFocus
            />
            {errs.nome && <span className="f-err">{errs.nome}</span>}
          </div>
          <div className="f-group">
            <label className="f-lbl">
              Categoria <span className="req">*</span>
            </label>
            <select
              className={`f-sel ${errs.id_categoria ? 'err' : ''}`}
              value={form.id_categoria}
              onChange={(e) => set('id_categoria', e.target.value)}
            >
              <option value="">— Seleziona —</option>
              {categorie.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {errs.id_categoria && (
              <span className="f-err">{errs.id_categoria}</span>
            )}
          </div>
          <div className="f-row2">
            <div className="f-group">
              <label className="f-lbl">
                Durata <span className="req">*</span>
              </label>
              <select
                className="f-sel"
                value={form.durata_minuti}
                onChange={(e) => set('durata_minuti', Number(e.target.value))}
              >
                {DURATE.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                    {d >= 60
                      ? ` (${Math.floor(d / 60)}h${d % 60 ? `${d % 60}m` : ''})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="f-group">
              <label className="f-lbl">
                Prezzo (€) <span className="req">*</span>
              </label>
              <input
                className={`f-inp ${errs.prezzo ? 'err' : ''}`}
                type="number"
                min="0"
                step="0.50"
                value={form.prezzo}
                onChange={(e) => set('prezzo', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              {errs.prezzo && <span className="f-err">{errs.prezzo}</span>}
            </div>
          </div>
          <div
            className="f-group"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <label className="f-lbl">Servizio attivo</label>
            <button
              type="button"
              className={`toggle-track ${form.attivo ? 'on' : ''}`}
              onClick={() => set('attivo', !form.attivo)}
              role="switch"
              aria-checked={form.attivo}
            >
              <span className="toggle-thumb" />
            </button>
            <span style={{ fontSize: 12, color: 'var(--s500)' }}>
              {form.attivo ? 'Visibile nella prenotazione' : 'Nascosto'}
            </span>
          </div>
          <div className="sp-foot">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner size={14} />}
              {mode === 'add' ? 'Aggiungi servizio' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

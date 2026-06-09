'use client';
import { useState, useEffect, useCallback } from 'react';
import { fetchMemo, createMemo, updateMemo, deleteMemo } from '@/lib/queries';
import { Toast, useToast, Spinner } from '@/components/ui';
import type { Memo, MemoColor } from '@/types';

const PALETTE: MemoColor[] = [
  '#fef9c3',
  '#fce7f3',
  '#dbeafe',
  '#dcfce7',
  '#ffe4e6',
  '#ede9fe',
  '#ffedd5',
];

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function dateStr(d: Date) {
  return d.toISOString().split('T')[0];
}
function formatDateIT(d: Date) {
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function MemoPage() {
  const [date, setDate] = useState(today);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftColor, setDraftColor] = useState<MemoColor>('#fef9c3');
  const { toast, ok, err, clear } = useToast();
  const isToday = dateStr(date) === dateStr(today());

  const load = useCallback(async (d: Date) => {
    setLoading(true);
    try {
      setMemos(await fetchMemo(d));
    } catch (e) {
      err((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const navigate = (days: number) => {
    setDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + days);
      return n;
    });
  };

  const handleAdd = async () => {
    if (!draftText.trim()) return;
    try {
      const m = await createMemo(draftText, date);
      setMemos((p) => [...p, m]);
      setDrafting(false);
      setDraftText('');
      ok('Memo salvato.');
    } catch (e) {
      err((e as Error).message);
    }
  };

  return (
    <div className="sec">
      <div className="sec-head">
        <div>
          <h1 className="sec-title">Memo del giorno</h1>
          <p className="sec-sub" style={{ textTransform: 'capitalize' }}>
            {formatDateIT(date)}
          </p>
        </div>
        <div className="sec-actions">
          <button className="nav-day" onClick={() => navigate(-1)}>
            ‹
          </button>
          <button
            className="today-chip"
            onClick={() => setDate(today())}
            style={{
              borderColor: isToday ? 'var(--gold)' : 'var(--s200)',
              color: isToday ? 'var(--gold)' : 'var(--s500)',
            }}
          >
            Oggi
          </button>
          <input
            type="date"
            className="date-pick"
            value={dateStr(date)}
            onChange={(e) => {
              const d = new Date(e.target.value + 'T00:00:00');
              setDate(d);
            }}
          />
          <button className="nav-day" onClick={() => navigate(1)}>
            ›
          </button>
          <button
            className="btn-add"
            onClick={() => {
              setDrafting(true);
              setDraftText('');
            }}
          >
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
            Nuovo memo
          </button>
        </div>
      </div>

      <div className="memo-board-area">
        {loading ? (
          <div
            style={{
              gridColumn: '1/-1',
              display: 'flex',
              justifyContent: 'center',
              padding: 60,
            }}
          >
            <Spinner size={24} />
          </div>
        ) : (
          <>
            {drafting && (
              <div className="memo-card" style={{ background: draftColor }}>
                <div className="memo-colors">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      className={`memo-cdot ${c === draftColor ? 'sel' : ''}`}
                      style={{ background: c }}
                      onClick={() => setDraftColor(c as MemoColor)}
                      aria-label={`Colore ${c}`}
                    />
                  ))}
                </div>
                <textarea
                  className="memo-ta"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Scrivi un memo…"
                  rows={5}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setDrafting(false);
                      setDraftText('');
                    }
                  }}
                />
                <div className="memo-foot">
                  <span />
                  <div className="memo-edit-acts">
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                      onClick={() => {
                        setDrafting(false);
                        setDraftText('');
                      }}
                    >
                      Annulla
                    </button>
                    <button
                      className="btn-memo-save"
                      onClick={handleAdd}
                      disabled={!draftText.trim()}
                    >
                      Salva
                    </button>
                  </div>
                </div>
              </div>
            )}

            {memos.map((m, i) => (
              <MemoCard
                key={m.id}
                memo={m}
                color={PALETTE[i % PALETTE.length] as MemoColor}
                onUpdate={async (t) => {
                  const u = await updateMemo(m.id, t);
                  setMemos((p) => p.map((x) => (x.id === m.id ? u : x)));
                  ok('Memo aggiornato.');
                }}
                onDelete={async () => {
                  await deleteMemo(m.id);
                  setMemos((p) => p.filter((x) => x.id !== m.id));
                  ok('Memo eliminato.');
                }}
              />
            ))}

            {memos.length === 0 && !drafting && (
              <div
                style={{
                  gridColumn: '1/-1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '70px 20px',
                  gap: 10,
                  color: 'var(--s400)',
                }}
              >
                <span style={{ fontSize: 48 }}>🗒</span>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: 'var(--s700)',
                  }}
                >
                  Nessun memo per questa data.
                </p>
                <p style={{ fontSize: 13, textAlign: 'center' }}>
                  Usa il pulsante "Nuovo memo" per aggiungere un promemoria.
                </p>
                <button
                  className="btn-add"
                  style={{ marginTop: 8 }}
                  onClick={() => setDrafting(true)}
                >
                  Aggiungi memo
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={clear} />}
    </div>
  );
}

// ── Singola card memo ─────────────────────────────────────────
function MemoCard({
  memo,
  color,
  onUpdate,
  onDelete,
}: {
  memo: Memo;
  color: MemoColor;
  onUpdate: (t: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo.testo);
  const time = new Date(memo.created_at).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="memo-card" style={{ background: color }}>
      {editing ? (
        <textarea
          className="memo-ta"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(memo.testo);
              setEditing(false);
            }
          }}
        />
      ) : (
        <p className="memo-text" onClick={() => setEditing(true)}>
          {memo.testo}
        </p>
      )}
      <div className="memo-foot">
        <span className="memo-time">⏰ {time}</span>
        {editing ? (
          <div className="memo-edit-acts">
            <button
              className="btn-ghost"
              style={{ padding: '3px 8px', fontSize: 11 }}
              onClick={() => {
                setDraft(memo.testo);
                setEditing(false);
              }}
            >
              Annulla
            </button>
            <button
              className="btn-memo-save"
              onClick={async () => {
                await onUpdate(draft);
                setEditing(false);
              }}
            >
              Salva
            </button>
          </div>
        ) : (
          <div className="memo-acts">
            <button
              className="memo-act"
              onClick={() => setEditing(true)}
              title="Modifica"
            >
              ✎
            </button>
            <button className="memo-act del" onClick={onDelete} title="Elimina">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

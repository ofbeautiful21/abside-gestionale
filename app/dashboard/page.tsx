'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getSupabase } from '@/lib/supabase';
import {
  fetchOperatrici,
  fetchAppuntamentiDelGiorno,
  fetchServiziAttivi,
  createAppuntamento,
  updateStatoAppuntamento,
  fetchMemo,
  createMemo,
  updateMemo,
  deleteMemo,
  searchClienti,
} from '@/lib/queries';
import {
  buildLabels,
  buildBlocks,
  totalSlots,
  slotToDate,
  slotToStr,
  blockColors,
  hexAlpha,
  contrastColor,
  hasConflict,
  formatDate,
  formatTime,
} from '@/lib/calendarUtils';
import { DEFAULT_GRID_CONFIG } from '@/types';
import type {
  Operatrice,
  Appuntamento,
  Servizio,
  Cliente,
  GridConfig,
  CalendarBlock,
  SlotClickInfo,
  Memo,
  MemoColor,
  AppuntamentoStato,
} from '@/types';
import { Toast, useToast, Confirm, Spinner } from '@/components/ui';

const MEMO_PALETTE: MemoColor[] = [
  '#fef9c3',
  '#fce7f3',
  '#dbeafe',
  '#dcfce7',
  '#ffe4e6',
  '#ede9fe',
  '#ffedd5',
];
const TIME_COL = 58;

// ════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [operatrici, setOperatrici] = useState<Operatrice[]>([]);
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<GridConfig>(DEFAULT_GRID_CONFIG);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [slotPrefill, setSlotPrefill] = useState<SlotClickInfo | null>(null);
  const { toast, ok, err, clear } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load static data once
  useEffect(() => {
    Promise.all([fetchOperatrici(), fetchServiziAttivi()]).then(
      ([ops, svcs]) => {
        setOperatrici(ops);
        setServizi(svcs);
      }
    );
    // Load saved config
    getSupabase()
      .from('dashboard_config')
      .select('config_json')
      .eq('key', 'grid_config')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.config_json && Object.keys(data.config_json).length)
          setCfg((c) => ({ ...c, ...data.config_json }));
      });
  }, []);

  const loadDay = useCallback(async (d: Date) => {
    setLoading(true);
    try {
      const [appts, ms] = await Promise.all([
        fetchAppuntamentiDelGiorno(d),
        fetchMemo(d),
      ]);
      setAppuntamenti(appts);
      setMemos(ms);
    } catch (e) {
      err((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(date);
  }, [date, loadDay]);

  // Realtime
  useEffect(() => {
    const s = date.toISOString().split('T')[0];
    const ch = getSupabase()
      .channel(`dash-${s}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appuntamenti' },
        () => loadDay(date)
      )
      .subscribe();
    return () => {
      getSupabase().removeChannel(ch);
    };
  }, [date, loadDay]);

  // Auto scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    const slot = isToday
      ? Math.max(
          0,
          ((now.getHours() - cfg.dayStartHour) * 60 + now.getMinutes()) / 15 - 3
        )
      : 0;
    scrollRef.current.scrollTop = slot * cfg.slotHeight;
  }, [date, cfg.slotHeight, cfg.dayStartHour]);

  // Persist config with debounce
  const cfgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (cfgTimer.current) clearTimeout(cfgTimer.current);
    cfgTimer.current = setTimeout(() => {
      getSupabase()
        .from('dashboard_config')
        .upsert(
          {
            key: 'grid_config',
            config_json: cfg,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
    }, 900);
  }, [cfg]);

  const navigate = (d: number) => {
    const n = new Date(date);
    n.setDate(n.getDate() + d);
    setDate(n);
  };
  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setDate(d);
  };
  const isToday = date.toDateString() === new Date().toDateString();

  const blocks = useMemo(
    () => buildBlocks(appuntamenti, operatrici, cfg),
    [appuntamenti, operatrici, cfg]
  );
  const labels = useMemo(() => buildLabels(cfg), [cfg]);
  const n = totalSlots(cfg);
  const gridCols = `${TIME_COL}px repeat(${operatrici.length}, minmax(${cfg.colMinWidth}px, 1fr))`;

  const now = new Date();
  const nowSlot = isToday
    ? ((now.getHours() - cfg.dayStartHour) * 60 + now.getMinutes()) / 15
    : -1;

  const blocksByCol = useMemo(() => {
    const m = new Map<number, CalendarBlock[]>();
    operatrici.forEach((_, i) => m.set(i, []));
    blocks.forEach((b) => m.get(b.colIndex)?.push(b));
    return m;
  }, [blocks, operatrici]);

  const confCount = appuntamenti.filter((a) => a.stato === 'confermato').length;
  const attCount = appuntamenti.filter((a) => a.stato === 'in_attesa').length;
  const totalCount = appuntamenti.filter((a) => a.stato !== 'disdetto').length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* ── TOP BAR ─────────────────────────────────────── */}
      <div className="dash-hdr">
        <div className="dash-brand">
          <span className="dash-star">✦</span>
          <span className="dash-name">Bellezza Studio</span>
        </div>
        <div style={{ width: 1, height: 22, background: 'var(--ivory-d)' }} />
        <div className="date-nav">
          <button className="nav-day" onClick={() => navigate(-1)}>
            ‹
          </button>
          <button className="today-chip" onClick={goToday}>
            Oggi
          </button>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              textTransform: 'capitalize',
              minWidth: 230,
            }}
          >
            {formatDate(date)}
          </span>
          <button className="nav-day" onClick={() => navigate(1)}>
            ›
          </button>
        </div>
        <input
          type="date"
          className="date-pick"
          value={date.toISOString().split('T')[0]}
          onChange={(e) => {
            const d = new Date(e.target.value + 'T00:00:00');
            setDate(d);
          }}
        />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="stat-pill pill-n">{totalCount} appt.</span>
          <span className="stat-pill pill-g">{confCount} conf.</span>
          {attCount > 0 && (
            <span className="stat-pill pill-a">{attCount} att.</span>
          )}
        </div>
        <button
          className="btn-add"
          onClick={() => {
            setSlotPrefill(null);
            setModalOpen(true);
          }}
        >
          + Nuovo
        </button>
        <button
          className={`tool-btn ${settingsOpen ? 'active' : ''}`}
          onClick={() => setSettingsOpen((v) => !v)}
          title="Personalizza"
        >
          ⚙
        </button>
        <button
          className="tool-btn"
          onClick={() => loadDay(date)}
          title="Aggiorna"
        >
          ↻
        </button>
      </div>

      {/* ── MAIN AREA ────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* ── CALENDAR ──────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Operatrici header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              background: 'white',
              borderBottom: `1px solid ${cfg.gridLineColor}`,
              flexShrink: 0,
            }}
          >
            <div style={{ borderRight: `1px solid ${cfg.gridLineColor}` }} />
            {operatrici.map((op) => (
              <div
                key={op.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRight: `1px solid ${cfg.gridLineColor}`,
                  borderTop: `3px solid ${op.colore}`,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: op.colore,
                    color: contrastColor(op.colore),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {op.nome
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {op.nome}
                </span>
              </div>
            ))}
          </div>

          {/* Grid scroll */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--s200) transparent',
            }}
          >
            {loading ? (
              <div className="loading">
                <Spinner size={24} />
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  gridTemplateRows: `repeat(${n},${cfg.slotHeight}px)`,
                  position: 'relative',
                  minWidth: `${
                    TIME_COL + operatrici.length * cfg.colMinWidth
                  }px`,
                }}
              >
                {labels.map(({ slot, label, isHour, isHalf }) => (
                  <div
                    key={`t${slot}`}
                    style={{
                      gridRow: slot + 1,
                      gridColumn: 1,
                      borderRight: `1px solid ${cfg.gridLineColor}`,
                      borderTop: isHour
                        ? `${cfg.hourLineWidth}px solid ${hexAlpha(
                            cfg.gridLineColor,
                            cfg.gridLineOpacity
                          )}`
                        : isHalf
                        ? `${cfg.halfHourLineWidth}px solid ${hexAlpha(
                            cfg.gridLineColor,
                            cfg.gridLineOpacity * 0.6
                          )}`
                        : cfg.quarterLineVisible
                        ? `0.5px dashed ${hexAlpha(
                            cfg.gridLineColor,
                            cfg.gridLineOpacity * 0.3
                          )}`
                        : 'none',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                      paddingRight: 6,
                    }}
                  >
                    {label && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: 'var(--s400)',
                          marginTop: -6,
                          userSelect: 'none',
                        }}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                ))}
                {operatrici.map((op, ci) =>
                  labels.map(({ slot, isHour, isHalf }) => (
                    <div
                      key={`c${ci}-${slot}`}
                      style={{
                        gridRow: slot + 1,
                        gridColumn: ci + 2,
                        borderRight: `1px solid ${hexAlpha(
                          cfg.gridLineColor,
                          cfg.gridLineOpacity * 0.5
                        )}`,
                        borderTop: isHour
                          ? `${cfg.hourLineWidth}px solid ${hexAlpha(
                              cfg.gridLineColor,
                              cfg.gridLineOpacity
                            )}`
                          : isHalf
                          ? `${cfg.halfHourLineWidth}px solid ${hexAlpha(
                              cfg.gridLineColor,
                              cfg.gridLineOpacity * 0.5
                            )}`
                          : cfg.quarterLineVisible
                          ? `0.5px dashed ${hexAlpha(
                              cfg.gridLineColor,
                              cfg.gridLineOpacity * 0.25
                            )}`
                          : 'none',
                        cursor: 'pointer',
                        transition: 'background .1s',
                      }}
                      onClick={() => {
                        setSlotPrefill({
                          operatriceId: op.id,
                          startTime: slotToDate(slot, cfg, date),
                        });
                        setModalOpen(true);
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          'rgba(184,147,90,.06)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = '')
                      }
                    />
                  ))
                )}
                {nowSlot >= 0 && nowSlot < n && (
                  <div
                    style={{
                      gridColumn: `2/${operatrici.length + 2}`,
                      gridRow: Math.floor(nowSlot) + 1,
                      position: 'relative',
                      top: `${(nowSlot % 1) * cfg.slotHeight}px`,
                      pointerEvents: 'none',
                      zIndex: 3,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#e24b4a',
                        marginLeft: -4,
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        height: 1.5,
                        background: '#e24b4a',
                        opacity: 0.65,
                      }}
                    />
                  </div>
                )}
                {operatrici.map((_, ci) =>
                  (blocksByCol.get(ci) ?? []).map((block) => {
                    const c = blockColors(block, cfg);
                    const a = block.appuntamento;
                    const tiny = block.spanSlots === 1,
                      short = block.spanSlots <= 2;
                    return (
                      <div
                        key={a.id}
                        style={{
                          gridRow: `${block.startSlot + 1}/span ${
                            block.spanSlots
                          }`,
                          gridColumn: ci + 2,
                          padding: '2px 3px',
                          position: 'relative',
                          zIndex: 2,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            borderRadius: cfg.blockBorderRadius,
                            borderLeft: `3px solid ${c.border}`,
                            background: c.bg,
                            padding: cfg.blockPadding,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: tiny ? 'row' : 'column',
                            gap: 2,
                            alignItems: tiny ? 'center' : undefined,
                            fontSize: cfg.blockFontSize,
                            opacity: cfg.blockOpacity,
                            transition: 'filter .15s',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.filter = 'brightness(.96)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.filter = '')
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: c.dot,
                              flexShrink: 0,
                              ...(tiny
                                ? { marginRight: 4 }
                                : { position: 'absolute', right: 5, top: 5 }),
                            }}
                          />
                          {cfg.showClientName && (
                            <span
                              style={{
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {a.cliente
                                ? `${a.cliente.cognome} ${a.cliente.nome}`
                                : '—'}
                            </span>
                          )}
                          {!short && cfg.showServiceName && (
                            <span
                              style={{
                                opacity: 0.7,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {a.servizio?.nome}
                            </span>
                          )}
                          {!short && cfg.showTimeRange && (
                            <span style={{ opacity: 0.55, marginTop: 'auto' }}>
                              {formatTime(a.data_ora_inizio)} –{' '}
                              {formatTime(a.data_ora_fine)}
                            </span>
                          )}
                          {!short && cfg.showPrice && a.servizio?.prezzo && (
                            <span
                              style={{ color: 'var(--gold)', fontWeight: 600 }}
                            >
                              €{a.servizio.prezzo.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── SETTINGS PANEL ────────────────────────────── */}
        {settingsOpen && (
          <SettingsPanel
            cfg={cfg}
            onChange={setCfg}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {/* ── MEMO PANEL ────────────────────────────────── */}
        <MemoDayPanel
          date={date}
          memos={memos}
          setMemos={setMemos}
          onOk={ok}
          onErr={err}
        />
      </div>

      {/* ── NEW APPOINTMENT MODAL ─────────────────────── */}
      {modalOpen && (
        <AppuntamentoModal
          date={date}
          operatrici={operatrici}
          servizi={servizi}
          appuntamenti={appuntamenti}
          prefill={slotPrefill}
          onClose={() => setModalOpen(false)}
          onSaved={(appt) => {
            setAppuntamenti((p) => [...p, appt]);
            ok('Appuntamento salvato!');
            setModalOpen(false);
          }}
          onErr={err}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={clear} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SETTINGS PANEL
// ════════════════════════════════════════════════════════════
function SettingsPanel({
  cfg,
  onChange,
  onClose,
}: {
  cfg: GridConfig;
  onChange: (c: GridConfig) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof GridConfig>(k: K, v: GridConfig[K]) =>
    onChange({ ...cfg, [k]: v });
  return (
    <aside className="settings-panel">
      <div className="set-hdr">
        <span className="set-title">⚙ Personalizzazione</span>
        <button
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 18,
            cursor: 'pointer',
            color: 'var(--s500)',
          }}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <SetSection title="Dimensioni">
        <SetSlider
          label="Altezza slot"
          value={cfg.slotHeight}
          min={16}
          max={56}
          step={2}
          unit="px"
          onChange={(v) => set('slotHeight', v)}
        />
        <SetSlider
          label="Largh. colonna min"
          value={cfg.colMinWidth}
          min={100}
          max={300}
          step={10}
          unit="px"
          onChange={(v) => set('colMinWidth', v)}
        />
        <SetSlider
          label="Font blocco"
          value={cfg.blockFontSize}
          min={9}
          max={16}
          step={1}
          unit="px"
          onChange={(v) => set('blockFontSize', v)}
        />
      </SetSection>
      <SetSection title="Griglia">
        <SetColor
          label="Colore linee"
          value={cfg.gridLineColor}
          onChange={(v) => set('gridLineColor', v)}
        />
        <SetSlider
          label="Opacità linee"
          value={Math.round(cfg.gridLineOpacity * 100)}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => set('gridLineOpacity', v / 100)}
        />
        <SetSlider
          label="Spess. ora"
          value={cfg.hourLineWidth}
          min={0.5}
          max={4}
          step={0.5}
          unit="px"
          onChange={(v) => set('hourLineWidth', v)}
        />
        <SetSlider
          label="Spess. mezza ora"
          value={cfg.halfHourLineWidth}
          min={0.5}
          max={3}
          step={0.5}
          unit="px"
          onChange={(v) => set('halfHourLineWidth', v)}
        />
        <SetToggle
          label="Linee 15 min"
          checked={cfg.quarterLineVisible}
          onChange={(v) => set('quarterLineVisible', v)}
        />
      </SetSection>
      <SetSection title="Orari">
        <SetSelect
          label="Inizio"
          value={cfg.dayStartHour}
          options={Array.from({ length: 13 }, (_, i) => ({
            label: `${String(i + 6).padStart(2, '0')}:00`,
            value: i + 6,
          }))}
          onChange={(v) => set('dayStartHour', v)}
        />
        <SetSelect
          label="Fine"
          value={cfg.dayEndHour}
          options={Array.from({ length: 7 }, (_, i) => ({
            label: `${String(i + 18).padStart(2, '0')}:00`,
            value: i + 18,
          }))}
          onChange={(v) => set('dayEndHour', v)}
        />
      </SetSection>
      <SetSection title="Blocchi appuntamento">
        <SetSlider
          label="Angoli"
          value={cfg.blockBorderRadius}
          min={0}
          max={14}
          step={1}
          unit="px"
          onChange={(v) => set('blockBorderRadius', v)}
        />
        <SetSlider
          label="Padding"
          value={cfg.blockPadding}
          min={2}
          max={14}
          step={1}
          unit="px"
          onChange={(v) => set('blockPadding', v)}
        />
        <SetSlider
          label="Opacità"
          value={Math.round(cfg.blockOpacity * 100)}
          min={30}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => set('blockOpacity', v / 100)}
        />
        <SetToggle
          label="Nome cliente"
          checked={cfg.showClientName}
          onChange={(v) => set('showClientName', v)}
        />
        <SetToggle
          label="Servizio"
          checked={cfg.showServiceName}
          onChange={(v) => set('showServiceName', v)}
        />
        <SetToggle
          label="Orario"
          checked={cfg.showTimeRange}
          onChange={(v) => set('showTimeRange', v)}
        />
        <SetToggle
          label="Prezzo"
          checked={cfg.showPrice}
          onChange={(v) => set('showPrice', v)}
        />
      </SetSection>
      <SetSection title="Schema colori">
        <div className="scheme-btns">
          {(['operatrice', 'stato'] as const).map((s) => (
            <button
              key={s}
              className={`scheme-btn ${cfg.colorScheme === s ? 'sel' : ''}`}
              onClick={() => set('colorScheme', s)}
            >
              {s}
            </button>
          ))}
        </div>
        {cfg.colorScheme === 'stato' && (
          <div
            style={{
              padding: '0 16px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <SetColor
              label="Confermato"
              value={cfg.statoColors.confermato}
              onChange={(v) =>
                set('statoColors', { ...cfg.statoColors, confermato: v })
              }
            />
            <SetColor
              label="In attesa"
              value={cfg.statoColors.in_attesa}
              onChange={(v) =>
                set('statoColors', { ...cfg.statoColors, in_attesa: v })
              }
            />
            <SetColor
              label="Disdetto"
              value={cfg.statoColors.disdetto}
              onChange={(v) =>
                set('statoColors', { ...cfg.statoColors, disdetto: v })
              }
            />
          </div>
        )}
      </SetSection>
      <div style={{ padding: '10px 16px' }}>
        <button
          className="btn-ghost"
          style={{ width: '100%' }}
          onClick={() => onChange(DEFAULT_GRID_CONFIG)}
        >
          Ripristina predefiniti
        </button>
      </div>
    </aside>
  );
}

function SetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="set-section">
      <p className="set-section-title">{title}</p>
      {children}
    </div>
  );
}
function SetSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="set-row">
      <span className="set-lbl">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="set-val">
        {value}
        {unit}
      </span>
    </div>
  );
}
function SetColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="set-row">
      <span className="set-lbl">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="color-hex">{value}</span>
      </div>
    </div>
  );
}
function SetToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="set-row">
      <span className="set-lbl">{label}</span>
      <button
        className={`toggle-track ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
function SetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: { label: string; value: number }[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="set-row">
      <span className="set-lbl">{label}</span>
      <select
        className="f-sel"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ padding: '3px 8px', fontSize: 12, width: 'auto' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MEMO DAY PANEL
// ════════════════════════════════════════════════════════════
function MemoDayPanel({
  date,
  memos,
  setMemos,
  onOk,
  onErr,
}: {
  date: Date;
  memos: Memo[];
  setMemos: React.Dispatch<React.SetStateAction<Memo[]>>;
  onOk: (m: string) => void;
  onErr: (m: string) => void;
}) {
  const [drafting, setDrafting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftColor, setDraftColor] = useState<MemoColor>('#fef9c3');

  const handleAdd = async () => {
    if (!draftText.trim()) return;
    try {
      const m = await createMemo(draftText, date);
      setMemos((p) => [...p, m]);
      setDrafting(false);
      setDraftText('');
      onOk('Memo salvato.');
    } catch (e) {
      onErr((e as Error).message);
    }
  };

  return (
    <div className="memo-panel">
      <div className="memo-panel-hdr">
        <div>
          <p className="memo-panel-title">Memo del giorno</p>
          <p className="memo-panel-sub">{memos.length} note</p>
        </div>
        <button
          className="memo-add-btn"
          onClick={() => {
            setDrafting(true);
            setDraftText('');
          }}
        >
          + Aggiungi
        </button>
      </div>
      <div
        className="memo-board-area"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflowY: 'auto',
          padding: 16,
        }}
      >
        {drafting && (
          <div className="memo-card" style={{ background: draftColor }}>
            <div className="memo-colors">
              {MEMO_PALETTE.map((c) => (
                <button
                  key={c}
                  className={`memo-cdot ${c === draftColor ? 'sel' : ''}`}
                  style={{ background: c }}
                  onClick={() => setDraftColor(c as MemoColor)}
                />
              ))}
            </div>
            <textarea
              className="memo-ta"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Scrivi un memo…"
              rows={4}
              autoFocus
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
        {memos.length === 0 && !drafting && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 20px',
              gap: 8,
              color: 'var(--s400)',
            }}
          >
            <span style={{ fontSize: 36 }}>🗒</span>
            <p style={{ fontSize: 13, textAlign: 'center' }}>
              Nessun memo per oggi.
              <br />
              Clicca + Aggiungi.
            </p>
          </div>
        )}
        {memos.map((m, i) => (
          <MemoCard
            key={m.id}
            memo={m}
            color={MEMO_PALETTE[i % MEMO_PALETTE.length] as MemoColor}
            onUpdate={async (t) => {
              const u = await updateMemo(m.id, t);
              setMemos((p) => p.map((x) => (x.id === m.id ? u : x)));
              onOk('Memo aggiornato.');
            }}
            onDelete={async () => {
              await deleteMemo(m.id);
              setMemos((p) => p.filter((x) => x.id !== m.id));
              onOk('Memo eliminato.');
            }}
          />
        ))}
      </div>
    </div>
  );
}

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
          rows={4}
          autoFocus
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

// ════════════════════════════════════════════════════════════
// APPOINTMENT MODAL
// ════════════════════════════════════════════════════════════
function AppuntamentoModal({
  date,
  operatrici,
  servizi,
  appuntamenti,
  prefill,
  onClose,
  onSaved,
  onErr,
}: {
  date: Date;
  operatrici: Operatrice[];
  servizi: Servizio[];
  appuntamenti: Appuntamento[];
  prefill: SlotClickInfo | null;
  onClose: () => void;
  onSaved: (a: Appuntamento) => void;
  onErr: (m: string) => void;
}) {
  const dateStr = date.toISOString().split('T')[0];
  const prefillTime = prefill?.startTime
    ? `${String(prefill.startTime.getHours()).padStart(2, '0')}:${String(
        prefill.startTime.getMinutes()
      ).padStart(2, '0')}`
    : '09:00';
  const [form, setForm] = useState({
    id_cliente: '',
    id_operatrice: prefill?.operatriceId ?? operatrici[0]?.id ?? '',
    id_servizio: '',
    data: dateStr,
    ora_inizio: prefillTime,
    stato: 'confermato' as AppuntamentoStato,
    note: '',
  });
  const [clienteQ, setClienteQ] = useState('');
  const [clienteResults, setClienteResults] = useState<
    Pick<Cliente, 'id' | 'nome' | 'cognome' | 'telefono'>[]
  >([]);
  const [selCliente, setSelCliente] = useState<Pick<
    Cliente,
    'id' | 'nome' | 'cognome' | 'telefono'
  > | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  const selServizio = servizi.find((s) => s.id === form.id_servizio);
  const oraFine = (() => {
    if (!selServizio) return null;
    const [h, m] = form.ora_inizio.split(':').map(Number);
    const t = h * 60 + m + selServizio.durata_minuti;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(
      t % 60
    ).padStart(2, '0')}`;
  })();

  // Conflict check
  useEffect(() => {
    if (!form.id_operatrice || !form.ora_inizio || !selServizio) {
      setConflict(false);
      return;
    }
    const start = new Date(`${form.data}T${form.ora_inizio}:00`);
    const end = new Date(start.getTime() + selServizio.durata_minuti * 60000);
    setConflict(hasConflict(appuntamenti, form.id_operatrice, start, end));
  }, [
    form.id_operatrice,
    form.ora_inizio,
    form.data,
    selServizio,
    appuntamenti,
  ]);

  // Search clienti
  useEffect(() => {
    if (!clienteQ.trim()) {
      setClienteResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setClienteResults(await searchClienti(clienteQ));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [clienteQ]);

  const slots = Array.from(
    { length: (form.data ? 1 : 1) * (20 - 8) * 4 },
    (_, i) => {
      const m = 8 * 60 + i * 15;
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(
        m % 60
      ).padStart(2, '0')}`;
    }
  );

  const serviziBycat = servizi.reduce<Record<string, Servizio[]>>((acc, s) => {
    const c = s.categoria?.nome ?? 'Altro';
    if (!acc[c]) acc[c] = [];
    acc[c].push(s);
    return acc;
  }, {});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id_cliente || !selServizio || conflict) return;
    setSaving(true);
    try {
      const a = await createAppuntamento(form, selServizio.durata_minuti);
      onSaved(a);
    } catch (err) {
      onErr((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <p className="modal-title">Nuovo appuntamento</p>
            <p className="modal-sub">{formatDate(date)}</p>
          </div>
          <button className="modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={submit} className="modal-body" noValidate>
          {/* Cliente */}
          <div className="f-group">
            <label className="f-lbl">Cliente *</label>
            {selCliente ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 13px',
                  background: 'var(--gold-p)',
                  border: '1.5px solid var(--gold-l)',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <div className="c-av">
                  {selCliente.nome[0]}
                  {selCliente.cognome[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 500, fontSize: 14 }}>
                    {selCliente.cognome} {selCliente.nome}
                  </p>
                  {selCliente.telefono && (
                    <p style={{ fontSize: 12, color: 'var(--s500)' }}>
                      {selCliente.telefono}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => {
                    setSelCliente(null);
                    setForm((f) => ({ ...f, id_cliente: '' }));
                    setClienteQ('');
                  }}
                >
                  Cambia
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="f-inp"
                  placeholder="Cerca per cognome…"
                  value={clienteQ}
                  onChange={(e) => setClienteQ(e.target.value)}
                  autoFocus
                />
                {clienteQ && (
                  <div className="search-drop">
                    {searching ? (
                      <p className="drop-msg">Ricerca…</p>
                    ) : clienteResults.length === 0 ? (
                      <p className="drop-msg">Nessun risultato</p>
                    ) : (
                      clienteResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="drop-item"
                          onClick={() => {
                            setSelCliente(c);
                            setForm((f) => ({ ...f, id_cliente: c.id }));
                            setClienteQ('');
                          }}
                        >
                          <span className="drop-av">
                            {c.nome[0]}
                            {c.cognome[0]}
                          </span>
                          <span>
                            <strong>{c.cognome}</strong> {c.nome}
                            {c.telefono && (
                              <span className="drop-tel"> · {c.telefono}</span>
                            )}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Operatrice */}
          <div className="f-group">
            <label className="f-lbl">Operatrice *</label>
            <div className="op-chips">
              {operatrici.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  className={`op-chip ${
                    form.id_operatrice === op.id ? 'sel' : ''
                  }`}
                  style={{ '--chip-c': op.colore } as React.CSSProperties}
                  onClick={() =>
                    setForm((f) => ({ ...f, id_operatrice: op.id }))
                  }
                >
                  <span className="op-dot" style={{ background: op.colore }} />
                  {op.nome}
                </button>
              ))}
            </div>
          </div>
          {/* Servizio */}
          <div className="f-group">
            <label className="f-lbl">Servizio *</label>
            <select
              className="f-sel"
              value={form.id_servizio}
              onChange={(e) =>
                setForm((f) => ({ ...f, id_servizio: e.target.value }))
              }
              required
            >
              <option value="">— Seleziona —</option>
              {Object.entries(serviziBycat).map(([cat, svcs]) => (
                <optgroup key={cat} label={cat}>
                  {svcs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} — {s.durata_minuti} min — €{s.prezzo.toFixed(2)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {/* Orario */}
          <div className="f-row2">
            <div className="f-group">
              <label className="f-lbl">Ora inizio *</label>
              <select
                className="f-sel"
                value={form.ora_inizio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ora_inizio: e.target.value }))
                }
              >
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="f-group">
              <label className="f-lbl">Ora fine</label>
              <div className={`time-calc ${oraFine ? 'has' : ''}`}>
                {oraFine ? (
                  <strong style={{ fontSize: 15, color: 'var(--gold)' }}>
                    {oraFine}
                  </strong>
                ) : (
                  <span className="time-ph">Auto dal servizio</span>
                )}
                {selServizio && (
                  <span className="dur-badge">
                    {selServizio.durata_minuti} min
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Note */}
          <div className="f-group">
            <label className="f-lbl">Note (opzionale)</label>
            <textarea
              className="f-ta"
              rows={2}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Note specifiche per questo appuntamento…"
            />
          </div>
          {conflict && (
            <div className="alert-err">
              ⚠️ L'operatrice ha già un appuntamento in questo orario.
            </div>
          )}
          <div className="modal-foot">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Annulla
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={
                saving || conflict || !form.id_cliente || !form.id_servizio
              }
            >
              {saving && <Spinner size={14} />} Conferma appuntamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

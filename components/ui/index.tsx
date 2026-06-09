'use client';
import { useEffect, useState } from 'react';

// ── Toast ─────────────────────────────────────────────────────
export function Toast({
  msg,
  type,
  onClose,
}: {
  msg: string;
  type: 'ok' | 'err';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`toast ${type === 'err' ? 'err' : ''}`} role="alert">
      <span className="toast-ico">{type === 'ok' ? '✓' : '✕'}</span>
      <span className="toast-msg">{msg}</span>
      <button className="toast-x" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

// ── useToast hook ─────────────────────────────────────────────
export function useToast() {
  const [toast, setToast] = useState<{
    msg: string;
    type: 'ok' | 'err';
  } | null>(null);
  const ok = (msg: string) => setToast({ msg, type: 'ok' });
  const err = (msg: string) => setToast({ msg, type: 'err' });
  const clear = () => setToast(null);
  return { toast, ok, err, clear };
}

// ── Confirm dialog ────────────────────────────────────────────
export function Confirm({
  msg,
  onOk,
  onCancel,
}: {
  msg: string;
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="cdlg-ov" onClick={onCancel}>
      <div
        className="cdlg"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
      >
        <p className="cdlg-msg">{msg}</p>
        <div className="cdlg-acts">
          <button className="btn-ghost" onClick={onCancel}>
            Annulla
          </button>
          <button className="btn-danger" onClick={onOk}>
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity=".2" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function Empty({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-ico">{icon}</span>
      <p className="empty-title">{title}</p>
      {sub && <p className="empty-sub">{sub}</p>}
    </div>
  );
}

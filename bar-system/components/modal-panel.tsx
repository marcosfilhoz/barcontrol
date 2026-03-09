"use client";

import { ReactNode } from "react";

type ModalPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function ModalPanel({ open, title, onClose, children }: ModalPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-2 py-1 text-xs"
          >
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

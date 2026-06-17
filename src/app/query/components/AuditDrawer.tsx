"use client";

import { useEffect, useRef, type ReactNode } from "react";

import {
  RAG_AUDIT_DRAWER_CLOSE_LABEL,
  RAG_AUDIT_DRAWER_TITLE,
} from "../constants";
import styles from "../page.module.css";

type AuditDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function AuditDrawer({ open, onClose, children }: AuditDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      } else {
        dialog.setAttribute("open", "");
      }
    }

    if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={RAG_AUDIT_DRAWER_TITLE}
      className={styles.auditDrawer}
      onClick={handleBackdropClick}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className={styles.auditDrawerPanel}>
        <header className={styles.auditDrawerHeader}>
          <p className={styles.auditDrawerEyebrow}>{RAG_AUDIT_DRAWER_TITLE}</p>
          <button
            type="button"
            onClick={onClose}
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            {RAG_AUDIT_DRAWER_CLOSE_LABEL}
          </button>
        </header>

        <div className={styles.auditDrawerBody}>{children}</div>
      </div>
    </dialog>
  );
}

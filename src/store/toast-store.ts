import { create } from "zustand";
import { describeWriteError } from "@/lib/api";

export type NoticeKind = "error" | "info";

export interface Notice {
  id: string;
  message: string;
  kind: NoticeKind;
}

interface ToastState {
  notices: Notice[];
  notify: (message: string, kind?: NoticeKind) => void;
  dismiss: (id: string) => void;
}

/**
 * Failures live here because the stores cannot render. A write that fails used
 * to update local state and say nothing; now it says something and, where it
 * can, undoes the optimistic change.
 */
let sequence = 0;
const MAX_NOTICES = 3;

export const useToastStore = create<ToastState>((set, get) => ({
  notices: [],

  notify: (message, kind = "info") => {
    // Auto-save retries the same write; one message per distinct problem.
    if (get().notices.some((notice) => notice.message === message)) return;
    const id = `notice-${++sequence}`;
    const notices = [...get().notices, { id, message, kind }].slice(-MAX_NOTICES);
    set({ notices });
    setTimeout(() => get().dismiss(id), kind === "error" ? 10_000 : 5_000);
  },

  dismiss: (id) => set({ notices: get().notices.filter((notice) => notice.id !== id) }),
}));

/** Reports a failed write with the action that failed, e.g. "Couldn't save the invoice." */
export function notifyWriteFailure(action: string, error: unknown): void {
  useToastStore.getState().notify(`${action} ${describeWriteError(error)}`, "error");
}

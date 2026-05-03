import React from 'react';
import * as Toast from '@radix-ui/react-toast';
import { create } from 'zustand';
import { X } from 'lucide-react';

interface ToastItem {
  id: string;
  title: string;
  variant?: 'default' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: ToastItem[];
  add: (title: string, variant?: ToastItem['variant'], action?: ToastItem['action']) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (title, variant = 'default', action) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, title, variant, action }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), action ? 6000 : 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(title: string) {
  useToastStore.getState().add(title, 'default');
}
toast.success = (title: string, action?: ToastItem['action']) => useToastStore.getState().add(title, 'success', action);
toast.error = (title: string) => useToastStore.getState().add(title, 'error');

export function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          open
          onOpenChange={() => remove(t.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
            t.variant === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : t.variant === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-white border-gray-200 text-gray-800'
          }`}
        >
          <Toast.Title className="flex-1">{t.title}</Toast.Title>
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); remove(t.id); }}
              className="text-xs font-semibold underline hover:no-underline"
            >
              {t.action.label}
            </button>
          )}
          <Toast.Close asChild>
            <button className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-20 lg:bottom-6 right-4 z-[100] flex flex-col gap-2 w-80" />
    </Toast.Provider>
  );
}

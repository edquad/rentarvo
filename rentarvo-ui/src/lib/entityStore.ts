import { create } from 'zustand';

interface EntityStore {
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
}

function loadEntityId(): string | null {
  const raw = localStorage.getItem('selectedEntityId');
  // '__all__' sentinel means user explicitly chose "All Entities"
  if (raw === '__all__') return '';
  return raw; // null = never chosen, string = specific entity
}

export const useEntityStore = create<EntityStore>((set) => ({
  selectedEntityId: loadEntityId(),
  setSelectedEntityId: (id) => {
    if (id) {
      localStorage.setItem('selectedEntityId', id);
    } else {
      // Persist the explicit "all" choice so it survives refresh
      localStorage.setItem('selectedEntityId', '__all__');
    }
    set({ selectedEntityId: id ?? '' });
  },
}));

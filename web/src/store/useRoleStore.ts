import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Role {
  id: string;
  content: string;
}

interface RoleState {
  roles: Role[];
  activeRoleId: string | null;
  addRole: (content: string) => void;
  removeRole: (id: string) => void;
  setActiveRole: (id: string | null) => void;
  getActiveRole: () => Role | undefined;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      roles: [],
      activeRoleId: null,
      addRole: (content) => {
        const newRole: Role = {
          id: crypto.randomUUID(), // Ensure distinct IDs
          content,
        };
        set((state) => ({ roles: [...state.roles, newRole] }));
      },
      removeRole: (id) =>
        set((state) => ({
          roles: state.roles.filter((r) => r.id !== id),
          activeRoleId: state.activeRoleId === id ? null : state.activeRoleId,
        })),
      setActiveRole: (id) => set({ activeRoleId: id }),
      getActiveRole: () => {
          const state = get();
          return state.roles.find(r => r.id === state.activeRoleId);
      }
    }),
    {
      name: 'ai-role-storage',
    }
  )
);

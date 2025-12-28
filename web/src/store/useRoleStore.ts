import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Role {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

interface RoleState {
  roles: Role[];
  activeRoleId: string | null;
  addRole: (content: string, name?: string) => void;
  removeRole: (id: string) => void;
  setActiveRole: (id: string | null) => void;
  getActiveRole: () => Role | undefined;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      roles: [],
      activeRoleId: null,
      addRole: (content, name) => {
        const newRole: Role = {
          id: crypto.randomUUID(), // Ensure distinct IDs
          name: name || `Lead Profile ${new Date().toLocaleString()}`,
          content,
          createdAt: Date.now(),
        };
        set((state) => ({ roles: [newRole, ...state.roles] }));
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

import { create } from 'zustand';
import type { Role, UserSession } from '../ontology';

const USERS: Record<Role, UserSession> = {
  analyst: { userId: 'u-analyst-1', name: 'Rina Analyst', role: 'analyst', ownedSkuIds: [] },
  manager: { userId: 'u-manager-1', name: 'Budi Manager', role: 'manager', ownedSkuIds: [] },
  ops_lead: { userId: 'u-ops-1', name: 'Sari Ops', role: 'ops_lead', ownedSkuIds: [] },
  compliance: { userId: 'u-compliance-1', name: 'Dewi Compliance', role: 'compliance', ownedSkuIds: [] },
};

interface SessionState {
  user: UserSession;
  setRole: (role: Role) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: USERS.analyst,
  setRole: (role) => set({ user: USERS[role] }),
}));

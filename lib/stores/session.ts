import { create } from 'zustand';
import type { Role, UserSession } from '../ontology';

/** Demo user directory — the manager's delegation picker lists these. */
export const USERS: Record<Role, UserSession> = {
  analyst: { userId: 'u-analyst-1', name: 'Rina Analyst', role: 'analyst', ownedSkuIds: [] },
  manager: { userId: 'u-manager-1', name: 'Budi Manager', role: 'manager', ownedSkuIds: [] },
  approver: { userId: 'u-approver-1', name: 'Andre Finance', role: 'approver', ownedSkuIds: [] },
  ops_lead: { userId: 'u-ops-1', name: 'Sari Ops', role: 'ops_lead', ownedSkuIds: [] },
  compliance: { userId: 'u-compliance-1', name: 'Dewi Compliance', role: 'compliance', ownedSkuIds: [] },
};

interface SessionState {
  user: UserSession;
  /** ONB-001: false until the first-run persona prompt is answered. */
  personaChosen: boolean;
  setRole: (role: Role) => void;
  choosePersona: (role: Role) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: USERS.analyst,
  personaChosen: false,
  setRole: (role) => set({ user: USERS[role] }),
  choosePersona: (role) => set({ user: USERS[role], personaChosen: true }),
}));

export type Ok = { ok: true };
export type Fail = { ok: false; error: string };
export type Result = Ok | Fail;

export const ok = (): Ok => ({ ok: true });
export const fail = (error: string): Fail => ({ ok: false, error });

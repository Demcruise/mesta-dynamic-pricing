import type { AuditEvent } from '@/lib/ontology';

/** AUD-009 export helpers — JSON download and the immutable evidence package. */

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Evidence package: the filtered events plus a manifest so the artefact is
 * self-describing when handed to an auditor. Deliberately excludes nothing —
 * the caller decides the scope via the audit filters.
 */
export function evidencePackage(events: AuditEvent[], meta: { scope: string; exportedBy: string }) {
  return {
    format: 'mesta.audit.evidence/v1',
    exportedAt: new Date().toISOString(),
    scope: meta.scope,
    exportedBy: meta.exportedBy,
    eventCount: events.length,
    events,
  };
}

/** Clipboard with a graceful fallback for insecure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

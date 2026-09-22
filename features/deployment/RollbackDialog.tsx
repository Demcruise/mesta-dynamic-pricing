'use client';

import { PriceValue } from '@/components/ds/PriceValue';
import { ConsequencePreview, RecoveryNotice } from '@/components/ds/trust';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { rollbackPublishJob } from '@/lib/actions/deployment';
import { useTranslation } from '@/lib/i18n';
import type { DeploymentRecord, PublishJob, Recommendation } from '@/lib/ontology';
import { useSessionStore, useToastStore } from '@/lib/stores';

/** Rollback confirmation with impact preview (EXEC-003): what price returns, which channels revert. */
export function RollbackDialog({ job, rec, records, onClose }: {
  job: PublishJob | null;
  rec: Recommendation | undefined;
  records: DeploymentRecord[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={job !== null} onClose={onClose} title={t('deployment.rollback.title')}>
      {job && rec && <Body job={job} rec={rec} records={records.filter((r) => r.jobId === job.id)} onClose={onClose} />}
    </Dialog>
  );
}

function Body({ job, rec, records, onClose }: {
  job: PublishJob; rec: Recommendation; records: DeploymentRecord[]; onClose: () => void;
}) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const synced = records.filter((r) => r.status === 'synced').length;
  const confirm = () => {
    const r = rollbackPublishJob(user, job.id);
    if (!r.ok) { toast(t(`deployment.err.${r.error}`)); return; }
    toast(t('deployment.rollback.done', { sku: rec.sku }));
    onClose();
  };

  return (
    <div className="flex flex-col gap-3">
      <ConsequencePreview
        items={[
          { label: t('deployment.rollback.current'), value: <PriceValue value={rec.proposedPrice} /> },
          { label: t('deployment.rollback.restores'), value: <PriceValue value={rec.currentPrice} />, tone: 'warn' },
          { label: t('deployment.rollback.channels'), value: t('deployment.rollback.channelsValue', { n: synced, total: records.length }) },
        ]}
      />
      <RecoveryNotice>{t('deployment.rollback.recovery')}</RecoveryNotice>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('recommendations.action.cancel')}</Button>
        <Button variant="destructive" onClick={confirm}>{t('deployment.rollback.confirm')}</Button>
      </div>
    </div>
  );
}

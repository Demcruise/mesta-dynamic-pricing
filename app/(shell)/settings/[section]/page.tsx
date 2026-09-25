import { SettingsPage } from '@/features/settings/SettingsPage';

/** SET-042: every settings section has a stable URL, e.g. /settings/pricing-engine. */
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <SettingsPage section={decodeURIComponent(section)} />;
}

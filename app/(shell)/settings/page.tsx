import { redirect } from 'next/navigation';

/** SET-042: /settings deep-links to its first section. */
export default function Page() {
  redirect('/settings/preferences');
}

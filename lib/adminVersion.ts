import 'server-only';
import { cookies } from 'next/headers';
import { studyVersion, type StudyVersion } from '@/lib/stats';

// The study version shown in /admin (V2 by default), kept in a cookie so every tab and the CSV
// export follow it without threading a parameter through every link.
export const ADMIN_VERSION_COOKIE = 'admin_versao';

export async function getAdminVersion(): Promise<StudyVersion> {
  return studyVersion((await cookies()).get(ADMIN_VERSION_COOKIE)?.value);
}

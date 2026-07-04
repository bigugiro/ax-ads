import { join } from 'node:path';

export const TMP_DIR = join(process.cwd(), 'tests', '.tmp');
export const CRED_FILE = join(TMP_DIR, 'user.json');

export interface E2EUser {
  email: string;
  password: string;
  agenciaId: string;
  authUserId: string;
}

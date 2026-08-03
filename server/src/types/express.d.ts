import type { User } from '@supabase/supabase-js';
import type { AccessContext } from '../lib/access.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      profile?: { id: string; role: string; full_name: string | null; account_status?: string | null };
      access?: AccessContext;
      requestId?: string;
    }
  }
}
export {};

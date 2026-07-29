import type { User } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      profile?: { id: string; role: string; full_name: string | null };
      requestId?: string;
    }
  }
}
export {};

import type { UserRole } from '@/generated/prisma/enums';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
  }
}

// next-auth/jwt.d.ts re-exports the JWT interface from @auth/core/jwt via
// `export *`; the augmentation has to target the module where it is actually
// declared, otherwise TypeScript creates a disconnected shadow interface.
declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
  }
}

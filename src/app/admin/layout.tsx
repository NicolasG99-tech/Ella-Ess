import { requireRoleForPage } from '@/lib/server/authz';
import { LogoutButton } from '@/features/auth/LogoutButton';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleForPage('admin', '/admin');

  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <span className="font-semibold text-stone-900">Lese-Abenteuer — Admin-Demo</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-600">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

import Link from 'next/link';
import { requireRoleForPage } from '@/lib/server/authz';
import { LogoutButton } from '@/features/auth/LogoutButton';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleForPage('teacher', '/lehrer');

  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <span className="font-semibold text-stone-900">Lese-Abenteuer — Lehrkräfte-Bereich</span>
        <div className="flex items-center gap-4">
          <Link href="/lehrer/konto" className="text-sm text-stone-600 underline">
            Mein Konto
          </Link>
          <span className="text-sm text-stone-600">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

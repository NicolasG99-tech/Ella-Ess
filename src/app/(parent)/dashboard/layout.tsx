import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/server/auth';
import { LogoutButton } from '@/features/auth/LogoutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard');
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <span className="font-semibold text-stone-900">Lese-Abenteuer — Elternbereich</span>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/abo" className="text-sm text-stone-600 underline">
            Mein Abo
          </Link>
          <Link href="/dashboard/konto" className="text-sm text-stone-600 underline">
            Mein Konto
          </Link>
          <span className="text-sm text-stone-600">{session.user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

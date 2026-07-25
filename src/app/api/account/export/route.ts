import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { gatherAccountData } from '@/lib/account/accountService';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Bitte melde dich an.' }, { status: 401 });
  }

  const data = await gatherAccountData(session.user.id);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lese-abenteuer-daten.json"',
    },
  });
}

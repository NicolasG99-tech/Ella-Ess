// Kinderbereich: bewusst spielerisch und reduziert gehalten (siehe
// docs/ARCHITECTURE.md) — kein sachlicher Eltern-Header, große Elemente.
export default function ChildAreaLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-full flex-1 flex-col bg-amber-50">{children}</main>;
}

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Erzeugt einen minimalen `.next/standalone`-Ordner mit nur den tatsächlich
  // benötigten node_modules — Grundlage für das schlanke Docker-Image
  // (siehe Dockerfile, Coolify/Hetzner-Deployment). Ohne Auswirkung auf
  // `next dev`/lokale Entwicklung.
  output: 'standalone',
  experimental: {
    serverActions: {
      // Standard-Limit (1 MB) reicht nicht für Audio-Uploads bei echtem
      // Spracherkennungs-Provider (SPEECH_PROVIDER=azure, siehe
      // submitReadingAttemptAction). Im Mock-Modus ungenutzt, da dort kein
      // Audio übertragen wird. 4 MB deckt die kurzen Leseabschnitts-Segmente
      // (2-5 Sätze) komfortabel ab; bei Bedarf anpassen.
      bodySizeLimit: '4mb',
    },
  },
  images: {
    // Erlaubt next/image für die selbst erstellten, statischen
    // Illustrations-SVGs unter public/illustrations/. Unbedenklich, da diese
    // Dateien ausschließlich von uns selbst erstellt werden (kein
    // Nutzer-Upload) und kein Skript enthalten; die CSP sandboxt SVGs
    // trotzdem zusätzlich ab.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;

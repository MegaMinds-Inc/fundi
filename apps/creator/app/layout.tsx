import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';
import '@fundi/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fundi Creator',
  description: 'Fundi Creator - program and lesson authoring',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  // Pulse dark canvas — the creator app's default surface.
  themeColor: '#0C1512',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Dark is the design-system default surface (data-theme left unset).
  return (
    <html lang="en">
      <head>
        {/* Phosphor Icons (substituted set — see @fundi/ui README) */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css"
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

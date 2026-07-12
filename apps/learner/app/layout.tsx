import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';
import '@fundi/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fundi Learner',
  description: 'Fundi Learner - lesson viewing and enrollment',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  // Pulse light canvas — the learner PWA runs light (mobile-first, low-end friendly).
  themeColor: '#F4FBF6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Learner runs the light theme — same semantic tokens, no component-layer branching.
  return (
    <html lang="en" data-theme="light">
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

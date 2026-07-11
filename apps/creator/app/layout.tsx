import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fundi Creator',
  description: 'Fundi Creator - program and lesson authoring',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

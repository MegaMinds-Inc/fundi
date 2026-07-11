import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fundi Learner',
  description: 'Fundi Learner - lesson viewing and enrollment',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#059669',
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

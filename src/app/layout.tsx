import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { DialogProvider } from '@/components/ui/Dialog';

export const metadata: Metadata = {
  title: 'E-Plenarius · Sistema de Votação',
  description: 'Sistema de votação para Câmaras Municipais',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider><DialogProvider>{children}</DialogProvider></AuthProvider>
      </body>
    </html>
  );
}

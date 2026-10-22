'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { publicGet } from '@/components/public/PublicShell';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Endereço amigável: /publico/camara-municipal-de-emas/... vira /publico/<id>/... antes de
 * montar a página (assim nenhuma página busca dados com o slug).
 */
export default function PublicoChamberLayout({ children }: { children: React.ReactNode }) {
  const { chamberId } = useParams<{ chamberId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const isUuid = UUID.test(chamberId);

  useEffect(() => {
    if (isUuid) return;
    publicGet<{ id: string }>(`/chambers/by-slug/${encodeURIComponent(chamberId)}`).then(c => {
      if (c?.id) router.replace(pathname.replace(`/publico/${chamberId}`, `/publico/${c.id}`));
    });
  }, [chamberId, isUuid, pathname, router]);

  if (!isUuid) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F6F9' }}>
        <Loader2 className="animate-spin" color="#64748B" />
      </div>
    );
  }
  return <>{children}</>;
}

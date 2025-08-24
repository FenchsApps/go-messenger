
import { CallView } from '@/components/call-view';
import { Suspense } from 'react';

export default function CallPage({ params }: { params: { callId: string } }) {
  return (
    <Suspense fallback={<div>Загрузка звонка...</div>}>
      <CallView callId={params.callId} />
    </Suspense>
  );
}

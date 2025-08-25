
'use client';
import { CallView } from '@/components/call-view';
import { useParams } from 'next/navigation';

export default function CallPage() {
  const params = useParams();
  const callId = params.callId as string;

  return <CallView callId={callId} />;
}

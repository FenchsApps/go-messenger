'use client';

import { MicrophoneSetup } from './microphone-setup';
import { CameraSetup } from './camera-setup';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Mic, Video } from 'lucide-react';
import { Separator } from './ui/separator';

export function DeviceSettings() {
  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><Mic className="h-4 w-4" /> Настройки микрофона</h3>
        <p className="text-sm text-muted-foreground">
            Выберите и протестируйте ваш микрофон.
        </p>
      </div>
      <MicrophoneSetup />
      <Separator />
      <div className="space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><Video className="h-4 w-4" /> Настройки камеры</h3>
         <p className="text-sm text-muted-foreground">
            Выберите и протестируйте вашу веб-камеру.
        </p>
      </div>
      <CameraSetup />
    </div>
  );
}

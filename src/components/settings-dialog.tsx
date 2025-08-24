
'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings, Moon, Sun, Monitor, CaseSensitive, Mic } from 'lucide-react';
import { useSettings } from '@/context/settings-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MicVisualizer } from './mic-visualizer';

export function SettingsDialog() {
  const { 
    theme, setTheme, 
    textSize, setTextSize,
    micId, setMicId
  } = useSettings();

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    // Only enumerate devices when the dialog is open to avoid unnecessary permission requests
    if (isDialogOpen) {
      const getDevices = async () => {
        try {
          // Request permission first to ensure we get device labels
          await navigator.mediaDevices.getUserMedia({ audio: true });
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
          setAudioDevices(audioInputDevices);

          // If no mic is selected, or the selected one is gone, select the first available one
          if ((!micId || !audioInputDevices.find(d => d.deviceId === micId)) && audioInputDevices.length > 0) {
              setMicId(audioInputDevices[0].deviceId);
          }
        } catch (err) {
          console.error("Error enumerating audio devices:", err);
          setAudioDevices([]); // Clear list on error
        }
      };
      getDevices();
    }
  }, [isDialogOpen, micId, setMicId]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Настройки</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-3">
            <Label className="font-semibold">Тема</Label>
            <RadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as any)}
              className="grid grid-cols-3 gap-2"
            >
              <div>
                <RadioGroupItem value="light" id="light" className="peer sr-only" />
                <Label
                  htmlFor="light"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <Sun className="mb-2 h-5 w-5" />
                  Светлая
                </Label>
              </div>
              <div>
                <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                <Label
                  htmlFor="dark"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <Moon className="mb-2 h-5 w-5" />
                  Темная
                </Label>
              </div>
              <div>
                <RadioGroupItem value="system" id="system" className="peer sr-only" />
                <Label
                  htmlFor="system"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <Monitor className="mb-2 h-5 w-5" />
                  Системная
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid gap-3">
            <Label className="font-semibold">Размер текста</Label>
            <RadioGroup
              value={textSize}
              onValueChange={(value) => setTextSize(value as any)}
              className="grid grid-cols-3 gap-2"
            >
              <div>
                <RadioGroupItem value="sm" id="sm" className="peer sr-only" />
                <Label
                  htmlFor="sm"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <CaseSensitive className="mb-2 h-4 w-4" />
                  Маленький
                </Label>
              </div>
              <div>
                <RadioGroupItem value="md" id="md" className="peer sr-only" />
                <Label
                  htmlFor="md"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <CaseSensitive className="mb-2 h-5 w-5" />
                  Средний
                </Label>
              </div>
               <div>
                <RadioGroupItem value="lg" id="lg" className="peer sr-only" />
                <Label
                  htmlFor="lg"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <CaseSensitive className="mb-2 h-6 w-6" />
                  Большой
                </Label>
              </div>
            </RadioGroup>
          </div>
           <div className="grid gap-3">
            <Label htmlFor="mic-select" className="font-semibold flex items-center gap-2">
              <Mic className="w-5 h-5"/>
              Микрофон
            </Label>
            <Select value={micId} onValueChange={setMicId}>
              <SelectTrigger id="mic-select" disabled={audioDevices.length === 0}>
                <SelectValue placeholder="Выберите микрофон" />
              </SelectTrigger>
              <SelectContent>
                {audioDevices.length > 0 ? audioDevices.map(device => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Микрофон ${audioDevices.indexOf(device) + 1}`}
                  </SelectItem>
                )) : (
                    <SelectItem value="no-devices" disabled>
                        Микрофоны не найдены
                    </SelectItem>
                )}
              </SelectContent>
            </Select>
            <MicVisualizer deviceId={micId} isOpen={isDialogOpen} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

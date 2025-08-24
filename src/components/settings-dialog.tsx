'use client';

import { useEffect, useState } from 'react';
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
import { Settings, Moon, Sun, Monitor, CaseSensitive, Mic, Video } from 'lucide-react';
import { useSettings } from '@/context/settings-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';

export function SettingsDialog() {
  const { 
    theme, setTheme, 
    textSize, setTextSize,
    videoDeviceId, setVideoDeviceId,
    audioDeviceId, setAudioDeviceId
  } = useSettings();
  
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    // This function now only runs once when the component mounts
    const getDevices = async () => {
      try {
        // We only need to enumerate devices, no need to keep the stream running.
        // A one-time permission request is enough if not granted.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
        // IMPORTANT: Stop the tracks immediately after we get the list
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Could not get media devices for settings.", err);
        // We don't want to bother the user with a toast here,
        // as the call-view will handle permission errors more gracefully.
      }
    };
    getDevices();
  }, []);

  return (
    <Dialog>
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

          <Separator />

          <div className="grid gap-3">
             <Label className="font-semibold flex items-center gap-2">
                <Video className="w-5 h-5" /> Камера
             </Label>
             <Select value={videoDeviceId} onValueChange={setVideoDeviceId}>
                <SelectTrigger>
                    <SelectValue placeholder="Выберите камеру" />
                </SelectTrigger>
                <SelectContent>
                    {videoDevices.map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Камера ${videoDevices.indexOf(device) + 1}`}
                        </SelectItem>
                    ))}
                </SelectContent>
             </Select>
          </div>
           <div className="grid gap-3">
             <Label className="font-semibold flex items-center gap-2">
                <Mic className="w-5 h-5" /> Микрофон
             </Label>
             <Select value={audioDeviceId} onValueChange={setAudioDeviceId}>
                <SelectTrigger>
                    <SelectValue placeholder="Выберите микрофон" />
                </SelectTrigger>
                <SelectContent>
                     {audioDevices.map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Микрофон ${audioDevices.indexOf(device) + 1}`}
                        </SelectItem>
                    ))}
                </SelectContent>
             </Select>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

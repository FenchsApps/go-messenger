import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log("This browser does not support desktop notification");
    return;
  }

  if (Notification.permission === 'granted') {
    return;
  }
  
  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted.');
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  }
}

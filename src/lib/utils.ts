import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function requestNotificationPermission(force: boolean = false) {
  if (!('Notification' in window)) {
    console.log("This browser does not support desktop notification");
    return;
  }

  // If we aren't forcing, and permission is not 'default', we don't need to ask again.
  if (!force && Notification.permission !== 'default') {
    return;
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
    } else {
      console.log('Notification permission denied.');
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
  }
}

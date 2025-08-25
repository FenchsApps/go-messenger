'use client';

import { saveSubscription } from "@/app/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function setupPushNotifications(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn("Push notifications are not supported by this browser.");
    return;
  }
  
  if (!VAPID_PUBLIC_KEY) {
      console.error("VAPID public key is not defined.");
      return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        await saveSubscription(userId, subscription);
        return;
    }
    
    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') {
        console.warn('Permission for notifications was denied.');
        return;
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
    });
    
    await saveSubscription(userId, subscription);

  } catch(error) {
    console.error("Error setting up push notifications:", error);
  }
}

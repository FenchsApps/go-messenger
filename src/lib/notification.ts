
'use client';

import { saveSubscription } from "@/app/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getPushSubscription() {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        if (!VAPID_PUBLIC_KEY) {
            throw new Error("VAPID public key is not defined. Cannot subscribe to push notifications.");
        }
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
        });
    }
    return subscription;
}

export async function setupPushNotifications(userId: string, onError: (message: string) => void) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    onError("Push notifications are not supported in this browser.");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    if (registration.installing) {
        console.log('Service worker installing');
    } else if (registration.waiting) {
        console.log('Service worker installed');
    } else if (registration.active) {
        console.log('Service worker active');
    }

    if (Notification.permission === 'granted') {
      console.log('Permission for notifications already granted.');
      const subscription = await getPushSubscription();
      // The subscription object needs to be converted to a plain object to be stored in Firestore
      await saveSubscription(userId, JSON.parse(JSON.stringify(subscription)));
    } else if (Notification.permission === 'denied') {
      console.log('Permission for notifications was denied.');
    } else {
      console.log('Requesting permission for notifications.');
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Permission for notifications granted.');
        const subscription = await getPushSubscription();
        await saveSubscription(userId, JSON.parse(JSON.stringify(subscription)));
      } else {
        console.log('Permission for notifications denied.');
      }
    }
  } catch (error) {
    console.error('Service Worker Error', error);
    onError("Failed to set up push notifications.");
  }
}

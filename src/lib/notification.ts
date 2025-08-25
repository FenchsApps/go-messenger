'use client';

import { saveSubscription } from "@/app/actions";

// This key is safe to be exposed on the client side
const VAPID_PUBLIC_KEY = "BMRz-1A7a5S0RvrG2Yk8mE2W0vB8mJ-m_H0tX9x8f2g5d1eR2c3s4v5w6y7z8A9B0C1D2E3F4G5H6I7J8";

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
    const registration = await navigator.serviceWorker.ready;
    const permission = await window.Notification.requestPermission();
    
    if (permission !== 'granted') {
        console.warn('Permission for notifications was denied.');
        // Maybe inform the user how to enable them later
        return;
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log("No existing subscription found, creating a new one.");
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
      });
    } else {
       console.log("Existing subscription found.");
    }
    
    await saveSubscription(userId, subscription.toJSON());
    console.log("Subscription details sent to the server.");

    // Send a welcome/confirmation notification
    if (registration.showNotification && Notification.permission === 'granted') {
        registration.showNotification('Уведомления включены', {
            body: 'Рады видеть вас в Go Messenger!',
            icon: '/icons/icon-192x192.png',
            silent: true
        });
    }

  } catch(error) {
    console.error("Error setting up push notifications:", error);
  }
}

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    deferredPWAInstallPrompt?: BeforeInstallPromptEvent;
  }
}

export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    window.deferredPWAInstallPrompt || null
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert('Браузер не надав автоматичного доступу до встановлення. \n\nЩоб встановити вручну:\n• На ПК (Chrome/Edge): натисніть іконку встановлення в адресному рядку.\n• На iPhone (Safari): натисніть "Поділитися" ➔ "На екран Додому".\n• На Android: меню браузера ➔ "Встановити додаток".\n\n(Або можливо, додаток вже встановлено!)');
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      window.deferredPWAInstallPrompt = undefined;
    }
  };

  return { handleInstall };
};

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt if user hasn't explicitly dismissed it recently
      const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!hasDismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember that the user dismissed it so we don't annoy them constantly
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm bg-secondary/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-4 pr-6">
        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
          <Download className="w-6 h-6 text-primary" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-1">Встановити додаток</h3>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            Встановіть Rpet на свій пристрій для зручного доступу та повноцінної роботи без інтернету!
          </p>
          
          <div className="flex gap-2">
            <button 
              onClick={handleInstallClick}
              className="flex-1 bg-primary text-primary-foreground py-1.5 px-3 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Встановити
            </button>
            <button 
              onClick={handleDismiss}
              className="flex-1 bg-white/5 text-white py-1.5 px-3 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors border border-white/5"
            >
              Не зараз
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

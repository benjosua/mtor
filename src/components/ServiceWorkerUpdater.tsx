import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

function ServiceWorkerUpdater() {
  const { t } = useTranslation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered:', r);
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      console.log('App ready for offline use');
      toast.success(t('pwa.offlineReadyTitle'), {
        description: t('pwa.offlineReadyDescription'),
        duration: 5000,
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady, t]);

  useEffect(() => {
    if (needRefresh) {
      console.log('New version available, showing notification...');
      toast.info(t('pwa.updateAvailableTitle'), {
        description: t('pwa.updateAvailableDescription'),
        action: {
          label: t('pwa.updateNow'),
          onClick: () => {
            updateServiceWorker(true);
          },
        },
        duration: Infinity,
      });
    }
  }, [needRefresh, updateServiceWorker, t]);

  return null;
}

export default ServiceWorkerUpdater;
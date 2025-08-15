import { useSyncConnectionStatus } from 'jazz-tools/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function ConnectionStatus() {
    const { t } = useTranslation();
    const isConnected = useSyncConnectionStatus();
    const isFirstRender = useRef(true);
    const previousState = useRef(isConnected);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            previousState.current = isConnected;
            return;
        }

        if (previousState.current !== isConnected) {
            if (isConnected) {
                toast.success(t('connection.connected'), {
                    description: t('connection.connectedDescription'),
                    duration: 2000,
                });
            } else {
                toast.warning(t('connection.lost'), {
                    description: t('connection.lostDescription'),
                    duration: 3000,
                });
            }
            previousState.current = isConnected;
        }
    }, [isConnected, t]);

    return null;
}

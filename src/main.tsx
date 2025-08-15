import { JazzReactProvider } from 'jazz-tools/react';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import { AccountProvider } from './components/AccountProvider';
import { DialogProvider } from './components/DialogProvider';
import ServiceWorkerUpdater from './components/ServiceWorkerUpdater';
import { ThemeProvider } from './components/theme-provider';
import { UiScaler } from './components/UiScaler';
import i18n from './i18n';
import './index.css';
import { onAnonymousAccountDiscarded } from './jazz/auth';
import { WorkoutAppAccount } from './jazz/schema';

const JAZZ_API_KEY = import.meta.env.VITE_JAZZ_API_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={i18n.t('common.loading', 'Loading...')}>
      <JazzReactProvider
        AccountSchema={WorkoutAppAccount}
        sync={
          { peer: `wss://cloud.jazz.tools/?key=${JAZZ_API_KEY}`, when: "signedUp" }}
        onAnonymousAccountDiscarded={onAnonymousAccountDiscarded}
      >
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <DialogProvider>
            <AccountProvider>
              <UiScaler />
              <App />
              <ServiceWorkerUpdater />
              <Toaster theme="system" />
            </AccountProvider>
          </DialogProvider>
        </ThemeProvider>
      </JazzReactProvider>
    </Suspense>
  </React.StrictMode>,
)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { DataProvider } from './data';
import { requestPersistence } from './db';
import { seedIfNeeded } from './seed/seed';
import './styles.css';

registerSW({ immediate: true });
requestPersistence();

seedIfNeeded().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DataProvider>
        <App />
      </DataProvider>
    </StrictMode>
  );
});

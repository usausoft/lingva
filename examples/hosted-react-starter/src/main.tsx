import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppLingvaProvider } from './lingva/provider';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

createRoot(root).render(
  <AppLingvaProvider>
    <App />
  </AppLingvaProvider>
);

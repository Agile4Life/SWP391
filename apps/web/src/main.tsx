import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import './styles.css';
import { installClickRipple } from './shared/ui/clickRipple';
import { ThemeProvider } from './shared/ui/ThemeToggle';
import { registerPwa } from './features/pwa/registerPwa';

installClickRipple();
void registerPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode><ThemeProvider><RouterProvider router={router} /></ThemeProvider></StrictMode>,
);

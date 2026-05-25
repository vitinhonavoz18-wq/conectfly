import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import './styles.css';

// Root logic for early redirect if needed
if (typeof window !== 'undefined') {
  const path = window.location.pathname;
  const sessionV2 = localStorage.getItem('sitecreatorfly_admin_session_v2');
  
  // Rule 7: Initial redirect
  if (path === '/' && sessionV2 !== 'true') {
     console.log('[Main] Acesso à raiz sem sessão V2. Preparando redirecionamento.');
     // To be 100% sure, we can force a redirect if the router doesn't catch it fast enough
     // but the router beforeLoad on _authenticated is very fast.
  }
}

const router = getRouter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

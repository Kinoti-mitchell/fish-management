
// Ensure React is loaded first and available globally
import React from "react";
import { createRoot } from "react-dom/client";
import { Suspense } from "react";
import * as ReactDOM from "react-dom";

// Make React available globally to prevent useLayoutEffect errors
if (typeof window !== 'undefined') {
  (window as any).React = React;
  // Also make React hooks available globally for libraries that need them
  (window as any).ReactDOM = ReactDOM;
}

import App from "./App.tsx";
import "./index.css";
import "./styles/rio-fish-branding.css";
import { AuthProvider } from "./components/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { LoadingScreen } from "./components/LoadingScreen";
import { initializePWA } from "./utils/pwa";

// Initialize PWA features
initializePWA();

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<LoadingScreen />}>
    <AuthProvider>
      <App />
      <Toaster />
    </AuthProvider>
  </Suspense>
);
  
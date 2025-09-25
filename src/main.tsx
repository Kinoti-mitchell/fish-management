
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/rio-fish-branding.css";
import { AuthProvider } from "./components/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { LoadingScreen } from "./components/LoadingScreen";

createRoot(document.getElementById("root")!).render(
  <React.Suspense fallback={<LoadingScreen />}>
    <AuthProvider>
      <App />
      <Toaster />
    </AuthProvider>
  </React.Suspense>
);
  
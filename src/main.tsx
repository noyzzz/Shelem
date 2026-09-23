import { App } from "@/app/App";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Toaster } from "@/components/ui/toast";
import "@/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
    </ErrorBoundary>
  </StrictMode>,
);

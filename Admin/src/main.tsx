import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "@/context/ThemeContext";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  queryClient,
  ADMIN_PERSIST_MAX_AGE_MS,
} from "@/lib/queryClient";

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "NEXTFIT_ADMIN_REACT_QUERY",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ADMIN_PERSIST_MAX_AGE_MS,
      }}
    >
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PersistQueryClientProvider>
  </StrictMode>
);

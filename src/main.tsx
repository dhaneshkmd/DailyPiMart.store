import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

/**
 * Render app ONLY after Pi SDK is ready.
 * index.html dispatches `pi-ready` when Pi.init() succeeds.
 */
function renderApp() {
  root.render(<App />);
}

// If Pi SDK is already ready, render immediately
if ((window as any).__PI_READY__) {
  renderApp();
} else {
  // Otherwise wait for Pi SDK initialization
  document.addEventListener(
    "pi-ready",
    () => {
      renderApp();
    },
    { once: true }
  );

  // Optional safety fallback (non-payment pages can still render)
  setTimeout(() => {
    if (!(window as any).__PI_READY__) {
      console.warn("Pi SDK not ready after timeout, rendering app in limited mode");
      renderApp();
    }
  }, 5000);
}

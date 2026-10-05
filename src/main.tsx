import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Automatically prefix /api/ calls with VITE_API_BASE_URL when frontend is hosted separately (e.g. Firebase Hosting -> Render Backend)
const rawApiBase = String((import.meta as any).env?.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
if (rawApiBase) {
  const apiOrigin = rawApiBase.endsWith("/api") ? rawApiBase.slice(0, -4) : rawApiBase;

  // 1. Patch window.fetch() — covers all XHR/JSON API calls
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = `${apiOrigin}${input}`;
    }
    return originalFetch(input, init);
  };

  // 2. Patch <img> and <video> src attributes — covers media that bypasses fetch()
  //    e.g. <img src="/api/media/MEDIA-XXX"> would otherwise hit the wrong host (Firebase)
  function rewriteMediaSrc(el: Element) {
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) {
      const src = el.getAttribute("src");
      if (src && src.startsWith("/api/")) {
        el.setAttribute("src", `${apiOrigin}${src}`);
      }
    }
    // Also handle <source> inside <video>/<picture>
    if (el instanceof HTMLSourceElement) {
      const src = el.getAttribute("src");
      if (src && src.startsWith("/api/")) {
        el.setAttribute("src", `${apiOrigin}${src}`);
      }
    }
  }

  // Rewrite any existing nodes once DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("img[src], video[src], source[src]").forEach(rewriteMediaSrc);
  });

  // Watch for dynamically added/updated nodes (React renders after initial load)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            rewriteMediaSrc(node);
            node.querySelectorAll("img[src], video[src], source[src]").forEach(rewriteMediaSrc);
          }
        });
      } else if (mutation.type === "attributes" && mutation.target instanceof Element) {
        rewriteMediaSrc(mutation.target);
      }
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

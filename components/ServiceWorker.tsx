"use client";

import { useEffect } from "react";

/** Registers the app-shell service worker once on mount (production only). */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // Tie the SW URL to the build id so a new deploy registers a fresh worker
    // (and its activate step purges the previous build's cache).
    const v = process.env.NEXT_PUBLIC_BUILD_ID || "";
    const url = v ? `/sw.js?v=${encodeURIComponent(v)}` : "/sw.js";
    const onLoad = () => navigator.serviceWorker.register(url).catch(() => {});
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Recover from stale-deploy chunk errors. When a new version is deployed, a tab
  // open since an older build can 404 on a code-split chunk the moment it renders
  // a not-yet-loaded view. All game state lives server-side, so a one-time reload
  // recovers cleanly. A sessionStorage flag prevents a reload loop.
  useEffect(() => {
    const RELOADED = "paleo_chunk_reloaded";
    const looksLikeChunkError = (msg: string) =>
      /loading chunk [\w-]+ failed/i.test(msg) ||
      /ChunkLoadError/i.test(msg) ||
      /failed to fetch dynamically imported module/i.test(msg) ||
      /importing a module script failed/i.test(msg);

    const recover = (msg: string) => {
      if (!looksLikeChunkError(msg)) return;
      if (sessionStorage.getItem(RELOADED)) return;
      sessionStorage.setItem(RELOADED, "1");
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => recover(e.message || String(e.error ?? ""));
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      recover(typeof r === "string" ? r : (r?.message ?? ""));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const clear = setTimeout(() => sessionStorage.removeItem(RELOADED), 10000);

    return () => {
      clearTimeout(clear);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

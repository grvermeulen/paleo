"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders a QR code for the join URL so players can hop in by scanning. */
export default function JoinQR({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 256,
      color: { dark: "#2c2117", light: "#f4ecd8" },
    })
      .then((d) => alive && setSrc(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className="flex h-44 w-44 items-center justify-center rounded-2xl border-4 border-[var(--color-ink)] bg-[var(--color-bone)]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR-code om mee te doen" className="h-40 w-40 rounded-lg" />
      ) : (
        <span className="text-sm font-bold text-[var(--color-stone-500)]">QR…</span>
      )}
    </div>
  );
}

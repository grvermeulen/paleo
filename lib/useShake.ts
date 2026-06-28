"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MotionPermissionState = "unknown" | "granted" | "denied" | "unsupported";

interface DeviceMotionEventStatic {
  requestPermission?: () => Promise<"granted" | "denied">;
}

/**
 * Detects a phone "shake" via DeviceMotion. iOS requires an explicit permission
 * request triggered by a user gesture — call `requestPermission()` from a tap.
 */
export function useShake(onShake: () => void, enabled: boolean) {
  const [permission, setPermission] = useState<MotionPermissionState>("unknown");
  const lastShake = useRef(0);
  const lastSample = useRef(0);
  const cb = useRef(onShake);
  useEffect(() => {
    cb.current = onShake;
  }, [onShake]);

  const needsPermission =
    typeof window !== "undefined" &&
    typeof (DeviceMotionEvent as unknown as DeviceMotionEventStatic)?.requestPermission ===
      "function";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceMotionEvent" in window)) {
      setPermission("unsupported");
      return;
    }
    if (!needsPermission) setPermission("granted");
  }, [needsPermission]);

  const requestPermission = useCallback(async () => {
    if (!needsPermission) {
      setPermission("granted");
      return;
    }
    try {
      const res = await (
        DeviceMotionEvent as unknown as DeviceMotionEventStatic
      ).requestPermission!();
      setPermission(res === "granted" ? "granted" : "denied");
    } catch {
      setPermission("denied");
    }
  }, [needsPermission]);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    const THRESHOLD = 17; // m/s^2 above gravity
    const handler = (e: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastSample.current < 50) return;
      lastSample.current = now;
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (mag > THRESHOLD + 9.8 && now - lastShake.current > 900) {
        lastShake.current = now;
        cb.current();
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [enabled, permission]);

  return { permission, requestPermission, needsPermission };
}

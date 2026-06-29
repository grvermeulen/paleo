"use client";

// A stable per-device id + remembered display name, kept in localStorage.

const ID_KEY = "paleo_device_id";
const NAME_KEY = "paleo_name";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function saveName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name);
}

const QUICK_HUNT_KEY = "paleo_quick_hunt";

/** Per-device "Snelle jacht": skip the hunt mini-game and auto-resolve. */
export function getQuickHunt(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(QUICK_HUNT_KEY) === "1";
}

export function setQuickHunt(on: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUICK_HUNT_KEY, on ? "1" : "0");
}

/** Whether the device asks for reduced motion (also implies quick-resolve). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

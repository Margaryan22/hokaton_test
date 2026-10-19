const KEY = "va:sound";
const listeners = new Set<() => void>();

export function subscribeSound(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/** Sound is on unless the user switched it off. */
export function parseSound(value: string | null): boolean {
  return value !== "off";
}

export function readSound(): boolean {
  try {
    return parseSound(localStorage.getItem(KEY));
  } catch {
    return true;
  }
}

export function writeSound(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // storage unavailable: the choice lasts until reload only
  }
  listeners.forEach((listener) => listener());
}

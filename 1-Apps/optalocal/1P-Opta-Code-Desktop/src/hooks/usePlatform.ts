import { useEffect, useState } from "react";
import { getPlatform } from "../lib/platform.js";

export type { Platform } from "../lib/platform.js";

export function usePlatform() {
  const [platform, setPlatform] = useState<
    "macos" | "windows" | "linux" | null
  >(null);
  useEffect(() => {
    void getPlatform().then(setPlatform);
  }, []);
  return platform;
}

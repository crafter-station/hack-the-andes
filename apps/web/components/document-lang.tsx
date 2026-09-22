"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const englishPrefixes = [
  "/admin",
  "/sign-in",
  "/sign-up",
  "/welcome",
  "/auth",
] as const;

export function isEnglishPath(pathname: string): boolean {
  return englishPrefixes.some((prefix) => {
    if (pathname === prefix) {
      return true;
    }
    return pathname.startsWith(`${prefix}/`);
  });
}

/** Keeps admin and auth English routes from inheriting the Spanish marketing lang. */
export function DocumentLang() {
  const pathname = usePathname();

  useEffect(() => {
    if (isEnglishPath(pathname)) {
      document.documentElement.lang = "en";
      return;
    }
    document.documentElement.lang = "es";
  }, [pathname]);

  return null;
}

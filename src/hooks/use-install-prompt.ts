import { useEffect, useState } from "react";

/**
 * Tracks whether the browser considers this PWA installable and, if so, holds
 * the deferred `beforeinstallprompt` event so a manual button can trigger it.
 * Chrome suppresses the automatic prompt in many cases, so this is the
 * reliable way to offer installation.
 */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return { canInstall: prompt !== null, installed, prompt };
}

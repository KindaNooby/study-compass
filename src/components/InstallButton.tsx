import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { Download, Smartphone } from "lucide-react";
import { useMemo } from "react";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * A manual install affordance for the landing page. Chrome/Edge on Android and
 * desktop fire `beforeinstallprompt`, which we surface as a button; iOS Safari
 * has no such event, so we show the Share-sheet instructions instead.
 */
export function InstallButton() {
  const { canInstall, installed, prompt } = useInstallPrompt();
  const ios = useMemo(() => isIos(), []);

  if (installed) return null;

  if (canInstall && prompt) {
    return (
      <button
        type="button"
        onClick={() => void prompt.prompt()}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-[#3159b7] px-4 text-sm font-bold text-white shadow-[0_8px_16px_rgba(49,89,183,0.2)] hover:bg-[#264b9f]"
      >
        <Download className="size-4" /> Install
      </button>
    );
  }

  if (ios) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#536ca7]">
        <Smartphone className="size-4 shrink-0" />
        To install: tap Share, then “Add to Home Screen”
      </span>
    );
  }

  return null;
}

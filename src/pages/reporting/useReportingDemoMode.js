import { useEffect, useState } from "react";

const REPORTING_DEMO_MODE_STORAGE_KEY = "reporting-demo-mode.enabled.v1";
const REPORTING_DEMO_MODE_EVENT = "reporting-demo-mode:changed";

const readStoredDemoMode = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(REPORTING_DEMO_MODE_STORAGE_KEY) === "true";
  } catch (_) {
    return false;
  }
};

export const writeReportingDemoMode = enabled => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      REPORTING_DEMO_MODE_STORAGE_KEY,
      enabled ? "true" : "false"
    );
  } catch (_) {
    // Ignore storage failures and still update listeners in memory.
  }

  window.dispatchEvent(
    new CustomEvent(REPORTING_DEMO_MODE_EVENT, {
      detail: { enabled: Boolean(enabled) },
    })
  );
};

const useReportingDemoMode = () => {
  const [demoModeEnabled, setDemoModeEnabledState] = useState(() => readStoredDemoMode());

  useEffect(() => {
    const handleStorage = event => {
      if (event.key !== REPORTING_DEMO_MODE_STORAGE_KEY) {
        return;
      }
      setDemoModeEnabledState(event.newValue === "true");
    };

    const handleChanged = event => {
      setDemoModeEnabledState(Boolean(event?.detail?.enabled));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(REPORTING_DEMO_MODE_EVENT, handleChanged);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(REPORTING_DEMO_MODE_EVENT, handleChanged);
    };
  }, []);

  const setDemoModeEnabled = enabled => {
    const nextValue = Boolean(enabled);
    setDemoModeEnabledState(nextValue);
    writeReportingDemoMode(nextValue);
  };

  return [demoModeEnabled, setDemoModeEnabled];
};

export default useReportingDemoMode;

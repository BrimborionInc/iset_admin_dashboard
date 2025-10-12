import React, { createContext, useContext, useState, useEffect } from "react";
import { applyMode, Mode } from "@cloudscape-design/global-styles";

// Create context
const DarkModeContext = createContext();

// Provide context to the app
export const DarkModeProvider = ({ children }) => {
    const [useDarkMode, setUseDarkMode] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }
        try {
            return sessionStorage.getItem("darkMode") === "true";
        } catch (_) {
            return false;
        }
    });

    // Apply mode when state changes & log mode
    useEffect(() => {
        console.log(`Dark Mode State Changed: ${useDarkMode ? "Dark" : "Light"}`);
        applyMode(useDarkMode ? Mode.Dark : Mode.Light);

        try {
            sessionStorage.setItem("darkMode", useDarkMode ? "true" : "false");
        } catch (_) {
            // ignore storage failures
        }
    }, [useDarkMode]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const handleAuthChange = (event) => {
            if (!event?.detail?.session) {
                setUseDarkMode(false);
                try {
                    sessionStorage.removeItem("darkMode");
                } catch (_) {
                    // ignore storage failures
                }
            }
        };

        window.addEventListener("auth:session-changed", handleAuthChange);
        return () => {
            window.removeEventListener("auth:session-changed", handleAuthChange);
        };
    }, [setUseDarkMode]);

    return (
        <DarkModeContext.Provider value={{ useDarkMode, setUseDarkMode }}>
            {children}
        </DarkModeContext.Provider>
    );
};

// Custom hook for easy access
export const useDarkMode = () => useContext(DarkModeContext);

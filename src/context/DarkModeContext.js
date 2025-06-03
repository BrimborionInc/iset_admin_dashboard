import React, { createContext, useContext, useState, useEffect } from "react";
import { applyMode, Mode } from "@cloudscape-design/global-styles";

// Create context
const DarkModeContext = createContext();

// Provide context to the app
export const DarkModeProvider = ({ children }) => {
    // Load dark mode state from localStorage (default to false if not set)
    const [useDarkMode, setUseDarkMode] = useState(() => {
        return localStorage.getItem("darkMode") === "true"; // Retrieve from localStorage
    });

    // Apply mode when state changes & log mode
    useEffect(() => {
        console.log(`Dark Mode State Changed: ${useDarkMode ? "Dark" : "Light"}`);
        applyMode(useDarkMode ? Mode.Dark : Mode.Light);

        // Store the new dark mode state in localStorage
        localStorage.setItem("darkMode", useDarkMode);
    }, [useDarkMode]);

    return (
        <DarkModeContext.Provider value={{ useDarkMode, setUseDarkMode }}>
            {children}
        </DarkModeContext.Provider>
    );
};

// Custom hook for easy access
export const useDarkMode = () => useContext(DarkModeContext);

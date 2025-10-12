import React, { createContext, useState } from 'react';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [dateRange, setDateRange] = useState(undefined);
  const [locations, setLocations] = useState([]); // Add locations state

  return (
    <LocationContext.Provider value={{ selectedLocations, setSelectedLocations, dateRange, setDateRange, locations, setLocations }}>
      {children}
    </LocationContext.Provider>
  );
};

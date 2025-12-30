import React, { createContext, useContext } from 'react';

const TutorialsContext = createContext({ tutorials: [] });

const useTutorials = () => useContext(TutorialsContext);

export { TutorialsContext, useTutorials };

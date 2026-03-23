import React, { createContext, useContext, useState } from "react";

interface PlanContextType {
  planId: string | null;
  setPlanId: (id: string | null) => void;
  planActions: any[];
  setPlanActions: (actions: any[]) => void;
}

const PlanContext = createContext<PlanContextType>({
  planId: null,
  setPlanId: () => {},
  planActions: [],
  setPlanActions: () => {},
});

export const usePlan = () => useContext(PlanContext);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [planId, setPlanId] = useState<string | null>(null);
  const [planActions, setPlanActions] = useState<any[]>([]);

  return (
    <PlanContext.Provider value={{ planId, setPlanId, planActions, setPlanActions }}>
      {children}
    </PlanContext.Provider>
  );
};

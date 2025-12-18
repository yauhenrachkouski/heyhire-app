"use client";

import * as React from "react";

type PlansModalContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openPlansModal: () => void;
  closePlansModal: () => void;
};

const PlansModalContext = React.createContext<PlansModalContextValue | null>(null);

export function PlansModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  const openPlansModal = React.useCallback(() => setOpen(true), []);
  const closePlansModal = React.useCallback(() => setOpen(false), []);

  const value = React.useMemo(
    () => ({ open, setOpen, openPlansModal, closePlansModal }),
    [open, openPlansModal, closePlansModal]
  );

  return <PlansModalContext.Provider value={value}>{children}</PlansModalContext.Provider>;
}

export function usePlansModal() {
  const ctx = React.useContext(PlansModalContext);
  if (!ctx) {
    throw new Error("usePlansModal must be used within a PlansModalProvider");
  }
  return ctx;
}

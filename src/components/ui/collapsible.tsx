"use client"

import * as React from "react"

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface CollapsibleTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

interface CollapsibleContentProps {
  children: React.ReactNode;
}

const CollapsibleContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open = false, onOpenChange, children, ...props }, ref) => {
    return (
      <CollapsibleContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
        <div ref={ref} {...props}>
          {children}
        </div>
      </CollapsibleContext.Provider>
    );
  }
);
Collapsible.displayName = "Collapsible";

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ asChild, children, onClick, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(CollapsibleContext);
    
    const handleClick = () => {
      onOpenChange(!open);
      onClick?.();
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ref,
        onClick: handleClick,
      });
    }

    return (
      <button ref={ref} onClick={handleClick} {...props}>
        {children}
      </button>
    );
  }
);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ children, ...props }, ref) => {
    const { open } = React.useContext(CollapsibleContext);
    
    if (!open) return null;

    return (
      <div ref={ref} {...props}>
        {children}
      </div>
    );
  }
);
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

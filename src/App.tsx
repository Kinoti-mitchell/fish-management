import React, { memo, useState, Suspense, lazy } from "react";
import { Navigation } from "./components/Navigation";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { useAuth } from "./components/AuthContext";
import { ProtectedComponent } from "./components/ProtectedComponent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/LoadingScreen";
import { LogoPreview } from "./components/LogoPreview";
import { NavigationSection } from "./types";

// Lazy load heavy components to improve initial loading with error handling
const Dashboard = lazy(() => import("./components/Dashboard").then(module => ({ default: module.Dashboard })).catch(() => ({ default: () => <div>Dashboard component failed to load</div> })));
const WarehouseEntry = lazy(() => import("./components/WarehouseEntry").catch(() => ({ default: () => <div>Warehouse Entry component failed to load</div> })));
const ProcessingManagement = lazy(() => import("./components/ProcessingManagement").catch(() => ({ default: () => <div>Processing Management component failed to load</div> })));
const SortingManagement = lazy(() => import("./components/SortingManagement").catch(() => ({ default: () => <div>Sorting Management component failed to load</div> })));
const InventoryManagement = lazy(() => import("./components/InventoryManagement").catch(() => ({ default: () => <div>Inventory Management component failed to load</div> })));
const TransferReports = lazy(() => import("./components/TransferReports").catch(() => ({ default: () => <div>Transfer Reports component failed to load</div> })));
const DisposalManagement = lazy(() => import("./components/DisposalManagement").catch(() => ({ default: () => <div>Disposal Management component failed to load</div> })));
const OrderManagement = lazy(() => import("./components/OrderManagement").catch(() => ({ default: () => <div>Order Management component failed to load</div> })));
const DispatchManagement = lazy(() => import("./components/DispatchManagement").catch(() => ({ default: () => <div>Dispatch Management component failed to load</div> })));
const OutletReceiving = lazy(() => import("./components/OutletReceiving").catch(() => ({ default: () => <div>Outlet Receiving component failed to load</div> })));
const Reports = lazy(() => import("./components/Reports").catch(() => ({ default: () => <div>Reports component failed to load</div> })));
const UserManagement = lazy(() => import("./components/UserManagement").catch(() => ({ default: () => <div>User Management component failed to load</div> })));

const AppContentRenderer = memo(({ 
  currentSection, 
  selectedItemId, 
  onNavigate
}: {
  currentSection: NavigationSection;
  selectedItemId?: string;
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}) => {
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h3 className="text-lg font-medium text-red-600 mb-2">Component Error</h3>
        <p className="text-sm text-gray-600 mb-4">Failed to load component</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reload Page
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Dashboard onNavigate={onNavigate} />
            </Suspense>
          </ErrorBoundary>
        );
      
      case 'warehouse-entry':
        return (
          <ProtectedComponent section="warehouse-entry" requiredPermissions={['write:inventory']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <WarehouseEntry onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'processing':
        return (
          <ProtectedComponent section="processing" requiredPermissions={['write:processing']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <ProcessingManagement onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'sorting':
        return (
          <ProtectedComponent section="sorting" requiredPermissions={['write:processing']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <SortingManagement onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'inventory':
        return (
          <ProtectedComponent section="inventory" requiredPermissions={['read:inventory']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <InventoryManagement onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'transfers':
        return (
          <ProtectedComponent section="transfers" requiredPermissions={['read:inventory']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <TransferReports onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'disposal':
        return (
          <ProtectedComponent section="disposal" requiredPermissions={['write:disposal']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <DisposalManagement onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'outlet-orders':
        return (
          <ProtectedComponent section="outlet-orders" requiredPermissions={['read:sales']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <OrderManagement onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'dispatch':
        return (
          <ProtectedComponent section="dispatch" requiredPermissions={['write:logistics']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <DispatchManagement onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'outlet-receiving':
        return (
          <ProtectedComponent section="outlet-receiving" requiredPermissions={['read:sales']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <OutletReceiving onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'reports':
        return (
          <ProtectedComponent section="reports" requiredPermissions={['read:basic']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <Reports onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      case 'user-management':
        return (
          <ProtectedComponent section="user-management" requiredPermissions={['admin:*', 'write:users']}>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <UserManagement onNavigate={onNavigate} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedComponent>
        );
      
      default:
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Dashboard onNavigate={onNavigate} />
            </Suspense>
          </ErrorBoundary>
        );
    }
  };

  return renderContent();
});

AppContentRenderer.displayName = 'AppContentRenderer';

function AppContent() {
  const { user, loading, signIn, signOut } = useAuth();
  const [currentSection, setCurrentSection] = useState<NavigationSection>('dashboard');
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(undefined);
  const [appState, setAppState] = useState<'landing' | 'login' | 'app'>('landing');

  // Debug logging
  console.log('AppContent - user:', user ? JSON.stringify(user, null, 2) : 'null');
  console.log('AppContent - loading:', loading);
  console.log('AppContent - appState:', appState);
  console.log('AppContent - user exists:', !!user);
  console.log('AppContent - user role:', user?.role);

  // Show loading state
  if (loading) {
    return <LoadingScreen />;
  }

  // Landing Page
  if (appState === 'landing') {
    return <LandingPage onGetStarted={() => setAppState('login')} />;
  }

  // Login Page
  if (appState === 'login') {
    return (
      <LoginPage 
        onLogin={async (email, password) => {
          const result = await signIn(email, password);
          if (result.success) {
            setAppState('app');
            return { success: true };
          }
          return { success: false, error: result.error };
        }}
        onBack={() => setAppState('landing')}
      />
    );
  }

  // For testing, always show the app regardless of user state
  console.log('AppContent: Rendering main app, user:', user, 'appState:', appState);

  // Main Application
  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        currentSection={currentSection} 
        onNavigate={(section) => setCurrentSection(section)}
        onLogout={async () => {
          await signOut();
          setAppState('landing');
        }}
      />
      
      {/* Main content - 75% of screen width, no spillage */}
      <main className="
        w-full
        min-h-screen
        pt-16
        md:pt-0
        md:ml-[15vw]
        md:max-ml-[240px]
        md:min-ml-[200px]
        md:w-[85vw]
        md:max-w-[calc(100vw-200px)]
        md:min-w-[calc(100vw-240px)]
        overflow-x-hidden
        overflow-y-auto
        safe-area-inset-left
        safe-area-inset-right
        box-border
      ">
        <div className="
          w-full
          h-full
          max-w-full
          p-3
          sm:p-4
          md:p-6
          lg:p-8
          xl:p-10
          mx-auto
          box-border
          overflow-x-hidden
        ">
          <AppContentRenderer
            currentSection={currentSection}
            selectedItemId={selectedItemId}
            onNavigate={(section, itemId) => {
              setCurrentSection(section);
              setSelectedItemId(itemId);
            }}
          />
        </div>
      </main>
    </div>
  );
}

// Minimal fallback component
const MinimalFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Rio Fish Farm</h1>
      <p className="text-gray-600 mb-4">Kenya Operations</p>
      <p className="text-sm text-gray-500">Loading application...</p>
    </div>
  </div>
);

export default function App() {
  try {
    return (
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('App render error:', error);
    return <MinimalFallback />;
  }
}
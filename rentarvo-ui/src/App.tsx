import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { PropertiesPage } from './features/properties/PropertiesPage';
import { PropertyFormPage } from './features/properties/PropertyFormPage';
import { PropertyDetailPage } from './features/properties/PropertyDetailPage';
import { TenantsPage } from './features/tenants/TenantsPage';
import { TenantFormPage } from './features/tenants/TenantFormPage';
import { TenantDetailPage } from './features/tenants/TenantDetailPage';
import { LeasesPage } from './features/leases/LeasesPage';
import { LeaseFormPage } from './features/leases/LeaseFormPage';
import { LeaseDetailPage } from './features/leases/LeaseDetailPage';
import { IncomeLedgerPage } from './features/income/IncomeLedgerPage';
import { ExpenseLedgerPage } from './features/expenses/ExpenseLedgerPage';
import { ContactsPage } from './features/contacts/ContactsPage';
import { PlaceholderPage } from './components/PlaceholderPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DocumentsPage } from './features/documents/DocumentsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ScheduleEPage } from './features/reports/ScheduleEPage';
import { NotFoundPage } from './components/NotFoundPage';
import { Toaster } from './components/Toaster';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-700 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster />
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="properties" element={<ErrorBoundary><PropertiesPage /></ErrorBoundary>} />
              <Route path="properties/new" element={<ErrorBoundary><PropertyFormPage /></ErrorBoundary>} />
              <Route path="properties/:id/edit" element={<ErrorBoundary><PropertyFormPage /></ErrorBoundary>} />
              <Route path="properties/:id" element={<ErrorBoundary><PropertyDetailPage /></ErrorBoundary>} />
              <Route path="tenants" element={<ErrorBoundary><TenantsPage /></ErrorBoundary>} />
              <Route path="tenants/new" element={<ErrorBoundary><TenantFormPage /></ErrorBoundary>} />
              <Route path="tenants/:id" element={<ErrorBoundary><TenantDetailPage /></ErrorBoundary>} />
              <Route path="leases" element={<ErrorBoundary><LeasesPage /></ErrorBoundary>} />
              <Route path="leases/new" element={<ErrorBoundary><LeaseFormPage /></ErrorBoundary>} />
              <Route path="leases/:id" element={<ErrorBoundary><LeaseDetailPage /></ErrorBoundary>} />
              <Route path="income" element={<ErrorBoundary><IncomeLedgerPage /></ErrorBoundary>} />
              <Route path="expenses" element={<ErrorBoundary><ExpenseLedgerPage /></ErrorBoundary>} />
              <Route path="documents" element={<ErrorBoundary><DocumentsPage /></ErrorBoundary>} />
              <Route path="contacts" element={<ErrorBoundary><ContactsPage /></ErrorBoundary>} />
              <Route path="analyses" element={<PlaceholderPage title="4-Square Analysis" />} />
              <Route path="reports" element={<ErrorBoundary><ScheduleEPage /></ErrorBoundary>} />
              <Route path="chat" element={<PlaceholderPage title="Chatbot" />} />
              <Route path="import" element={<PlaceholderPage title="Excel Import" />} />
              <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

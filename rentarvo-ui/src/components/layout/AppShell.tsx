import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/AuthContext';
import { useEntityStore } from '../../lib/entityStore';
import { api } from '../../lib/api';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  DollarSign,
  Receipt,
  FolderOpen,
  Contact,
  BarChart3,
  Upload,
  Settings,
  Menu,
  X,
  Plus,
  LogOut,
  ChevronLeft,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/properties', label: 'Properties', icon: Building2 },
  { path: '/tenants', label: 'Tenants', icon: Users },
  { path: '/leases', label: 'Leases', icon: FileText },
  { path: '/income', label: 'Income', icon: DollarSign },
  { path: '/expenses', label: 'Expenses', icon: Receipt },
  { path: '/documents', label: 'Documents', icon: FolderOpen },
  { path: '/contacts', label: 'Contacts', icon: Contact },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const mobileBottomNav = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/properties', label: 'Props', icon: Building2 },
  { path: '/income', label: 'Ledger', icon: DollarSign },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const { selectedEntityId, setSelectedEntityId } = useEntityStore();

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => api.get<any[]>('/entities'),
  });

  // Auto-select first entity only on initial load (null = never chosen)
  // Empty string means user explicitly chose "All Entities"
  React.useEffect(() => {
    if (entities.length > 0 && selectedEntityId === null) {
      setSelectedEntityId(entities[0].id);
    }
  }, [entities, selectedEntityId, setSelectedEntityId]);

  return (
    <div className="min-h-dvh flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r bg-white">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-brand-700">Rentarvo</h1>
          <p className="text-xs text-gray-400">Property management, simplified.</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700 border-r-2 border-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">{user?.name}</p>
              <p className="text-gray-400 text-xs">{user?.role}</p>
            </div>
            <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-white flex flex-col z-10">
            <div className="p-4 border-b flex items-center justify-between">
              <h1 className="text-xl font-bold text-brand-700">Rentarvo</h1>
              <button onClick={() => setSidebarOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium ${
                      active ? 'bg-brand-50 text-brand-700' : 'text-gray-600'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b bg-white flex items-center px-4 gap-4 sticky top-0 z-30">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          {entities.length > 1 && (
            <select
              value={selectedEntityId || ''}
              onChange={(e) => setSelectedEntityId(e.target.value || null)}
              className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-brand-500 outline-none min-w-0 max-w-[180px] sm:max-w-none truncate"
            >
              <option value="">All Entities</option>
              {entities.map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}
          <div className="flex-1" />
          <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
          <button onClick={logout} className="lg:hidden p-2 text-gray-400 hover:text-red-500" title="Sign out">
            <LogOut size={16} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileBottomNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 ${
                  active ? 'text-brand-700' : 'text-gray-400'
                }`}
              >
                <Icon size={18} />
                <span className="text-[10px] leading-tight truncate">{item.label}</span>
              </Link>
            );
          })}

          {/* Center FAB */}
          <button
            onClick={() => setMobileAddOpen(!mobileAddOpen)}
            className="w-11 h-11 bg-accent-500 rounded-full flex items-center justify-center text-white shadow-lg -mt-6 shrink-0"
            title="Quick add"
          >
            <Plus size={22} />
          </button>

          <Link
            to="/settings"
            onClick={(e) => { e.preventDefault(); setSidebarOpen(true); }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 ${
              location.pathname.startsWith('/settings') ? 'text-brand-700' : 'text-gray-400'
            }`}
          >
            <Menu size={18} />
            <span className="text-[10px] leading-tight">More</span>
          </Link>
        </div>
      </nav>

      {/* Mobile Add sheet */}
      {mobileAddOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileAddOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 z-10 safe-area-bottom">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Add Property', path: '/properties/new', icon: Building2 },
                { label: 'New Lease', path: '/leases/new', icon: FileText },
                { label: 'Log Income', path: '/income?add=true', icon: DollarSign },
                { label: 'Log Expense', path: '/expenses?add=true', icon: Receipt },
                { label: 'Add Tenant', path: '/tenants/new', icon: Users },
                { label: 'Upload Document', path: '/documents?add=true', icon: Upload },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.path}
                    to={action.path}
                    onClick={() => setMobileAddOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50"
                  >
                    <Icon size={18} className="text-brand-600" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </Link>
                );
              })}
            </div>
            <button
              onClick={() => setMobileAddOpen(false)}
              className="w-full mt-4 py-2.5 text-gray-500 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

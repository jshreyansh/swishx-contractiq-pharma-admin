import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppUser, UserRole, Toast } from '../types';
import { supabase } from '../lib/supabase';

interface AppContextType {
  currentRole: UserRole;
  currentUser: AppUser | null;
  allUsers: AppUser[];
  roleUsers: AppUser[];
  setRole: (role: UserRole) => void;
  setCurrentUserById: (userId: string) => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  loading: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEMO_ROLE_DEFAULT_EMAIL: Record<UserRole, string> = {
  admin: 'vikram.desai@swishx.com',
  cfa: 'ramesh.cfa@swishx.com',
  division_approver: 'anand.mehta@swishx.com',
  final_approver: 'arvind.kapoor@swishx.com',
  viewer: 'ops.viewer@swishx.com',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [roleUsers, setRoleUsers] = useState<AppUser[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('app_users')
      .select('*, division:divisions(*)')
      .eq('status', 'active')
      .order('name');
    if (data) setAllUsers(data as AppUser[]);
    return (data as AppUser[]) || [];
  }, []);

  const switchToRole = useCallback(async (role: UserRole, users: AppUser[]) => {
    const usersForRole = users.filter(u => u.role === role);
    setRoleUsers(usersForRole);
    const defaultEmail = DEMO_ROLE_DEFAULT_EMAIL[role];
    const defaultUser = usersForRole.find(u => u.email === defaultEmail) || usersForRole[0] || null;
    setCurrentUser(defaultUser);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const users = await loadUsers();
      await switchToRole('admin', users);
      setLoading(false);
    };
    init();
  }, [loadUsers, switchToRole]);

  const setRole = useCallback(async (role: UserRole) => {
    setCurrentRole(role);
    await switchToRole(role, allUsers);
  }, [switchToRole, allUsers]);

  const setCurrentUserById = useCallback((userId: string) => {
    const user = allUsers.find(u => u.id === userId) || null;
    if (user) setCurrentUser(user);
  }, [allUsers]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{
      currentRole, currentUser, allUsers, roleUsers,
      setRole, setCurrentUserById,
      toasts, addToast, removeToast,
      loading,
      sidebarCollapsed, toggleSidebar,
      mobileSidebarOpen, setMobileSidebarOpen,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

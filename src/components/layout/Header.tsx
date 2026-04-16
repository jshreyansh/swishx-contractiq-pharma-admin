import { ChevronDown, Shield, Truck, GitBranch, CheckSquare, Eye, Users, Menu, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { useLocation } from 'react-router-dom';

const roles: { role: UserRole; label: string; icon: React.ElementType; color: string; dot: string }[] = [
  { role: 'admin', label: 'Admin / Executive', icon: Shield, color: 'text-[#FD4B1B]', dot: 'bg-[#FD4B1B]' },
  { role: 'cfa', label: 'CFA / CNF User', icon: Truck, color: 'text-amber-600', dot: 'bg-amber-500' },
  { role: 'division_approver', label: 'Division Approver', icon: GitBranch, color: 'text-emerald-600', dot: 'bg-emerald-500' },
  { role: 'final_approver', label: 'Final Approver', icon: CheckSquare, color: 'text-[#0278FC]', dot: 'bg-[#0278FC]' },
  { role: 'viewer', label: 'Viewer (Read-only)', icon: Eye, color: 'text-ink-700', dot: 'bg-ink-300' },
];

const MULTI_ACCOUNT_ROLES: UserRole[] = ['cfa', 'division_approver', 'final_approver'];

const ROUTE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  'orders': 'Orders',
  'cfa-queue': 'CFA Queue',
  'division': 'Division Workspace',
  'final-approval': 'Final Approval',
  'reports': 'Reports',
  'config': 'Config & Users',
};

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-semibold text-ink-900">Dashboard</span>;
  }

  const crumbs = segments.map((seg, i) => {
    const label = ROUTE_LABELS[seg] || (seg.length > 20 ? seg.slice(0, 8) + '…' : seg);
    const isLast = i === segments.length - 1;
    return { label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1">
      <span className="text-sm text-ink-500">Dashboard</span>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={13} className="text-ink-300" />
          <span className={`text-sm ${crumb.isLast ? 'font-semibold text-ink-900' : 'text-ink-500'}`}>
            {crumb.label}
          </span>
        </span>
      ))}
    </nav>
  );
}

export default function Header() {
  const { currentRole, currentUser, roleUsers, setRole, setCurrentUserById, setMobileSidebarOpen } = useApp();
  const [roleOpen, setRoleOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const active = roles.find(r => r.role === currentRole)!;
  const showAccountSwitcher = MULTI_ACCOUNT_ROLES.includes(currentRole) && roleUsers.length > 1;

  const userInitials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="h-14 bg-app-surface border-b border-app-surface-dark flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open navigation menu"
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-ink-700 hover:bg-app-surface-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/30"
        >
          <Menu size={18} />
        </button>
        <div className="hidden sm:block">
          <Breadcrumbs />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showAccountSwitcher && (
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => { setAccountOpen(!accountOpen); setRoleOpen(false); }}
              className="flex items-center gap-2 bg-white hover:bg-app-bg border border-app-surface-dark rounded-xl px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/30"
            >
              <Users size={13} className="text-ink-500" />
              <span className="text-ink-900 font-medium hidden sm:inline">{currentUser?.name || 'Select Account'}</span>
              <ChevronDown size={13} className="text-ink-500" />
            </button>

            {accountOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-app-surface-dark rounded-2xl shadow-xl py-1.5 z-50 animate-fade-in">
                <p className="px-3 py-1.5 text-xs text-ink-500 font-semibold uppercase tracking-wide border-b border-app-surface-dark mb-1">
                  Switch Account
                </p>
                {roleUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => { setCurrentUserById(user.id); setAccountOpen(false); }}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 text-sm hover:bg-app-bg transition-colors ${
                      user.id === currentUser?.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-app-surface-dark flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-ink-700">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className={`font-semibold truncate ${user.id === currentUser?.id ? 'text-brand-orange' : 'text-ink-900'}`}>
                        {user.name}
                      </p>
                      <p className="text-xs text-ink-500 truncate">{user.email}</p>
                      {user.division && (
                        <p className="text-xs text-ink-500 truncate">{(user.division as { name: string }).name}</p>
                      )}
                    </div>
                    {user.id === currentUser?.id && (
                      <span className="ml-auto text-xs text-brand-orange font-semibold flex-shrink-0 mt-0.5">Active</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={roleRef}>
          <button
            onClick={() => { setRoleOpen(!roleOpen); setAccountOpen(false); }}
            className="flex items-center gap-2 bg-white hover:bg-app-bg border border-app-surface-dark rounded-xl px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/30"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${active.dot}`} />
            <span className="font-medium text-ink-900 hidden sm:inline">{active.label}</span>
            <ChevronDown size={13} className="text-ink-500" />
          </button>

          {roleOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-app-surface-dark rounded-2xl shadow-xl py-1.5 z-50 animate-fade-in">
              <p className="px-3 py-1.5 text-xs text-ink-500 font-semibold uppercase tracking-wide border-b border-app-surface-dark mb-1">Switch Role</p>
              {roles.map(r => (
                <button
                  key={r.role}
                  onClick={() => { setRole(r.role); setRoleOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-app-bg transition-colors ${
                    r.role === currentRole ? 'bg-primary-50' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} />
                  <span className={r.role === currentRole ? 'font-semibold text-brand-orange' : 'text-ink-900'}>{r.label}</span>
                  {r.role === currentRole && (
                    <span className="ml-auto text-xs text-brand-orange font-semibold">Active</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
            {userInitials}
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs font-semibold text-ink-900 leading-none">{currentUser?.name || '—'}</p>
            <p className="text-xs text-ink-500 mt-0.5">{currentUser?.email || '—'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

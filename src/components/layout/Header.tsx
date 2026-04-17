import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronLeft, ChevronRight,
  Shield, Truck, GitBranch, CheckSquare, Eye, Users, Menu,
  LayoutDashboard, ClipboardList, BarChart2, Settings, ScrollText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

const roles: { role: UserRole; label: string; dot: string }[] = [
  { role: 'admin',            label: 'Admin / Executive',   dot: 'bg-[#FD4B1B]' },
  { role: 'cfa',              label: 'CFA / CNF User',      dot: 'bg-amber-500' },
  { role: 'division_approver',label: 'Division Approver',   dot: 'bg-emerald-500' },
  { role: 'final_approver',   label: 'Final Approver',      dot: 'bg-[#0278FC]' },
  { role: 'viewer',           label: 'Viewer (Read-only)',  dot: 'bg-slate-400' },
];

const ROUTE_MAP: Record<string, { label: string; Icon: React.ElementType }> = {
  '':               { label: 'Dashboard',         Icon: LayoutDashboard },
  'orders':         { label: 'Orders',             Icon: ClipboardList },
  'rate-contracts': { label: 'Rate Contracts',     Icon: ScrollText },
  'cfa-queue':      { label: 'CFA Queue',          Icon: Truck },
  'division':       { label: 'Division Workspace', Icon: GitBranch },
  'final-approval': { label: 'Final Approval',     Icon: CheckSquare },
  'reports':        { label: 'Reports',            Icon: BarChart2 },
  'config':         { label: 'Config & Users',     Icon: Settings },
};

const MULTI_ACCOUNT_ROLES: UserRole[] = ['cfa', 'division_approver', 'final_approver'];

function PageIdentity() {
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.split('/').filter(Boolean);
  const firstSeg = segments[0] || '';
  const route = ROUTE_MAP[firstSeg];
  const isDeep = segments.length > 1;

  if (isDeep && route) {
    const { Icon } = route;
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-700 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="flex items-center gap-1.5 text-ink-400">
          <Icon size={13} />
          <span className="text-xs">{route.label}</span>
          <ChevronRight size={11} className="text-ink-300" />
        </div>
        <span className="text-sm font-semibold text-ink-900">Detail</span>
      </div>
    );
  }

  if (!route) return null;
  const { Icon } = route;

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
        <Icon size={14} className="text-ink-600" />
      </div>
      <span className="text-[15px] font-semibold text-ink-900 tracking-tight">{route.label}</span>
    </div>
  );
}

export default function Header() {
  const { currentRole, currentUser, roleUsers, setRole, setCurrentUserById, setMobileSidebarOpen } = useApp();
  const [roleOpen, setRoleOpen]       = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const roleRef    = useRef<HTMLDivElement>(null);
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
    <header className="h-14 bg-white border-b border-slate-100 shadow-header flex items-center justify-between px-4 md:px-5 sticky top-0 z-30">

      {/* Left: mobile menu + page identity */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open navigation menu"
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-ink-500 hover:bg-slate-100 transition-colors"
        >
          <Menu size={18} />
        </button>
        <div className="hidden sm:block">
          <PageIdentity />
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1.5">

        {/* Account switcher */}
        {showAccountSwitcher && (
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => { setAccountOpen(!accountOpen); setRoleOpen(false); }}
              className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/30 shadow-card"
            >
              <Users size={13} className="text-ink-400" />
              <span className="text-[13px] font-medium text-ink-800 hidden sm:inline">{currentUser?.name || 'Select Account'}</span>
              <ChevronDown size={11} className="text-ink-400" />
            </button>

            {accountOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-100 rounded-2xl shadow-dropdown py-2 z-50 animate-fade-in">
                <p className="px-4 pb-1.5 pt-0.5 text-[10px] text-ink-400 font-bold uppercase tracking-widest border-b border-slate-100 mb-1.5">
                  Switch Account
                </p>
                {roleUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => { setCurrentUserById(user.id); setAccountOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                      user.id === currentUser?.id ? 'bg-primary-50/40' : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-[11px] font-bold text-ink-600">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold truncate ${user.id === currentUser?.id ? 'text-brand-orange' : 'text-ink-900'}`}>
                        {user.name}
                      </p>
                      <p className="text-[11px] text-ink-400 truncate">{user.email}</p>
                    </div>
                    {user.id === currentUser?.id && (
                      <svg className="w-3.5 h-3.5 text-brand-orange shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Role switcher */}
        <div className="relative" ref={roleRef}>
          <button
            onClick={() => { setRoleOpen(!roleOpen); setAccountOpen(false); }}
            className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/30 shadow-card"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${active.dot}`} />
            <span className="text-[13px] font-medium text-ink-800 hidden sm:inline">{active.label}</span>
            <ChevronDown size={11} className="text-ink-400" />
          </button>

          {roleOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-100 rounded-2xl shadow-dropdown py-2 z-50 animate-fade-in">
              <p className="px-4 pb-1.5 pt-0.5 text-[10px] text-ink-400 font-bold uppercase tracking-widest border-b border-slate-100 mb-1.5">
                Switch Role
              </p>
              {roles.map(r => (
                <button
                  key={r.role}
                  onClick={() => { setRole(r.role); setRoleOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                    r.role === currentRole ? 'bg-primary-50/40' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} />
                  <span className={`text-[13px] flex-1 text-left ${r.role === currentRole ? 'font-semibold text-brand-orange' : 'font-medium text-ink-800'}`}>
                    {r.label}
                  </span>
                  {r.role === currentRole && (
                    <svg className="w-3.5 h-3.5 text-brand-orange shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User avatar + name */}
        <div className="flex items-center gap-2.5 pl-2 ml-1 border-l border-slate-100">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #FD4B1B 0%, #FF6B42 100%)' }}
          >
            {userInitials}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-[13px] font-semibold text-ink-900 leading-none">{currentUser?.name || '—'}</p>
            <p className="text-[11px] text-ink-400 mt-0.5 capitalize">{currentRole.replace(/_/g, ' ')}</p>
          </div>
        </div>

      </div>
    </header>
  );
}

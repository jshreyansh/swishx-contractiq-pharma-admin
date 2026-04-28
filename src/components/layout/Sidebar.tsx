import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, ScrollText, Truck, GitBranch,
  CheckSquare, BarChart2, Settings, PanelLeftClose, PanelLeft, X, BookOpen,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'viewer', 'final_approver', 'division_approver', 'cfa'] },
  { path: '/orders', label: 'Orders', icon: ClipboardList, roles: ['admin', 'viewer', 'final_approver', 'division_approver', 'cfa'] },
  { path: '/rate-contracts', label: 'Rate Contracts', icon: ScrollText, roles: ['admin', 'viewer', 'division_approver', 'final_approver'] },
  { path: '/catalogue', label: 'Catalogue', icon: BookOpen, roles: ['admin', 'viewer', 'cfa', 'division_approver', 'final_approver'] },
  { path: '/cfa-queue', label: 'CFA / CNF Queue', icon: Truck, roles: ['admin', 'cfa'] },
  { path: '/division', label: 'Division Workspace', icon: GitBranch, roles: ['admin', 'division_approver'] },
  { path: '/final-approval', label: 'Final Approval', icon: CheckSquare, roles: ['admin', 'final_approver'] },
  { path: '/reports', label: 'Reports', icon: BarChart2, roles: ['admin', 'viewer'] },
  { path: '/config', label: 'Config & Users', icon: Settings, roles: ['admin'] },
];

const utilityPaths = new Set(['/reports', '/config']);

function NavItem({
  item,
  collapsed,
  onClick,
}: {
  item: typeof navItems[0];
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD4B1B]/40 ${
          collapsed ? 'px-0 py-2.5 justify-center w-9 mx-auto' : 'px-3 py-2'
        } ${
          isActive
            ? 'bg-[rgba(253,75,27,0.09)] text-white'
            : 'text-[#6B7480] hover:text-[#BFC5CB] hover:bg-white/[0.04]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#FD4B1B] rounded-r-full" />
          )}

          <item.icon
            size={16}
            strokeWidth={isActive ? 2.5 : 1.8}
            className={`shrink-0 transition-colors ${isActive ? 'text-[#FD4B1B]' : ''}`}
          />

          <span className={`whitespace-nowrap font-medium text-[13px] transition-all duration-200 ${
            collapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
          }`}>
            {item.label}
          </span>

          {isActive && !collapsed && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FD4B1B]/50 shrink-0" />
          )}

          {collapsed && (
            <div className="pointer-events-none absolute left-full ml-2.5 px-2.5 py-1.5 bg-[#1A1A1A] border border-white/[0.08] text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
              {item.label}
              <div className="absolute top-1/2 -left-[5px] -translate-y-1/2 w-2.5 h-2.5 bg-[#1A1A1A] rotate-45 border-l border-b border-white/[0.08]" />
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { currentRole, sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useApp();
  const visibleItems = navItems.filter(item => item.roles.includes(currentRole));
  const mainItems = visibleItems.filter(item => !utilityPaths.has(item.path));
  const utilityItems = visibleItems.filter(item => utilityPaths.has(item.path));

  const content = (collapsed: boolean, onItemClick?: () => void) => (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Logo / brand area */}
      <div className={`flex items-center border-b border-white/[0.06] shrink-0 ${
        collapsed ? 'px-0 h-16 justify-center' : 'px-4 h-16'
      }`}>
        {collapsed ? (
          <button
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#5A6068] hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD4B1B]/40"
          >
            <PanelLeft size={17} />
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-[3px]">
              <img src="/Swish_X_logo_white.png" alt="SwishX" className="h-6 w-auto object-contain" />
              <span className="text-[9px] tracking-[0.14em] text-[#3D444B] font-semibold uppercase leading-none">ContractIQ</span>
            </div>
            <button
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#3D444B] hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 focus-visible:outline-none"
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
        {mainItems.length > 0 && (
          <>
            {!collapsed && (
              <p className="px-3 mb-2 text-[9.5px] font-bold tracking-[0.12em] text-[#2E353C] uppercase">
                Workspace
              </p>
            )}
            <div className="space-y-0.5">
              {mainItems.map(item => (
                <NavItem key={item.path} item={item} collapsed={collapsed} onClick={onItemClick} />
              ))}
            </div>
          </>
        )}

        {utilityItems.length > 0 && (
          <>
            <div className="mx-1 my-3 border-t border-white/[0.05]" />
            {!collapsed && (
              <p className="px-3 mb-2 text-[9.5px] font-bold tracking-[0.12em] text-[#2E353C] uppercase">
                More
              </p>
            )}
            <div className="space-y-0.5">
              {utilityItems.map(item => (
                <NavItem key={item.path} item={item} collapsed={collapsed} onClick={onItemClick} />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.05] px-3 py-3 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0" />
            <span className="text-[10px] text-[#2E353C] font-medium tracking-wide">MVP · v1.0</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden md:flex flex-col h-full bg-[#0D0D0D] shadow-sidebar transition-all duration-200 ease-in-out shrink-0 z-20 ${
          sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar-expanded'
        }`}
      >
        {content(sidebarCollapsed)}
      </aside>

      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative flex flex-col w-sidebar-expanded bg-[#0D0D0D] animate-slide-in-left">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close sidebar"
              className="absolute top-4 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-[#5A6068] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X size={15} />
            </button>
            {content(false, () => setMobileSidebarOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}

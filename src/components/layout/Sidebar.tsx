import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Truck, GitBranch,
  CheckSquare, BarChart2, Settings, ChevronLeft, ChevronRight, X, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'viewer', 'final_approver', 'division_approver', 'cfa'] },
  { path: '/orders', label: 'Orders', icon: ClipboardList, roles: ['admin', 'viewer', 'final_approver'] },
  { path: '/cfa-queue', label: 'CFA Queue', icon: Truck, roles: ['admin', 'cfa'] },
  { path: '/division', label: 'Division Workspace', icon: GitBranch, roles: ['admin', 'division_approver'] },
  { path: '/final-approval', label: 'Final Approval', icon: CheckSquare, roles: ['admin', 'final_approver'] },
  { path: '/reports', label: 'Reports', icon: BarChart2, roles: ['admin', 'viewer'] },
  { path: '/config', label: 'Config & Users', icon: Settings, roles: ['admin'] },
];

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
        `group relative flex items-center gap-3 rounded-xl text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD4B1B]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0D0D0D] ${
          collapsed ? 'px-0 py-3 justify-center w-10 mx-auto' : 'px-3 py-2.5'
        } ${
          isActive
            ? 'bg-[rgba(253,75,27,0.12)] text-white'
            : 'text-[#8A9098] hover:text-white hover:bg-[#1C1C1C]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={18}
            className={`shrink-0 transition-colors ${isActive ? 'text-[#FD4B1B]' : 'text-current'}`}
          />
          <span
            className={`whitespace-nowrap font-medium transition-all duration-200 ${
              collapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
            }`}
          >
            {item.label}
          </span>

          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#FD4B1B] rounded-full" />
          )}

          {collapsed && (
            <div className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-xl">
              {item.label}
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-[#1C1C1C] rotate-45 border-l border-b border-white/10" />
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

  const sidebarContent = (collapsed: boolean, onItemClick?: () => void) => (
    <>
      <div
        className={`flex items-center border-b border-white/[0.06] ${
          collapsed ? 'px-0 py-3 justify-center h-14' : 'px-4 h-14 gap-0'
        }`}
      >
        {collapsed ? (
          <button
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#8A9098] hover:text-white hover:bg-[#1C1C1C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD4B1B]/50"
          >
            <PanelLeft size={18} />
          </button>
        ) : (
          <>
            <img
              src="/Swish_X_logo_white.png"
              alt="SwishX"
              className="h-7 w-auto object-contain flex-1 min-w-0"
            />
            <button
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              className="ml-1 w-8 h-8 flex items-center justify-center rounded-xl text-[#8A9098] hover:text-white hover:bg-[#1C1C1C] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD4B1B]/50"
            >
              <PanelLeftClose size={17} />
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {visibleItems.map(item => (
          <NavItem key={item.path} item={item} collapsed={collapsed} onClick={onItemClick} />
        ))}
      </nav>

      <div className="border-t border-white/[0.06] px-4 py-3">
        {!collapsed && (
          <p className="text-[#8A9098] text-xs text-center opacity-50">SwishX MVP Demo v1.0</p>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside
        className={`hidden md:flex flex-col min-h-screen bg-[#0D0D0D] transition-all duration-200 ease-in-out shrink-0 ${
          sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar-expanded'
        }`}
      >
        {sidebarContent(sidebarCollapsed)}
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
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-[#8A9098] hover:text-white hover:bg-[#1C1C1C] transition-colors"
            >
              <X size={15} />
            </button>
            {sidebarContent(false, () => setMobileSidebarOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}

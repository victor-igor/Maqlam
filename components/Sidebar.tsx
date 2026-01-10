import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  Settings,
  Cpu,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  Megaphone,
  Diamond,
  UserCog
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  isMobileOpen?: boolean;
  closeMobile?: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, closeMobile, onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isAdminOrGestor } = usePermissions();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: '/', label: 'Dashboard', icon: Sparkles },
    { id: '/contacts', label: 'Contatos', icon: Users },
    { id: '/campaigns', label: 'Campanhas', icon: Megaphone },
    ...(isAdminOrGestor ? [{ id: '/users', label: 'Usuários', icon: UserCog }] : []),
    { id: '/settings', label: 'Configurações', icon: Settings },
  ];

  // Base classes shared between desktop and mobile states
  const baseClasses = "bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark flex flex-col h-full transition-all duration-300 ease-in-out";

  // Mobile specific classes (fixed drawer)
  const mobileClasses = `fixed inset-y-0 left-0 z-50 w-64 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-auto`;

  // Desktop layout classes (width control)
  const desktopClasses = `md:flex-shrink-0 ${isCollapsed ? 'md:w-20' : 'md:w-64'}`;

  const handleNavigation = (path: string) => {
    navigate(path);
    if (closeMobile) closeMobile();
  };

  return (
    <aside className={`${baseClasses} ${mobileClasses} ${desktopClasses}`}>
      {/* Mobile Close Button */}
      <button
        onClick={closeMobile}
        className="absolute top-4 right-4 md:hidden text-gray-500 dark:text-gray-400 hover:text-primary"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Desktop Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="hidden md:flex absolute -right-3 top-9 z-20 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark text-gray-500 dark:text-gray-400 rounded-full p-1 shadow-sm hover:text-primary transition-colors"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Logo Area */}
      <div className={`p-6 flex items-center ${isCollapsed ? 'md:justify-center' : ''} h-20`}>
        {/* Desktop Logo Logic */}
        <div className={`hidden md:block transition-all duration-300`}>
          {isCollapsed ? (
            // Minimized Logo: Icon Only
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <Diamond className="w-5 h-5 text-primary" strokeWidth={2.5} />
            </div>
          ) : (
            // Expanded Logo: Icon + Typography
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 flex-shrink-0">
                <Diamond className="w-5 h-5 text-primary" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-gray-900 dark:text-white leading-none tracking-tight">CAMPOS</span>
                <span className="text-[10px] text-primary font-bold tracking-[0.3em] leading-none mt-1.5 uppercase">Joias</span>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Always Shows Full Logo */}
        <div className="md:hidden flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 flex-shrink-0">
            <Diamond className="w-5 h-5 text-primary" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900 dark:text-white leading-none tracking-tight">CAMPOS</span>
            <span className="text-[10px] text-primary font-bold tracking-[0.3em] leading-none mt-1.5 uppercase">Joias</span>
          </div>
        </div>
      </div>

      {/* Status Indicator */}
      <div className={`px-6 py-2 ${isCollapsed ? 'md:flex md:justify-center md:px-0' : ''}`}>
        <div className={`
          flex items-center space-x-2 text-xs text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 py-1.5 rounded-full transition-all duration-300
          ${isCollapsed ? 'md:px-2 md:justify-center md:w-8 md:h-8' : 'px-3 w-fit'}
        `}>
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className={`whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>SYSTEM ONLINE</span>
        </div>
      </div>

      {/* Stats Card - Only visible when expanded (or on mobile) */}
      <div className={`px-6 py-4 space-y-4 overflow-hidden transition-all duration-300 ${isCollapsed ? 'md:h-0 md:py-0 md:opacity-0' : 'h-auto opacity-100'}`}>
        <div className="bg-muted-light dark:bg-muted-dark p-4 rounded-xl border border-border-light dark:border-border-dark whitespace-nowrap">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-200">Agente Processando</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-mono">Uptime: 48h 27m</p>
          <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-1.5 rounded-full w-[98%]"></div>
          </div>
          <p className="text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-1">98% CAPACITY</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {(!isCollapsed || window.innerWidth < 768) && (
          <p className="px-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 animate-in fade-in">
            // Navegação
          </p>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          // Check if active: exact match for dashboard, startsWith for others
          const isActive = item.id === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.id);

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              title={isCollapsed ? item.label : ''}
              className={`
                w-full flex items-center px-4 py-3 rounded-lg font-semibold transition-all duration-200
                ${isCollapsed ? 'md:justify-center md:px-2' : 'space-x-3'}
                ${isActive
                  ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-muted-dark hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
              <span className={`whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className={`p-4 border-t border-border-light dark:border-border-dark transition-all duration-300 ${isCollapsed ? 'md:flex md:flex-col md:items-center md:gap-4' : ''}`}>
        <div className={`flex items-center w-full ${isCollapsed ? 'md:justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-tr from-primary to-primary-hover border border-primary/20 flex items-center justify-center text-black font-bold text-xs">
            {userProfile?.nome?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className={`flex-1 overflow-hidden ${isCollapsed ? 'md:hidden' : ''}`}>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{userProfile?.nome || 'Usuário'}</p>
            <p className="text-xs text-gray-500 truncate">{userProfile?.email || 'email@exemplo.com'}</p>
          </div>

          {/* Logout Button - Visible when expanded */}
          <button
            onClick={onLogout}
            className={`p-1.5 text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ${isCollapsed ? 'md:hidden' : ''}`}
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Logout Button - Visible when collapsed */}
        <button
          onClick={onLogout}
          className={`hidden ${isCollapsed ? 'md:flex' : ''} p-2 text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors`}
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
import React from 'react';
import {
  User,
  Smartphone,
  ShieldBan,
  ArrowRight
} from 'lucide-react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

type SettingsTab = 'profile' | 'instances' | 'blacklist';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'profile', label: 'Meu Perfil', icon: User, path: '/settings/profile' },
    { id: 'instances', label: 'Instâncias', icon: Smartphone, path: '/settings/instances' },
    { id: 'blacklist', label: 'Blacklist', icon: ShieldBan, path: '/settings/blacklist' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Settings Navigation */}
        <div className="lg:col-span-3">
          <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname.includes(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap
                    ${isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-white dark:bg-card-dark text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-muted-dark hover:text-gray-900 dark:hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    {tab.label}
                  </div>
                  {isActive && <ArrowRight className="w-4 h-4 text-white/50" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
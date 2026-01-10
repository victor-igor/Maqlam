import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface HeaderProps {
    isDarkMode: boolean;
    toggleTheme: () => void;
    category?: string;
    title: string;
    description: string;
    children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ 
    isDarkMode, 
    toggleTheme, 
    category = "DASHBOARD",
    title, 
    description,
    children
}) => {
  // Separate children into the menu button (if present) and actions
  const childrenArray = React.Children.toArray(children);
  const mobileMenuButton = childrenArray.find((child: any) => child?.type === 'button' && child?.props?.className?.includes('md:hidden'));
  const actionButtons = childrenArray.filter((child: any) => child !== mobileMenuButton);

  return (
    <header className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 gap-4">
      <div className="flex items-start gap-3 w-full md:w-auto">
        {/* Insert Mobile Menu Button Here if passed */}
        {mobileMenuButton}

        <div className="flex-1">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 tracking-widest uppercase">// {category}</p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm hidden sm:block">
            {description}
            </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {actionButtons}
          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-white dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-muted-dark transition-all text-gray-600 dark:text-gray-400 shadow-sm"
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
      </div>
    </header>
  );
};
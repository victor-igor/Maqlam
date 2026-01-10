import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ContactsList } from './components/ContactsList';
import { ContactDetails } from './components/ContactDetails';
import { AddContactModal } from './components/AddContactModal';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { CampaignsList } from './components/CampaignsList';
import { CreateCampaign } from './components/CreateCampaign';
import { CampaignReport } from './components/CampaignReport';
import { UserManagement } from './components/UserManagement';
import { Plus, Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const Layout: React.FC = () => {
  const { session, loading } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Apply theme class to html element
  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleLogout = async () => {
    // signOut is handled by Sidebar calling useAuth().signOut()
    // But here we might need to reset view or redirect
    navigate('/login');
  };

  const getHeaderProps = () => {
    const path = location.pathname;

    if (path === '/') {
      return {
        category: 'DASHBOARD',
        title: 'Dashboard do agente de IA',
        description: 'Monitoramento em tempo real de leads e automações.'
      };
    }

    if (path.startsWith('/contacts')) {
      if (path.includes('/details/')) return null; // Details view
      return {
        category: 'CRM',
        title: 'Gerenciamento de Contatos',
        description: 'Visualize, adicione e gerencie seus leads e clientes.'
      };
    }

    if (path.startsWith('/campaigns')) {
      if (path === '/campaigns/new') return null; // Create view has its own header
      if (path.match(/\/campaigns\/[^/]+/)) return null; // Report view has its own header
      return {
        category: 'MARKETING',
        title: 'Disparos em Massa',
        description: 'Crie e agende campanhas de mensagens para sua base.'
      };
    }

    if (path.startsWith('/settings')) {
      return {
        category: 'SISTEMA',
        title: 'Configurações',
        description: 'Gerencie seu perfil, preferências da IA e integrações.'
      };
    }

    if (path.startsWith('/users')) {
      return {
        category: 'ADMINISTRAÇÃO',
        title: 'Gerenciamento de Usuários',
        description: 'Gerencie os usuários do sistema.'
      };
    }

    return {
      category: 'APP',
      title: 'Campos Joias AI',
      description: ''
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark text-gray-500 dark:text-gray-400">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const headerProps = getHeaderProps();

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-sans text-gray-900 dark:text-[#EDEDED]">
      {/* Mobile Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        closeMobile={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        <div className="max-w-7xl mx-auto h-full flex flex-col">

          {headerProps && (
            <Header
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
              category={headerProps.category}
              title={headerProps.title}
              description={headerProps.description}
            >
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2.5 rounded-full bg-white dark:bg-card-dark border border-border-light dark:border-border-dark text-gray-600 dark:text-gray-400 shadow-sm mr-auto"
              >
                <Menu className="w-5 h-5" />
              </button>

              {location.pathname === '/contacts' && (
                <button
                  onClick={() => setIsAddContactOpen(true)}
                  className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-black px-4 py-2.5 rounded-lg font-bold transition-colors shadow-sm text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Novo Contato</span>
                  <span className="sm:hidden">Novo</span>
                </button>
              )}
            </Header>
          )}

          {/* If header is null (details views), allow manual theme toggle if needed, 
                or rely on internal components to show navigation. 
                For consistency, we can render a minimal header or just content. */}
          {!headerProps && (
            <div className="flex justify-end mb-2">
              {/* Mobile Menu Button (Standalone for details views) */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2.5 rounded-full bg-white dark:bg-card-dark border border-border-light dark:border-border-dark text-gray-600 dark:text-gray-400 shadow-sm mr-auto"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          )}

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<ContactsList onEdit={(id) => navigate(`/contacts/details/${id}`)} />} />
            <Route path="/contacts/details/:id" element={<ContactDetails onBack={() => navigate('/contacts')} />} />
            <Route path="/campaigns" element={<CampaignsList />} />
            <Route path="/campaigns/new" element={<CreateCampaign />} />
            <Route path="/campaigns/edit/:id" element={<CreateCampaign />} />
            <Route path="/campaigns/:id" element={<CampaignReport />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Modals */}
      <AddContactModal isOpen={isAddContactOpen} onClose={() => setIsAddContactOpen(false)} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginWrapper />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

// Wrapper to handle login redirection if already authenticated
const LoginWrapper: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  if (session) return null;

  return <Login onLogin={() => navigate('/')} />;
};

export default App;
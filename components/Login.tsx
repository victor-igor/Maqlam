import React, { useState } from 'react';
import { Eye, EyeOff, Diamond } from 'lucide-react';

import { signIn } from '../lib/auth';
import { useToast } from '../contexts/ToastContext';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      success('Login realizado com sucesso!');
      onLogin();
    } catch (err: any) {
      console.error('Login error:', err);
      error(err.message || 'Verifique suas credenciais e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col bg-background-dark overflow-hidden font-sans text-white">
      <div className="flex h-full grow flex-col">
        <div className="relative flex flex-1 items-center justify-center py-5">
          <div className="z-10 flex w-full max-w-md flex-col items-center px-4 animate-in fade-in zoom-in-95 duration-500">

            {/* Header / Logo */}
            <div className="mb-10 flex flex-col items-center text-center">
              <div className="flex flex-col items-center gap-5 mb-2 group">
                <div className="w-56 h-auto group-hover:scale-105 transition-transform duration-500">
                  <img src="/assets/images/logo-full-dark.png" alt="Campos Joias" className="w-full h-auto drop-shadow-lg" />
                </div>
              </div>
              <p className="mt-4 text-base text-gray-400">
                Faça login para acessar o painel
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-5">
              <label className="flex flex-col w-full">
                <p className="text-gray-900 dark:text-[#EDEDED] text-sm font-medium leading-normal pb-2 ml-1">Email</p>
                <div className="relative flex w-full flex-1 items-center">
                  <div className="absolute left-4 z-10 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                      <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                    </svg>
                  </div>
                  <input
                    className="w-full rounded-xl text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-light dark:border-border-dark bg-input-light dark:bg-input-dark h-12 placeholder:text-gray-500 pl-11 pr-4 text-base font-normal transition-all"
                    placeholder="Digite seu email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="flex flex-col w-full">
                <p className="text-gray-900 dark:text-[#EDEDED] text-sm font-medium leading-normal pb-2 ml-1">Senha</p>
                <div className="relative flex w-full flex-1 items-center">
                  <div className="absolute left-4 z-10 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    className="w-full rounded-xl text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-light dark:border-border-dark bg-input-light dark:bg-input-dark h-12 placeholder:text-gray-500 pl-11 pr-12 text-base font-normal transition-all"
                    placeholder="Digite sua senha"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div
                    className="text-gray-500 absolute right-4 flex items-center justify-center cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </div>
                </div>
              </label>

              <div className="flex w-full justify-end pt-1">
                <button type="button" className="text-gray-400 text-sm font-normal hover:text-primary transition-colors">Esqueceu a senha?</button>
              </div>

              <div className="w-full pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-gradient-to-r from-primary to-secondary text-white text-base font-bold tracking-wide hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-secondary/30 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? 'ENTRANDO...' : 'ENTRAR'}
                </button>
              </div>
            </form>

            <div className="mt-12 flex gap-6">
              <a className="text-gray-500 text-xs font-medium hover:text-white transition-colors" href="#">Política de Privacidade</a>
              <a className="text-gray-500 text-xs font-medium hover:text-white transition-colors" href="#">Termos de Serviço</a>
            </div>
          </div>

          {/* Background Gradient */}
          <div className="absolute bottom-0 left-0 w-full h-64 overflow-hidden pointer-events-none">
            <div className="absolute bottom-0 left-0 w-full h-full opacity-20">
              <svg className="absolute bottom-0 left-0 w-[200%] h-auto -translate-x-1/4 animate-[wave_15s_linear_infinite]" style={{ transformOrigin: 'bottom' }} viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="wave-gradient-1" x1="50%" x2="50%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#0E0069" stopOpacity="0.2"></stop>
                    <stop offset="100%" stopColor="#0E0069" stopOpacity="0"></stop>
                  </linearGradient>
                </defs>
                <path d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,218.7C672,213,768,171,864,144C960,117,1056,107,1152,117.3C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" fill="url(#wave-gradient-1)"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes wave {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

import React, { useState } from 'react';
import { StatCard } from './StatCard';
import { DashboardChart } from './DashboardChart';
import { ActivityFeed } from './ActivityFeed';
import { 
  Calendar, 
  Bot, 
  MessageCircle, 
  ArrowRightLeft, 
  Zap,
  HelpCircle,
  TrendingUp
} from 'lucide-react';

type TimeRange = 'today' | '7days' | '30days' | 'custom';

export const Dashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mock Data for Statistics
  const statsData: Record<TimeRange, any> = {
    today: {
      agenda: "12",
      subAgenda: "Agendamentos Hoje",
      agente: "8",
      subAgente: "Via IA Hoje",
      respostas: "450",
      transfers: "5",
      performance: "35.2s",
      conversion: "12%"
    },
    '7days': {
      agenda: "84",
      subAgenda: "Agendamentos 7d",
      agente: "52",
      subAgente: "Via IA 7d",
      respostas: "1.240",
      transfers: "28",
      performance: "41.5s",
      conversion: "48%"
    },
    '30days': {
      agenda: "342",
      subAgenda: "Agendamentos 30d",
      agente: "215",
      subAgente: "Via IA 30d",
      respostas: "5.594",
      transfers: "83",
      performance: "49.2s",
      conversion: "63%"
    },
    custom: {
      agenda: "156",
      subAgenda: "No Período",
      agente: "98",
      subAgente: "Via IA",
      respostas: "3.120",
      transfers: "42",
      performance: "44.5s",
      conversion: "58%"
    }
  };

  // Mock Data for Charts
  const chartDataOptions: Record<TimeRange, any[]> = {
    today: [
      { name: '08:00', respostas: 45, transferencias: 2 },
      { name: '10:00', respostas: 80, transferencias: 5 },
      { name: '12:00', respostas: 120, transferencias: 8 },
      { name: '14:00', respostas: 90, transferencias: 4 },
      { name: '16:00', respostas: 110, transferencias: 6 },
      { name: '18:00', respostas: 60, transferencias: 3 },
    ],
    '7days': [
      { name: 'Seg', respostas: 400, transferencias: 24 },
      { name: 'Ter', respostas: 300, transferencias: 18 },
      { name: 'Qua', respostas: 550, transferencias: 35 },
      { name: 'Qui', respostas: 480, transferencias: 20 },
      { name: 'Sex', respostas: 690, transferencias: 45 },
      { name: 'Sáb', respostas: 390, transferencias: 15 },
      { name: 'Dom', respostas: 420, transferencias: 22 },
    ],
    '30days': [
      { name: 'Sem 1', respostas: 1200, transferencias: 80 },
      { name: 'Sem 2', respostas: 1450, transferencias: 95 },
      { name: 'Sem 3', respostas: 1100, transferencias: 60 },
      { name: 'Sem 4', respostas: 1600, transferencias: 110 },
    ],
    custom: [
      { name: 'Período 1', respostas: 800, transferencias: 50 },
      { name: 'Período 2', respostas: 950, transferencias: 65 },
      { name: 'Período 3', respostas: 700, transferencias: 40 },
      { name: 'Período 4', respostas: 1100, transferencias: 85 },
    ]
  };

  // Mock Data for Top Questions
  const topQuestions = [
    { id: 1, text: "Qual o valor da automação?", count: 156, percentage: 35 },
    { id: 2, text: "Funciona com WhatsApp Business?", count: 124, percentage: 28 },
    { id: 3, text: "Vocês oferecem teste grátis?", count: 89, percentage: 20 },
    { id: 4, text: "Preciso de API oficial?", count: 45, percentage: 10 },
    { id: 5, text: "Como funciona o suporte?", count: 31, percentage: 7 },
  ];

  const currentStats = statsData[timeRange];
  const currentChartData = chartDataOptions[timeRange];

  const getButtonStyle = (range: TimeRange) => {
    const isActive = timeRange === range;
    return isActive
      ? "text-xs font-bold px-3 py-1.5 rounded-md bg-gray-100 dark:bg-muted-dark text-gray-900 dark:text-white shadow-sm flex-1 sm:flex-none transition-all"
      : "text-xs font-medium px-3 py-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted-dark transition-colors flex-1 sm:flex-none";
  };

  return (
    <>
      <section className="mb-8 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Métricas Principais
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                <div className="flex items-center bg-white dark:bg-card-dark p-1 rounded-lg border border-gray-200 dark:border-border-dark shadow-sm w-full sm:w-auto overflow-x-auto">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 px-3 whitespace-nowrap">PERÍODO:</span>
                    <button 
                        onClick={() => setTimeRange('today')}
                        className={getButtonStyle('today')}
                    >
                        Hoje
                    </button>
                    <button 
                        onClick={() => setTimeRange('7days')}
                        className={getButtonStyle('7days')}
                    >
                        7 Dias
                    </button>
                    <button 
                        onClick={() => setTimeRange('30days')}
                        className={getButtonStyle('30days')}
                    >
                        30 Dias
                    </button>
                    <button 
                        onClick={() => setTimeRange('custom')}
                        className={getButtonStyle('custom')}
                    >
                        Personalizado
                    </button>
                </div>

                {timeRange === 'custom' && (
                    <div className="flex items-center gap-2 bg-white dark:bg-card-dark p-1 rounded-lg border border-gray-200 dark:border-border-dark shadow-sm animate-in slide-in-from-right-4 duration-300">
                        <div className="relative">
                             <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="text-xs font-medium bg-transparent border-none text-gray-900 dark:text-white focus:ring-0 p-1.5"
                             />
                        </div>
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                        <div className="relative">
                             <input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="text-xs font-medium bg-transparent border-none text-gray-900 dark:text-white focus:ring-0 p-1.5"
                             />
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Cards Maiores - Topo */}
            <div className="col-span-1 sm:col-span-2">
                <StatCard 
                    title="Agenda"
                    value={currentStats.agenda}
                    subtext={currentStats.subAgenda}
                    icon={Calendar}
                    color="orange"
                />
            </div>
            
            <div className="col-span-1 sm:col-span-2">
                <StatCard 
                    title="Agente"
                    value={currentStats.agente}
                    subtext={currentStats.subAgente}
                    icon={Bot}
                    color="blue"
                />
            </div>

            {/* Cards Menores - Linha Inferior */}
            <div className="col-span-1">
                <StatCard 
                    title="Respostas"
                    value={currentStats.respostas}
                    subtext="Total de Respostas"
                    icon={MessageCircle}
                    color="green"
                />
            </div>

            <div className="col-span-1">
                <StatCard 
                    title="Transfers"
                    value={currentStats.transfers}
                    subtext="Transferências"
                    icon={ArrowRightLeft}
                    color="red"
                />
            </div>

            <div className="col-span-1">
                <StatCard 
                    title="Performance"
                    value={currentStats.performance}
                    subtext="Tempo Resp. Médio"
                    icon={Zap}
                    color="purple"
                />
            </div>

            <div className="col-span-1">
                  <div className="h-full min-h-[140px] flex flex-col justify-center items-center bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark hover:shadow-md transition-shadow duration-200 p-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-primary/5 dark:bg-primary/10 group-hover:bg-primary/10 transition-colors"></div>
                    <div className="text-center relative z-10">
                        <p className="text-primary font-black text-3xl tracking-tight">{currentStats.conversion}</p>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">Conversão Automática</p>
                    </div>
                  </div>
            </div>
        </div>
      </section>

      <section className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Coluna Principal: Gráfico + Dúvidas */}
            <div className="xl:col-span-2 flex flex-col gap-6">
                <div className="bg-card-light dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Respostas & Transferências
                    </h3>
                    <DashboardChart data={currentChartData} />
                </div>

                {/* Nova Seção: Principais Dúvidas */}
                <div className="bg-card-light dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-secondary" />
                        Principais Dúvidas & Insights da IA
                    </h3>
                    <div className="space-y-5">
                        {topQuestions.map((item, index) => (
                            <div key={item.id} className="group">
                                <div className="flex justify-between items-end mb-1">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors">
                                        {item.text}
                                    </p>
                                    <div className="text-right">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{item.count} oco.</span>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                        className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${
                                            index === 0 ? 'bg-primary shadow-[0_0_10px_rgba(0,255,255,0.5)]' : 
                                            index === 1 ? 'bg-secondary shadow-[0_0_10px_rgba(255,0,255,0.5)]' : 
                                            'bg-gray-400 dark:bg-gray-600'
                                        }`}
                                        style={{ width: `${item.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <button className="text-xs font-bold text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary uppercase tracking-wide transition-colors flex items-center gap-1">
                            Ver Relatório Detalhado de Conversas
                        </button>
                    </div>
                </div>
            </div>

            {/* Coluna Lateral: Feed */}
            <div className="bg-card-light dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Atividade Recente</h3>
                    <div className="flex items-center space-x-2 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-[10px] font-bold text-green-600 dark:text-green-500 uppercase">Ao vivo</span>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden">
                      <ActivityFeed />
                </div>
            </div>
        </div>
      </section>
    </>
  );
};

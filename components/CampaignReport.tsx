import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Send,
    CheckCircle2,
    AlertCircle,
    MessageCircle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { getCampaignStats } from '../lib/campaigns';
import { useToast } from '../contexts/ToastContext';
import { useParams, useNavigate } from 'react-router-dom';
import { CampaignVariationsCard } from './CampaignVariationsCard';
import { Calendar } from 'lucide-react';

type TimeRange = 'today' | '7days' | '30days' | 'custom';

export const CampaignReport: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { error: toastError } = useToast();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>('30days');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        if (id) {
            loadStats(id);
        }
    }, [id, timeRange, startDate, endDate]);

    const getDateRange = () => {
        const end = new Date();
        let start = new Date();

        switch (timeRange) {
            case 'today':
                start = new Date();
                start.setHours(0, 0, 0, 0);
                return { start: start.toISOString(), end: end.toISOString() };
            case '7days':
                start.setDate(end.getDate() - 7);
                return { start: start.toISOString(), end: end.toISOString() };
            case '30days':
                start.setDate(end.getDate() - 30);
                return { start: start.toISOString(), end: end.toISOString() };
            case 'custom':
                if (startDate && endDate) {
                    return { start: startDate, end: endDate };
                }
                return null;
            default:
                return null;
        }
    };

    const loadStats = async (campaignId: string) => {
        try {
            setLoading(true);
            const range = getDateRange();
            const data = await getCampaignStats(campaignId, range?.start, range?.end);
            setStats(data);
        } catch (err) {
            console.error(err);
            toastError('Erro ao carregar estatísticas');
        } finally {
            setLoading(false);
        }
    };

    const getButtonStyle = (range: TimeRange) => {
        const isActive = timeRange === range;
        return isActive
            ? "text-xs font-bold px-3 py-1.5 rounded-md bg-gray-100 dark:bg-muted-dark text-gray-900 dark:text-white shadow-sm flex-1 sm:flex-none transition-all"
            : "text-xs font-medium px-3 py-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted-dark transition-colors flex-1 sm:flex-none";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 dark:text-gray-400">Carregando estatísticas...</div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 dark:text-gray-400">Relatório não encontrado.</div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/campaigns')} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Relatório de Desempenho</h2>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Total Enviado</h3>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <Send className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                    <p className="text-xs text-gray-500 mt-1">Mensagens processadas</p>
                </div>

                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Entregues</h3>
                        <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.delivered}</p>
                    <p className="text-xs text-green-500 mt-1 font-bold">
                        {stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0}% Taxa de Entrega
                    </p>
                </div>

                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Falhas</h3>
                        <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.failed}</p>
                    <p className="text-xs text-red-500 mt-1 font-bold">
                        {stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}% Taxa de Erro
                    </p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hourly Distribution Chart */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Horários de Resposta (Atividade)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.hourlyDistribution}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="sent" fill="#3B82F6" name="Enviados" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="delivered" fill="#10B981" name="Entregues" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Distribuição de Status</h3>
                    <div className="h-80 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Entregue', value: stats.delivered, color: '#10B981' },
                                        { name: 'Falha', value: stats.failed, color: '#EF4444' },
                                        { name: 'Pendente', value: stats.total - (stats.delivered + stats.failed), color: '#F59E0B' }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {[
                                        { name: 'Entregue', value: stats.delivered, color: '#10B981' },
                                        { name: 'Falha', value: stats.failed, color: '#EF4444' },
                                        { name: 'Pendente', value: stats.total - (stats.delivered + stats.failed), color: '#F59E0B' }
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>



            {/* Variation Performance (A/B Testing) */}
            <CampaignVariationsCard variationStats={stats.variationStats} campaign={stats.campaign} />

            {/* Leads List */}
            <div className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detalhes dos Envios</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-muted-dark text-gray-500 dark:text-gray-400 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-4">Telefone / Contato</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Data e Hora</th>
                                <th className="px-6 py-4">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                            {stats.logs && stats.logs.length > 0 ? (
                                stats.logs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-muted-dark/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {log.phone || log.contact_phone || log.contact_id || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                                                ${(log.status === 'delivered' || log.status === 'success') ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                                    log.status === 'read' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                                                        log.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'}
                                            `}>
                                                {log.status === 'sent' ? 'Enviado' :
                                                    (log.status === 'delivered' || log.status === 'success') ? 'Entregue' :
                                                        log.status === 'read' ? 'Lido' :
                                                            log.status === 'failed' ? 'Falha' : log.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                            {log.details?.error ? (
                                                <span className="text-red-500" title={log.details.error}>{log.details.error}</span>
                                            ) : log.replied_at ? (
                                                <span className="text-blue-500 font-bold flex items-center gap-1">
                                                    <MessageCircle className="w-3 h-3" />
                                                    Respondeu em {new Date(log.replied_at).toLocaleString()}
                                                </span>
                                            ) : log.message_content ? (
                                                <span className="text-gray-400 truncate" title={log.message_content}>{log.message_content}</span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Nenhum registro encontrado para esta campanha.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
};

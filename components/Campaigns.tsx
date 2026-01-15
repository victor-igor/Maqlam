import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    Megaphone,
    Image as ImageIcon,
    Video,
    Type,
    UploadCloud,
    Clock,
    Send,
    Users,
    CheckCircle2,
    Smartphone,
    Plus,
    BarChart2,
    AlertCircle,
    MessageCircle,
    ArrowLeft,
    MoreVertical,
    Trash2,
    Copy,
    Calendar as CalendarIcon,
    XCircle,
    Download,
    Search,
    Filter,
    Check,
    CheckCheck,
    X,
    Repeat,
    Shield
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { createCampaign, listCampaigns, deleteCampaign, getCampaignStats, Campaign, CampaignType, RecurrenceRule, MessageType } from '../lib/campaigns';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

type ViewMode = 'list' | 'create' | 'report';
type TimeRange = 'today' | '7days' | '30days' | 'custom';

export const Campaigns: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const { success, error: toastError } = useToast();

    // --- Filter State ---
    const [timeRange, setTimeRange] = useState<TimeRange>('30days');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // --- Form State ---
    const [campaignName, setCampaignName] = useState('');
    const [audience, setAudience] = useState('all');
    const [messageType, setMessageType] = useState<MessageType>('text');
    const [messageText, setMessageText] = useState('');
    const [messageVariations, setMessageVariations] = useState<string[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [campaignType, setCampaignType] = useState<CampaignType>('instant');
    const [scheduleTime, setScheduleTime] = useState('');
    const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
    const [recurrenceTimes, setRecurrenceTimes] = useState<string[]>(['09:00']);
    const [dailyLimit, setDailyLimit] = useState<number | ''>(''); // Throttling

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Preview State
    const [previewIndex, setPreviewIndex] = useState(0);

    const [stats, setStats] = useState<any>(null);

    const handleViewReport = async (campaignId: string) => {
        setSelectedCampaignId(campaignId);
        setViewMode('report');
        try {
            setLoading(true);
            const data = await getCampaignStats(campaignId);
            setStats(data);
        } catch (err) {
            console.error(err);
            toastError('Erro ao carregar estatísticas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCampaigns();
    }, []);

    // Cycle preview every 3 seconds if there are variations
    useEffect(() => {
        if (messageVariations.length > 0) {
            const interval = setInterval(() => {
                setPreviewIndex(prev => (prev + 1) % (messageVariations.length + 1));
            }, 3000);
            return () => clearInterval(interval);
        } else {
            setPreviewIndex(0);
        }
    }, [messageVariations]);

    const loadCampaigns = async () => {
        try {
            setLoading(true);
            const data = await listCampaigns();
            setCampaigns(data);
        } catch (err: any) {
            console.error('Error loading campaigns:', err);
            toastError('Erro ao carregar campanhas');
        } finally {
            setLoading(false);
        }
    };

    const handleAddVariation = () => {
        setMessageVariations([...messageVariations, '']);
    };

    const handleRemoveVariation = (index: number) => {
        const newVariations = [...messageVariations];
        newVariations.splice(index, 1);
        setMessageVariations(newVariations);
    };

    const handleVariationChange = (index: number, value: string) => {
        const newVariations = [...messageVariations];
        newVariations[index] = value;
        setMessageVariations(newVariations);
    };

    const handleCreateCampaign = async () => {
        try {
            if (!campaignName || !messageText) {
                toastError('Preencha todos os campos obrigatórios');
                return;
            }

            if (campaignType === 'scheduled' && !scheduleTime) {
                toastError('Selecione a data e hora do agendamento');
                return;
            }

            if (campaignType === 'recurring' && (recurrenceDays.length === 0 || recurrenceTimes.length === 0)) {
                toastError('Configure a recorrência corretamente');
                return;
            }

            if (messageType !== 'text' && !file) {
                toastError('Selecione um arquivo de mídia');
                return;
            }

            let mediaUrl = undefined;
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('campaign-media')
                    .upload(filePath, file);

                if (uploadError) {
                    throw uploadError;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('campaign-media')
                    .getPublicUrl(filePath);

                mediaUrl = publicUrl;
            }

            const recurrenceRule: RecurrenceRule | undefined = campaignType === 'recurring'
                ? { days: recurrenceDays, times: recurrenceTimes }
                : undefined;

            // Combine main message and variations into a single array for the 'message_variations' column
            // This ensures all potential messages are in one place for n8n to pick from.
            const allVariations = [messageText, ...messageVariations].filter(v => v.trim() !== '');

            await createCampaign({
                name: campaignName,
                type: campaignType,
                schedule_time: campaignType === 'scheduled' ? new Date(scheduleTime).toISOString() : undefined,
                recurrence_rule: recurrenceRule,
                audience_filter: { type: 'all' }, // Simplified for now
                message_type: messageType,
                media_url: mediaUrl,
                daily_limit: dailyLimit ? Number(dailyLimit) : undefined,
                message_variations: allVariations // Store ALL variations here
            });

            success('Campanha criada com sucesso!');
            setViewMode('list');
            loadCampaigns();

            // Reset form
            setCampaignName('');
            setMessageText('');
            setMessageVariations([]);
            setCampaignType('instant');
            setScheduleTime('');
            setRecurrenceDays([]);
            setMessageType('text');
            setFile(null);
            setDailyLimit('');
        } catch (err: any) {
            console.error('Error creating campaign:', err);
            toastError('Erro ao criar campanha: ' + err.message);
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta campanha?')) return;
        try {
            await deleteCampaign(id);
            success('Campanha excluída com sucesso!');
            loadCampaigns();
        } catch (err: any) {
            toastError('Erro ao excluir campanha');
        }
    };

    const toggleRecurrenceDay = (day: number) => {
        setRecurrenceDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    // --- Filter Logic ---
    const filteredCampaigns = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        return campaigns.filter(camp => {
            const campDate = new Date(camp.created_at).getTime();

            if (timeRange === 'today') {
                return campDate >= todayStart;
            }
            if (timeRange === '7days') {
                const sevenDaysAgo = todayStart - (7 * 24 * 60 * 60 * 1000);
                return campDate >= sevenDaysAgo;
            }
            if (timeRange === '30days') {
                const thirtyDaysAgo = todayStart - (30 * 24 * 60 * 60 * 1000);
                return campDate >= thirtyDaysAgo;
            }
            if (timeRange === 'custom') {
                const start = customStartDate ? new Date(customStartDate).getTime() : 0;
                const end = customEndDate ? new Date(customEndDate).getTime() + (24 * 60 * 60 * 1000) : Infinity;
                return campDate >= start && campDate <= end;
            }
            return true;
        });
    }, [campaigns, timeRange, customStartDate, customEndDate]);

    // --- File Handling ---
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) validateAndSetFile(droppedFile);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const validateAndSetFile = (selectedFile: File) => {
        if (messageType === 'image' && !selectedFile.type.startsWith('image/')) {
            alert('Por favor, selecione um arquivo de imagem.');
            return;
        }
        if (messageType === 'video' && !selectedFile.type.startsWith('video/')) {
            alert('Por favor, selecione um arquivo de vídeo.');
            return;
        }
        setFile(selectedFile);
    };

    const clearFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getButtonStyle = (range: TimeRange) => {
        const isActive = timeRange === range;
        return isActive
            ? "text-xs font-bold px-3 py-1.5 rounded-md bg-primary text-white shadow-sm transition-all"
            : "text-xs font-medium px-3 py-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted-dark transition-colors";
    };

    const handleChangeMessageType = (type: MessageType) => {
        setMessageType(type);
        setFile(null);
    };
    // ... (inside render report view)
    if (viewMode === 'report' && stats) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-6 space-y-8">
                <div className="flex items-center justify-between">
                    <button onClick={() => setViewMode('list')} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-bold">Voltar para Campanhas</span>
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Relatório de Desempenho</h2>
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
                {stats.variationStats && Object.keys(stats.variationStats).length > 0 && (
                    <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm mb-8">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Performance por Variação (A/B Test)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(stats.variationStats).map(([key, data]: [string, any]) => (
                                <div key={key} className="bg-gray-50 dark:bg-muted-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Variação {String.fromCharCode(65 + parseInt(key))}</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded-full">
                                            {data.total} envios
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Entregues
                                            </span>
                                            <span className="font-bold text-gray-900 dark:text-white">{data.delivered || 0} ({data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${data.total > 0 ? (data.delivered / data.total) * 100 : 0}%` }}></div>
                                        </div>

                                        <div className="flex justify-between text-sm mt-2">
                                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Falhas
                                            </span>
                                            <span className="font-bold text-gray-900 dark:text-white">{data.failed || 0} ({data.total > 0 ? Math.round((data.failed / data.total) * 100) : 0}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                            <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${data.total > 0 ? (data.failed / data.total) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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
                                                    ${log.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                                        log.status === 'read' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                                                            log.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'}
                                                `}>
                                                    {log.status === 'sent' ? 'Enviado' :
                                                        log.status === 'delivered' ? 'Entregue' :
                                                            log.status === 'read' ? 'Lido' :
                                                                log.status === 'failed' ? 'Falha' : log.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                {log.error_message ? (
                                                    <span className="text-red-500">{log.error_message}</span>
                                                ) : log.replied_at ? (
                                                    <span className="text-blue-500 font-bold flex items-center gap-1">
                                                        <MessageCircle className="w-3 h-3" />
                                                        Respondeu em {new Date(log.replied_at).toLocaleString()}
                                                    </span>
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
    }

    // --- Render Management View (List) ---
    if (viewMode === 'list') {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                {/* Header & Filters */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gerenciador de Campanhas</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Acompanhe o desempenho dos seus disparos em massa.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-center">
                        {/* Time Filter */}
                        <div className="flex items-center bg-white dark:bg-card-dark p-1 rounded-lg border border-border-light dark:border-border-dark shadow-sm w-full sm:w-auto overflow-x-auto">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 px-2 whitespace-nowrap flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3" />
                                PERÍODO:
                            </span>
                            <button onClick={() => setTimeRange('today')} className={getButtonStyle('today')}>Hoje</button>
                            <button onClick={() => setTimeRange('7days')} className={getButtonStyle('7days')}>7 Dias</button>
                            <button onClick={() => setTimeRange('30days')} className={getButtonStyle('30days')}>30 Dias</button>
                        </div>

                        <button
                            onClick={() => setViewMode('create')}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-white px-5 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,255,255,0.3)] whitespace-nowrap"
                        >
                            <Plus className="w-5 h-5" />
                            Nova Campanha
                        </button>
                    </div>
                </div>

                {/* Campaigns Grid */}
                <div className="grid grid-cols-1 gap-6">
                    {loading ? (
                        <div className="text-center py-12">Carregando campanhas...</div>
                    ) : filteredCampaigns.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-card-dark border border-dashed border-border-light dark:border-border-dark rounded-xl">
                            <p className="text-gray-500 dark:text-gray-400">Nenhuma campanha encontrada neste período.</p>
                        </div>
                    ) : (
                        filteredCampaigns.map((camp) => (
                            <div key={camp.id} className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden hover:border-primary/50 transition-colors">
                                <div className="p-6 border-b border-border-light dark:border-border-dark flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-border-light dark:border-border-dark bg-blue-50 dark:bg-blue-900/10 text-blue-500`}>
                                            {camp.message_type === 'video' ? <Video className="w-6 h-6" /> :
                                                camp.message_type === 'image' ? <ImageIcon className="w-6 h-6" /> :
                                                    <Megaphone className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{camp.name}</h3>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{new Date(camp.created_at).toLocaleDateString()}</span>
                                                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span className="capitalize">{camp.type === 'instant' ? 'Instantâneo' : camp.type === 'scheduled' ? 'Agendado' : 'Recorrente'}</span>
                                                {camp.daily_limit && (
                                                    <>
                                                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                        <span className="flex items-center gap-1 text-orange-500">
                                                            <Shield className="w-3 h-3" />
                                                            Limite: {camp.daily_limit}/dia
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border
                                    ${camp.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' :
                                                camp.status === 'active' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30 animate-pulse' :
                                                    'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30'}
                                `}>
                                            {camp.status}
                                        </span>

                                        <div className="flex items-center border-l border-border-light dark:border-border-dark pl-3 ml-2 gap-1">
                                            <button
                                                onClick={() => handleViewReport(camp.id)}
                                                className="p-2 text-gray-400 hover:text-primary transition-colors"
                                                title="Ver Relatório"
                                            >
                                                <BarChart2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCampaign(camp.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )))}
                </div>
            </div>
        );
    }

    // --- Render Create View ---
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => setViewMode('list')}
                    className="p-2 rounded-lg bg-white dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Criar Nova Campanha</h2>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* Configuration Column */}
                <div className="xl:col-span-8 space-y-6">

                    {/* 1. Campaign Details */}
                    <section className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div>
                            Detalhes da Campanha
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Nome da Campanha</label>
                                <input
                                    type="text"
                                    value={campaignName}
                                    onChange={(e) => setCampaignName(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Ex: Promoção Black Friday"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Público Alvo</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Users className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <select
                                        value={audience}
                                        onChange={(e) => setAudience(e.target.value)}
                                        className="w-full pl-10 bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none appearance-none"
                                    >
                                        <option value="all">Todos os Contatos</option>
                                        <option value="leads">Tag: Leads Quentes</option>
                                        <option value="clients">Tag: Clientes Ativos</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. Content Composer */}
                    <section className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</div>
                            Conteúdo da Mensagem
                        </h2>

                        {/* Type Selector */}
                        <div className="flex gap-4 mb-6 border-b border-border-light dark:border-border-dark pb-6">
                            <button
                                onClick={() => handleChangeMessageType('text')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all font-bold text-sm
                        ${messageType === 'text'
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-input-dark'
                                    }`}
                            >
                                <Type className="w-4 h-4" />
                                Apenas Texto
                            </button>
                            <button
                                onClick={() => handleChangeMessageType('image')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all font-bold text-sm
                        ${messageType === 'image'
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-input-dark'
                                    }`}
                            >
                                <ImageIcon className="w-4 h-4" />
                                Imagem + Texto
                            </button>
                            <button
                                onClick={() => handleChangeMessageType('video')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all font-bold text-sm
                        ${messageType === 'video'
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-input-dark'
                                    }`}
                            >
                                <Video className="w-4 h-4" />
                                Vídeo + Texto
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Mensagem Principal (Variação A)</label>
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Padrão</span>
                                </div>
                                <textarea
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    className="w-full h-32 bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                    placeholder="Digite sua mensagem aqui..."
                                />
                            </div>

                            {/* Variations List */}
                            {messageVariations.map((variation, index) => (
                                <div key={index} className="animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Variação {String.fromCharCode(66 + index)}</label>
                                        <button onClick={() => handleRemoveVariation(index)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                                            <Trash2 className="w-3 h-3" /> Remover
                                        </button>
                                    </div>
                                    <textarea
                                        value={variation}
                                        onChange={(e) => handleVariationChange(index, e.target.value)}
                                        className="w-full h-32 bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                        placeholder={`Digite a variação ${String.fromCharCode(66 + index)} da mensagem...`}
                                    />
                                </div>
                            ))}

                            <button
                                onClick={handleAddVariation}
                                className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Adicionar Variação de Texto
                            </button>

                            {messageType !== 'text' && (
                                <div
                                    className="border-2 border-dashed border-border-light dark:border-border-dark rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors mt-4"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleFileDrop}
                                    onClick={triggerFileInput}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept={messageType === 'image' ? 'image/*' : 'video/*'}
                                        onChange={handleFileSelect}
                                    />
                                    {file ? (
                                        <div className="relative group">
                                            {messageType === 'image' ? (
                                                <img src={URL.createObjectURL(file)} alt="Preview" className="h-32 rounded-lg object-cover" />
                                            ) : (
                                                <video src={URL.createObjectURL(file)} className="h-32 rounded-lg" controls />
                                            )}
                                            <button
                                                onClick={clearFile}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <p className="text-xs text-center mt-2 text-gray-500">{file.name}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-muted-dark rounded-full flex items-center justify-center mb-3 text-gray-400">
                                                <UploadCloud className="w-6 h-6" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                Clique para fazer upload ou arraste o arquivo
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {messageType === 'image' ? 'PNG, JPG ou GIF até 5MB' : 'MP4 até 10MB'}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 3. Scheduling & Recurrence & Throttling */}
                    <section className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">3</div>
                            Agendamento e Segurança
                        </h2>

                        <div className="flex gap-4 mb-6">
                            <button
                                onClick={() => setCampaignType('instant')}
                                className={`flex-1 py-3 rounded-lg border transition-all font-bold text-sm
                        ${campaignType === 'instant'
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500'
                                    }`}
                            >
                                Enviar Agora
                            </button>
                            <button
                                onClick={() => setCampaignType('scheduled')}
                                className={`flex-1 py-3 rounded-lg border transition-all font-bold text-sm
                        ${campaignType === 'scheduled'
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500'
                                    }`}
                            >
                                Agendar
                            </button>
                            <button
                                onClick={() => setCampaignType('recurring')}
                                className={`flex-1 py-3 rounded-lg border transition-all font-bold text-sm
                        ${campaignType === 'recurring'
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500'
                                    }`}
                            >
                                Recorrente
                            </button>
                        </div>

                        {campaignType === 'scheduled' && (
                            <div className="animate-in fade-in slide-in-from-top-2 mb-6">
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Data e Hora do Envio</label>
                                <input
                                    type="datetime-local"
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        )}

                        {campaignType === 'recurring' && (
                            <div className="animate-in fade-in slide-in-from-top-2 space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Dias da Semana</label>
                                    <div className="flex gap-2">
                                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                                            <button
                                                key={index}
                                                onClick={() => toggleRecurrenceDay(index)}
                                                className={`w-10 h-10 rounded-full font-bold text-sm transition-colors
                                        ${recurrenceDays.includes(index)
                                                        ? 'bg-primary text-white'
                                                        : 'bg-gray-100 dark:bg-muted-dark text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Horários</label>
                                    <div className="space-y-2">
                                        {recurrenceTimes.map((time, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="time"
                                                    value={time}
                                                    onChange={(e) => {
                                                        const newTimes = [...recurrenceTimes];
                                                        newTimes[index] = e.target.value;
                                                        setRecurrenceTimes(newTimes);
                                                    }}
                                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                                                />
                                                {recurrenceTimes.length > 1 && (
                                                    <button
                                                        onClick={() => {
                                                            const newTimes = [...recurrenceTimes];
                                                            newTimes.splice(index, 1);
                                                            setRecurrenceTimes(newTimes);
                                                        }}
                                                        className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setRecurrenceTimes([...recurrenceTimes, '09:00'])}
                                            className="text-sm text-primary font-bold flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" /> Adicionar Horário
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Throttling Section */}
                        <div className="pt-6 border-t border-border-light dark:border-border-dark">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-5 h-5 text-orange-500" />
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Segurança de Envio (Anti-Ban)</h3>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-lg p-4 mb-4">
                                <p className="text-xs text-orange-700 dark:text-orange-400">
                                    Defina um limite diário para evitar bloqueios no WhatsApp. O sistema irá distribuir os envios automaticamente ao longo dos dias.
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Limite de Mensagens por Dia</label>
                                <input
                                    type="number"
                                    value={dailyLimit}
                                    onChange={(e) => setDailyLimit(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="Ex: 50"
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Deixe em branco para enviar sem limites (não recomendado para listas frias).</p>
                            </div>
                        </div>
                    </section>

                </div>

                {/* Preview Column */}
                <div className="xl:col-span-4">
                    <div className="sticky top-6">
                        {/* Preview Phone */}
                        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex justify-between items-center">
                                <span>Pré-visualização</span>
                                {messageVariations.length > 0 && (
                                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full animate-pulse">
                                        Mostrando Variação {previewIndex === 0 ? 'A' : String.fromCharCode(65 + previewIndex)}
                                    </span>
                                )}
                            </h3>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-3xl overflow-hidden bg-[#E5DDD5] dark:bg-[#0b141a] h-[500px] relative">
                                {/* Header */}
                                <div className="bg-[#008069] dark:bg-[#202c33] p-3 flex items-center gap-3 text-white">
                                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                                        <Users className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold leading-none">{campaignName || 'Nome da Campanha'}</p>
                                        <p className="text-[10px] opacity-80 leading-none mt-1">
                                            {audience === 'all' ? 'Todos os contatos' : audience === 'leads' ? 'Leads Quentes' : 'Clientes Ativos'}
                                        </p>
                                    </div>
                                </div>

                                {/* Message Area */}
                                <div className="p-4 flex flex-col gap-2 h-full overflow-y-auto pb-20">
                                    <div className="self-end bg-[#d9fdd3] dark:bg-[#005c4b] rounded-lg p-2 max-w-[85%] shadow-sm relative">
                                        {/* Media Preview */}
                                        {file && (
                                            <div className="mb-2 rounded-lg overflow-hidden">
                                                {messageType === 'image' ? (
                                                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-auto object-cover" />
                                                ) : (
                                                    <video src={URL.createObjectURL(file)} className="w-full h-auto" controls />
                                                )}
                                            </div>
                                        )}

                                        {/* Text Message */}
                                        <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                                            {previewIndex === 0 ? (messageText || 'Sua mensagem aparecerá aqui...') : (messageVariations[previewIndex - 1] || 'Variação vazia...')}
                                        </p>

                                        {/* Timestamp & Check */}
                                        <div className="flex justify-end items-center gap-1 mt-1">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <CheckCheck className="w-3 h-3 text-blue-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Card */}
                        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Resumo do Envio</h3>
                            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                                <div className="flex justify-between">
                                    <span>Tipo:</span>
                                    <span className="font-bold capitalize">{campaignType === 'instant' ? 'Instantâneo' : campaignType === 'scheduled' ? 'Agendado' : 'Recorrente'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Variações:</span>
                                    <span className="font-bold">{1 + messageVariations.length} mensagens</span>
                                </div>
                                {dailyLimit && (
                                    <div className="flex justify-between text-orange-600 dark:text-orange-400">
                                        <span>Limite Diário:</span>
                                        <span className="font-bold">{dailyLimit} msgs/dia</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleCreateCampaign}
                                className="w-full mt-6 bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                            >
                                {campaignType === 'instant' ? 'Enviar Campanha' : 'Agendar Campanha'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

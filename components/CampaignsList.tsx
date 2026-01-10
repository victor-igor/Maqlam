import React, { useState, useEffect, useMemo } from 'react';
import {
    Megaphone,
    Image as ImageIcon,
    Video,
    Plus,
    BarChart2,
    Trash2,
    Clock,
    Calendar as CalendarIcon,
    Shield,
    Search,
    Edit2,
    Pause,
    Play
} from 'lucide-react';
import { listCampaigns, deleteCampaign, updateCampaignStatus, Campaign } from '../lib/campaigns';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

type TimeRange = 'today' | '7days' | '30days' | 'custom';

export const CampaignsList: React.FC = () => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const { success, error: toastError } = useToast();
    const navigate = useNavigate();

    // --- Filter State ---
    const [timeRange, setTimeRange] = useState<TimeRange>('30days');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // --- Delete Modal State ---
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadCampaigns();
    }, []);

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

    const handleDeleteClick = (id: string) => {
        setCampaignToDelete(id);
        setDeleteModalOpen(true);
    };

    const handleToggleStatus = async (id: string, currentStatus: string, scheduleTime?: string) => {
        let newStatus: 'active' | 'paused' | 'pending' = 'active';

        if (currentStatus === 'active' || currentStatus === 'pending') {
            newStatus = 'paused';
        } else {
            // Resuming: Check if it should be pending or active
            if (scheduleTime && new Date(scheduleTime) > new Date()) {
                newStatus = 'pending';
            } else {
                newStatus = 'active';
            }
        }

        try {
            await updateCampaignStatus(id, newStatus);
            success(`Campanha ${newStatus === 'paused' ? 'pausada' : newStatus === 'pending' ? 'agendada' : 'iniciada'} com sucesso!`);
            loadCampaigns();
        } catch (err: any) {
            console.error('Error updating status:', err);
            toastError('Erro ao atualizar status da campanha');
        }
    };

    const confirmDelete = async () => {
        if (!campaignToDelete) return;

        try {
            setIsDeleting(true);
            await deleteCampaign(campaignToDelete);
            success('Campanha excluída com sucesso!');
            loadCampaigns();
            setDeleteModalOpen(false);
        } catch (err: any) {
            console.error('Full delete error:', err);
            toastError(`Erro ao excluir campanha: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setIsDeleting(false);
            setCampaignToDelete(null);
        }
    };

    // --- Filter Logic ---
    const filteredCampaigns = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        return campaigns.filter(camp => {
            const campDate = new Date(camp.created_at).getTime();
            const matchesSearch = camp.name.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

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
    }, [campaigns, timeRange, customStartDate, customEndDate, searchTerm]);

    const getButtonStyle = (range: TimeRange) => {
        const isActive = timeRange === range;
        return isActive
            ? "text-xs font-bold px-3 py-1.5 rounded-md bg-primary text-black shadow-sm transition-all"
            : "text-xs font-medium px-3 py-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted-dark transition-colors";
    };

    const formatRecurrence = (rule?: { days: number[], times: string[] }) => {
        if (!rule) return 'Recorrência não definida';
        const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const daysStr = rule.days.map(d => daysMap[d]).join(', ');
        const timesStr = rule.times.join(', ');
        return `${daysStr} às ${timesStr}`;
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-grow w-full lg:max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-xl leading-5 bg-white dark:bg-input-dark text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition duration-150 ease-in-out shadow-sm"
                        placeholder="Buscar campanha..."
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Time Filter */}
                    <div className="flex items-center bg-white dark:bg-card-dark p-1 rounded-lg border border-border-light dark:border-border-dark shadow-sm overflow-x-auto">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 px-2 whitespace-nowrap flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            PERÍODO:
                        </span>
                        <button onClick={() => setTimeRange('today')} className={getButtonStyle('today')}>Hoje</button>
                        <button onClick={() => setTimeRange('7days')} className={getButtonStyle('7days')}>7 Dias</button>
                        <button onClick={() => setTimeRange('30days')} className={getButtonStyle('30days')}>30 Dias</button>
                    </div>

                    <button
                        onClick={() => navigate('/campaigns/new')}
                        className="flex items-center justify-center gap-2 bg-primary text-black px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,255,255,0.3)] whitespace-nowrap text-sm"
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
                                            {camp.type === 'recurring' ? (
                                                <span>{formatRecurrence(camp.recurrence_rule)}</span>
                                            ) : (
                                                <span>{new Date(camp.schedule_time || camp.created_at).toLocaleDateString()} {new Date(camp.schedule_time || camp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            )}
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
                                                camp.status === 'paused' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/30' :
                                                    'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30'}
                                `}>
                                        {camp.status === 'paused' ? 'Pausada' : camp.status}
                                    </span>

                                    <div className="flex items-center border-l border-border-light dark:border-border-dark pl-3 ml-2 gap-1">
                                        {(camp.status === 'active' || camp.status === 'paused' || camp.status === 'pending') && (camp.type === 'scheduled' || camp.type === 'recurring') && (
                                            <button
                                                onClick={() => handleToggleStatus(camp.id, camp.status, camp.schedule_time)}
                                                className={`p-2 transition-colors ${camp.status === 'active' || camp.status === 'pending'
                                                    ? 'text-orange-400 hover:text-orange-500'
                                                    : 'text-green-400 hover:text-green-500'
                                                    }`}
                                                title={camp.status === 'active' || camp.status === 'pending' ? 'Pausar' : 'Retomar'}
                                            >
                                                {camp.status === 'active' || camp.status === 'pending' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate(`/campaigns/${camp.id}`)}
                                            className="p-2 text-gray-400 hover:text-primary transition-colors"
                                            title="Ver Relatório"
                                        >
                                            <BarChart2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => navigate(`/campaigns/edit/${camp.id}`)}
                                            className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(camp.id)}
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

            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Excluir Campanha"
                message="Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita e todos os dados relacionados (métricas, logs) serão perdidos."
                isDeleting={isDeleting}
            />
        </div >
    );
};

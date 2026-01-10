
import React, { useState, useEffect, useRef } from 'react';
import {
    Smartphone,
    QrCode,
    Trash2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Plus,
    Loader2,
    MoreVertical,
    Power,
    MessageSquare,
    Megaphone
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { whatsappService, WhatsAppInstance } from '../lib/whatsapp';

export const InstancesManager: React.FC = () => {
    const { success, error, info } = useToast();
    const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Create Instance Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newInstanceName, setNewInstanceName] = useState('');

    // Connection & QR Code States
    const [connectingInstance, setConnectingInstance] = useState<WhatsAppInstance | null>(null);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>('');

    // Chatwoot Status State
    const [chatwootStatus, setChatwootStatus] = useState<Record<string, { enabled: boolean; loading: boolean }>>({});

    // Confirmation Modal State
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => Promise<void>;
        isLoading: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        action: async () => { },
        isLoading: false
    });

    // Polling Ref
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadInstances();
        return () => stopPolling();
    }, []);

    useEffect(() => {
        if (instances.length > 0) {
            loadChatwootStatus(instances);
        }
    }, [instances]);

    const loadInstances = async () => {
        try {
            setLoading(true);
            const data = await whatsappService.listInstances();

            // Inicializar com status "verificando" para não mostrar dados antigos do banco
            const initialInstances = data.map(inst => ({
                ...inst,
                status: 'connecting' as const
            }));
            setInstances(initialInstances);

            // Sincronizar status em tempo real para cada instância
            data.forEach(async (instance) => {
                try {
                    const statusData = await whatsappService.getInstanceStatus(instance.id);
                    if (statusData) {
                        console.log(`[Sync] Dados da instância ${instance.name}:`, {
                            status: statusData.instance?.status || statusData.status,
                            profilePicUrl: statusData.instance?.profilePicUrl || statusData.profilePicUrl,
                            fullData: statusData
                        });

                        setInstances(prev => prev.map(i => {
                            if (i.id === instance.id) {
                                // Determinar status
                                let newStatus = i.status;
                                if (typeof statusData.status === 'string') {
                                    newStatus = statusData.status as any;
                                } else if (statusData.instance && statusData.instance.status) {
                                    newStatus = statusData.instance.status;
                                } else if (statusData.status && (statusData.status.loggedIn || statusData.status.connected)) {
                                    newStatus = 'connected';
                                }

                                // Determinar foto de perfil
                                // Prioriza a foto que vem da API se ela existir (length > 0).
                                // Se a API não mandar nada, mantém o que tem no banco.
                                let newProfilePic = i.profile_pic_url;
                                const apiProfilePic = statusData.instance?.profilePicUrl || statusData.profilePicUrl;

                                if (apiProfilePic && apiProfilePic.length > 0) {
                                    newProfilePic = apiProfilePic;
                                }

                                console.log(`[Sync] Atualizando ${instance.name} - Foto Final:`, newProfilePic);

                                return {
                                    ...i,
                                    status: newStatus,
                                    profile_pic_url: newProfilePic,
                                    phone: statusData.instance?.owner || statusData.owner || i.phone
                                };
                            }
                            return i;
                        }));
                    }
                } catch (e) {
                    console.error(`Erro ao sincronizar instância ${instance.name}:`, e);
                }
            });

        } catch (err) {
            console.error(err);
            error('Erro ao carregar instâncias');
        } finally {
            setLoading(false);
        }
    };

    const loadChatwootStatus = async (instancesList: WhatsAppInstance[]) => {
        try {
            const connectedInstances = instancesList.filter(
                inst => inst.status === 'connected' || inst.status === 'open'
            );

            for (const instance of connectedInstances) {
                setChatwootStatus(prev => ({
                    ...prev,
                    [instance.id]: { enabled: false, loading: true }
                }));

                const status = await whatsappService.getChatwootStatus(instance.id);

                setChatwootStatus(prev => ({
                    ...prev,
                    [instance.id]: {
                        enabled: status?.enabled || false,
                        loading: false
                    }
                }));
            }
        } catch (err) {
            console.error('Erro ao carregar status do Chatwoot:', err);
        }
    };

    const handleConnectChatwoot = async (instanceId: string) => {
        try {
            setChatwootStatus(prev => ({
                ...prev,
                [instanceId]: { ...prev[instanceId], loading: true }
            }));

            await whatsappService.connectChatwoot(instanceId);

            setChatwootStatus(prev => ({
                ...prev,
                [instanceId]: { enabled: true, loading: false }
            }));

            success('Chatwoot conectado com sucesso!');
        } catch (err: any) {
            console.error(err);
            error(err.message || 'Erro ao conectar Chatwoot');
            setChatwootStatus(prev => ({
                ...prev,
                [instanceId]: { ...prev[instanceId], loading: false }
            }));
        }
    };

    const handleOpenCreateModal = () => {
        if (instances.length >= 5) {
            error('Limite máximo de 5 instâncias atingido. Exclua uma para criar nova.');
            return;
        }
        setNewInstanceName('');
        setShowCreateModal(true);
    };

    const handleConfirmCreate = async () => {
        if (!newInstanceName.trim()) {
            error('Digite um nome para a instância');
            return;
        }

        try {
            setCreating(true);
            const newInstance = await whatsappService.createInstance(newInstanceName);
            setInstances(prev => [newInstance, ...prev]);
            success('Nova instância criada com sucesso!');
            setShowCreateModal(false);
        } catch (err: any) {
            console.error(err);
            error(err.message || 'Erro ao criar instância');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteInstance = (id: string) => {
        setConfirmation({
            isOpen: true,
            title: 'Excluir Instância',
            message: 'Tem certeza que deseja excluir esta instância? Esta ação não pode ser desfeita.',
            isLoading: false,
            action: async () => {
                try {
                    setConfirmation(prev => ({ ...prev, isLoading: true }));
                    await whatsappService.deleteInstance(id);
                    setInstances(prev => prev.filter(i => i.id !== id));
                    success('Instância removida');
                    setConfirmation(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    console.error(err);
                    error('Erro ao remover instância');
                    setConfirmation(prev => ({ ...prev, isLoading: false }));
                }
            }
        });
    };

    const handleConnect = async (instance: WhatsAppInstance) => {
        try {
            setConnectingInstance(instance);
            setShowQrModal(true);
            setQrCodeData(null);
            setConnectionStatus('Iniciando conexão...');

            const result = await whatsappService.connectInstance(instance.id);

            // Verificar se o QR Code veio na resposta do Connect
            if (result && (result.base64 || result.qr || result.qrcode)) {
                setQrCodeData(result.base64 || result.qr || result.qrcode);
                setConnectionStatus('QR Code Gerado');
            }

            // Start Polling for QR Code / Status
            startPolling(instance.id);
        } catch (err: any) {
            console.error(err);
            // Se for erro 409 (já conectado), o polling vai resolver ou o usuário verá o status
            if (err.message && err.message.includes('409')) {
                setConnectionStatus('Verificando conexão existente...');
                startPolling(instance.id);
            } else {
                error('Erro ao iniciar conexão: ' + (err.message || 'Erro desconhecido'));
                setShowQrModal(false);
                setConnectingInstance(null);
            }
        }
    };

    const handleDisconnect = (id: string) => {
        setConfirmation({
            isOpen: true,
            title: 'Desconectar Instância',
            message: 'Deseja realmente desconectar esta instância do WhatsApp?',
            isLoading: false,
            action: async () => {
                try {
                    setConfirmation(prev => ({ ...prev, isLoading: true }));
                    await whatsappService.disconnectInstance(id);

                    // Update local state immediately
                    setInstances(prev => prev.map(inst =>
                        inst.id === id
                            ? { ...inst, status: 'disconnected', phone: undefined, battery: undefined, profile_pic_url: undefined }
                            : inst
                    ));

                    success('Instância desconectada');
                    setConfirmation(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    console.error(err);
                    error('Erro ao desconectar');
                    setConfirmation(prev => ({ ...prev, isLoading: false }));
                }
            }
        });
    };

    const startPolling = (instanceId: string) => {
        stopPolling(); // Clear existing

        pollInterval.current = setInterval(async () => {
            const statusData = await whatsappService.getInstanceStatus(instanceId);

            if (statusData) {
                // Lógica robusta de status para polling
                let realStatus = 'unknown';
                let displayStatus = 'Aguardando...';

                if (typeof statusData.status === 'string') {
                    realStatus = statusData.status;
                    displayStatus = statusData.status;
                } else if (statusData.instance && statusData.instance.status) {
                    realStatus = statusData.instance.status;
                    displayStatus = statusData.instance.status;
                } else if (statusData.status && (statusData.status.loggedIn || statusData.status.connected)) {
                    realStatus = 'connected';
                    displayStatus = 'Conectado';
                }

                setConnectionStatus(displayStatus);

                if (statusData.qr) {
                    // Se vier QR code, é string base64
                    setQrCodeData(typeof statusData.qr === 'string' ? statusData.qr : null);
                }

                if (realStatus === 'open' || realStatus === 'connected') {
                    success('Conexão estabelecida!');
                    stopPolling();
                    setShowQrModal(false);
                    setConnectingInstance(null);
                    loadInstances(); // Reload to get updated status
                }
            }
        }, 2000); // Poll every 2 seconds
    };

    const stopPolling = () => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
    };

    const handleCloseModal = () => {
        stopPolling();
        setShowQrModal(false);
        setConnectingInstance(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-primary" />
                        Gerenciar Instâncias
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Conecte seus números de WhatsApp para automatizar o atendimento.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadInstances}
                        className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        title="Atualizar lista"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleOpenCreateModal}
                        disabled={creating}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm shadow-sm disabled:opacity-70"
                    >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Nova Instância
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading && instances.length === 0 && (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            )}

            {/* Empty State */}
            {!loading && instances.length === 0 && (
                <div className="text-center py-12 bg-gray-50 dark:bg-card-dark/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhuma instância encontrada</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">Crie sua primeira instância para começar.</p>
                    <button
                        onClick={handleOpenCreateModal}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
                    >
                        Criar Instância
                    </button>
                </div>
            )}

            {/* Instances Grid */}
            {instances.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {instances.map((instance) => (
                        <div
                            key={instance.id}
                            className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden group hover:shadow-md transition-all duration-200"
                        >
                            {/* Card Header */}
                            <div className="p-5 border-b border-border-light dark:border-border-dark flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center overflow-hidden
                    ${instance.status === 'connected' || instance.status === 'open'
                                            ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}
                  `}>
                                        {instance.profile_pic_url ? (
                                            <img
                                                src={instance.profile_pic_url}
                                                alt={instance.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    console.log('Erro ao carregar imagem:', instance.profile_pic_url);
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : (
                                            <Smartphone className="w-5 h-5" />
                                        )}
                                        {/* Fallback icon if image fails to load or is missing */}
                                        <Smartphone className={`w-5 h-5 ${instance.profile_pic_url ? 'hidden' : ''}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{instance.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`w-2 h-2 rounded-full ${instance.status === 'connected' || instance.status === 'open' ? 'bg-green-500' : 'bg-red-500'
                                                }`} />
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
                                                {instance.status === 'open' ? 'Conectado' : (instance.status === 'connecting' ? 'Verificando...' : instance.status)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => handleDeleteInstance(instance.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Remover Instância"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-5 space-y-4">
                                {instance.status === 'connected' || instance.status === 'open' ? (
                                    <>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500 dark:text-gray-400">Status</span>
                                                <span className="font-medium text-green-600 dark:text-green-400">Online</span>
                                            </div>
                                            {instance.phone && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500 dark:text-gray-400">Número</span>
                                                    <span className="font-medium text-gray-900 dark:text-white">{instance.phone}</span>
                                                </div>
                                            )}
                                            {instance.battery && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500 dark:text-gray-400">Bateria</span>
                                                    <span className="font-medium text-gray-900 dark:text-white">{instance.battery}%</span>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleDisconnect(instance.id)}
                                            className="w-full py-2 px-4 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                        >
                                            <Power className="w-4 h-4" />
                                            Desconectar
                                        </button>

                                        <div className="pt-3 border-t border-border-light dark:border-border-dark space-y-3">
                                            {/* Campaign Toggle */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Megaphone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Uso em Campanhas
                                                    </span>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={instance.is_active_for_campaigns ?? true}
                                                        onChange={async (e) => {
                                                            const newValue = e.target.checked;
                                                            // Optimistic update
                                                            setInstances(prev => prev.map(i =>
                                                                i.id === instance.id ? { ...i, is_active_for_campaigns: newValue } : i
                                                            ));
                                                            try {
                                                                await whatsappService.toggleCampaignStatus(instance.id, newValue);
                                                                success(`Instância ${newValue ? 'ativada' : 'desativada'} para campanhas`);
                                                            } catch (err) {
                                                                error('Erro ao atualizar status');
                                                                // Revert on error
                                                                setInstances(prev => prev.map(i =>
                                                                    i.id === instance.id ? { ...i, is_active_for_campaigns: !newValue } : i
                                                                ));
                                                            }
                                                        }}
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                                </label>
                                            </div>

                                            {/* Chatwoot Connection */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    Chatwoot
                                                </span>
                                                {chatwootStatus[instance.id]?.loading ? (
                                                    <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                                                ) : (
                                                    <span className={`text-xs font-medium ${chatwootStatus[instance.id]?.enabled
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {chatwootStatus[instance.id]?.enabled ? 'Conectado' : 'Desconectado'}
                                                    </span>
                                                )}
                                            </div>
                                            {!chatwootStatus[instance.id]?.enabled && (
                                                <button
                                                    onClick={() => handleConnectChatwoot(instance.id)}
                                                    disabled={chatwootStatus[instance.id]?.loading}
                                                    className="w-full py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {chatwootStatus[instance.id]?.loading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <MessageSquare className="w-4 h-4" />
                                                    )}
                                                    Conectar Chatwoot
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-2 space-y-4">
                                        <div className="text-center">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                                {instance.status === 'connecting' ? 'Verificando conexão...' : 'Instância desconectada'}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                {instance.status === 'connecting' ? 'Aguarde um momento' : 'Escaneie o QR Code para conectar'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleConnect(instance)}
                                            className="w-full py-2 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium flex items-center justify-center gap-2"
                                        >
                                            <QrCode className="w-4 h-4" />
                                            Conectar WhatsApp
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Instance Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-200 dark:border-border-dark flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Nova Instância
                            </h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nome da Instância
                                </label>
                                <input
                                    type="text"
                                    value={newInstanceName}
                                    onChange={(e) => setNewInstanceName(e.target.value)}
                                    placeholder="Ex: Atendimento Principal"
                                    className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary px-3 py-2"
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmCreate}
                                    disabled={creating || !newInstanceName.trim()}
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Criar Instância
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {showQrModal && connectingInstance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-200 dark:border-border-dark flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Conectar {connectingInstance.name}
                            </h3>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 flex flex-col items-center space-y-6">
                            {!qrCodeData ? (
                                <div className="w-64 h-64 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl space-y-4">
                                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                    <p className="text-sm text-gray-500 animate-pulse">
                                        {typeof connectionStatus === 'string' ? connectionStatus : 'Aguardando status...'}
                                    </p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="w-64 h-64 bg-white p-2 rounded-xl border-2 border-gray-900 dark:border-white">
                                        <img
                                            src={qrCodeData}
                                            alt="QR Code WhatsApp"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-300 mt-4">
                                        Status: <span className="text-primary">
                                            {typeof connectionStatus === 'string' ? connectionStatus : 'QR Code Gerado'}
                                        </span>
                                    </p>
                                </div>
                            )}

                            <div className="text-center space-y-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Abra o WhatsApp no seu celular
                                </p>
                                <ol className="text-xs text-gray-500 dark:text-gray-400 text-left space-y-1 list-decimal pl-4">
                                    <li>Toque em <strong>Mais opções</strong> (Android) ou <strong>Configurações</strong> (iPhone)</li>
                                    <li>Toque em <strong>Aparelhos conectados</strong></li>
                                    <li>Toque em <strong>Conectar um aparelho</strong></li>
                                    <li>Aponte a câmera para a tela para capturar o código</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmation.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-6 text-center space-y-4">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                    {confirmation.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {confirmation.message}
                                </p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-border-dark flex gap-3">
                            <button
                                onClick={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmation.action}
                                disabled={confirmation.isLoading}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {confirmation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

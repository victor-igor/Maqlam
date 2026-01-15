import React, { useState, useEffect } from 'react';
import { X, Settings, Save, Loader2, Shield, Globe } from 'lucide-react';
import { getCampaignSettings, saveCampaignSettings, CampaignSettings } from '../lib/campaigns';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { WhatsAppInstance } from '../lib/whatsapp';

interface CampaignSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CampaignSettingsModal: React.FC<CampaignSettingsModalProps> = ({ isOpen, onClose }) => {
    const { success, error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [metaAccessToken, setMetaAccessToken] = useState('');
    const [metaAccountId, setMetaAccountId] = useState('');
    const [gatewayUrl, setGatewayUrl] = useState('');

    const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
    const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            loadSettings();
            loadInstances();
        }
    }, [isOpen]);

    const loadInstances = async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .order('name');

            if (error) throw error;

            const allInstances = data || [];
            setInstances(allInstances);

            // Initialize selected IDs based on is_active_for_campaigns
            const activeIds = new Set(
                allInstances
                    .filter(i => i.is_active_for_campaigns)
                    .map(i => i.id)
            );
            setSelectedInstanceIds(activeIds);
        } catch (err) {
            console.error('Error loading instances:', err);
        }
    };

    const loadSettings = async () => {
        try {
            setLoading(true);
            const settings = await getCampaignSettings();
            setMetaAccessToken(settings.meta_access_token || '');
            setMetaAccountId(settings.meta_account_id || '');
            setGatewayUrl(settings.gateway_url || '');

        } catch (err) {
            console.error('Error loading settings:', err);
            toastError('Erro ao carregar configurações');
        } finally {
            setLoading(false);
        }
    };

    const toggleInstance = (id: string) => {
        const newSelected = new Set(selectedInstanceIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedInstanceIds(newSelected);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // 1. Save Global Settings
            await saveCampaignSettings({
                meta_access_token: metaAccessToken || undefined,
                meta_account_id: metaAccountId || undefined,
                gateway_url: gatewayUrl || undefined,

            });

            // 2. Update Instances in parallel
            const updates = instances.map(instance => {
                const isActive = selectedInstanceIds.has(instance.id);
                // Only update if changed
                if (instance.is_active_for_campaigns !== isActive) {
                    return supabase
                        .from('whatsapp_instances')
                        .update({ is_active_for_campaigns: isActive })
                        .eq('id', instance.id);
                }
                return Promise.resolve();
            });

            await Promise.all(updates);

            success('Configurações salvas com sucesso!');
            onClose();
        } catch (err: any) {
            console.error('Error saving settings:', err);
            toastError('Erro ao salvar configurações: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Settings className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Configurações de Campanhas</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Configure as credenciais para envio</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-muted-dark transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Official API Section */}
                        {/* Global Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-purple-500" />
                                <h3 className="font-bold text-gray-900 dark:text-white">Configurações Globais</h3>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Configurações aplicadas a todos os tipos de campanha
                            </p>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
                                    URL do Webhook (N8N / Typebot / Etc)
                                </label>
                                <input
                                    type="url"
                                    value={gatewayUrl}
                                    onChange={(e) => setGatewayUrl(e.target.value)}
                                    placeholder="https://seu-gateway.com/webhook"
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="border-t border-border-light dark:border-border-dark" />

                        {/* Official API Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-green-500" />
                                <h3 className="font-bold text-gray-900 dark:text-white">API Oficial (Meta Business)</h3>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Para usar templates aprovados do WhatsApp Business
                            </p>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
                                    WhatsApp Business Account ID
                                </label>
                                <input
                                    type="text"
                                    value={metaAccountId}
                                    onChange={(e) => setMetaAccountId(e.target.value)}
                                    placeholder="Ex: 123456789012345"
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
                                    Access Token
                                </label>
                                <input
                                    type="password"
                                    value={metaAccessToken}
                                    onChange={(e) => setMetaAccessToken(e.target.value)}
                                    placeholder="EAAxxxxxxx..."
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="border-t border-border-light dark:border-border-dark" />

                        {/* Unofficial Gateway Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-500" />
                                <h3 className="font-bold text-gray-900 dark:text-white">API Não Oficial</h3>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Selecione as instâncias conectadas para envio
                            </p>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-3">
                                    Instâncias de Disparo
                                </label>

                                <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1">
                                    {instances.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl bg-gray-50/50 dark:bg-card-dark/50">
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma instância encontrada</p>
                                            <p className="text-xs text-gray-400 mt-1">Conecte um WhatsApp primeiro</p>
                                        </div>
                                    ) : (
                                        instances.map((instance) => {
                                            const isSelected = selectedInstanceIds.has(instance.id);
                                            const isConnected = instance.status === 'connected';

                                            return (
                                                <div
                                                    key={instance.id}
                                                    onClick={() => toggleInstance(instance.id)}
                                                    className={`
                                                        group relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none
                                                        ${isSelected
                                                            ? 'bg-primary/5 border-primary shadow-sm dark:bg-primary/10'
                                                            : 'bg-white dark:bg-card-dark border-border-light dark:border-border-dark hover:border-primary/50 hover:shadow-md'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        {/* Checkbox Visual */}
                                                        <div className={`
                                                            flex items-center justify-center w-5 h-5 rounded-md border transition-colors
                                                            ${isSelected
                                                                ? 'bg-primary border-primary text-white'
                                                                : 'border-gray-300 dark:border-gray-600 group-hover:border-primary'
                                                            }
                                                        `}>
                                                            {isSelected && <svg className="w-3.5 h-3.5 stroke-current stroke-[3]" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" /></svg>}
                                                        </div>

                                                        {/* Instance Info */}
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}`}>
                                                                {instance.name}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {instance.phone && (
                                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-muted-dark px-1.5 py-0.5 rounded">
                                                                        {instance.phone}
                                                                    </span>
                                                                )}
                                                                {instance.battery !== undefined && (
                                                                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                                                        Configurada: {new Date(instance.last_connection || '').toLocaleDateString('pt-BR')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div className={`
                                                        px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border
                                                        ${isConnected
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                            : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                                                        }
                                                    `}>
                                                        {isConnected ? 'Conectado' : 'Desconectado'}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-2 px-1">
                                    <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                    <p className="text-[10px] text-gray-400">
                                        Selecione múltiplas instâncias para balancear o envio de mensagens (Load Balancing).
                                    </p>
                                </div>
                            </div>


                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-border-light dark:border-border-dark">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted-dark transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};

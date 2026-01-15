import React, { useState, useRef, useEffect } from 'react';
import {
    Type,
    Image as ImageIcon,
    Video,
    Users,
    Plus,
    Trash2,
    X,
    ArrowLeft,
    Globe,
    Shield,
    CheckCircle2
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    createCampaign,
    updateCampaign,
    getCampaign,
    CampaignType,
    RecurrenceRule,
    MessageType,
    CampaignProvider,
    WhatsAppTemplate,
    listMessageTemplates
} from '../lib/campaigns';
import { getTags, Tag } from '../lib/contacts';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

export const CreateCampaign: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { success, error: toastError } = useToast();

    // --- Form State ---
    const [campaignName, setCampaignName] = useState('');
    const [audience, setAudience] = useState('all');
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);

    // Provider & Template State
    const [provider, setProvider] = useState<CampaignProvider>('unofficial');
    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Message State
    const [messageType, setMessageType] = useState<MessageType>('text');
    const [messageText, setMessageText] = useState('');
    const [messageVariations, setMessageVariations] = useState<string[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | undefined>(undefined);

    // Schedule State
    const [campaignType, setCampaignType] = useState<CampaignType>('instant');
    const [scheduleTime, setScheduleTime] = useState('');
    const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
    const [recurrenceTimes, setRecurrenceTimes] = useState<string[]>(['09:00']);
    const [dailyLimit, setDailyLimit] = useState<number | ''>('');

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Preview State
    const [previewIndex, setPreviewIndex] = useState(0);

    // Load campaign data if editing
    useEffect(() => {
        if (id) {
            loadCampaign(id);
        }
    }, [id]);

    // Load tags and templates
    useEffect(() => {
        loadTags();
        loadTemplates();
    }, []);

    const loadTags = async () => {
        try {
            const tags = await getTags();
            setAvailableTags(tags);
        } catch (error) {
            console.error('Error loading tags:', error);
            toastError('Erro ao carregar tags');
        }
    };

    const loadTemplates = async () => {
        try {
            setLoadingTemplates(true);
            const data = await listMessageTemplates();
            setTemplates(data);
        } catch (error) {
            console.error('Error loading templates:', error);
            // Don't show error toast immediately as user might not have configured credentials yet
        } finally {
            setLoadingTemplates(false);
        }
    };

    const loadCampaign = async (campaignId: string) => {
        try {
            const campaign = await getCampaign(campaignId);
            setCampaignName(campaign.name);
            setCampaignType(campaign.type);
            setProvider(campaign.provider || 'unofficial');
            setMessageType(campaign.message_type);
            setMediaUrl(campaign.media_url);

            // Handle provider specific data
            if (campaign.provider === 'official' && campaign.template_name) {
                // We need to wait for templates to load or find it in the already loaded list
                // For now, let's just set the text. In a real scenario we'd match the template object.
                setMessageText(campaign.template_text || '');
            } else {
                if (campaign.message_variations && campaign.message_variations.length > 0) {
                    setMessageText(campaign.message_variations[0]);
                    setMessageVariations(campaign.message_variations.slice(1));
                }
            }

            // Handle recurrence
            if (campaign.recurrence_rule) {
                setRecurrenceDays(campaign.recurrence_rule.days);
                setRecurrenceTimes(campaign.recurrence_rule.times);
            }

            // Handle schedule
            if (campaign.schedule_time) {
                setScheduleTime(new Date(campaign.schedule_time).toISOString().slice(0, 16));
            }

            // Handle daily limit
            if (campaign.daily_limit) {
                setDailyLimit(campaign.daily_limit);
            }

            // Handle Audience
            if (campaign.audience_filter?.type === 'tag') {
                setAudience(campaign.audience_filter.value || 'all');
            }

        } catch (err: any) {
            console.error('Error loading campaign:', err);
            toastError('Erro ao carregar dados da campanha');
            navigate('/campaigns');
        }
    };

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

    const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateName = e.target.value;
        const template = templates.find(t => t.name === templateName);

        setSelectedTemplate(template || null);
        if (template) {
            // Find the body component to get the text
            const bodyComponent = template.components.find(c => c.type === 'BODY');
            if (bodyComponent) {
                setMessageText(bodyComponent.text || '');
            }
        } else {
            setMessageText('');
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
            if (!campaignName) {
                toastError('Nome da campanha é obrigatório');
                return;
            }

            // Validation based on provider
            if (provider === 'official') {
                if (!selectedTemplate && !id) { // Allow editing without re-selecting if purely updating schedule
                    // Actually, for editing, we might not have selectedTemplate set if we just loaded text. 
                    // Enhancing loadCampaign to find template would be better, but for now enforce text presence.
                    if (!messageText) {
                        toastError('Selecione um template para envio oficial');
                        return;
                    }
                }
            } else {
                if (!messageText) {
                    toastError('A mensagem principal é obrigatória');
                    return;
                }
            }

            if (campaignType === 'scheduled' && !scheduleTime) {
                toastError('Selecione a data e hora do agendamento');
                return;
            }

            if (campaignType === 'recurring') {
                if (recurrenceDays.length === 0) {
                    toastError('Selecione pelo menos um dia da semana para a recorrência');
                    return;
                }
                if (recurrenceTimes.length === 0 || recurrenceTimes.some(t => !t)) {
                    toastError('Defina horários válidos para o disparo recorrente');
                    return;
                }
            }

            if (provider === 'unofficial' && messageType !== 'text' && !file && !mediaUrl) {
                toastError('Selecione um arquivo de mídia');
                return;
            }

            // Upload File if present
            let finalMediaUrl = mediaUrl;
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('campaign-media')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('campaign-media')
                    .getPublicUrl(filePath);

                finalMediaUrl = publicUrl;
            }

            const recurrenceRule: RecurrenceRule | undefined = campaignType === 'recurring'
                ? { days: recurrenceDays, times: recurrenceTimes }
                : undefined;

            // Combine variations only for unofficial
            const allVariations = provider === 'unofficial'
                ? [messageText, ...messageVariations].filter(v => v.trim() !== '')
                : [messageText];

            const campaignData = {
                name: campaignName,
                type: campaignType,
                provider: provider,
                schedule_time: campaignType === 'scheduled' ? new Date(scheduleTime).toISOString() : undefined,
                recurrence_rule: recurrenceRule,
                audience_filter: (audience === 'all'
                    ? { type: 'all' }
                    : { type: 'tag', value: audience }) as { type: 'all' | 'tag' | 'csv'; value?: string },
                message_type: messageType,
                media_url: finalMediaUrl,
                daily_limit: dailyLimit ? Number(dailyLimit) : undefined,
                message_variations: allVariations,

                // Template fields for Official Provider
                template_name: provider === 'official' ? selectedTemplate?.name : undefined,
                template_language: provider === 'official' ? selectedTemplate?.language : undefined,
                template_text: provider === 'official' ? messageText : undefined,
            };

            if (id) {
                await updateCampaign(id, campaignData);
                success('Campanha atualizada com sucesso!');
            } else {
                await createCampaign(campaignData);
                success('Campanha criada com sucesso!');
            }

            navigate('/campaigns');
        } catch (err: any) {
            console.error('Error saving campaign:', err);
            toastError('Erro ao salvar campanha: ' + err.message);
        }
    };

    const toggleRecurrenceDay = (day: number) => {
        setRecurrenceDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const handleAddRecurrenceTime = () => {
        setRecurrenceTimes([...recurrenceTimes, '09:00']);
    };

    const handleRemoveRecurrenceTime = (index: number) => {
        const newTimes = [...recurrenceTimes];
        newTimes.splice(index, 1);
        setRecurrenceTimes(newTimes);
    };

    const handleRecurrenceTimeChange = (index: number, value: string) => {
        const newTimes = [...recurrenceTimes];
        newTimes[index] = value;
        setRecurrenceTimes(newTimes);
    };

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

    const handleChangeMessageType = (type: MessageType) => {
        setMessageType(type);
        setFile(null);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/campaigns')}
                    className="p-2 rounded-lg bg-white dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {id ? 'Editar Campanha' : 'Criar Nova Campanha'}
                </h2>
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

                        {/* Provider Selection (Hybrid) */}
                        <div className="mb-6 p-4 bg-gray-50 dark:bg-muted-dark rounded-xl border border-border-light dark:border-border-dark">
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-3">Provedor de Envio</label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setProvider('unofficial')}
                                    className={`flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all ${provider === 'unofficial'
                                        ? 'bg-white dark:bg-blue-900/30 shadow-sm border-primary ring-1 ring-primary'
                                        : 'bg-transparent border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${provider === 'unofficial' ? 'border-primary' : 'border-gray-400'}`}>
                                        {provider === 'unofficial' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                                            API Não Oficial
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Usa seus números conectados (Gateway)</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setProvider('official')}
                                    className={`flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all ${provider === 'official'
                                        ? 'bg-white dark:bg-blue-900/30 shadow-sm border-primary ring-1 ring-primary'
                                        : 'bg-transparent border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${provider === 'official' ? 'border-primary' : 'border-gray-400'}`}>
                                        {provider === 'official' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-green-500" />
                                            API Oficial (Meta)
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Alta escala, requer templates aprovados</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Nome da Campanha</label>
                                <input
                                    type="text"
                                    value={campaignName}
                                    onChange={(e) => setCampaignName(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
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
                                        className="w-full pl-10 bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
                                    >
                                        <option value="all">Todos os Contatos</option>
                                        {availableTags.map(tag => (
                                            <option key={tag.id} value={tag.name}>
                                                Tag: {tag.name}
                                            </option>
                                        ))}
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

                        {/* Official Provider: Template Selection */}
                        {provider === 'official' && (
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                                        Selecione um Template Aprovado
                                    </label>
                                    <button
                                        onClick={loadTemplates}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                        disabled={loadingTemplates}
                                    >
                                        {loadingTemplates ? 'Carregando...' : 'Atualizar Templates'}
                                    </button>
                                </div>
                                <select
                                    value={selectedTemplate?.name || ''}
                                    onChange={handleTemplateSelect}
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                >
                                    <option value="">-- Selecione um Template --</option>
                                    {templates.map(tpl => (
                                        <option key={tpl.id} value={tpl.name}>
                                            {tpl.name} ({tpl.status}) - {tpl.language}
                                        </option>
                                    ))}
                                </select>
                                {templates.length === 0 && !loadingTemplates && (
                                    <p className="text-xs text-red-500 mt-2">
                                        Nenhum template encontrado. Verifique suas credenciais nas configurações.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Unofficial Provider: Type Selector */}
                        {provider === 'unofficial' && (
                            <div className="flex gap-4 mb-6 border-b border-border-light dark:border-border-dark pb-6">
                                <button
                                    onClick={() => handleChangeMessageType('text')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all font-bold text-sm
                            ${messageType === 'text'
                                            ? 'bg-primary/10 border-primary text-primary dark:text-blue-300 dark:bg-primary/20'
                                            : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-input-dark'
                                        }`}
                                >
                                    <Type className="w-4 h-4" />
                                    Apenas Texto
                                </button>
                                <button
                                    onClick={() => handleChangeMessageType('image')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all font-bold text-sm
                            ${messageType === 'image'
                                            ? 'bg-primary/10 border-primary text-primary dark:text-blue-300 dark:bg-primary/20'
                                            : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-input-dark'
                                        }`}
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    Imagem + Texto
                                </button>
                                <button
                                    onClick={() => handleChangeMessageType('video')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all font-bold text-sm
                            ${messageType === 'video'
                                            ? 'bg-primary/10 border-primary text-primary dark:text-blue-300 dark:bg-primary/20'
                                            : 'bg-gray-50 dark:bg-muted-dark border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-input-dark'
                                        }`}
                                >
                                    <Video className="w-4 h-4" />
                                    Vídeo + Texto
                                </button>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Mensagem {provider === 'official' ? '(Template)' : 'Principal'}</label>
                                    {provider === 'unofficial' && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Padrão</span>}
                                </div>
                                <textarea
                                    value={messageText}
                                    onChange={(e) => provider === 'unofficial' && setMessageText(e.target.value)} // Read-only for official if strict
                                    readOnly={provider === 'official'}
                                    className={`w-full h-32 bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none resize-none ${provider === 'official' ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    placeholder={provider === 'official' ? "Texto do template selecionado..." : "Digite sua mensagem aqui..."}
                                />
                            </div>

                            {/* Variations List (Only Unofficial) */}
                            {provider === 'unofficial' && (
                                <>
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
                                                className="w-full h-32 bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none resize-none"
                                                placeholder={`Digite a variação ${String.fromCharCode(66 + index)} da mensagem...`}
                                            />
                                        </div>
                                    ))}

                                    <button
                                        onClick={handleAddVariation}
                                        className="flex items-center gap-2 text-sm font-bold text-primary dark:text-blue-400 hover:text-primary/80 dark:hover:text-blue-300 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Adicionar Variação de Texto
                                    </button>
                                </>
                            )}

                            {/* Media Upload (Only Unofficial for now) */}
                            {provider === 'unofficial' && messageType !== 'text' && (
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
                                    {file || mediaUrl ? (
                                        <div className="relative group">
                                            {messageType === 'image' ? (
                                                <img src={file ? URL.createObjectURL(file) : mediaUrl} alt="Preview" className="h-32 rounded-lg object-cover" />
                                            ) : (
                                                <video src={file ? URL.createObjectURL(file) : mediaUrl} className="h-32 rounded-lg" controls />
                                            )}
                                            <button
                                                onClick={clearFile}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <p className="text-xs text-center mt-2 text-gray-500">{file?.name || 'Mídia Atual'}</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-muted-dark rounded-full flex items-center justify-center mx-auto mb-3">
                                                {messageType === 'image' ? <ImageIcon className="w-6 h-6 text-gray-400" /> : <Video className="w-6 h-6 text-gray-400" />}
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">Clique para upload</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ou arraste e solte o arquivo aqui</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 3. Schedule & Throttling */}
                    <section className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">3</div>
                            Agendamento e Limites
                        </h2>

                        <div className="space-y-6">
                            {/* Campaign Type */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div
                                    onClick={() => setCampaignType('instant')}
                                    className={`cursor-pointer rounded-xl border p-4 transition-all ${campaignType === 'instant' ? 'border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/20 dark:border-blue-500' : 'border-border-light dark:border-border-dark hover:border-gray-300 dark:hover:border-gray-600'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">Envio Imediato</span>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${campaignType === 'instant' ? 'border-primary' : 'border-gray-400'}`}>
                                            {campaignType === 'instant' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Inicia o disparo assim que a campanha for criada.</p>
                                </div>

                                <div
                                    onClick={() => setCampaignType('scheduled')}
                                    className={`cursor-pointer rounded-xl border p-4 transition-all ${campaignType === 'scheduled' ? 'border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/20 dark:border-blue-500' : 'border-border-light dark:border-border-dark hover:border-gray-300 dark:hover:border-gray-600'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">Agendar</span>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${campaignType === 'scheduled' ? 'border-primary' : 'border-gray-400'}`}>
                                            {campaignType === 'scheduled' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Escolha uma data e hora específica para o envio.</p>
                                </div>

                                <div
                                    onClick={() => setCampaignType('recurring')}
                                    className={`cursor-pointer rounded-xl border p-4 transition-all ${campaignType === 'recurring' ? 'border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/20 dark:border-blue-500' : 'border-border-light dark:border-border-dark hover:border-gray-300 dark:hover:border-gray-600'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">Recorrente</span>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${campaignType === 'recurring' ? 'border-primary' : 'border-gray-400'}`}>
                                            {campaignType === 'recurring' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Envie periodicamente (ex: toda segunda-feira).</p>
                                </div>
                            </div>

                            {/* Schedule Inputs */}
                            {campaignType === 'scheduled' && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Data e Hora do Disparo</label>
                                    <input
                                        type="datetime-local"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                            )}

                            {/* Recurrence Inputs */}
                            {campaignType === 'recurring' && (
                                <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Dias da Semana</label>
                                        <div className="flex gap-2">
                                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => toggleRecurrenceDay(index)}
                                                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-colors
                                            ${recurrenceDays.includes(index)
                                                            ? 'bg-primary text-white shadow-md'
                                                            : 'bg-gray-100 dark:bg-muted-dark text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-input-dark'
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Horários do Disparo</label>
                                        <div className="space-y-3">
                                            {recurrenceTimes.map((time, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <input
                                                        type="time"
                                                        value={time}
                                                        onChange={(e) => handleRecurrenceTimeChange(index, e.target.value)}
                                                        className="flex-1 bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                                    />
                                                    {recurrenceTimes.length > 1 && (
                                                        <button
                                                            onClick={() => handleRemoveRecurrenceTime(index)}
                                                            className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                onClick={handleAddRecurrenceTime}
                                                className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Adicionar Horário
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Throttling Input */}
                            <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">
                                    Limite Diário de Envios (Opcional)
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Defina quantas mensagens enviar por dia para evitar bloqueios.</p>
                                <input
                                    type="number"
                                    min="1"
                                    value={dailyLimit}
                                    onChange={(e) => setDailyLimit(e.target.value ? parseInt(e.target.value) : '')}
                                    className="w-full bg-gray-50 dark:bg-input-dark border border-border-light dark:border-border-dark rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Ex: 1000"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Preview Column */}
                <div className="xl:col-span-4">
                    <div className="sticky top-6">
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4">Pré-visualização</h3>

                        {/* Phone Frame */}
                        <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[650px] w-[320px] shadow-xl">
                            <div className="w-[32px] h-[32px] absolute -left-[17px] top-[72px] bg-gray-800 rounded-l-lg"></div>
                            <div className="w-[32px] h-[32px] absolute -left-[17px] top-[124px] bg-gray-800 rounded-l-lg"></div>
                            <div className="w-[32px] h-[64px] absolute -right-[17px] top-[142px] bg-gray-800 rounded-r-lg"></div>

                            <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
                            <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                            <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>

                            <div className="rounded-[2rem] overflow-hidden w-full h-full bg-[#EFE7DD] dark:bg-[#0b141a] relative flex flex-col">

                                {/* Status Bar (Fake) */}
                                <div className="h-8 bg-[#008069] dark:bg-[#202c33] w-full flex items-center justify-between px-6 pt-2">
                                    <span className="text-[10px] text-white font-medium">12:30</span>
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
                                        <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
                                    </div>
                                </div>

                                {/* WhatsApp Header */}
                                <div className="bg-[#008069] dark:bg-[#202c33] px-3 pb-3 pt-1 flex items-center gap-2 text-white shadow-sm z-10">
                                    <ArrowLeft className="w-5 h-5" />
                                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                                        <Users className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm truncate">{campaignName || 'Nome da Campanha'}</p>
                                        <p className="text-[10px] opacity-90 truncate">
                                            {audience === 'all' ? 'Todos os contatos' : `Tag: ${audience}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-3 text-white">
                                        <Video className="w-5 h-5" />
                                        <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold">?</div>
                                    </div>
                                </div>

                                {/* Chat Area */}
                                <div className="flex-1 p-3 overflow-y-auto bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-opacity-30 dark:bg-opacity-10">
                                    <div className="flex justify-center mb-4">
                                        <span className="bg-[#FFF5C4] dark:bg-[#1f2c34] text-gray-600 dark:text-gray-300 text-[10px] px-2 py-1 rounded shadow-sm uppercase font-medium">
                                            Hoje
                                        </span>
                                    </div>

                                    {/* Message Bubble */}
                                    <div className="bg-[#d9fdd3] dark:bg-[#005c4b] rounded-lg p-1 shadow-sm max-w-[90%] ml-auto relative rounded-tr-none">
                                        {/* Tail */}
                                        <div className="absolute -right-2 top-0 w-0 h-0 border-t-[10px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-[10px] border-r-transparent"></div>

                                        {/* Media Preview */}
                                        {(file || mediaUrl) && provider === 'unofficial' && (
                                            <div className="mb-1 rounded-lg overflow-hidden bg-black/10">
                                                {messageType === 'image' ? (
                                                    <img src={file ? URL.createObjectURL(file) : mediaUrl} alt="Preview" className="w-full h-auto object-cover max-h-48" />
                                                ) : (
                                                    <video src={file ? URL.createObjectURL(file) : mediaUrl} className="w-full h-auto max-h-48" controls />
                                                )}
                                            </div>
                                        )}

                                        {/* Text Content */}
                                        <div className="px-2 pt-1 pb-5 min-w-[100px]">
                                            <p className="text-[13px] text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                                                {previewIndex === 0 ? (messageText || 'Sua mensagem aparecerá aqui...') : (messageVariations[previewIndex - 1] || '')}
                                            </p>
                                        </div>

                                        {/* Timestamp & Status */}
                                        <div className="absolute bottom-1 right-2 flex items-center gap-1">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-300">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {/* Double Check */}
                                            <div className="flex -space-x-1">
                                                <div className="w-3 h-2 border-r-2 border-b-2 border-[#53bdeb] transform rotate-45"></div>
                                                <div className="w-3 h-2 border-r-2 border-b-2 border-[#53bdeb] transform rotate-45"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Variation Indicator */}
                                    {messageVariations.length > 0 && provider === 'unofficial' && (
                                        <div className="flex justify-center mt-6">
                                            <span className="bg-black/40 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                                                Variação {previewIndex === 0 ? 'A' : String.fromCharCode(65 + previewIndex)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 flex items-center gap-2 pb-6">
                                    <div className="p-2 text-gray-500 dark:text-gray-400">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 bg-white dark:bg-[#2a3942] h-9 rounded-lg px-3 flex items-center text-sm text-gray-400">
                                        Mensagem
                                    </div>
                                    <div className="p-2 bg-[#008069] rounded-full text-white">
                                        <div className="w-4 h-4" /> {/* Mic icon placeholder */}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-card-dark border-t border-border-light dark:border-border-dark z-20 md:pl-64">
                <div className="max-w-7xl mx-auto flex justify-end gap-4">
                    <button
                        onClick={() => navigate('/campaigns')}
                        className="px-6 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted-dark transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreateCampaign}
                        className="px-6 py-2.5 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    >
                        {id ? 'Salvar Alterações' : 'Criar Campanha'}
                    </button>
                </div>
            </div>
            <div className="h-20"></div> {/* Spacer for fixed bottom bar */}
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone,
  Brain,
  Pencil,
  Building2,
  Trash2,
  X,
  PauseCircle,
  PlayCircle,
  Clock,
  Ban,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { EditContactModal } from './EditContactModal';
import { getContact, updateContact, Contact, getTags, createTag, deleteTag, Tag } from '../lib/contacts';
import { useToast } from '../contexts/ToastContext';
import { AISummaryDisplay } from './AISummaryDisplay';

interface ContactDetailsProps {
  onBack?: () => void;
}

export const ContactDetails: React.FC<ContactDetailsProps> = ({ onBack }) => {
  const { id } = useParams<{ id: string }>();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  const [showCustomTimeout, setShowCustomTimeout] = useState(false);
  const [customTimeoutDate, setCustomTimeoutDate] = useState('');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  // Action menu ref
  const actionMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (id) {
      fetchContactDetails();
      loadTags();
    }
  }, [id]);

  const loadTags = async () => {
    try {
      const tags = await getTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const fetchContactDetails = async () => {
    try {
      setLoading(true);
      const data = await getContact(id!);
      setContact(data);
    } catch (error) {
      console.error('Error fetching contact:', error);
      toastError('Erro ao carregar detalhes do contato');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedData: Partial<Contact>) => {
    if (!id) return;

    try {
      await updateContact(id, updatedData);
      const updatedContact = await getContact(id);
      setContact(updatedContact);
      setEditModalOpen(false);
      toastSuccess('Contato atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating contact:', error);
      toastError('Erro ao atualizar contato');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAddTag = async (tagName: string) => {
    if (!contact) return;
    const currentTags = contact.tags || [];
    if (currentTags.includes(tagName)) return;

    const newTags = [...currentTags, tagName];

    try {
      setContact(prev => prev ? { ...prev, tags: newTags } : null); // Optimistic update
      if (id) {
        await updateContact(id, { tags: newTags });
        toastSuccess('Tag adicionada!');
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      toastError('Erro ao adicionar tag');
      fetchContactDetails(); // Revert on error
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!contact) return;
    const currentTags = contact.tags || [];
    const newTags = currentTags.filter(t => t !== tagName);

    try {
      setContact(prev => prev ? { ...prev, tags: newTags } : null); // Optimistic update
      if (id) {
        await updateContact(id, { tags: newTags });
        toastSuccess('Tag removida!');
      }
    } catch (error) {
      console.error('Error removing tag:', error);
      toastError('Erro ao remover tag');
      fetchContactDetails(); // Revert on error
    }
  };

  const handleDeleteSystemTag = async (tagId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tag do sistema? Isso não removerá a tag dos contatos que já a possuem.')) return;

    try {
      await deleteTag(tagId);
      await loadTags();
      toastSuccess('Tag excluída do sistema!');
    } catch (error) {
      console.error('Error deleting tag:', error);
      toastError('Erro ao excluir tag');
    }
  };

  const handleBlockAgent = async (option: '1h' | '2h' | '12h' | '24h' | 'custom' | 'permanent' | 'unblock', customDate?: string) => {
    if (!contact || !id) return;

    try {
      let newTimeout: string | null = null;
      const now = new Date();
      let hoursToAdd = 0;

      switch (option) {
        case '1h': hoursToAdd = 1; break;
        case '2h': hoursToAdd = 2; break;
        case '12h': hoursToAdd = 12; break;
        case '24h': hoursToAdd = 24; break;
        case 'permanent': hoursToAdd = 24 * 365 * 100; break;
        case 'custom':
          if (!customDate) {
            toastError('Selecione uma data e hora.');
            return;
          }
          newTimeout = new Date(customDate).toISOString();
          break;
        case 'unblock':
          newTimeout = null;
          break;
      }

      if (hoursToAdd > 0) {
        newTimeout = new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000).toISOString();
      }

      await updateContact(id, { timeout: newTimeout });
      setContact(prev => prev ? { ...prev, timeout: newTimeout } : null);

      setShowCustomTimeout(false);
      setCustomTimeoutDate('');

      const statusMessage = newTimeout ? 'Atendimento da IA pausado com sucesso.' : 'Atendimento da IA reativado.';
      toastSuccess(statusMessage);

    } catch (err) {
      console.error('Error updating timeout:', err);
      toastError('Erro ao atualizar status do agente IA.');
    }
  };

  const formatPhone = (phone: string | undefined | null) => {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, '');
    let isBR = false;

    // Check for Brazil country code (55)
    if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
      isBR = true;
      clean = clean.substring(2);
    }

    let formatted = clean;
    if (clean.length === 11) {
      formatted = `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
    } else if (clean.length === 10) {
      formatted = `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
    }

    if (isBR) {
      return `+55 ${formatted}`;
    }

    // If it matched the 10/11 regex exactly without 55 prefix, return formatted.
    if (formatted !== clean) return formatted;

    return phone;
  };

  const renderField = (label: string, value: string | undefined | null) => (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</label>
      {value ? (
        <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{value}</p>
      ) : (
        <p className="mt-1.5 text-sm font-medium text-gray-400 italic">Não informado</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Carregando detalhes...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-gray-500 dark:text-gray-400">Contato não encontrado</div>
        <button onClick={() => navigate('/contacts')} className="text-primary hover:underline">
          Voltar para lista
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 text-sm">
        <button onClick={() => navigate('/')} className="text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
          Dashboard
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <button onClick={() => navigate('/contacts')} className="text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
          Contatos
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-900 dark:text-white font-medium">{contact.nome_completo}</span>
      </div>

      {/* ProfileHeader */}
      <header className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6 mb-8">
        <div className="flex w-full flex-col gap-6 md:flex-row md:justify-between md:items-center">
          <div className="flex flex-col md:flex-row gap-4 items-center text-center md:text-left">
            <div className="bg-primary rounded-full h-24 w-24 flex-shrink-0 ring-4 ring-gray-50 dark:ring-border-dark flex items-center justify-center text-3xl font-bold text-white">
              {getInitials(contact.nome_completo)}
            </div>
            <div className="flex flex-col justify-center items-center md:items-start">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{contact.nome_completo}</h1>
              <div className="flex items-center gap-2 mt-1 text-gray-500 dark:text-gray-400">
                <Building2 className="w-4 h-4" />
                <p className="text-sm font-medium">{contact.empresa || 'Empresa não informada'}</p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.2)]
                  ${contact.status === 'Cliente' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}
                  ${contact.status === 'Lead' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : ''}
                  ${contact.status === 'Inativo' ? 'bg-gray-500' : ''}
                `}></span>
                <p className={`text-sm font-semibold
                  ${contact.status === 'Cliente' ? 'text-green-600 dark:text-green-400' : ''}
                  ${contact.status === 'Lead' ? 'text-yellow-600 dark:text-yellow-400' : ''}
                  ${contact.status === 'Inativo' ? 'text-gray-600 dark:text-gray-400' : ''}
                `}>{contact.status}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left/Main Column */}
        <div className="xl:col-span-2 flex flex-col gap-8">
          {/* Tabs */}


          {/* Informações Gerais Section */}
          <section className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark">
            <header className="flex flex-wrap justify-between items-center gap-3 p-6 border-b border-border-light dark:border-border-dark">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Informações de Contato</h2>
              <button
                onClick={() => setEditModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-gray-100 dark:bg-muted-dark text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-input-dark transition-colors"
              >
                <Pencil className="w-4 h-4" />
                <span className="truncate">Editar</span>
              </button>
            </header>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                {renderField('Nome Completo', contact.nome_completo)}
              </div>
              <div className="lg:col-span-1">
                {renderField('CPF', contact.cpf)}
              </div>
              <div className="lg:col-span-1">
                {renderField('Telefone', formatPhone(contact.telefone))}
              </div>

              <div className="lg:col-span-2">
                {renderField('Email', contact.email)}
              </div>
              <div className="lg:col-span-1">
                {renderField('Cargo', contact.cargo)}
              </div>
              <div className="lg:col-span-1">
                {renderField('Empresa', contact.empresa)}
              </div>

              <div className="col-span-full h-px bg-gray-100 dark:bg-border-dark my-2" />

              <div className="lg:col-span-2">
                {renderField('Endereço', contact.endereco)}
              </div>
              <div className="lg:col-span-1">
                {renderField('Bairro', contact.bairro)}
              </div>
              <div className="lg:col-span-1">
                {renderField('CEP', contact.cep)}
              </div>

              <div className="lg:col-span-1">
                {renderField('Cidade', contact.cidade)}
              </div>
              <div className="lg:col-span-1">
                {renderField('Estado', contact.estado)}
              </div>
              <div className="lg:col-span-1">
                {renderField('Origem', contact.origem)}
              </div>
              <div className="lg:col-span-1">
                {renderField('Status', contact.status)}
              </div>

              <div className="lg:col-span-full flex gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contact.aceita_whatsapp ?? true}
                    disabled={true}
                    className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Aceita WhatsApp</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contact.aceita_email ?? true}
                    disabled={true}
                    className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Aceita Email</label>
                </div>
              </div>

              <div className="col-span-full">
                {renderField('Observações', contact.observacoes)}
              </div>
            </div>
          </section>
        </div>

        {/* Right Sidebar - Agency Context */}
        <aside className="xl:col-span-1 flex flex-col gap-8 sticky top-6 h-fit">
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Resumo da IA</h3>
            </div>

            <AISummaryDisplay text={contact.resumo_lead || 'Ainda não há resumo gerado pela IA para este contato. Inicie uma conversa para gerar insights.'} />

            <div className="space-y-4 mt-4">
              <div className="p-4 bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Última Interação</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {contact.ultima_interacao_lead
                      ? new Date(contact.ultima_interacao_lead).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Nenhuma interação'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tags</span>
                  <button
                    onClick={() => setShowTagInput(!showTagInput)}
                    className="text-xs text-primary hover:underline"
                  >
                    Gerenciar
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {(contact.tags || []).map((tagName, index) => (
                    <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      {tagName}
                      <button
                        onClick={() => handleRemoveTag(tagName)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {showTagInput && (
                  <div className="relative space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-2">
                      <select
                        className="flex-1 text-sm px-3 py-1.5 rounded-md border border-border-light dark:border-border-dark bg-gray-50 dark:bg-muted-dark focus:outline-none focus:ring-1 focus:ring-primary"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) handleAddTag(val);
                          e.target.value = '';
                        }}
                      >
                        <option value="">Selecionar tag...</option>
                        {availableTags.map(tag => (
                          <option key={tag.id} value={tag.name} disabled={contact.tags?.includes(tag.name)}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Criar nova tag..."
                        className="flex-1 text-sm px-3 py-1.5 rounded-md border border-border-light dark:border-border-dark bg-gray-50 dark:bg-muted-dark focus:outline-none focus:ring-1 focus:ring-primary"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              try {
                                await createTag(val);
                                await loadTags(); // Reload tags
                                handleAddTag(val); // Auto-add to contact
                                e.currentTarget.value = '';
                                toastSuccess('Tag criada!');
                              } catch (err) {
                                toastError('Erro ao criar tag');
                              }
                            }
                          }
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">Enter para criar nova tag</p>

                    {/* System Tags Management */}
                    <div className="pt-3 border-t border-border-light dark:border-border-dark">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Gerenciar Tags do Sistema</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {availableTags.map(tag => (
                          <div key={tag.id} className="flex items-center justify-between text-xs p-1.5 hover:bg-gray-50 dark:hover:bg-muted-dark/50 rounded transition-colors group">
                            <span className="text-gray-700 dark:text-gray-300">{tag.name}</span>
                            <button
                              onClick={() => handleDeleteSystemTag(tag.id)}
                              className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              title="Excluir tag do sistema"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {availableTags.length === 0 && (
                          <p className="text-xs text-gray-400 italic">Nenhuma tag cadastrada.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Action button removed */}

            <div className="mt-6 pt-6 border-t border-primary/10">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-primary" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Controle do Agente</h4>
              </div>

              <div className="mb-4">
                {contact.timeout && new Date(contact.timeout) > new Date() ? (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg flex items-start gap-3">
                    <PauseCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-800 dark:text-red-300">
                        {new Date(contact.timeout).getFullYear() > new Date().getFullYear() + 50
                          ? 'Bloqueio Permanente'
                          : 'Atendimento Pausado'}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {new Date(contact.timeout).getFullYear() > new Date().getFullYear() + 50
                          ? 'O robô não irá interagir até que seja reativado manualmente.'
                          : `Até: ${new Date(contact.timeout).toLocaleDateString('pt-BR')} às ${new Date(contact.timeout).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white/50 dark:bg-black/20 border border-primary/10 rounded-lg flex items-center gap-3">
                    <PlayCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-sm font-bold text-green-800 dark:text-green-300">Agente Ativo</p>
                      <p className="text-xs text-green-600 dark:text-green-400">Interagindo normalmente.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={actionMenuRef}>
                <button
                  onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                  className="w-full flex items-center justify-between rounded-lg border border-primary/20 bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm hover:bg-white/80 dark:hover:bg-muted-dark focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm px-4 py-2.5"
                >
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium">
                    {contact.timeout && new Date(contact.timeout) > new Date() ? 'Gerenciar Bloqueio' : 'Pausar ou Bloquear'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isActionMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isActionMenuOpen && (
                  <div className="absolute z-10 mb-2 bottom-full w-full max-h-64 overflow-y-auto overflow-x-hidden rounded-xl bg-white dark:bg-card-dark shadow-xl ring-1 ring-black/5 dark:ring-white/10 p-1 animate-in fade-in zoom-in-95 duration-100 transform origin-bottom right-0">
                    <p className="px-3 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Pausar Temporariamente
                    </p>

                    {[
                      { label: 'Pausar por 1 hora', value: '1h', icon: Clock, color: 'text-orange-500' },
                      { label: 'Pausar por 2 horas', value: '2h', icon: Clock, color: 'text-orange-500' },
                      { label: 'Pausar por 12 horas', value: '12h', icon: Clock, color: 'text-orange-600' },
                      { label: 'Pausar por 24 horas', value: '24h', icon: Clock, color: 'text-orange-600' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          handleBlockAgent(option.value as any);
                          setIsActionMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors group"
                      >
                        <div className={`p-1.5 rounded-md bg-orange-100 dark:bg-orange-900/30 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors ${option.color}`}>
                          <option.icon className="w-4 h-4" />
                        </div>
                        {option.label}
                      </button>
                    ))}

                    <div className="h-px bg-gray-100 dark:bg-border-dark my-1" />

                    <button
                      onClick={() => {
                        setShowCustomTimeout(true);
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group"
                    >
                      <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors text-blue-600 dark:text-blue-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      Agendar retorno personalizado...
                    </button>

                    <div className="h-px bg-gray-100 dark:bg-border-dark my-1" />

                    <button
                      onClick={() => {
                        handleBlockAgent('permanent');
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
                    >
                      <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors text-red-600 dark:text-red-400">
                        <Ban className="w-4 h-4" />
                      </div>
                      Bloquear Permanentemente
                    </button>

                    {(contact.timeout && new Date(contact.timeout) > new Date()) && (
                      <>
                        <div className="h-px bg-gray-100 dark:bg-border-dark my-1" />
                        <button
                          onClick={() => {
                            handleBlockAgent('unblock');
                            setIsActionMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors group"
                        >
                          <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors text-green-600 dark:text-green-400">
                            <PlayCircle className="w-4 h-4" />
                          </div>
                          Reativar Atendimento Agora
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {showCustomTimeout && (
                <div className="mt-3 p-3 bg-white dark:bg-muted-dark rounded-lg border border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Data e Hora de Retorno</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-input-dark text-gray-900 dark:text-white text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm mb-3 appearance-none dark:[color-scheme:dark]"
                    value={customTimeoutDate}
                    onChange={(e) => setCustomTimeoutDate(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowCustomTimeout(false);
                        setCustomTimeoutDate('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleBlockAgent('custom', customTimeoutDate)}
                      disabled={!customTimeoutDate}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {contact && (
        <EditContactModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSave}
          initialData={contact}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone,
  Brain,
  Pencil,
  Save,
  X,
  Building2,
  User,
  MapPin,
  Briefcase,
  Trash2
} from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');
  const [showTagInput, setShowTagInput] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [countryCode, setCountryCode] = useState('+55');

  const countries = [
    { code: '+55', name: 'Brasil', flag: '🇧🇷', format: '(XX) XXXXX-XXXX' },
    { code: '+1', name: 'EUA', flag: '🇺🇸', format: '(XXX) XXX-XXXX' },
    { code: '+44', name: 'Reino Unido', flag: '🇬🇧', format: 'XXXX XXXXXX' },
    { code: '+351', name: 'Portugal', flag: '🇵🇹', format: 'XXX XXX XXX' },
    { code: '+34', name: 'Espanha', flag: '🇪🇸', format: 'XXX XXX XXX' },
    { code: '+54', name: 'Argentina', flag: '🇦🇷', format: 'XX XXXX-XXXX' },
    { code: '+56', name: 'Chile', flag: '🇨🇱', format: 'X XXXX XXXX' },
    { code: '+52', name: 'México', flag: '🇲🇽', format: 'XX XXXX XXXX' }
  ];

  // Form state
  const [formData, setFormData] = useState({
    nome_completo: '',
    cpf: '',
    email: '',
    telefone: '',
    empresa: '',
    cargo: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    observacoes: '',
    status: 'Lead',
    origem: '',
    aceita_whatsapp: true,
    aceita_email: true
  });

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

      // Extract country code logic
      let phone = data.telefone || '';
      let extractedCountryCode = '+55';

      const knownCodes = ['+55', '+1', '+44', '+351', '+34', '+54', '+56', '+52'];
      let foundCode = false;

      for (const code of knownCodes) {
        if (phone.startsWith(code)) {
          extractedCountryCode = code;
          phone = phone.substring(code.length).replace(/\D/g, '');
          foundCode = true;
          break;
        }
      }

      if (!foundCode) {
        const phoneMatchPlus = phone.match(/^(\+\d{1,3})\s*(.*)/);
        if (phoneMatchPlus) {
          extractedCountryCode = phoneMatchPlus[1];
          phone = phoneMatchPlus[2].replace(/\D/g, '');
        } else {
          const numbersOnly = phone.replace(/\D/g, '');
          if (numbersOnly.startsWith('55') && numbersOnly.length >= 12) {
            extractedCountryCode = '+55';
            phone = numbersOnly.substring(2);
          } else if (numbersOnly.startsWith('1') && numbersOnly.length === 11) {
            extractedCountryCode = '+1';
            phone = numbersOnly.substring(1);
          } else {
            phone = numbersOnly;
          }
        }
      }

      // Format phone
      if (extractedCountryCode === '+55' && phone.length > 0) {
        phone = phone.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
      } else if (extractedCountryCode === '+1' && phone.length > 0) {
        phone = phone.replace(/(\d{3})(\d)/, '($1) $2').replace(/(\d{3})(\d)/, '$1-$2');
      }

      setCountryCode(extractedCountryCode);

      setFormData({
        nome_completo: data.nome_completo || '',
        cpf: data.cpf || '',
        email: data.email || '',
        telefone: phone,
        empresa: data.empresa || '',
        cargo: data.cargo || '',
        cep: data.cep || '',
        endereco: data.endereco || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        observacoes: data.observacoes || '',
        status: data.status || 'Lead',
        origem: data.origem || '',
        aceita_whatsapp: data.aceita_whatsapp ?? true,
        aceita_email: data.aceita_email ?? true,
        tags: data.tags || []
      });
    } catch (error) {
      console.error('Error fetching contact:', error);
      toastError('Erro ao carregar detalhes do contato');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field === 'cpf' && typeof value === 'string') {
      const numbers = value.replace(/\D/g, '').slice(0, 11);
      let formatted = numbers;
      if (numbers.length > 0) {
        formatted = numbers
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      }
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else if (field === 'cep' && typeof value === 'string') {
      const numbers = value.replace(/\D/g, '').slice(0, 8);
      let formatted = numbers;
      if (numbers.length > 5) {
        formatted = numbers.replace(/(\d{5})(\d)/, '$1-$2');
      }
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else if (field === 'telefone' && typeof value === 'string') {
      const numbers = value.replace(/\D/g, '');
      let formatted = numbers;

      if (countryCode === '+55') {
        formatted = numbers.slice(0, 11);
        if (formatted.length > 0) {
          formatted = formatted
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2');
        }
      } else if (countryCode === '+1') {
        formatted = numbers.slice(0, 10);
        if (formatted.length > 0) {
          formatted = formatted
            .replace(/(\d{3})(\d)/, '($1) $2')
            .replace(/(\d{3})(\d)/, '$1-$2');
        }
      } else {
        formatted = numbers.slice(0, 15);
        if (formatted.length > 3) {
          formatted = formatted.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
        }
      }
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSave = async () => {
    if (!id) return;

    try {
      setSaving(true);

      const cleanValue = (val: string) => {
        if (!val) return null;
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed;
      };

      const phoneDigits = formData.telefone.replace(/\D/g, '');
      const finalPhone = phoneDigits.length > 0 ? `${countryCode}${phoneDigits}` : null;

      const updates = {
        ...formData,
        cpf: cleanValue(formData.cpf),
        cep: cleanValue(formData.cep),
        bairro: cleanValue(formData.bairro),
        cidade: cleanValue(formData.cidade),
        estado: cleanValue(formData.estado),
        telefone: finalPhone || ''
      };

      await updateContact(id, updates);

      const updatedContact = await getContact(id);
      setContact(updatedContact);
      setIsEditing(false);
      toastSuccess('Contato atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating contact:', error);
      toastError('Erro ao atualizar contato');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    fetchContactDetails(); // Reload original data
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAddTag = async (tagName: string) => {
    const currentTags = formData.tags || [];
    if (currentTags.includes(tagName)) return;

    const newTags = [...currentTags, tagName];

    if (isEditing) {
      setFormData(prev => ({ ...prev, tags: newTags }));
    } else {
      // Instant save
      try {
        setFormData(prev => ({ ...prev, tags: newTags })); // Optimistic update
        if (id) {
          await updateContact(id, { tags: newTags });
          setContact(prev => prev ? { ...prev, tags: newTags } : null);
          toastSuccess('Tag adicionada!');
        }
      } catch (error) {
        console.error('Error adding tag:', error);
        toastError('Erro ao adicionar tag');
        fetchContactDetails(); // Revert on error
      }
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    const currentTags = formData.tags || [];
    const newTags = currentTags.filter(t => t !== tagName);

    if (isEditing) {
      setFormData(prev => ({ ...prev, tags: newTags }));
    } else {
      // Instant save
      try {
        setFormData(prev => ({ ...prev, tags: newTags })); // Optimistic update
        if (id) {
          await updateContact(id, { tags: newTags });
          setContact(prev => prev ? { ...prev, tags: newTags } : null);
          toastSuccess('Tag removida!');
        }
      } catch (error) {
        console.error('Error removing tag:', error);
        toastError('Erro ao remover tag');
        fetchContactDetails(); // Revert on error
      }
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
          <div className="flex w-full gap-3 md:w-auto">
            {/* Buttons removed */}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left/Main Column */}
        <div className="xl:col-span-2 flex flex-col gap-8">
          {/* Tabs */}
          <nav className="border-b border-border-light dark:border-border-dark">
            <div className="flex gap-8 overflow-x-auto scrollbar-hide">
              <button className="flex items-center justify-center border-b-2 border-primary pb-3 px-1 whitespace-nowrap">
                <p className="text-primary text-sm font-semibold">Dados Cadastrais</p>
              </button>
              <button className="flex items-center justify-center border-b-2 border-transparent pb-3 px-1 whitespace-nowrap">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-semibold">Histórico de Conversas</p>
              </button>
            </div>
          </nav>

          {/* Informações Gerais Section */}
          <section className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark">
            <header className="flex flex-wrap justify-between items-center gap-3 p-6 border-b border-border-light dark:border-border-dark">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Informações de Contato</h2>
              {isEditing ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span className="truncate">{saving ? 'Salvando...' : 'Salvar'}</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-gray-100 dark:bg-muted-dark text-gray-700 dark:text-gray-400 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-input-dark transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span className="truncate">Cancelar</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-gray-100 dark:bg-muted-dark text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-input-dark transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="truncate">Editar</span>
                </button>
              )}
            </header>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Nome Completo</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.nome_completo}
                    onChange={(e) => handleInputChange('nome_completo', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.nome_completo}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">CPF</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => handleInputChange('cpf', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.cpf || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.email || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Telefone</label>
                {isEditing ? (
                  <div className="flex gap-2 mt-1.5">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                    >
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={formData.telefone}
                      onChange={(e) => handleInputChange('telefone', e.target.value)}
                      placeholder={countries.find(c => c.code === countryCode)?.format || ''}
                      className="flex-1 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                    />
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">
                    {contact.telefone ? (
                      contact.telefone.startsWith(countryCode)
                        ? contact.telefone.replace(countryCode, `${countryCode} `)
                        : `${countryCode} ${contact.telefone}`
                    ) : '-'}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Endereço</label>
                {isEditing ? (
                  <textarea
                    value={formData.endereco}
                    onChange={(e) => handleInputChange('endereco', e.target.value)}
                    rows={2}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2 resize-none"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.endereco || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">CEP</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.cep}
                    onChange={(e) => handleInputChange('cep', e.target.value)}
                    placeholder="00000-000"
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.cep || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Bairro</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.bairro}
                    onChange={(e) => handleInputChange('bairro', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.bairro || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cidade</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.cidade}
                    onChange={(e) => handleInputChange('cidade', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.cidade || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Estado</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.estado}
                    onChange={(e) => handleInputChange('estado', e.target.value)}
                    maxLength={2}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2 uppercase"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.estado || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Empresa</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.empresa}
                    onChange={(e) => handleInputChange('empresa', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.empresa || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cargo</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.cargo}
                    onChange={(e) => handleInputChange('cargo', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.cargo || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Origem</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.origem}
                    onChange={(e) => handleInputChange('origem', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.origem || '-'}</p>
                )}
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.aceita_whatsapp}
                    onChange={(e) => handleInputChange('aceita_whatsapp', e.target.checked)}
                    disabled={!isEditing}
                    className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Aceita WhatsApp</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.aceita_email}
                    onChange={(e) => handleInputChange('aceita_email', e.target.checked)}
                    disabled={!isEditing}
                    className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Aceita Email</label>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</label>
                {isEditing ? (
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2"
                  >
                    <option value="Lead">Lead</option>
                    <option value="Cliente">Cliente</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.status}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Observações</label>
                {isEditing ? (
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => handleInputChange('observacoes', e.target.value)}
                    rows={3}
                    className="w-full mt-1.5 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2 resize-none"
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{contact.observacoes || '-'}</p>
                )}
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
                  {(formData.tags || []).map((tagName, index) => (
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
                          <option key={tag.id} value={tag.name} disabled={formData.tags?.includes(tag.name)}>
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
          </div>
        </aside>
      </div>
    </div>
  );
};

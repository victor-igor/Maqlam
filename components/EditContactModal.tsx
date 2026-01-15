import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, FileText, Save, Home, AlignLeft, Building2, Briefcase } from 'lucide-react';
import { Contact } from '../lib/contacts';

interface EditContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Contact>) => Promise<void>;
    initialData: Contact;
}

type TabType = 'pessoal' | 'endereco';

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

export const EditContactModal: React.FC<EditContactModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<Contact>(initialData);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('pessoal');
    const [countryCode, setCountryCode] = useState('+55');

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData);

            // Extract country code and format phone
            let phone = initialData.telefone || '';
            let extractedCode = '+55';
            let localPhone = '';

            if (phone) {
                // Find matching country code
                const foundCountry = countries.find(c => phone.startsWith(c.code));
                if (foundCountry) {
                    extractedCode = foundCountry.code;
                    localPhone = phone.substring(foundCountry.code.length);
                } else if (phone.startsWith('+')) {
                    // Has + but unknown code, extract digits
                    localPhone = phone.replace(/\D/g, '');
                } else {
                    localPhone = phone;
                }

                // Format the local phone based on country code
                const digits = localPhone.replace(/\D/g, '');
                if (extractedCode === '+55' && digits.length > 0) {
                    localPhone = digits
                        .slice(0, 11)
                        .replace(/(\d{2})(\d)/, '($1) $2')
                        .replace(/(\d{5})(\d)/, '$1-$2');
                } else if (extractedCode === '+1' && digits.length > 0) {
                    localPhone = digits
                        .slice(0, 10)
                        .replace(/(\d{3})(\d)/, '($1) $2')
                        .replace(/(\d{3})(\d)/, '$1-$2');
                } else {
                    localPhone = digits;
                }
            }

            setCountryCode(extractedCode);
            setFormData(prev => ({
                ...prev,
                telefone: localPhone
            }));
            setActiveTab('pessoal');
        }
    }, [isOpen, initialData]);

    const handleInputChange = (field: keyof Contact, value: any) => {
        if (field === 'telefone') {
            // Format phone based on country
            const numbers = value.replace(/\D/g, '');
            let formatted = numbers;

            if (countryCode === '+55') {
                if (numbers.startsWith('55') && numbers.length > 11) {
                    formatted = numbers.substring(2).slice(0, 11);
                } else {
                    formatted = numbers.slice(0, 11);
                }
                if (formatted.length > 0) {
                    formatted = formatted
                        .replace(/(\d{2})(\d)/, '($1) $2')
                        .replace(/(\d{5})(\d)/, '$1-$2');
                }
            } else if (countryCode === '+1') {
                if (numbers.startsWith('1') && numbers.length > 10) {
                    formatted = numbers.substring(1).slice(0, 10);
                } else {
                    formatted = numbers.slice(0, 10);
                }
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
        } else if (field === 'cpf') {
            const numbers = value.replace(/\D/g, '').slice(0, 11);
            let formatted = numbers;
            if (numbers.length > 0) {
                formatted = numbers
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            }
            setFormData(prev => ({ ...prev, [field]: formatted }));
        } else if (field === 'cep') {
            const numbers = value.replace(/\D/g, '').slice(0, 8);
            let formatted = numbers;
            if (numbers.length > 5) {
                formatted = numbers.replace(/(\d{5})(\d)/, '$1-$2');
            }
            setFormData(prev => ({ ...prev, [field]: formatted }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleSubmit = async () => {
        try {
            setSaving(true);
            // Prepare data with full phone number including country code
            const dataToSave = {
                ...formData,
                telefone: formData.telefone ? `${countryCode}${formData.telefone.replace(/\D/g, '')}` : ''
            };
            await onSave(dataToSave);
            onClose();
        } catch (error) {
            console.error('Error saving contact info:', error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'pessoal' as TabType, label: 'Dados Cadastrais', icon: User },
        { id: 'endereco' as TabType, label: 'Endereço e Outros', icon: MapPin },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-card-dark rounded-xl shadow-xl w-full max-w-2xl border border-border-light dark:border-border-dark flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-border-light dark:border-border-dark">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editar contato</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border-light dark:border-border-dark px-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'pessoal' && (
                        <div className="space-y-6">
                            <div>
                                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    <User className="w-3.5 h-3.5" />
                                    Nome Completo
                                </label>
                                <input
                                    type="text"
                                    value={formData.nome_completo}
                                    onChange={(e) => handleInputChange('nome_completo', e.target.value)}
                                    className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder="Nome do contato"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <FileText className="w-3.5 h-3.5" />
                                        CPF
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cpf || ''}
                                        onChange={(e) => handleInputChange('cpf', e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Building2 className="w-3.5 h-3.5" />
                                        Empresa
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.empresa || ''}
                                        onChange={(e) => handleInputChange('empresa', e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Briefcase className="w-3.5 h-3.5" />
                                        Cargo
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cargo || ''}
                                        onChange={(e) => handleInputChange('cargo', e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Briefcase className="w-3.5 h-3.5" />
                                        Status
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => handleInputChange('status', e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    >
                                        <option value="Lead">Lead</option>
                                        <option value="Cliente">Cliente</option>
                                        <option value="Inativo">Inativo</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    <FileText className="w-3.5 h-3.5" />
                                    Origem
                                </label>
                                <input
                                    type="text"
                                    value={formData.origem || ''}
                                    onChange={(e) => handleInputChange('origem', e.target.value)}
                                    className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Phone className="w-3.5 h-3.5" />
                                        Telefone
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={countryCode}
                                            onChange={(e) => setCountryCode(e.target.value)}
                                            className="w-[100px] flex-shrink-0 text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                                            className="flex-1 min-w-0 text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                            placeholder={countries.find(c => c.code === countryCode)?.format || ''}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Mail className="w-3.5 h-3.5" />
                                        E-mail
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        placeholder="email@exemplo.com"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-6 mt-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.aceita_whatsapp}
                                        onChange={(e) => handleInputChange('aceita_whatsapp', e.target.checked)}
                                        className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Aceita WhatsApp</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.aceita_email}
                                        onChange={(e) => handleInputChange('aceita_email', e.target.checked)}
                                        className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Aceita Email</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'endereco' && (
                        <div className="space-y-6">
                            <div>
                                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    Endereço Completo
                                </label>
                                <textarea
                                    value={formData.endereco || ''}
                                    onChange={(e) => handleInputChange('endereco', e.target.value)}
                                    rows={3}
                                    className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                    placeholder="Rua, número, complemento"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        CEP
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cep || ''}
                                        onChange={(e) => handleInputChange('cep', e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        placeholder="00000-000"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Home className="w-3.5 h-3.5" />
                                        Bairro
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.bairro || ''}
                                        onChange={(e) => handleInputChange('bairro', e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        Cidade
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cidade || ''}
                                        onChange={(e) => handleInputChange('cidade', e.target.value)}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        Estado
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.estado || ''}
                                        onChange={(e) => handleInputChange('estado', e.target.value)}
                                        maxLength={2}
                                        className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all uppercase"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    <AlignLeft className="w-3.5 h-3.5" />
                                    Observações
                                </label>
                                <textarea
                                    value={formData.observacoes || ''}
                                    onChange={(e) => handleInputChange('observacoes', e.target.value)}
                                    rows={4}
                                    className="w-full text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-muted-dark/30 rounded-b-xl">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-card-dark border border-gray-300 dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            'Salvando...'
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Salvar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

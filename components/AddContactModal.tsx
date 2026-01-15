import React, { useState } from 'react';
import { X, User, Phone, Mail, MapPin, Building2, Save } from 'lucide-react';
import { createContact, Contact } from '../lib/contacts';
import { useToast } from '../contexts/ToastContext';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const countries = [
  { code: '+55', name: 'Brasil', flag: '🇧🇷', format: '(XX) XXXXX-XXXX' },
  { code: '+1', name: 'EUA', flag: '🇺🇸', format: '(XXX) XXX-XXXX' },
];

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose }) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Contact>>({
    aceita_whatsapp: true,
    aceita_email: true,
    status: 'Lead'
  });
  const [countryCode, setCountryCode] = useState('+55');

  if (!isOpen) return null;

  const handleInputChange = (field: keyof Contact, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (!formData.nome_completo || !formData.telefone) {
        toastError('Nome e Telefone são obrigatórios');
        return;
      }

      setSaving(true);

      // Format phone with country code
      const cleanPhone = formData.telefone.replace(/\D/g, '');
      const finalPhone = `${countryCode}${cleanPhone}`;

      await createContact({
        nome_completo: formData.nome_completo,
        telefone: finalPhone,
        email: formData.email || '',
        empresa: formData.empresa || '',
        // Add other fields as needed
        aceita_whatsapp: formData.aceita_whatsapp,
        aceita_email: formData.aceita_email,
        status: formData.status || 'Lead',
        endereco: formData.endereco,
        // ... propagate other fields
      } as any);

      toastSuccess('Contato criado com sucesso!');
      onClose();
      window.location.reload(); // Refresh to show new contact
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toastError('Erro ao criar contato: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-card-dark rounded-xl shadow-xl w-full max-w-lg border border-border-light dark:border-border-dark flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border-light dark:border-border-dark">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Adicionar Novo Contato</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Nome Completo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={formData.nome_completo || ''}
                onChange={(e) => handleInputChange('nome_completo', e.target.value)}
                className="block w-full pl-10 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2.5 transition-colors"
                placeholder="Ex: Ana Carolina Souza"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Telefone / WhatsApp</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-[80px] text-sm bg-gray-50 dark:bg-input-dark border border-gray-300 dark:border-border-dark rounded-lg p-2 focus:ring-primary focus:border-primary outline-none"
                >
                  {countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
                <input
                  type="tel"
                  value={formData.telefone || ''}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2.5 transition-colors"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Empresa</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={formData.empresa || ''}
                  onChange={(e) => handleInputChange('empresa', e.target.value)}
                  className="block w-full pl-10 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2.5 transition-colors"
                  placeholder="Nome da Empresa"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Email Corporativo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="block w-full pl-10 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2.5 transition-colors"
                placeholder="email@empresa.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Endereço</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-start pt-3 pointer-events-none">
                <MapPin className="h-4 w-4 text-gray-400" />
              </div>
              <textarea
                rows={3}
                value={formData.endereco || ''}
                onChange={(e) => handleInputChange('endereco', e.target.value)}
                className="block w-full pl-10 rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2.5 transition-colors resize-none"
                placeholder="Rua, Número, Bairro - Cidade/UF"
              />
            </div>
          </div>
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
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Contato'}
          </button>
        </div>
      </div>
    </div>
  );
};

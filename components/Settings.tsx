import React, { useState, useEffect } from 'react';
import {
  User,
  Smartphone,
  ShieldBan,
  Save,
  Camera,
  Loader2,
  LogOut,
  Trash2
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { getCurrentUserProfile, updateUser, UserProfile } from '../lib/auth';
import { PhotoCropper } from './PhotoCropper';
import { ConfirmDialog } from './ConfirmDialog';
import { InstancesManager } from './InstancesManager';
import { BlacklistSettings } from './BlacklistSettings';

type SettingsTab = 'profile' | 'instances' | 'blacklist';

export const Settings: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cargo: '',
    especialidade: '',
    crmv: ''
  });

  // Photo Upload States
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeletePhotoDialog, setShowDeletePhotoDialog] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profile = await getCurrentUserProfile();
      if (profile) {
        setUserProfile(profile);
        setFormData({
          nome: profile.nome || '',
          email: profile.email || '',
          telefone: profile.telefone || '',
          cargo: profile.cargo || '',
          especialidade: profile.especialidade || '',
          crmv: profile.crmv || ''
        });
      }
    } catch (err) {
      console.error(err);
      toastError('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;

    try {
      setSaving(true);
      await updateUser(userProfile.id, {
        nome: formData.nome,
        telefone: formData.telefone,
        cargo: formData.cargo,
        especialidade: formData.especialidade,
        crmv: formData.crmv
      });
      success('Perfil atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      toastError('Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!userProfile) return;

    try {
      setUploadingPhoto(true);
      setShowCropper(false);

      const fileName = `${userProfile.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars') // Certifique-se que este bucket existe!
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update User Profile
      await updateUser(userProfile.id, {
        foto_perfil_url: publicUrl
      });

      setUserProfile(prev => prev ? { ...prev, foto_perfil_url: publicUrl } : null);
      success('Foto de perfil atualizada!');
    } catch (err) {
      console.error(err);
      toastError('Erro ao atualizar foto');
    } finally {
      setUploadingPhoto(false);
      setSelectedImage(null);
    }
  };

  const handleDeletePhoto = async () => {
    if (!userProfile?.foto_perfil_url) return;

    try {
      // Extract file path from URL if needed, or just update profile to null
      // For simplicity, we just unlink it from the profile
      await updateUser(userProfile.id, {
        foto_perfil_url: null
      });

      setUserProfile(prev => prev ? { ...prev, foto_perfil_url: null } : null);
      success('Foto de perfil removida');
    } catch (err) {
      console.error(err);
      toastError('Erro ao remover foto');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'instances', label: 'Instâncias', icon: Smartphone },
    { id: 'blacklist', label: 'Blacklist', icon: ShieldBan },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Settings Navigation */}
        <div className="lg:col-span-3">
          <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap
                    ${isActive
                      ? 'bg-primary text-black shadow-md shadow-primary/20'
                      : 'bg-white dark:bg-card-dark text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-muted-dark'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-6">

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
              <div className="p-6 border-b border-border-light dark:border-border-dark">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Informações do Perfil</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Atualize sua foto e detalhes pessoais.</p>
              </div>
              <div className="p-6 space-y-8">
                {/* Photo Upload Section */}
                <div className="flex items-center gap-6">
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-secondary p-1">
                      <div className="w-full h-full rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden relative">
                        {userProfile?.foto_perfil_url ? (
                          <img src={userProfile.foto_perfil_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                            <User className="w-10 h-10" />
                          </div>
                        )}
                        {uploadingPhoto && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="w-8 h-8 text-white" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                        disabled={uploadingPhoto}
                      />
                    </label>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{userProfile?.nome || 'Usuário'}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 capitalize">{userProfile?.role || 'Funcionário'}</p>
                    <div className="flex gap-2">
                      <label className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer">
                        Alterar Foto
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileSelect}
                          disabled={uploadingPhoto}
                        />
                      </label>
                      {userProfile?.foto_perfil_url && (
                        <button
                          onClick={() => setShowDeletePhotoDialog(true)}
                          className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Nome Completo</label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary px-3 py-2.5 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-gray-100 dark:bg-muted-dark text-gray-500 dark:text-gray-400 shadow-sm px-3 py-2.5 sm:text-sm cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Telefone</label>
                    <input
                      type="tel"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary px-3 py-2.5 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Cargo</label>
                    <input
                      type="text"
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary px-3 py-2.5 sm:text-sm"
                    />
                  </div>
                  {(userProfile?.role === 'veterinario' || userProfile?.role === 'admin' || userProfile?.role === 'gestor') && (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Especialidade</label>
                        <input
                          type="text"
                          value={formData.especialidade}
                          onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                          className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary px-3 py-2.5 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">CRMV</label>
                        <input
                          type="text"
                          value={formData.crmv}
                          onChange={(e) => setFormData({ ...formData, crmv: e.target.value })}
                          className="w-full rounded-lg border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary px-3 py-2.5 sm:text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-muted-dark/30 border-t border-border-light dark:border-border-dark flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-70"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Alterações
                </button>
              </div>
            </div>
          )}

          {/* Instances Tab */}
          {activeTab === 'instances' && (
            <InstancesManager />
          )}

          {/* Blacklist Tab */}
          {activeTab === 'blacklist' && (
            <BlacklistSettings />
          )}

        </div>
      </div>

      {/* Photo Cropper Modal */}
      {showCropper && selectedImage && (
        <PhotoCropper
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setSelectedImage(null);
          }}
          aspect={1}
        />
      )}

      {/* Delete Photo Confirmation */}
      <ConfirmDialog
        isOpen={showDeletePhotoDialog}
        onClose={() => setShowDeletePhotoDialog(false)}
        onConfirm={handleDeletePhoto}
        title="Remover Foto"
        message="Tem certeza que deseja remover sua foto de perfil?"
        confirmText="Remover"
        type="delete"
      />
    </div>
  );
};
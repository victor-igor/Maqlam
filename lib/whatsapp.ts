
import { supabase } from './supabase';

const UAZAPI_URL = 'https://eloscope.uazapi.com';
const ADMIN_TOKEN = '0CeF8Tm8BiSvEH68Mv1NmycMxoo9dvCVCgUx5ZjvsmTacGXvlZ'; // ⚠️ Em produção, use variáveis de ambiente ou Edge Functions!

export interface WhatsAppInstance {
    id: string; // UUID do Supabase
    instance_id: string; // ID da Uazapi
    name: string;
    status: 'connected' | 'disconnected' | 'connecting' | 'open';
    last_connection?: string;
    battery?: number;
    phone?: string;
    profile_pic_url?: string; // URL da foto de perfil (snake_case para bater com o banco)
    is_active_for_campaigns?: boolean;
}

// Helper para headers
// Se tiver token, manda APENAS o token (conforme solicitado).
// Se não tiver, manda o admintoken (para criar instância).
const getHeaders = (token?: string) => {
    if (token) {
        return {
            'Content-Type': 'application/json',
            'token': token
        };
    }
    return {
        'Content-Type': 'application/json',
        'admintoken': ADMIN_TOKEN
    };
};

export const whatsappService = {
    // 1. Criar Instância
    async createInstance(name: string) {
        try {
            // Verificar limite de instâncias (Máximo 5)
            const { count, error: countError } = await supabase
                .from('whatsapp_instances')
                .select('*', { count: 'exact', head: true });

            if (countError) {
                console.error('Erro ao verificar limite de instâncias:', countError);
                throw new Error('Erro ao verificar limite de instâncias');
            }

            if (count !== null && count >= 5) {
                throw new Error('Limite máximo de 5 instâncias atingido. Exclua uma para criar nova.');
            }

            console.log('Iniciando criação de instância na Uazapi:', name);
            // Chamada à API Uazapi
            const response = await fetch(`${UAZAPI_URL}/instance/init`, {
                method: 'POST',
                headers: getHeaders(), // Usa admintoken
                body: JSON.stringify({
                    name,
                    systemName: 'ReabilitaCao',
                    adminField01: 'reabilita-cao-admin'
                })
            });

            const data = await response.json();
            console.log('Resposta da Uazapi (JSON):', JSON.stringify(data, null, 2));

            if (!response.ok) {
                throw new Error(data.message || 'Erro ao criar instância na Uazapi');
            }

            // Normalizar dados (pode vir como array ou objeto)
            const responseData = Array.isArray(data) ? data[0] : data;

            // Extrair ID e Token (pode vir aninhado em 'instance' ou na raiz)
            const instanceData = responseData.instance || responseData;

            const instanceId = instanceData.id || instanceData.instanceId || responseData.instanceId || responseData.id || responseData.key;
            const token = responseData.token || instanceData.token;

            if (!instanceId) {
                console.error('Resposta da Uazapi sem ID conhecido:', JSON.stringify(data, null, 2));
                throw new Error('API Uazapi retornou sucesso mas sem ID da instância. Veja o console.');
            }

            // Salvar no Supabase
            console.log('Tentando salvar no Supabase:', {
                instance_id: instanceId,
                name: responseData.name || name,
                token: token ? '***' : 'MISSING',
                status: 'disconnected'
            });

            const { data: dbData, error } = await supabase
                .from('whatsapp_instances')
                .insert({
                    instance_id: instanceId,
                    name: responseData.name || name,
                    token: token, // ⚠️ Token salvo no banco
                    status: 'disconnected'
                })
                .select()
                .single();

            if (error) {
                console.error('Erro detalhado do Supabase (Insert):', error);
                throw error;
            }

            console.log('Instância salva no Supabase:', dbData);
            return dbData;
        } catch (error) {
            console.error('Erro ao criar instância (Catch):', error);
            throw error;
        }
    },

    // 2. Listar Instâncias (Do Banco + Sync Opcional)
    async listInstances() {
        try {
            console.log('Listando instâncias do Supabase...');
            const { data, error } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro detalhado do Supabase (Select):', error);
                throw error;
            }
            console.log('Instâncias carregadas:', data);
            return data as WhatsAppInstance[];
        } catch (error) {
            console.error('Erro ao listar instâncias:', error);
            throw error;
        }
    },

    // 3. Conectar Instância (Gerar QR Code)
    async connectInstance(id: string) {
        try {
            // Buscar token no banco
            const { data: instance, error } = await supabase
                .from('whatsapp_instances')
                .select('token, instance_id')
                .eq('id', id)
                .single();

            if (error || !instance) throw new Error('Instância não encontrada');

            const headers = getHeaders(instance.token);
            console.log('Conectando com headers:', headers);

            // Chamada à API - SEM BODY
            const response = await fetch(`${UAZAPI_URL}/instance/connect`, {
                method: 'POST',
                headers: headers
            });

            const responseData = await response.json().catch(() => ({}));
            console.log('Resposta do Connect:', JSON.stringify(responseData, null, 2));

            // Normalizar QR Code no retorno do Connect também
            if (responseData.instance) {
                if (responseData.instance.qrcode && !responseData.qr) responseData.qr = responseData.instance.qrcode;
                if (responseData.instance.qr && !responseData.qr) responseData.qr = responseData.instance.qr;
            }
            if (responseData.qrcode && !responseData.qr) responseData.qr = responseData.qrcode;
            if (responseData.base64 && !responseData.qr) responseData.qr = responseData.base64;

            if (response.status === 409) {
                console.warn('Instância já conectada ou em conflito (409). Verificando status...');
                return responseData;
            }

            if (!response.ok) {
                console.error('Erro ao conectar:', responseData);
                throw new Error(`Erro ao conectar: ${response.status}`);
            }

            // Atualizar status local para connecting
            await supabase
                .from('whatsapp_instances')
                .update({ status: 'connecting' })
                .eq('id', id);

            return responseData;
        } catch (error) {
            console.error('Erro ao conectar instância:', error);
            throw error;
        }
    },

    // 4. Obter Status (Polling)
    async getInstanceStatus(id: string) {
        try {
            const { data: instance, error } = await supabase
                .from('whatsapp_instances')
                .select('token, instance_id')
                .eq('id', id)
                .single();

            if (error || !instance) throw new Error('Instância não encontrada');

            const response = await fetch(`${UAZAPI_URL}/instance/status`, {
                method: 'GET',
                headers: getHeaders(instance.token)
            });

            const data = await response.json();
            console.log('Status da Instância (Polling) - RAW:', JSON.stringify(data, null, 2));

            // Normalizar QR Code (pode vir aninhado em 'instance')
            if (data.instance) {
                if (data.instance.qrcode && !data.qr) data.qr = data.instance.qrcode;
                if (data.instance.qr && !data.qr) data.qr = data.instance.qr;
            }

            // Fallbacks padrão
            if (data.qrcode && !data.qr) data.qr = data.qrcode;
            if (data.base64 && !data.qr) data.qr = data.base64;

            // Extrair Profile Pic
            let profilePicUrl = data.profilePicUrl;
            if (data.instance && data.instance.profilePicUrl) {
                profilePicUrl = data.instance.profilePicUrl;
            }

            console.log('Profile Pic URL Extraída:', profilePicUrl);

            // Atualizar status no banco se mudou
            if (data.status || profilePicUrl) {
                // O status pode vir aninhado também
                let statusStr = 'unknown';
                if (typeof data.status === 'string') {
                    statusStr = data.status;
                } else if (data.instance && data.instance.status) {
                    statusStr = data.instance.status;
                } else if (data.status && data.status.loggedIn) {
                    statusStr = 'connected';
                }

                // Preparar objeto de update
                const updateData: any = {};
                if (statusStr !== 'unknown') updateData.status = statusStr;
                if (profilePicUrl) updateData.profile_pic_url = profilePicUrl;

                if (Object.keys(updateData).length > 0) {
                    console.log('Atualizando banco com:', updateData);
                    await supabase
                        .from('whatsapp_instances')
                        .update(updateData)
                        .eq('id', id);
                }
            }

            return data; // Retorna { status, qr, pairingCode, ... }
        } catch (error) {
            console.error('Erro ao obter status:', error);
            return null;
        }
    },

    // 5. Desconectar
    async disconnectInstance(id: string) {
        try {
            const { data: instance, error } = await supabase
                .from('whatsapp_instances')
                .select('token')
                .eq('id', id)
                .single();

            if (error || !instance) throw new Error('Instância não encontrada');

            await fetch(`${UAZAPI_URL}/instance/disconnect`, {
                method: 'POST',
                headers: getHeaders(instance.token)
            });

            // Atualizar banco
            await supabase
                .from('whatsapp_instances')
                .update({ status: 'disconnected', phone: null, battery: null, profile_pic_url: null })
                .eq('id', id);

            return true;
        } catch (error) {
            console.error('Erro ao desconectar:', error);
            throw error;
        }
    },

    // 6. Deletar Instância
    async deleteInstance(id: string) {
        try {
            const { data: instance, error } = await supabase
                .from('whatsapp_instances')
                .select('token, instance_id')
                .eq('id', id)
                .single();

            if (error || !instance) throw new Error('Instância não encontrada');

            console.log(`Deletando instância ${id} na Uazapi...`);

            // Deletar na Uazapi - Usando token da instância conforme solicitado
            // Endpoint: DELETE /instance
            const response = await fetch(`${UAZAPI_URL}/instance`, {
                method: 'DELETE',
                headers: getHeaders(instance.token)
            });

            const responseData = await response.json().catch(() => ({}));
            console.log('Resposta do Delete:', responseData);

            // Deletar do banco
            await supabase
                .from('whatsapp_instances')
                .delete()
                .eq('id', id);

            return true;
        } catch (error) {
            console.error('Erro ao deletar instância:', error);
            throw error;
        }
    },

    // 7. Obter Status da Conexão Chatwoot
    async getChatwootStatus(id: string) {
        try {
            const { data: instance, error } = await supabase
                .from('whatsapp_instances')
                .select('token')
                .eq('id', id)
                .single();

            if (error || !instance) throw new Error('Instância não encontrada');

            const response = await fetch(`${UAZAPI_URL}/chatwoot/config`, {
                method: 'GET',
                headers: getHeaders(instance.token)
            });

            if (!response.ok) {
                console.error('Erro ao obter status do Chatwoot:', response.status);
                return null;
            }

            const data = await response.json();
            console.log('Status Chatwoot:', data);
            return data;
        } catch (error) {
            console.error('Erro ao obter status do Chatwoot:', error);
            return null;
        }
    },

    // 8. Conectar ao Chatwoot
    async connectChatwoot(id: string) {
        try {
            const { data: instance, error } = await supabase
                .from('whatsapp_instances')
                .select('token')
                .eq('id', id)
                .single();

            if (error || !instance) throw new Error('Instância não encontrada');

            const response = await fetch(`${UAZAPI_URL}/chatwoot/config`, {
                method: 'PUT',
                headers: getHeaders(instance.token),
                body: JSON.stringify({
                    enabled: true,
                    url: "https://chatwoot.eloscope.com.br",
                    access_token: "5aqYAqWSQXvKAsYkn9Dp9jC2",
                    account_id: 1,
                    inbox_id: 4,
                    ignore_groups: true,
                    sign_messages: false,
                    create_new_conversation: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Erro ao conectar Chatwoot:', errorData);
                throw new Error(errorData.message || 'Erro ao conectar ao Chatwoot');
            }

            const data = await response.json();
            console.log('Chatwoot conectado:', data);
            return data;
        } catch (error) {
            console.error('Erro ao conectar Chatwoot:', error);
            throw error;
        }
    },

    // 9. Alternar Status para Campanhas
    async toggleCampaignStatus(id: string, isActive: boolean) {
        try {
            const { error } = await supabase
                .from('whatsapp_instances')
                .update({ is_active_for_campaigns: isActive })
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Erro ao alternar status de campanha:', error);
            throw error;
        }
    }
};

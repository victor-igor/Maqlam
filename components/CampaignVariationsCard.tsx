import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, MessageSquare, X } from 'lucide-react';
import { Campaign } from '../lib/campaigns';

interface VariationStats {
    [key: string]: {
        total: number;
        delivered: number;
        failed: number;
    };
}

interface CampaignVariationsCardProps {
    variationStats: VariationStats;
    campaign?: Campaign;
}

interface MessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    messageText: string;
}

const MessageModal: React.FC<MessageModalProps> = ({ isOpen, onClose, messageText }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-card-dark rounded-xl shadow-xl w-full max-w-4xl border border-border-light dark:border-border-dark flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mensagem Completa</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {messageText}
                    </p>
                </div>
                <div className="flex justify-end p-4 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-muted-dark/30 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-card-dark border border-gray-300 dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

const VariationItem: React.FC<{ messageText: string, data: any, campaign?: Campaign, onViewMore: (text: string) => void }> = ({ messageText, data, campaign, onViewMore }) => {
    const displayText = messageText === 'default' && campaign?.message_variations && campaign.message_variations.length > 0
        ? campaign.message_variations[0]
        : messageText === 'default'
            ? 'Mensagem Padrão'
            : messageText;

    const limit = 20;
    const shouldTruncate = displayText.length > limit;
    const textToShow = shouldTruncate ? displayText.slice(0, limit) + '...' : displayText;

    return (
        <div className="bg-gray-50 dark:bg-muted-dark p-4 rounded-lg border border-border-light dark:border-border-dark flex flex-col h-full">
            <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-start gap-2 overflow-hidden flex-1">
                    <MessageSquare className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                            {textToShow}
                        </p>
                        {shouldTruncate && (
                            <button
                                onClick={() => onViewMore(displayText)}
                                className="text-xs text-primary font-bold mt-1 hover:underline text-left w-fit"
                            >
                                Ver mais
                            </button>
                        )}
                    </div>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                    {data.total} envios
                </span>
            </div>

            <div className="space-y-3 mt-auto">
                {/* Delivered Progress */}
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Entregues
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                            {data.delivered || 0} ({data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0}%)
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                            className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${data.total > 0 ? (data.delivered / data.total) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>

                {/* Failed Progress */}
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Falhas
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                            {data.failed || 0} ({data.total > 0 ? Math.round((data.failed / data.total) * 100) : 0}%)
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                            className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${data.total > 0 ? (data.failed / data.total) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CampaignVariationsCard: React.FC<CampaignVariationsCardProps> = ({ variationStats, campaign }) => {
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

    if (!variationStats || Object.keys(variationStats).length === 0) {
        return null;
    }

    return (
        <>
            <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm mb-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Performance por Mensagem</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(variationStats).map(([messageText, data]: [string, any]) => (
                        <VariationItem
                            key={messageText}
                            messageText={messageText}
                            data={data}
                            campaign={campaign}
                            onViewMore={setSelectedMessage}
                        />
                    ))}
                </div>
            </div>

            <MessageModal
                isOpen={!!selectedMessage}
                onClose={() => setSelectedMessage(null)}
                messageText={selectedMessage || ''}
            />
        </>
    );
};

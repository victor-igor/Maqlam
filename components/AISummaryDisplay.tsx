import React, { useState } from 'react';
import { Maximize2, X, Brain } from 'lucide-react';

interface AISummaryDisplayProps {
    text: string;
}

export const AISummaryDisplay: React.FC<AISummaryDisplayProps> = ({ text }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    if (!text) return <p className="text-sm text-gray-500 italic">Nenhum resumo disponível.</p>;

    // Simple markdown parser
    const formatText = (content: string) => {
        return content.split('\n').map((line, index) => {
            // Headers
            if (line.startsWith('## ')) {
                return <h4 key={index} className="text-sm font-bold text-gray-900 dark:text-white mt-4 mb-2">{line.replace('## ', '')}</h4>;
            }
            // List items
            if (line.startsWith('- ')) {
                const content = line.replace('- ', '');
                return (
                    <div key={index} className="flex gap-2 ml-1 mb-1.5">
                        <span className="text-primary mt-1.5">•</span>
                        <p className="text-gray-600 dark:text-gray-300 flex-1 leading-relaxed">{parseInline(content)}</p>
                    </div>
                );
            }
            // Regular paragraphs
            if (line.trim() === '') {
                return <div key={index} className="h-2" />;
            }
            return <p key={index} className="text-gray-600 dark:text-gray-300 mb-1.5 leading-relaxed">{parseInline(line)}</p>;
        });
    };

    const parseInline = (text: string) => {
        // Bold: **text**
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} className="italic text-gray-700 dark:text-gray-300">{part.slice(1, -1)}</em>;
            }
            return part;
        });
    };

    // Calculate if text is long enough to need truncation
    const isLongText = text.length > 200;

    return (
        <>
            <div className="space-y-2">
                <div className="text-sm leading-relaxed max-h-[180px] overflow-hidden relative">
                    {formatText(text)}

                    {/* Gradient mask */}
                    {isLongText && (
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white dark:from-card-dark to-transparent pointer-events-none" />
                    )}
                </div>

                {isLongText && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors mt-2 w-full justify-center py-2 bg-primary/5 rounded-lg hover:bg-primary/10"
                    >
                        <Maximize2 className="w-3 h-3" />
                        Ver resumo completo
                    </button>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />

                    <div className="relative bg-white dark:bg-card-dark rounded-xl shadow-2xl w-full max-w-2xl border border-border-light dark:border-border-dark flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-muted-dark/30 rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Brain className="w-5 h-5 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Resumo da IA</h3>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-muted-dark rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            <div className="prose dark:prose-invert max-w-none">
                                {formatText(text)}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-muted-dark/30 rounded-b-xl flex justify-end">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-card-dark border border-gray-300 dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

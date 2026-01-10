import React from 'react';
import { AlertTriangle, Camera, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'upload' | 'delete' | 'warning';
    details?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'warning',
    details
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'upload':
                return <Camera className="w-12 h-12 text-primary" />;
            case 'delete':
                return <Trash2 className="w-12 h-12 text-red-500" />;
            default:
                return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
        }
    };

    const getConfirmButtonClass = () => {
        switch (type) {
            case 'delete':
                return 'bg-red-500 hover:bg-red-600 text-white';
            case 'upload':
                return 'bg-primary hover:bg-primary/90 text-white';
            default:
                return 'bg-primary hover:bg-primary/90 text-white';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                    {getIcon()}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                    {title}
                </h3>

                {/* Message */}
                <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
                    {message}
                </p>

                {/* Details */}
                {details && (
                    <div className="bg-gray-50 dark:bg-muted-dark rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center whitespace-pre-line">
                            {details}
                        </p>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-border-dark text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted-dark transition-colors font-medium"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 px-4 py-2.5 rounded-lg transition-colors font-medium ${getConfirmButtonClass()}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

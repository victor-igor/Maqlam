import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AIImportModal } from './AIImportModal';

export const FinancialImportPage: React.FC = () => {
    const navigate = useNavigate();

    // When used as a page, we pass isPage={true} so it renders inline (full height/width)
    // onClose redirects back to the main dashboard
    return (
        <AIImportModal
            isOpen={true}
            isPage={true}
            onClose={() => navigate('/financial')}
        />
    );
};

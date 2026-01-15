import React from 'react';
import { Outlet } from 'react-router-dom';

export const Financial: React.FC = () => {
    return (
        <div className="h-full w-full">
            <Outlet />
        </div>
    );
};

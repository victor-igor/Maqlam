import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface FloatingDropdownContentProps {
    anchor: HTMLElement | null;
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    width?: number;
    className?: string;
}

export const FloatingDropdownContent: React.FC<FloatingDropdownContentProps> = ({ anchor, isOpen, onClose, children, width = 280, className = "" }) => {
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (!isOpen || !anchor) return;

        const updatePosition = () => {
            const rect = anchor.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;
            const viewportHeight = window.innerHeight;
            // const viewportWidth = window.innerWidth;

            // Basic positioning: below the anchor
            let top = rect.bottom + scrollY + 8;
            let left = rect.right + scrollX - width; // Align right edge with anchor right edge

            // Check bottom overflow
            if (rect.bottom + 350 > viewportHeight) {
                // If not enough space below, try above
                if (rect.top > 350) {
                    top = rect.top + scrollY - 350 - 8;
                }
            }

            // Check left boundary
            if (left < 0) {
                left = rect.left + scrollX; // Align left edge
            }

            // Check right boundary logic if aligning left
            if (left + width > document.documentElement.scrollWidth) {
                left = document.documentElement.scrollWidth - width - 10;
            }

            setCoords({ top, left });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true); // Capture scroll on all elements

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, anchor, width]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (anchor && anchor.contains(e.target as Node)) return;
            onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, anchor, onClose]);

    if (!isOpen || !anchor || !coords) return null;

    // Use Absolute positioning relative to document body
    return createPortal(
        <div
            className={`fixed z-[9999] flex flex-col bg-[#0F172A] border border-slate-700/80 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 ${className}`}
            style={{
                top: coords.top - window.scrollY,
                left: coords.left - window.scrollX,
                width: width,
                maxHeight: '350px'
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body
    );
};

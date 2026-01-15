import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface FinancialFiltersProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onApply: () => void;
    loading: boolean;
}

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const parseDateString = (dateStr: string): { year: number; month: number; day: number } => {
    const parts = dateStr.split('-').map(Number);
    return {
        year: parts[0] || new Date().getFullYear(),
        month: (parts[1] || 1) - 1,
        day: parts[2] || 1
    };
};

// Portal Component for cleaner usage
const Portal: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div data-portal-id={id}>{children}</div>,
        document.body
    );
};

const DatePicker: React.FC<{
    value: string;
    onChange: (date: string) => void;
    isEnd?: boolean;
}> = ({ value, onChange, isEnd = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'month' | 'day'>('month');

    // Refs
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Positioning State
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const parsed = parseDateString(value);
    const [viewYear, setViewYear] = useState(parsed.year);
    const [viewMonth, setViewMonth] = useState(parsed.month);

    // Update Position Check
    const updatePosition = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Calculate available space below
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceCurrent = 420; // Approx max height of dropdown

            let top = rect.bottom + window.scrollY + 8;

            // If checking collision (optional), for now just force below as requested
            // But adding window scroll is CRITICAL for fixed/absolute hybrid or Portal absolute

            // Using Portal -> we are in document.body (absolute over everything)
            // We need absolute coordinates relative to the document

            setCoords({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX
            });
        }
    };

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
        }
    }, [isOpen]);

    // Close on scroll or resize to prevent floating issues
    useEffect(() => {
        const handleScrollOrResize = () => {
            if (isOpen) setIsOpen(false);
        };

        window.addEventListener('scroll', handleScrollOrResize, true); // Capture phase matches all scrolls
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen]);

    // Click Outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is outside BUTTON and outside DROPDOWN
            const target = event.target as Node;
            const clickedButton = buttonRef.current?.contains(target);
            const clickedDropdown = dropdownRef.current?.contains(target);

            if (!clickedButton && !clickedDropdown) {
                setIsOpen(false);
                setViewMode('month');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpen = () => {
        if (!isOpen) {
            setViewYear(parsed.year);
            setViewMonth(parsed.month);
            setViewMode('month');
            // updatePosition() called by layoutEffect
        }
        setIsOpen(!isOpen);
    };

    const handleMonthSelect = (monthIndex: number) => {
        setViewMonth(monthIndex);
        setViewMode('day');
    };

    const handleDaySelect = (day: number) => {
        const m = String(viewMonth + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        onChange(`${viewYear}-${m}-${d}`);
        setIsOpen(false);
        setViewMode('month');
    };

    const handleSelectFullMonth = () => {
        let day = 1;
        if (isEnd) {
            day = new Date(viewYear, viewMonth + 1, 0).getDate();
        }
        const m = String(viewMonth + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        onChange(`${viewYear}-${m}-${d}`);
        setIsOpen(false);
        setViewMode('month');
    };

    const generateDays = () => {
        const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const days: (number | null)[] = [];

        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(null);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return days;
    };

    const displayDate = new Date(parsed.year, parsed.month, parsed.day);
    const formattedValue = displayDate.toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    const navigatePrev = () => {
        if (viewMode === 'day') {
            if (viewMonth === 0) {
                setViewMonth(11);
                setViewYear(prev => prev - 1);
            } else {
                setViewMonth(prev => prev - 1);
            }
        } else {
            setViewYear(prev => prev - 1);
        }
    };

    const navigateNext = () => {
        if (viewMode === 'day') {
            if (viewMonth === 11) {
                setViewMonth(0);
                setViewYear(prev => prev + 1);
            } else {
                setViewMonth(prev => prev + 1);
            }
        } else {
            setViewYear(prev => prev + 1);
        }
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={handleOpen}
                className={`flex items-center gap-2 px-4 h-9 rounded-xl transition-all border
                    ${isOpen
                        ? 'bg-[#1A202C] border-blue-500/50 text-blue-400'
                        : 'bg-gray-100 dark:bg-[#0B1116] border-border-light dark:border-white/5 hover:border-border-light dark:hover:border-white/10 text-gray-900 dark:text-slate-300 hover:text-primary dark:hover:text-white'
                    }
                    text-[11px] font-bold uppercase tracking-wider min-w-[130px] justify-between group
                `}
            >
                <span>{formattedValue}</span>
                <Calendar className={`w-3.5 h-3.5 transition-colors ${isOpen ? 'text-blue-400' : 'text-gray-500 dark:text-slate-600 group-hover:text-gray-700 dark:group-hover:text-slate-400'}`} />
            </button>

            {isOpen && (
                <Portal id="datepicker-portal">
                    <div
                        ref={dropdownRef}
                        className="fixed z-[9999] w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden"
                        style={{
                            top: coords.top,
                            left: coords.left,
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                            <button
                                onClick={navigatePrev}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => setViewMode('month')}
                                className="text-base font-bold text-slate-900 dark:text-white hover:text-primary dark:hover:text-emerald-400 transition-colors"
                            >
                                {viewMode === 'day' ? `${MONTHS[viewMonth]} ${viewYear}` : viewYear}
                            </button>

                            <button
                                onClick={navigateNext}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Month Grid */}
                        {viewMode === 'month' && (
                            <div className="p-4">
                                <div className="grid grid-cols-3 gap-2">
                                    {MONTHS.map((month, index) => {
                                        const isSelected = parsed.month === index && parsed.year === viewYear;
                                        const isCurrentMonth = new Date().getMonth() === index && new Date().getFullYear() === viewYear;

                                        return (
                                            <button
                                                key={month}
                                                onClick={() => handleMonthSelect(index)}
                                                className={`
                                                    py-3 px-2 rounded-xl text-sm font-medium transition-all
                                                    ${isSelected
                                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }
                                                    ${isCurrentMonth && !isSelected ? 'ring-2 ring-primary/30 text-primary dark:text-emerald-400' : ''}
                                                `}
                                            >
                                                {month.substring(0, 3)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Day Grid */}
                        {viewMode === 'day' && (
                            <div className="p-4">
                                {/* Quick Action */}
                                <button
                                    onClick={handleSelectFullMonth}
                                    className="w-full mb-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 rounded-xl transition-all shadow-md shadow-primary/20"
                                >
                                    {isEnd ? 'Último Dia do Mês' : 'Primeiro Dia do Mês'}
                                </button>

                                {/* Weekday Headers */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {WEEKDAYS.map((day, i) => (
                                        <div key={i} className="h-8 flex items-center justify-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Day Numbers */}
                                <div className="grid grid-cols-7 gap-1">
                                    {generateDays().map((day, index) => {
                                        if (day === null) {
                                            return <div key={`empty-${index}`} className="h-9"></div>;
                                        }

                                        const isSelected = parsed.day === day && parsed.month === viewMonth && parsed.year === viewYear;
                                        const isToday = new Date().getDate() === day && new Date().getMonth() === viewMonth && new Date().getFullYear() === viewYear;

                                        return (
                                            <button
                                                key={day}
                                                onClick={() => handleDaySelect(day)}
                                                className={`
                                                    h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all
                                                    ${isSelected
                                                        ? 'bg-primary text-white shadow-md shadow-primary/30'
                                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }
                                                    ${isToday && !isSelected ? 'ring-2 ring-primary/40 text-primary dark:text-emerald-400 font-bold' : ''}
                                                `}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </Portal>
            )}
        </div>
    );
};

export const FinancialFilters: React.FC<FinancialFiltersProps> = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onApply,
    loading
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    // Format the date range for display
    const formatRange = () => {
        const start = parseDateString(startDate);
        const end = parseDateString(endDate);

        const startStr = `${start.day} ${MONTHS[start.month].substring(0, 3)}.`;
        const endStr = `${end.day} ${MONTHS[end.month].substring(0, 3)}. ${end.year}`;

        return `${startStr} - ${endStr}`;
    };

    // Handle Open/Position
    useLayoutEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX
            });
        }
    }, [isOpen]);

    // Click Outside
    // Click Outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;

            // Check if clicking inside own popover or trigger
            const isInsideMain = triggerRef.current?.contains(target) || popoverRef.current?.contains(target);

            // Check if clicking inside ANY nested portal (datepicker)
            // Use closest to find the portal container if clicking deeply nested elements
            const isInsidePortal = !!target.closest('[data-portal-id="datepicker-portal"]');

            if (isOpen && !isInsideMain && !isInsidePortal) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleApply = () => {
        onApply();
        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* Minimalist Trigger Button */}
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-3 px-5 h-10 rounded-xl transition-all border group
                    ${isOpen
                        ? 'bg-[#1A202C] border-blue-500/50 text-blue-400 shadow-lg shadow-blue-500/10'
                        : 'bg-white dark:bg-[#0B1116] border-border-light dark:border-white/5 hover:border-border-light dark:hover:border-white/10 text-gray-700 dark:text-slate-300 hover:text-primary dark:hover:text-white'
                    }
                `}
            >
                <div className={`p-1 rounded-md ${isOpen ? 'bg-blue-500/10' : 'bg-gray-100 dark:bg-white/5 group-hover:bg-gray-200 dark:group-hover:bg-white/10'} transition-colors`}>
                    <Calendar className={`w-3.5 h-3.5 ${isOpen ? 'text-blue-400' : 'text-gray-500 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-slate-200'}`} />
                </div>
                <div className="flex flex-col items-start leading-none gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-500 group-hover:text-gray-700 dark:group-hover:text-slate-400">Período</span>
                    <span className="text-[11px] font-bold tracking-wide">{formatRange()}</span>
                </div>
                <ChevronDown className={`w-3 h-3 ml-2 transition-transform ${isOpen ? 'rotate-180 text-blue-400' : 'text-gray-400 dark:text-slate-600'}`} />
            </button>

            {/* Popover Content */}
            {isOpen && (
                <Portal>
                    <div
                        ref={popoverRef}
                        style={{ top: coords.top, left: coords.left }}
                        className="fixed z-[9999] bg-white dark:bg-[#0F151A] border border-border-light dark:border-white/10 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 p-4 min-w-[320px] animate-in fade-in zoom-in-95 duration-200"
                    >
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light dark:border-white/5">
                            <span className="text-gray-900 dark:text-white text-sm font-bold">Filtrar Período</span>
                            <button onClick={() => setIsOpen(false)} className="text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                                <span className="sr-only">Close</span>
                                <ChevronDown className="w-4 h-4 rotate-180" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider ml-1">Início</label>
                                <DatePicker value={startDate} onChange={onStartDateChange} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider ml-1">Fim</label>
                                <DatePicker value={endDate} onChange={onEndDateChange} isEnd={true} />
                            </div>

                            <button
                                onClick={handleApply}
                                disabled={loading}
                                className="w-full mt-2 h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? 'Carregando...' : 'Aplicar Filtro'}
                            </button>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
};

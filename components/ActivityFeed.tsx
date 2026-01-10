
import React from 'react';
import { ActivityItem } from '../types';
import { User } from 'lucide-react';

const activities: ActivityItem[] = [
  {
    id: '1',
    user: 'Mariana Silva',
    action: 'Novo agendamento via Agente',
    time: '2 min atrás',
    avatar: 'MS',
  },
  {
    id: '2',
    user: 'Carlos Souza',
    action: 'Solicitou remarcação',
    time: '15 min atrás',
    avatar: 'CS',
  },
  {
    id: '3',
    user: 'Fernanda Lima',
    action: 'Dúvida sobre disponibilidade',
    time: '32 min atrás',
    avatar: 'FL',
  },
  {
    id: '4',
    user: 'João Pedro',
    action: 'Iniciou nova conversa',
    time: '1 hora atrás',
    avatar: 'JP',
  },
];

export const ActivityFeed: React.FC = () => {
  return (
    <div className="space-y-6">
        {activities.map((activity, index) => (
            <div key={activity.id} className="flex items-start space-x-3 group cursor-pointer">
                <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border border-white/10 shadow-sm
                        ${index % 2 === 0 
                            ? 'bg-gradient-to-tr from-primary/20 to-primary/5 text-primary' 
                            : 'bg-gradient-to-tr from-secondary/20 to-secondary/5 text-secondary'}
                    `}>
                        {activity.avatar}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full shadow-[0_0_8px_rgba(0,255,0,0.5)]"></span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">
                        {activity.user}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {activity.action}
                    </p>
                </div>
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap bg-gray-100 dark:bg-zinc-800/50 px-2 py-1 rounded-full">
                    {activity.time}
                </span>
            </div>
        ))}
        <button className="w-full py-3 text-xs font-bold text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary transition-colors border-t border-gray-100 dark:border-zinc-800 mt-2 flex items-center justify-center gap-2 uppercase tracking-wide">
            Ver todo o histórico
        </button>
    </div>
  );
};

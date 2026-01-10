
import { LucideIcon } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string;
  subtext: string;
  icon: LucideIcon;
  color: 'orange' | 'blue' | 'green' | 'red' | 'purple';
}

export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  time: string;
  avatar: string;
}

export interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export type ViewType = 'dashboard' | 'contacts' | 'contact-details' | 'campaigns' | 'settings' | 'users';

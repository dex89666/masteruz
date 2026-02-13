// ============================================
// MasterUz — Empty State Component
// ============================================

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon | string;
  title: string;
  description?: string;
  action?: ReactNode | EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  const actionNode = action && typeof action === 'object' && 'label' in (action as any)
    ? <button onClick={(action as EmptyStateAction).onClick} className="btn-primary">{(action as EmptyStateAction).label}</button>
    : action as ReactNode;

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
        {typeof Icon === 'string'
          ? <span className="text-2xl">{Icon}</span>
          : <Icon size={28} className="text-gray-400" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      {actionNode && <div>{actionNode}</div>}
    </div>
  );
}

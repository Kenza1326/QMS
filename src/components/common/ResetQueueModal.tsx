import React from 'react';
import {RotateCcw} from 'lucide-react';
import {queueStore} from '../../services/queueStore';
import {configService} from '../../services/configService';
import {authService} from '../../services/authService';
import {notifications} from '../../services/notificationService';

interface ResetQueueButtonProps {
  variant?: 'danger' | 'ghost' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export const ResetQueueButton: React.FC<ResetQueueButtonProps> = ({variant = 'danger', size = 'md', className = '', showText = true}) => {
  const sizeClasses = {sm:'px-2.5 py-1.5 text-xs', md:'px-3.5 py-2 text-xs', lg:'px-4 py-2.5 text-sm'};
  const variantClasses = {
    danger:'bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs active:scale-98',
    ghost:'bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200',
    pill:'bg-white hover:bg-rose-50 text-rose-600 font-bold border border-rose-200 shadow-xs',
  };
  const handleReset = async () => {
    const agencyId = configService.getConfig().selectedAgencyId;
    const accepted = await notifications.confirmAction({title:'Vider la file de cette agence ?', message:'Tous ses tickets seront supprimés et ses guichets libérés.', actionLabel:'Vider la file', destructive:true});
    if (!accepted || configService.getConfig().selectedAgencyId !== agencyId) return;
    const user = authService.getCurrentUser();
    try { await queueStore.resetQueue(user ? `${user.name} (${user.roleLabel})` : 'Administrateur'); } catch(error) { notifications.error(error instanceof Error ? error.message : 'Réinitialisation impossible.'); }
  };
  return <button type="button" onClick={handleReset} className={`rounded-xl flex items-center gap-2 transition-all cursor-pointer ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} title="Réinitialiser la file de cette agence"><RotateCcw className="w-3.5 h-3.5 shrink-0" />{showText && <span>Réinitialiser la file</span>}</button>;
};


import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  variant?: 'danger' | 'primary';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  variant = 'danger'
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} zIndex={60}>
      <div className="space-y-6 mt-2">
        <div className={`p-6 rounded-[2rem] flex flex-col items-center text-center gap-4 ${
          variant === 'danger' ? 'bg-rose-50' : 'bg-indigo-50'
        }`}>
          <div className={variant === 'danger' ? 'text-rose-500' : 'text-indigo-500'}>
            <AlertTriangle size={48} strokeWidth={2.5} />
          </div>
          <p className="text-slate-600 font-medium leading-relaxed">
            {message}
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-2xl">
            Cancelar
          </Button>
          <Button 
            variant={variant} 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className="flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

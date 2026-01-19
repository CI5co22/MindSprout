
import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 right-6 z-[100] animate-in fade-in slide-in-from-right-4 duration-300 pointer-events-none">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-[2rem] shadow-2xl border pointer-events-auto ${
        type === 'success' ? 'bg-indigo-600 border-indigo-500' : 'bg-rose-600 border-rose-500'
      } text-white min-w-[280px] max-w-sm`}>
        {type === 'success' ? <CheckCircle2 size={20} strokeWidth={3} /> : <AlertCircle size={20} strokeWidth={3} />}
        <p className="flex-1 text-sm font-black tracking-tight">{message}</p>
        <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity p-1">
          <X size={16} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

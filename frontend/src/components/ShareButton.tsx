// ============================================
// MasterUz — ShareButton Component
// Компонент для шаринга через Web Share API
// ============================================

import { useState } from 'react';
import { Share2, Check, Copy } from 'lucide-react';
import { useTranslation } from '../i18n';
import toast from 'react-hot-toast';

interface ShareButtonProps {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  compact?: boolean;
}

export function ShareButton({ title, text, url, className = '', compact = false }: ShareButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const shareUrl = url || window.location.href;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // User cancelled — ignore
      }
    } else {
      // Fallback: copy to clipboard
      handleCopy();
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t('common.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('common.error'));
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleShare}
        className={`p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-primary-600 transition-colors ${className}`}
        title={t('common.share')}
      >
        <Share2 size={18} />
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleShare}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <Share2 size={16} />
        {t('common.share')}
      </button>
      <button
        onClick={handleCopy}
        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        title={t('common.copyLink')}
      >
        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
      </button>
    </div>
  );
}

// ============================================
// MasterUz — Master Portfolio Management Page
// Управление портфолио: добавление/удаление работ
// ============================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { portfolioApi, photosApi } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuthStore, useAppStore } from '../store';
import { useTranslation } from '../i18n';
import {
  Plus, Trash2, Edit3, Image, Camera, Upload,
  X, Check, Heart, FolderOpen, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { PortfolioItem, PortfolioStats } from '../types';

export function MasterPortfolioPage() {
  const { user } = useAuthStore();
  const { categories } = useAppStore();
  const { t } = useTranslation();

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [formUploading, setFormUploading] = useState(false);
  const [formImagePreview, setFormImagePreview] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        portfolioApi.getMasterPortfolio(user!.id),
        portfolioApi.getStats(),
      ]);
      setItems(itemsRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditItem(null);
    setFormTitle('');
    setFormDesc('');
    setFormImageUrl('');
    setFormImagePreview('');
    setFormCategory('');
    setShowForm(true);
  }

  function openEditForm(item: PortfolioItem) {
    setEditItem(item);
    setFormTitle(item.title);
    setFormDesc(item.description || '');
    setFormImageUrl(item.imageUrl);
    setFormImagePreview(item.imageUrl);
    setFormCategory(item.categoryId || '');
    setShowForm(true);
  }

  async function handlePhotoUpload(file: File) {
    setFormUploading(true);
    try {
      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setFormImagePreview(localUrl);

      // Compress if needed
      let uploadFile = file;
      if (file.size > 500 * 1024) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const img = new window.Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = localUrl;
          });
          const maxSize = 1200;
          let w = img.width, h = img.height;
          if (w > maxSize || h > maxSize) {
            if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
            else { w = Math.round(w * maxSize / h); h = maxSize; }
          }
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 0.8));
          uploadFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        } catch { /* use original */ }
      }

      // Upload to server
      const formData = new FormData();
      formData.append('photo', uploadFile);
      const res = await photosApi.upload(formData);
      const url = res.data.data?.url;
      if (url) {
        setFormImageUrl(url);
        setFormImagePreview(url.startsWith('data:') ? url : url);
        toast.success('Фото загружено');
      } else {
        // Fallback to base64
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setFormImageUrl(dataUrl);
          setFormImagePreview(dataUrl);
        };
        reader.readAsDataURL(uploadFile);
        toast.success('Фото загружено (локально)');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      // Fallback: read as base64
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setFormImageUrl(dataUrl);
        setFormImagePreview(dataUrl);
      };
      reader.readAsDataURL(file);
      toast.success('Фото загружено (локально)');
    } finally {
      setFormUploading(false);
    }
  }

  async function handleSave() {
    if (!formTitle.trim() || !formImageUrl.trim()) {
      toast.error(t('portfolio.fillRequired'));
      return;
    }

    setSaving(true);
    try {
      const data = {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        imageUrl: formImageUrl.trim(),
        categoryId: formCategory || undefined,
      };

      if (editItem) {
        const res = await portfolioApi.update(editItem.id, data);
        setItems(items.map(i => i.id === editItem.id ? res.data.data : i));
        toast.success(t('portfolio.updated'));
      } else {
        const res = await portfolioApi.create(data);
        setItems([...items, res.data.data]);
        toast.success(t('portfolio.added'));
      }

      setShowForm(false);
      // Refresh stats
      try {
        const statsRes = await portfolioApi.getStats();
        setStats(statsRes.data.data);
      } catch { /* ok */ }
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await portfolioApi.remove(deleteId);
      setItems(items.filter(i => i.id !== deleteId));
      setDeleteId(null);
      toast.success(t('portfolio.deleted'));
      // Refresh stats
      try {
        const statsRes = await portfolioApi.getStats();
        setStats(statsRes.data.data);
      } catch { /* ok */ }
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || t('common.error'));
    }
  }

  const filteredItems = filterCategory
    ? items.filter(i => i.categoryId === filterCategory)
    : items;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              📸 {t('portfolio.title')}
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 ml-7">{t('portfolio.subtitle')}</p>
        </div>
        <button
          onClick={openCreateForm}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">{t('portfolio.addWork')}</span>
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/30 dark:to-blue-800/20 dark:border-blue-800 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Image size={16} className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.totalItems}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">{t('portfolio.works')}</p>
          </div>
          <div className="card bg-gradient-to-br from-red-50 to-pink-100 border-red-200 dark:from-red-900/30 dark:to-pink-800/20 dark:border-red-800 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Heart size={16} className="text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-800 dark:text-red-300">{stats.totalLikes}</p>
            <p className="text-xs text-red-600 dark:text-red-400">{t('portfolio.likes')}</p>
          </div>
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 dark:from-purple-900/30 dark:to-purple-800/20 dark:border-purple-800 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <FolderOpen size={16} className="text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">{stats.categoriesUsed}</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">{t('portfolio.categories')}</p>
          </div>
        </div>
      )}

      {/* Category filter */}
      {categories.length > 0 && items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              !filterCategory
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {t('portfolio.allCategories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filterCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Portfolio Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="📸"
          title={t('portfolio.empty')}
          description={t('portfolio.emptyDesc')}
          action={{
            label: t('portfolio.addFirstWork'),
            onClick: openCreateForm,
          }}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-xl overflow-hidden bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 hover:shadow-lg dark:hover:shadow-black/30 transition-all"
            >
              {/* Image */}
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditForm(item)}
                      className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full text-red-500 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {/* Likes badge */}
                {item.likesCount > 0 && (
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Heart size={10} fill="currentColor" />
                    {item.likesCount}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                )}
                {item.category && (
                  <span className="inline-block mt-1.5 text-[10px] bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded-full">
                    {item.category.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold dark:text-white">
                {editItem ? t('portfolio.editWork') : t('portfolio.addWork')}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Photo upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Фото работы *
                </label>
                {formImagePreview ? (
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-100 dark:bg-gray-700">
                    <img
                      src={formImagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <button
                      onClick={() => { setFormImageUrl(''); setFormImagePreview(''); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                    >
                      <X size={16} />
                    </button>
                    {formUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {/* Gallery button */}
                    <label className="flex-1 flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer">
                      <Upload size={28} className="text-gray-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Из галереи</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {/* Camera button */}
                    <label className="flex-1 flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer">
                      <Camera size={28} className="text-gray-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Камера</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('portfolio.workTitle')} *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder={t('portfolio.workTitlePlaceholder')}
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('portfolio.workDesc')}
                  <span className="text-gray-400 ml-1 font-normal">({t('common.optional')})</span>
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows={3}
                  placeholder={t('portfolio.workDescPlaceholder')}
                  maxLength={1000}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('portfolio.workCategory')}
                  <span className="text-gray-400 ml-1 font-normal">({t('common.optional')})</span>
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">{t('portfolio.noCategory')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="btn-secondary flex-1"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || formUploading || !formTitle.trim() || !formImageUrl}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Check size={18} />
                    {editItem ? t('common.save') : t('portfolio.addWork')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <ConfirmDialog
          isOpen={!!deleteId}
          title={t('portfolio.deleteConfirmTitle')}
          message={t('portfolio.deleteConfirmMsg')}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

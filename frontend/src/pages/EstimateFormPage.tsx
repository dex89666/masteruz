// ============================================
// MasterUz — Estimate Form Page (Master)
// Мастер составляет смету после выезда
// ============================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { estimationApi } from '../api/client';
import { Estimate, EstimateWorkItem, EstimateMaterialItem } from '../types';
import {
  ArrowLeft, Plus, Trash2, Send, Camera, Image as ImageIcon,
  X, Calculator, Hammer, Package, Clock, FileText, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function EstimateFormPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  // Work items
  const [workItems, setWorkItems] = useState<EstimateWorkItem[]>([
    { name: '', quantity: 1, unit: 'шт', unitPrice: 0, total: 0 },
  ]);

  // Material items
  const [materialItems, setMaterialItems] = useState<EstimateMaterialItem[]>([]);

  const [estimatedDays, setEstimatedDays] = useState(1);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);

  useEffect(() => {
    loadExistingEstimate();
  }, [orderId]);

  async function loadExistingEstimate() {
    if (!orderId) return;
    try {
      const res = await estimationApi.getEstimate(orderId);
      const data = res.data.data;
      // API возвращает массив — берём первую (последнюю) смету
      const est = Array.isArray(data) ? data[0] : data;
      if (est) {
        setEstimate(est);
        if (est.workItems?.length) setWorkItems(est.workItems as EstimateWorkItem[]);
        if (est.materialItems?.length) setMaterialItems(est.materialItems as EstimateMaterialItem[]);
        if (est.estimatedDays) setEstimatedDays(est.estimatedDays);
        if (est.notes) setNotes(est.notes);
        if (est.photos?.length) setPhotos(est.photos);
        if (est.videos?.length) setVideos(est.videos);
      }
    } catch { }
    setLoading(false);
  }

  // ---------- Work items helpers ----------

  function addWorkItem() {
    setWorkItems(prev => [...prev, { name: '', quantity: 1, unit: 'шт', unitPrice: 0, total: 0 }]);
  }

  function updateWorkItem(idx: number, field: keyof EstimateWorkItem, value: any) {
    setWorkItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  }

  function removeWorkItem(idx: number) {
    if (workItems.length <= 1) return toast.error('Минимум 1 позиция работ');
    setWorkItems(prev => prev.filter((_, i) => i !== idx));
  }

  // ---------- Material items helpers ----------

  function addMaterialItem() {
    setMaterialItems(prev => [...prev, { name: '', quantity: 1, unit: 'шт', unitPrice: 0, total: 0 }]);
  }

  function updateMaterialItem(idx: number, field: keyof EstimateMaterialItem, value: any) {
    setMaterialItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  }

  function removeMaterialItem(idx: number) {
    setMaterialItems(prev => prev.filter((_, i) => i !== idx));
  }

  // ---------- Photo / Video ----------

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Видео не больше 50 МБ');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setVideos(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Totals ----------

  const workTotal = workItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const materialTotal = materialItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalAmount = workTotal + materialTotal;

  // ---------- Submit ----------

  async function handleSave() {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const preparedWork = workItems.filter(w => w.name.trim()).map(w => ({
        name: w.name,
        quantity: w.quantity,
        unitPrice: w.unitPrice,
        total: w.quantity * w.unitPrice,
      }));
      const preparedMaterial = materialItems.filter(m => m.name.trim()).map(m => ({
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        unitPrice: m.unitPrice,
        total: m.quantity * m.unitPrice,
      }));

      await estimationApi.createEstimate(orderId!, {
        workItems: preparedWork,
        materialItems: preparedMaterial,
        estimatedDays,
        notes,
        photos,
        videos,
      });

      toast.success('Смета сохранена');
      await loadExistingEstimate();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendToClient() {
    if (!estimate) {
      toast.error('Сначала сохраните смету');
      return;
    }

    setSubmitting(true);
    try {
      await estimationApi.sendEstimate(estimate.id);
      toast.success('Смета отправлена клиенту!');
      navigate(`/orders/${orderId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  }

  function validateForm(): boolean {
    const validWork = workItems.filter(w => w.name.trim());
    if (validWork.length === 0) {
      toast.error('Добавьте хотя бы одну позицию работ');
      return false;
    }

    for (const item of validWork) {
      if (item.unitPrice <= 0) {
        toast.error(`Укажите цену для "${item.name}"`);
        return false;
      }
      if (item.quantity <= 0) {
        toast.error(`Укажите кол-во для "${item.name}"`);
        return false;
      }
    }

    if (estimatedDays < 1) {
      toast.error('Минимальный срок — 1 день');
      return false;
    }

    if (photos.length === 0) {
      toast.error('Прикрепите фото замеров');
      return false;
    }

    return true;
  }

  const UNITS = ['шт', 'м', 'м²', 'м³', 'п.м.', 'кг', 'л', 'комплект', 'услуга'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">📋 Составление сметы</h1>
          <p className="text-sm text-gray-500">Заказ #{orderId?.slice(0, 8)}</p>
        </div>
      </div>

      {estimate?.status === 'SENT' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-sm text-blue-700 dark:text-blue-400 mb-4">
          ✅ Смета отправлена клиенту. Ожидайте ответа.
        </div>
      )}

      {/* ===== РАБОТЫ ===== */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2">
            <Hammer size={18} className="text-primary-600" />
            Работы
          </h2>
          <button onClick={addWorkItem} className="text-primary-600 text-sm font-semibold flex items-center gap-1">
            <Plus size={16} /> Добавить
          </button>
        </div>

        <div className="space-y-3">
          {workItems.map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400 font-mono w-5">#{idx + 1}</span>
                <input
                  type="text"
                  value={item.name}
                  onChange={e => updateWorkItem(idx, 'name', e.target.value)}
                  placeholder="Название работы"
                  className="flex-1 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
                <button onClick={() => removeWorkItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Кол-во</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateWorkItem(idx, 'quantity', Math.max(0, Number(e.target.value)))}
                    min={0}
                    step={0.1}
                    className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Ед.</label>
                  <select
                    value={item.unit}
                    onChange={e => updateWorkItem(idx, 'unit', e.target.value)}
                    className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Цена за ед.</label>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={e => updateWorkItem(idx, 'unitPrice', Math.max(0, Number(e.target.value)))}
                    min={0}
                    step={1000}
                    className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-primary-600 mt-2">
                = {(item.quantity * item.unitPrice).toLocaleString('ru')} сум
              </div>
            </div>
          ))}
        </div>

        <div className="text-right mt-2 font-bold text-sm">
          Итого работы: {workTotal.toLocaleString('ru')} сум
        </div>
      </section>

      {/* ===== МАТЕРИАЛЫ ===== */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2">
            <Package size={18} className="text-orange-500" />
            Материалы
          </h2>
          <button onClick={addMaterialItem} className="text-orange-500 text-sm font-semibold flex items-center gap-1">
            <Plus size={16} /> Добавить
          </button>
        </div>

        {materialItems.length === 0 && (
          <div className="text-sm text-gray-400 italic">
            Материалы не добавлены (необязательно)
          </div>
        )}

        <div className="space-y-3">
          {materialItems.map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400 font-mono w-5">#{idx + 1}</span>
                <input
                  type="text"
                  value={item.name}
                  onChange={e => updateMaterialItem(idx, 'name', e.target.value)}
                  placeholder="Название материала"
                  className="flex-1 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
                <button onClick={() => removeMaterialItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Кол-во</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateMaterialItem(idx, 'quantity', Math.max(0, Number(e.target.value)))}
                    min={0}
                    step={0.1}
                    className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Ед.</label>
                  <select
                    value={item.unit}
                    onChange={e => updateMaterialItem(idx, 'unit', e.target.value)}
                    className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Цена за ед.</label>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={e => updateMaterialItem(idx, 'unitPrice', Math.max(0, Number(e.target.value)))}
                    min={0}
                    step={1000}
                    className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-orange-500 mt-2">
                = {(item.quantity * item.unitPrice).toLocaleString('ru')} сум
              </div>
            </div>
          ))}
        </div>

        {materialItems.length > 0 && (
          <div className="text-right mt-2 font-bold text-sm">
            Итого материалы: {materialTotal.toLocaleString('ru')} сум
          </div>
        )}
      </section>

      {/* ===== СРОКИ ===== */}
      <section className="mb-6">
        <h2 className="font-bold flex items-center gap-2 mb-3">
          <Clock size={18} className="text-blue-500" />
          Сроки выполнения
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={estimatedDays}
            onChange={e => setEstimatedDays(Math.max(1, Number(e.target.value)))}
            min={1}
            className="w-20 p-3 border rounded-xl text-center font-bold dark:bg-gray-800 dark:border-gray-700"
          />
          <span className="text-sm text-gray-600">
            {estimatedDays === 1 ? 'день' : estimatedDays < 5 ? 'дня' : 'дней'}
          </span>
        </div>
      </section>

      {/* ===== ФОТО / ВИДЕО ===== */}
      <section className="mb-6">
        <h2 className="font-bold flex items-center gap-2 mb-3">
          <Camera size={18} className="text-green-500" />
          Фото и видео замеров *
        </h2>

        {/* Фото */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">Фото замеров, объекта, проблемных мест</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-500 transition-colors">
              <ImageIcon size={20} className="text-gray-400" />
              <span className="text-xs text-gray-400 mt-1">Фото</span>
              <input type="file" accept="image/*" multiple capture="environment" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Видео */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Видео объекта (необязательно, до 50 МБ)</p>
          <div className="flex flex-wrap gap-2">
            {videos.map((_v, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-xs text-gray-500">🎥 #{idx + 1}</span>
                <button
                  onClick={() => setVideos(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-500 transition-colors">
              <Camera size={20} className="text-gray-400" />
              <span className="text-xs text-gray-400 mt-1">Видео</span>
              <input type="file" accept="video/*" capture="environment" onChange={handleVideoUpload} className="hidden" />
            </label>
          </div>
        </div>
      </section>

      {/* ===== ЗАМЕТКИ ===== */}
      <section className="mb-6">
        <h2 className="font-bold flex items-center gap-2 mb-3">
          <FileText size={18} className="text-purple-500" />
          Примечания
        </h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Дополнительные комментарии для клиента..."
          className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 h-24 resize-none"
          maxLength={2000}
        />
      </section>

      {/* ===== ИТОГО ===== */}
      <div className="bg-gradient-to-r from-primary-50 to-green-50 dark:from-primary-900/20 dark:to-green-900/20 rounded-2xl p-4 mb-6 border border-primary-200 dark:border-primary-800">
        <div className="flex items-center gap-2 mb-3">
          <Calculator size={20} className="text-primary-600" />
          <h2 className="font-bold text-lg">Итого по смете</h2>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Работы:</span>
            <span className="font-semibold">{workTotal.toLocaleString('ru')} сум</span>
          </div>
          {materialTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Материалы:</span>
              <span className="font-semibold">{materialTotal.toLocaleString('ru')} сум</span>
            </div>
          )}
          <div className="border-t dark:border-gray-700 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="font-bold text-base">Общая сумма:</span>
              <span className="font-bold text-lg text-primary-600">{totalAmount.toLocaleString('ru')} сум</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Срок выполнения:</span>
            <span>{estimatedDays} {estimatedDays === 1 ? 'день' : estimatedDays < 5 ? 'дня' : 'дней'}</span>
          </div>
        </div>
      </div>

      {/* ===== КНОПКИ ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-700 p-4 max-w-2xl mx-auto">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex-1 py-3 border-2 border-primary-600 text-primary-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50"
          >
            <Save size={18} />
            Сохранить
          </button>
          <button
            onClick={handleSendToClient}
            disabled={submitting || !estimate}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-700 disabled:opacity-50"
          >
            <Send size={18} />
            Отправить клиенту
          </button>
        </div>
      </div>
    </div>
  );
}

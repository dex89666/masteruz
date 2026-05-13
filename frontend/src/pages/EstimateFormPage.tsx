// ============================================
// MasterUz — Estimate Form Page (Master)
// Мастер составляет смету. После отправки клиенту можно:
//   • добавить «дополнительную работу/материал» (новые строки)
//   • пометить любую строку как «не требуется» (вычёркивается, минусуется из итога)
//   • восстановить ранее отменённую строку
// Старые данные физически не удаляются — только cancelled-флаг.
// ============================================

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { estimationApi, photosApi, ordersApi } from '../api/client';
import { Estimate, EstimateWorkItem, EstimateMaterialItem, Order } from '../types';
import {
  ArrowLeft, Plus, Trash2, Send, Camera, Image as ImageIcon,
  X, Calculator, Hammer, Package, Clock, FileText, Save, RotateCcw, Ban, Percent, Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';

const UNITS = ['шт', 'м', 'м²', 'м³', 'п.м.', 'кг', 'л', 'комплект', 'услуга'];
const PLATFORM_COMMISSION_RATE = 20; // % с работ (по умолчанию; реальный берём из order.commissionRate)

export function EstimateFormPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const [workItems, setWorkItems] = useState<EstimateWorkItem[]>([
    { name: '', quantity: 1, unit: 'шт', unitPrice: 0, total: 0 },
  ]);
  const [materialItems, setMaterialItems] = useState<EstimateMaterialItem[]>([]);
  const [estimatedDays, setEstimatedDays] = useState(1);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);

  // Граница между «старыми» (зафиксированными после отправки) и «новыми» строками.
  // Старые строки нельзя редактировать — только пометить cancelled.
  const [lockedWorkCount, setLockedWorkCount] = useState(0);
  const [lockedMaterialCount, setLockedMaterialCount] = useState(0);

  const isSent = !!estimate && estimate.status !== 'DRAFT';

  useEffect(() => {
    load();
  }, [orderId]);

  async function load() {
    if (!orderId) return;
    try {
      const [estRes, orderRes] = await Promise.all([
        estimationApi.getEstimate(orderId).catch(() => null),
        ordersApi.getById(orderId).catch(() => null),
      ]);

      const estData = estRes?.data.data;
      const est = Array.isArray(estData) ? estData[0] : estData;
      if (est) {
        setEstimate(est);
        const w = (est.workItems as EstimateWorkItem[]) || [];
        const m = (est.materialItems as EstimateMaterialItem[]) || [];
        setWorkItems(w.length ? w : [{ name: '', quantity: 1, unit: 'шт', unitPrice: 0, total: 0 }]);
        setMaterialItems(m);
        if (est.status !== 'DRAFT') {
          // После отправки — заблокировать существующие строки
          setLockedWorkCount(w.length);
          setLockedMaterialCount(m.length);
        }
        if (est.estimatedDays) setEstimatedDays(est.estimatedDays);
        if (est.notes) setNotes(est.notes);
        if (est.photos?.length) setPhotos(est.photos);
        if (est.videos?.length) setVideos(est.videos);
      }

      const ord = orderRes?.data.data;
      if (ord) setOrder(ord);
    } catch (err) {
      console.error('[loadEstimate]', err);
    } finally {
      setLoading(false);
    }
  }

  // ---------- helpers ----------

  function isLocked(kind: 'work' | 'material', idx: number) {
    return kind === 'work' ? idx < lockedWorkCount : idx < lockedMaterialCount;
  }

  function addWorkItem() {
    setWorkItems(prev => [...prev, { name: '', quantity: 1, unit: 'шт', unitPrice: 0, total: 0 }]);
  }
  function addMaterialItem() {
    setMaterialItems(prev => [...prev, { name: '', quantity: 1, unit: 'шт', unitPrice: 0, total: 0 }]);
  }

  function updateWork(idx: number, field: keyof EstimateWorkItem, value: any) {
    if (isLocked('work', idx)) return;
    setWorkItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
  function updateMaterial(idx: number, field: keyof EstimateMaterialItem, value: any) {
    if (isLocked('material', idx)) return;
    setMaterialItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  function toggleWorkCancelled(idx: number) {
    setWorkItems(prev => prev.map((it, i) => (i === idx ? { ...it, cancelled: !it.cancelled } : it)));
  }
  function toggleMaterialCancelled(idx: number) {
    setMaterialItems(prev => prev.map((it, i) => (i === idx ? { ...it, cancelled: !it.cancelled } : it)));
  }

  function removeWork(idx: number) {
    if (isLocked('work', idx)) return; // нельзя удалять отправленные
    setWorkItems(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }
  function removeMaterial(idx: number) {
    if (isLocked('material', idx)) return;
    setMaterialItems(prev => prev.filter((_, i) => i !== idx));
  }

  // ---------- Upload (реальный, через FormData) ----------

  async function uploadFile(file: File, kind: 'photo' | 'video') {
    const form = new FormData();
    form.append('file', file);
    const res = await photosApi.uploadMedia(form);
    const url = res.data.data?.url;
    if (!url) throw new Error('Сервер не вернул URL');
    if (kind === 'photo') setPhotos(prev => [...prev, url]);
    else setVideos(prev => [...prev, url]);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        await uploadFile(file, 'photo');
      } catch (err: any) {
        toast.error(err?.response?.data?.error?.message || `Не удалось загрузить ${file.name}`);
      }
    }
    e.target.value = '';
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 60 * 1024 * 1024) {
        toast.error(`${file.name}: видео больше 60 МБ`);
        continue;
      }
      try {
        await uploadFile(file, 'video');
      } catch (err: any) {
        toast.error(err?.response?.data?.error?.message || `Не удалось загрузить ${file.name}`);
      }
    }
    e.target.value = '';
  }

  // ---------- Totals (cancelled-строки не учитываются) ----------

  const workTotal = useMemo(
    () => workItems.filter(w => !w.cancelled).reduce((s, w) => s + w.quantity * w.unitPrice, 0),
    [workItems]
  );
  const materialTotal = useMemo(
    () => materialItems.filter(m => !m.cancelled).reduce((s, m) => s + m.quantity * m.unitPrice, 0),
    [materialItems]
  );

  const estimationFee = order?.estimationFee || 0;
  const commissionRate = order?.commissionRate || PLATFORM_COMMISSION_RATE;
  const platformCommission = Math.round((workTotal * commissionRate) / 100);
  const totalAmount = workTotal + materialTotal;
  const masterNet = totalAmount - platformCommission;

  // ---------- Save / Send ----------

  function validate(): boolean {
    const activeWork = workItems.filter(w => !w.cancelled && w.name.trim());
    if (activeWork.length === 0) {
      toast.error('Добавьте хотя бы одну активную позицию работ');
      return false;
    }
    for (const it of activeWork) {
      if (it.unitPrice <= 0 || it.quantity <= 0) {
        toast.error(`Заполните цену и кол-во для "${it.name}"`);
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

  async function handleSave() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const prepWork = workItems
        .filter(w => w.name.trim())
        .map(w => ({
          name: w.name,
          quantity: w.quantity,
          unit: w.unit,
          unitPrice: w.unitPrice,
          total: w.cancelled ? 0 : w.quantity * w.unitPrice,
          cancelled: !!w.cancelled,
        }));
      const prepMaterial = materialItems
        .filter(m => m.name.trim())
        .map(m => ({
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          unitPrice: m.unitPrice,
          total: m.cancelled ? 0 : m.quantity * m.unitPrice,
          cancelled: !!m.cancelled,
        }));

      await estimationApi.createEstimate(orderId!, {
        workItems: prepWork,
        materialItems: prepMaterial,
        estimatedDays,
        notes,
        photos,
        videos,
      });

      toast.success('Смета сохранена');
      await load();
    } catch (err: any) {
      console.error('[saveEstimate]', err?.response?.data || err);
      toast.error(err?.response?.data?.error?.message || 'Ошибка сохранения');
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
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  }

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
          <h1 className="text-xl font-bold">Составление сметы</h1>
          <p className="text-sm text-gray-500">Заказ #{orderId?.slice(0, 8)}</p>
        </div>
      </div>

      {isSent && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-sm text-amber-800 dark:text-amber-300 mb-4">
          Смета отправлена. Старые позиции можно только пометить как «не требуется». Новые работы и материалы добавляйте кнопкой «Добавить».
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
            <Plus size={16} /> {isSent ? 'Доп. работа' : 'Добавить'}
          </button>
        </div>

        <div className="space-y-3">
          {workItems.map((item, idx) => {
            const locked = isLocked('work', idx);
            const cancelled = !!item.cancelled;
            return (
              <div
                key={idx}
                className={`bg-white dark:bg-gray-800 border rounded-xl p-3 transition-opacity ${
                  cancelled ? 'opacity-60 border-red-200 dark:border-red-900/40' : 'dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 font-mono w-5">#{idx + 1}</span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateWork(idx, 'name', e.target.value)}
                    disabled={locked}
                    placeholder="Название работы"
                    className={`flex-1 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${
                      cancelled ? 'line-through text-gray-500' : ''
                    } ${locked ? 'bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed' : ''}`}
                  />
                  {locked ? (
                    <button
                      onClick={() => toggleWorkCancelled(idx)}
                      className={`p-1.5 rounded-lg ${
                        cancelled
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                      }`}
                      title={cancelled ? 'Восстановить' : 'Пометить «не требуется»'}
                    >
                      {cancelled ? <RotateCcw size={16} /> : <Ban size={16} />}
                    </button>
                  ) : (
                    <button onClick={() => removeWork(idx)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Кол-во</label>
                    <input
                      type="number" value={item.quantity} disabled={locked} min={0} step={0.1}
                      onChange={e => updateWork(idx, 'quantity', Math.max(0, Number(e.target.value)))}
                      className={`w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${locked ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Ед.</label>
                    <select
                      value={item.unit} disabled={locked}
                      onChange={e => updateWork(idx, 'unit', e.target.value)}
                      className={`w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${locked ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Цена за ед.</label>
                    <input
                      type="number" value={item.unitPrice} disabled={locked} min={0} step={1000}
                      onChange={e => updateWork(idx, 'unitPrice', Math.max(0, Number(e.target.value)))}
                      className={`w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${locked ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}
                    />
                  </div>
                </div>
                <div className={`text-right text-sm font-semibold mt-2 ${cancelled ? 'line-through text-gray-400' : 'text-primary-600'}`}>
                  = {(item.quantity * item.unitPrice).toLocaleString('ru')} сум
                </div>
              </div>
            );
          })}
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
            <Plus size={16} /> {isSent ? 'Доп. материал' : 'Добавить'}
          </button>
        </div>

        {materialItems.length === 0 && (
          <div className="text-sm text-gray-400 italic">Материалы не добавлены (необязательно)</div>
        )}

        <div className="space-y-3">
          {materialItems.map((item, idx) => {
            const locked = isLocked('material', idx);
            const cancelled = !!item.cancelled;
            return (
              <div
                key={idx}
                className={`bg-white dark:bg-gray-800 border rounded-xl p-3 transition-opacity ${
                  cancelled ? 'opacity-60 border-red-200 dark:border-red-900/40' : 'dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 font-mono w-5">#{idx + 1}</span>
                  <input
                    type="text" value={item.name} disabled={locked}
                    onChange={e => updateMaterial(idx, 'name', e.target.value)}
                    placeholder="Название материала"
                    className={`flex-1 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${
                      cancelled ? 'line-through text-gray-500' : ''
                    } ${locked ? 'bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed' : ''}`}
                  />
                  {locked ? (
                    <button
                      onClick={() => toggleMaterialCancelled(idx)}
                      className={`p-1.5 rounded-lg ${
                        cancelled
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                      }`}
                      title={cancelled ? 'Восстановить' : 'Пометить «не требуется»'}
                    >
                      {cancelled ? <RotateCcw size={16} /> : <Ban size={16} />}
                    </button>
                  ) : (
                    <button onClick={() => removeMaterial(idx)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Кол-во</label>
                    <input
                      type="number" value={item.quantity} disabled={locked} min={0} step={0.1}
                      onChange={e => updateMaterial(idx, 'quantity', Math.max(0, Number(e.target.value)))}
                      className={`w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${locked ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Ед.</label>
                    <select
                      value={item.unit} disabled={locked}
                      onChange={e => updateMaterial(idx, 'unit', e.target.value)}
                      className={`w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${locked ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Цена за ед.</label>
                    <input
                      type="number" value={item.unitPrice} disabled={locked} min={0} step={1000}
                      onChange={e => updateMaterial(idx, 'unitPrice', Math.max(0, Number(e.target.value)))}
                      className={`w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${locked ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}
                    />
                  </div>
                </div>
                <div className={`text-right text-sm font-semibold mt-2 ${cancelled ? 'line-through text-gray-400' : 'text-orange-500'}`}>
                  = {(item.quantity * item.unitPrice).toLocaleString('ru')} сум
                </div>
              </div>
            );
          })}
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
            type="number" value={estimatedDays} min={1}
            onChange={e => setEstimatedDays(Math.max(1, Number(e.target.value)))}
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

        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">Фото замеров, объекта, проблемных мест</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  type="button"
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

        <div>
          <p className="text-xs text-gray-500 mb-2">Видео объекта (необязательно, до 60 МБ)</p>
          <div className="flex flex-wrap gap-2">
            {videos.map((v, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden bg-black">
                <video src={v} className="w-full h-full object-cover" muted />
                <button
                  onClick={() => setVideos(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  type="button"
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
          value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000}
          placeholder="Дополнительные комментарии для клиента..."
          className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 h-24 resize-none"
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

          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
            <span className="flex items-center gap-1">
              <Truck size={12} /> Выезд мастера на оценку:
            </span>
            <span>{estimationFee.toLocaleString('ru')} сум</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Percent size={12} /> Комиссия платформы ({commissionRate}%):
            </span>
            <span>-{platformCommission.toLocaleString('ru')} сум</span>
          </div>

          <div className="border-t dark:border-gray-700 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="font-bold text-base">К оплате клиентом:</span>
              <span className="font-bold text-lg text-primary-600">{totalAmount.toLocaleString('ru')} сум</span>
            </div>
            <div className="flex justify-between text-xs text-green-700 dark:text-green-400 mt-1">
              <span>Мастер получает (после комиссии):</span>
              <span className="font-semibold">{masterNet.toLocaleString('ru')} сум</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 pt-1">
            <span>Срок выполнения:</span>
            <span>{estimatedDays} {estimatedDays === 1 ? 'день' : estimatedDays < 5 ? 'дня' : 'дней'}</span>
          </div>
        </div>
      </div>

      {/* ===== КНОПКИ ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-700 p-4 max-w-2xl mx-auto">
        <div className="flex gap-3">
          <button
            onClick={handleSave} disabled={submitting}
            className="flex-1 py-3 border-2 border-primary-600 text-primary-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50"
          >
            <Save size={18} />
            {isSent ? 'Сохранить изменения' : 'Сохранить'}
          </button>
          {!isSent && (
            <button
              onClick={handleSendToClient} disabled={submitting || !estimate}
              className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-700 disabled:opacity-50"
            >
              <Send size={18} />
              Отправить клиенту
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

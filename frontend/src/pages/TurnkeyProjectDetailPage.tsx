// ============================================
// MasterUz — Детали проекта (ремонт под ключ)
// ============================================

import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { turnkeyApi } from '../api/client';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeft, Calendar, MapPin, Ruler, DoorOpen, Paintbrush, Sofa, CheckCircle2, Circle, Clock, Building2, Home as HomeIcon, Building, Store, Ban, Paperclip, RulerIcon, Palette, Camera } from 'lucide-react';

const statusColors: Record<string, string> = {
  INQUIRY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONSULTATION: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  DESIGNING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  IN_PROGRESS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const propertyTypeIcons: Record<string, any> = {
  apartment: Building2,
  house: HomeIcon,
  office: Building,
  commercial: Store,
};

export function TurnkeyProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['turnkey-project', id],
    queryFn: () => turnkeyApi.getProject(id!).then(r => r.data.data),
    enabled: !!id,
  });

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Ban size={48} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
            {t('common.notFound')}
          </h2>
          <button onClick={() => navigate('/turnkey/my')} className="text-purple-600 hover:underline">
            ← {t('turnkey.myProjects')}
          </button>
        </div>
      </div>
    );
  }

  const completedStages = project.stages?.filter((s: any) => s.status === 'completed').length || 0;
  const totalStages = project.stages?.length || 0;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back button */}
        <Link to="/turnkey/my" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6">
          <ArrowLeft size={16} />
          {t('turnkey.myProjects')}
        </Link>

        {/* Header card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
              {project.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{project.description}</p>
              )}
            </div>
            <span className={`inline-flex px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${statusColors[project.status] || statusColors.INQUIRY}`}>
              {t(`turnkey.status_${project.status}` as any)}
            </span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              {(() => { const Icon = propertyTypeIcons[project.propertyType] || HomeIcon; return <Icon size={20} />; })()}
              <span>{t(`turnkey.${project.propertyType}` as any)}</span>
            </div>
            {project.area && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Ruler size={16} className="text-gray-400" />
                <span>{project.area} м²</span>
              </div>
            )}
            {project.rooms && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <DoorOpen size={16} className="text-gray-400" />
                <span>{project.rooms} {t('turnkey.roomsShort')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar size={16} className="text-gray-400" />
              <span>{new Date(project.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Extra info */}
          <div className="flex flex-wrap gap-3 mt-4">
            {project.designIncluded && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-full">
                <Paintbrush size={12} /> {t('turnkey.withDesign')}
              </span>
            )}
            {project.furnitureIncluded && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full">
                <Sofa size={12} /> {t('turnkey.withFurniture')}
              </span>
            )}
            {project.address && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <MapPin size={12} /> {project.address}{project.city ? `, ${project.city}` : ''}
              </span>
            )}
          </div>

          {/* Budget & price */}
          {(project.budgetMin || project.budgetMax || project.totalPrice) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
              {project.totalPrice && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('turnkey.estimateResult')}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                    {project.totalPrice.toLocaleString()} {t('common.currency')}
                  </p>
                </div>
              )}
              {(project.budgetMin || project.budgetMax) && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('turnkey.priceRange')}</p>
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
                    {project.budgetMin ? `${Number(project.budgetMin).toLocaleString()}` : '—'}
                    {' — '}
                    {project.budgetMax ? `${Number(project.budgetMax).toLocaleString()}` : '—'}
                    {' '}{t('common.currency')}
                  </p>
                </div>
              )}
              {project.estimatedDays && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('turnkey.estimatedDays')}</p>
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
                    {project.estimatedDays} {t('turnkey.days')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('turnkey.progress')}</h2>

          {/* Overall progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>{completedStages} / {totalStages} {t('turnkey.progress').toLowerCase()}</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stages timeline */}
          <div className="space-y-0">
            {project.stages?.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((stage: any, i: number) => {
              const isCompleted = stage.status === 'completed';
              const isActive = stage.status === 'in_progress';
              const isLast = i === (project.stages?.length || 0) - 1;

              return (
                <div key={stage.id} className="flex gap-4">
                  {/* Timeline line + icon */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : isActive
                          ? 'bg-orange-100 dark:bg-orange-900/30 ring-2 ring-orange-400'
                          : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />
                      ) : isActive ? (
                        <Clock size={18} className="text-orange-500" />
                      ) : (
                        <Circle size={18} className="text-gray-400" />
                      )}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 h-12 ${
                        isCompleted ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                    )}
                  </div>

                  {/* Stage info */}
                  <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${
                        isCompleted ? 'text-green-700 dark:text-green-400' :
                        isActive ? 'text-orange-700 dark:text-orange-400 font-semibold' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {stage.name}
                      </h3>
                      {stage.progress > 0 && stage.progress < 100 && (
                        <span className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                          {stage.progress}%
                        </span>
                      )}
                    </div>
                    {stage.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{stage.description}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {stage.startDate && <span><Calendar size={12} className="inline" /> {new Date(stage.startDate).toLocaleDateString()}</span>}
                      {stage.endDate && <span>→ {new Date(stage.endDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floor plan / Design project links */}
        {(project.floorPlanUrl || project.designProjectUrl) && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4"><Paperclip size={18} className="inline" /> Документы</h2>
            <div className="flex flex-wrap gap-3">
              {project.floorPlanUrl && (
                <a href={project.floorPlanUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                  <RulerIcon size={16} className="inline" /> Планировка
                </a>
              )}
              {project.designProjectUrl && (
                <a href={project.designProjectUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                  <Palette size={16} className="inline" /> Дизайн-проект
                </a>
              )}
            </div>
          </div>
        )}

        {/* Images */}
        {project.images && project.images.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4"><Camera size={18} className="inline" /> Фотографии</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {project.images.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Фото ${i + 1}`}
                  className="w-full h-40 object-cover rounded-xl" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MasterUz — Мои проекты (ремонт под ключ)
// ============================================

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { turnkeyApi } from '../api/client';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Building2, Home as HomeIcon, Building, Store, MapPin, Calendar, DollarSign } from 'lucide-react';

const statusColors: Record<string, string> = {
  INQUIRY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONSULTATION: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  DESIGNING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  IN_PROGRESS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function MyTurnkeyProjectsPage() {
  const { t } = useTranslation();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['my-turnkey-projects'],
    queryFn: () => turnkeyApi.getMyProjects().then(r => r.data.data),
  });

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('turnkey.myProjects')}</h1>
          <Link to="/turnkey"
            className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition">
            + {t('turnkey.newProject')}
          </Link>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="text-center py-16">
            <Building size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('turnkey.noProjects')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1 mb-4">{t('turnkey.noProjectsDesc')}</p>
            <Link to="/turnkey" className="inline-block px-6 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition">
              {t('turnkey.createFirst')}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project: any) => {
              const completedStages = project.stages?.filter((s: any) => s.status === 'completed').length || 0;
              const totalStages = project.stages?.length || 0;
              const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

              return (
                <Link key={project.id} to={`/turnkey/${project.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{project.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {project.propertyType === 'apartment' ? <Building2 size={14} className="inline" /> :
                         project.propertyType === 'house' ? <HomeIcon size={14} className="inline" /> :
                         project.propertyType === 'office' ? <Building size={14} className="inline" /> : <Store size={14} className="inline" />}
                        {' '}{project.area ? `${project.area} м²` : ''} {project.rooms ? `• ${project.rooms} ${t('turnkey.roomsShort')}` : ''}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || statusColors.INQUIRY}`}>
                      {t(`turnkey.status_${project.status}` as any)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>{t('turnkey.progress')}: {completedStages}/{totalStages}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {project.totalPrice && <span><DollarSign size={12} className="inline" /> {project.totalPrice.toLocaleString()} {t('common.currency')}</span>}
                    {project.address && <span><MapPin size={12} className="inline" /> {project.address}</span>}
                    <span><Calendar size={12} className="inline" /> {new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

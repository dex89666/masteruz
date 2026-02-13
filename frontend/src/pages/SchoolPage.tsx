// ============================================
// MasterUz — School Page (Школа мастеров)
// Агент 2 (Фронтенд-разработчик)
// ============================================

import { useEffect, useState } from 'react';
import { schoolApi } from '../api/client';
import { useTelegram } from '../hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  BookOpen, CheckCircle, Lock, Play, Clock, Award,
  ChevronRight, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { SchoolCourse, CourseProgress } from '../types';
import { useTranslation } from '../i18n';

export function SchoolPage() {
  const { t } = useTranslation();
  const { hapticNotification } = useTelegram();
  const [courses, setCourses] = useState<SchoolCourse[]>([]);
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<SchoolCourse | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [coursesRes, progressRes] = await Promise.all([
        schoolApi.getCourses(),
        schoolApi.getProgress().catch(() => ({ data: { data: [] } })),
      ]);
      setCourses(coursesRes.data.data || []);
      setProgress(progressRes.data.data || []);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  }

  function isCompleted(courseId: string) {
    return progress.some((p) => p.courseId === courseId && p.completed);
  }

  async function handleCompleteCourse(courseId: string) {
    setCompleting(true);
    try {
      await schoolApi.completeCourse(courseId);
      hapticNotification?.('success');
      toast.success(t('school.courseCompleted'));
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setCompleting(false);
    }
  }

  const requiredCourses = courses.filter((c) => c.isRequired);
  const optionalCourses = courses.filter((c) => !c.isRequired);
  const completedRequired = requiredCourses.filter((c) => isCompleted(c.id)).length;
  const allRequiredCompleted = completedRequired === requiredCourses.length && requiredCourses.length > 0;

  if (loading) return <LoadingSpinner />;

  // Course detail view
  if (activeCourse) {
    const completed = isCompleted(activeCourse.id);
    return (
      <div className="page-container pb-20">
        <button
          onClick={() => setActiveCourse(null)}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4"
        >
          <ArrowLeft size={18} className="mr-1" />
          {t('school.backToCourses')}
        </button>

        <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
          <div className="flex items-start justify-between mb-3">
            <h1 className="text-xl font-bold dark:text-white">{activeCourse.title}</h1>
            {completed && (
              <span className="badge bg-green-100 text-green-700">
                <CheckCircle size={14} className="mr-1" />
                {t('school.completed')}
              </span>
            )}
          </div>

          {activeCourse.isRequired && (
            <span className="badge bg-red-100 text-red-700 mb-3">{t('school.required')}</span>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <span className="flex items-center">
              <Clock size={14} className="mr-1" />
              {activeCourse.durationMinutes || 30} {t('common.min')}
            </span>
            <span className="flex items-center">
              <BookOpen size={14} className="mr-1" />
              {t('school.order')} {activeCourse.order}
            </span>
          </div>
        </div>

        {/* Содержание курса */}
        <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
          <h2 className="font-semibold mb-3 dark:text-white">{t('school.courseContent')}</h2>
          <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {activeCourse.content || t('school.contentPlaceholder')}
          </div>
        </div>

        {/* Видео (если есть) */}
        {activeCourse.videoUrl && (
          <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
            <h2 className="font-semibold mb-3 dark:text-white">{t('school.videoLesson')}</h2>
            <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <a
                href={activeCourse.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-primary-600 hover:text-primary-700"
              >
                <Play size={32} className="mr-2" />
                {t('school.watchVideo')}
              </a>
            </div>
          </div>
        )}

        {/* Кнопка завершения */}
        {!completed && (
          <button
            onClick={() => handleCompleteCourse(activeCourse.id)}
            disabled={completing}
            className="btn-primary w-full py-3"
          >
            {completing ? t('school.completing') : (
              <>
                <CheckCircle size={18} className="mr-2" />
                {t('school.completeCourse')}
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="page-container pb-20">
      <h1 className="page-title">{t('school.title')}</h1>

      {/* Прогресс-бар */}
      <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold dark:text-white">{t('school.yourProgress')}</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {completedRequired}/{requiredCourses.length} {t('school.requiredOf')}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
          <div
            className="bg-primary-600 h-3 rounded-full transition-all duration-500"
            style={{
              width: requiredCourses.length
                ? `${(completedRequired / requiredCourses.length) * 100}%`
                : '0%',
            }}
          />
        </div>
        {allRequiredCompleted ? (
          <div className="flex items-center text-green-600 text-sm">
            <Award size={16} className="mr-2" />
            {t('school.allCompleted')}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {t('school.completeForVerification')}
          </p>
        )}
      </div>

      {/* Обязательные курсы */}
      {requiredCourses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Lock size={18} className="mr-2 text-red-500" />
            {t('school.requiredCourses')}
          </h2>
          <div className="space-y-3">
            {requiredCourses.map((course) => {
              const completed = isCompleted(course.id);
              return (
                <button
                  key={course.id}
                  onClick={() => setActiveCourse(course)}
                  className="card dark:bg-gray-800 dark:ring-gray-700 w-full text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          completed
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-primary-100 dark:bg-primary-900/30'
                        }`}
                      >
                        {completed ? (
                          <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <BookOpen size={20} className="text-primary-600 dark:text-primary-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium dark:text-white">{course.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {course.durationMinutes || 30} {t('common.min')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Дополнительные курсы */}
      {optionalCourses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <BookOpen size={18} className="mr-2 text-primary-500" />
            {t('school.additionalCourses')}
          </h2>
          <div className="space-y-3">
            {optionalCourses.map((course) => {
              const completed = isCompleted(course.id);
              return (
                <button
                  key={course.id}
                  onClick={() => setActiveCourse(course)}
                  className="card dark:bg-gray-800 dark:ring-gray-700 w-full text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          completed
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        {completed ? (
                          <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <Play size={20} className="text-gray-600 dark:text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium dark:text-white">{course.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {course.durationMinutes || 30} {t('common.min')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MasterUz — School Page (Школа мастеров)
// С анти-скип системой, квизами и видео-трекингом
// ============================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { schoolApi } from '../api/client';
import { useTelegram } from '../hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  BookOpen, CheckCircle, Lock, Play, Clock, Award,
  ChevronRight, ArrowLeft, AlertTriangle, Eye, HelpCircle, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { SchoolCourse, CourseProgress, SchoolProgressData, QuizResult } from '../types';

type ViewMode = 'list' | 'course' | 'quiz' | 'result';

export function SchoolPage() {
  const { hapticNotification } = useTelegram();
  const [courses, setCourses] = useState<SchoolCourse[]>([]);
  const [progressData, setProgressData] = useState<SchoolProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<SchoolCourse | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [completing, setCompleting] = useState(false);

  // Video tracking state
  const [videoTimer, setVideoTimer] = useState(0);
  const [videoRunning, setVideoRunning] = useState(false);
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [videoSaving, setVideoSaving] = useState(false);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    loadData();
    return () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    };
  }, []);

  async function loadData() {
    try {
      const [coursesRes, progressRes] = await Promise.all([
        schoolApi.getCourses(),
        schoolApi.getProgress().catch(() => ({ data: { data: null } })),
      ]);
      setCourses(coursesRes.data.data || []);
      const pd = progressRes.data.data;
      if (pd && pd.progress) {
        setProgressData(pd);
      } else {
        setProgressData({
          totalCourses: 0,
          completedCourses: 0,
          requiredCourses: 0,
          completedRequired: 0,
          isSchoolCompleted: false,
          progress: [],
        });
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      setProgressData({
        totalCourses: 0,
        completedCourses: 0,
        requiredCourses: 0,
        completedRequired: 0,
        isSchoolCompleted: false,
        progress: [],
      });
    } finally {
      setLoading(false);
    }
  }

  function getProgressForCourse(courseId: string): CourseProgress | undefined {
    return progressData?.progress?.find((p) => p.courseId === courseId);
  }

  function isCompleted(courseId: string): boolean {
    return !!getProgressForCourse(courseId)?.completed;
  }

  function isVideoCompleted(courseId: string): boolean {
    return !!getProgressForCourse(courseId)?.videoCompleted;
  }

  // ═══════════════════════════════════════
  // Video timer logic (anti-skip)
  // ═══════════════════════════════════════

  const startVideoTimer = useCallback(() => {
    if (videoIntervalRef.current) return;
    setVideoRunning(true);
    videoIntervalRef.current = setInterval(() => {
      setVideoTimer((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopVideoTimer = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    setVideoRunning(false);
  }, []);

  async function saveVideoProgress() {
    if (!activeCourse) return;
    setVideoSaving(true);
    try {
      const res = await schoolApi.updateVideoProgress(activeCourse.id, videoTimer);
      const data = res.data.data;
      if (data.videoCompleted) {
        hapticNotification?.('success');
        toast.success('Видео просмотрено! ✅');
        await loadData();
      }
      return data;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка сохранения прогресса');
    } finally {
      setVideoSaving(false);
    }
  }

  function openCourse(course: SchoolCourse) {
    setActiveCourse(course);
    setViewMode('course');
    setQuizAnswers({});
    setQuizResult(null);

    // Load existing video progress
    const progress = getProgressForCourse(course.id);
    setVideoTimer(progress?.videoWatchedSec || 0);
    setVideoRunning(false);
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
  }

  function goBack() {
    stopVideoTimer();
    if (viewMode === 'result') {
      setViewMode('list');
      setActiveCourse(null);
    } else if (viewMode === 'quiz') {
      setViewMode('course');
    } else {
      setViewMode('list');
      setActiveCourse(null);
    }
  }

  // ═══════════════════════════════════════
  // Quiz submission
  // ═══════════════════════════════════════

  async function handleSubmitQuiz() {
    if (!activeCourse?.questions?.length) return;

    const answersArr: number[] = [];
    for (let i = 0; i < activeCourse.questions.length; i++) {
      answersArr.push(quizAnswers[i] ?? -1);
    }

    // Validate all questions answered
    const unanswered = answersArr.filter((a) => a === -1).length;
    if (unanswered > 0) {
      toast.error(`Ответьте на все вопросы (не отвечено: ${unanswered})`);
      return;
    }

    setQuizSubmitting(true);
    try {
      const res = await schoolApi.submitQuiz(activeCourse.id, answersArr);
      const result: QuizResult = res.data.data;
      setQuizResult(result);
      setViewMode('result');

      if (result.passed) {
        hapticNotification?.('success');
        toast.success(`Тест пройден! Результат: ${result.score}% 🎉`);
      } else {
        hapticNotification?.('error');
        toast.error(`Не пройден. Результат: ${result.score}%. Нужно ${result.passingScore}%`);
      }

      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка отправки теста');
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function handleCompleteCourse(courseId: string) {
    setCompleting(true);
    try {
      await schoolApi.completeCourse(courseId);
      hapticNotification?.('success');
      toast.success('Курс завершён! 🎉');
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка');
    } finally {
      setCompleting(false);
    }
  }

  // ═══════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════

  const requiredCourses = courses.filter((c) => c.isRequired);
  const optionalCourses = courses.filter((c) => !c.isRequired);
  const completedRequired = requiredCourses.filter((c) => isCompleted(c.id)).length;
  const allRequiredCompleted = completedRequired === requiredCourses.length && requiredCourses.length > 0;

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) return <LoadingSpinner />;

  // ═══════════════════════════════════════
  // VIEW: Quiz Result
  // ═══════════════════════════════════════
  if (viewMode === 'result' && quizResult && activeCourse) {
    return (
      <div className="page-container pb-20">
        <button onClick={goBack} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 mb-4">
          <ArrowLeft size={18} className="mr-1" />
          Назад к курсам
        </button>

        <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center py-8">
          {quizResult.passed ? (
            <>
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Award size={40} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">Тест пройден! 🎉</h2>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={40} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Тест не пройден</h2>
            </>
          )}

          <div className="text-4xl font-bold dark:text-white mb-2">{quizResult.score}%</div>
          <p className="text-gray-500 dark:text-gray-400 mb-1">
            Правильных ответов: {quizResult.correctCount} из {quizResult.totalQuestions}
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Проходной балл: {quizResult.passingScore}% · Попытка №{quizResult.attempts}
          </p>

          {!quizResult.passed && (
            <button
              onClick={() => {
                setQuizAnswers({});
                setQuizResult(null);
                setViewMode('quiz');
              }}
              className="btn-primary mx-auto"
            >
              <RotateCcw size={18} className="mr-2" />
              Попробовать ещё раз
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // VIEW: Quiz
  // ═══════════════════════════════════════
  if (viewMode === 'quiz' && activeCourse?.questions?.length) {
    const questions = activeCourse.questions;
    return (
      <div className="page-container pb-20">
        <button onClick={goBack} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 mb-4">
          <ArrowLeft size={18} className="mr-1" />
          Назад к уроку
        </button>

        <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
          <h1 className="text-lg font-bold dark:text-white mb-1">Проверочный тест</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeCourse.title} · Проходной балл: {activeCourse.passingScore || 70}%
          </p>
        </div>

        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div key={q.id} className="card dark:bg-gray-800 dark:ring-gray-700">
              <h3 className="font-medium dark:text-white mb-3">
                <span className="text-primary-600 mr-2">{qIdx + 1}.</span>
                {q.question}
              </h3>
              <div className="space-y-2">
                {(q.options as string[]).map((opt, optIdx) => {
                  const selected = quizAnswers[qIdx] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-2 ${
                        selected
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="dark:text-gray-200">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Отвечено: {Object.keys(quizAnswers).length}/{questions.length}
          </span>
          <button
            onClick={handleSubmitQuiz}
            disabled={quizSubmitting}
            className="btn-primary px-6 py-3"
          >
            {quizSubmitting ? 'Проверка...' : 'Отправить ответы'}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // VIEW: Course Detail
  // ═══════════════════════════════════════
  if (viewMode === 'course' && activeCourse) {
    const completed = isCompleted(activeCourse.id);
    const progress = getProgressForCourse(activeCourse.id);
    const hasVideo = !!activeCourse.videoUrl;
    const hasQuiz = !!(activeCourse.questions && activeCourse.questions.length > 0);
    const durationSec = (activeCourse.durationMinutes || 1) * 60;
    const requiredSec = Math.floor(durationSec * 0.8);
    const vidCompleted = progress?.videoCompleted || isVideoCompleted(activeCourse.id);
    const quizPassed = !!progress?.quizPassedAt;

    return (
      <div className="page-container pb-20">
        <button onClick={goBack} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4">
          <ArrowLeft size={18} className="mr-1" />
          Назад к курсам
        </button>

        {/* Header */}
        <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
          <div className="flex items-start justify-between mb-3">
            <h1 className="text-xl font-bold dark:text-white">{activeCourse.title}</h1>
            {completed && (
              <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle size={14} className="mr-1" />
                Пройден
              </span>
            )}
          </div>

          {activeCourse.isRequired && (
            <span className="badge bg-red-100 text-red-700 mb-3">Обязательный</span>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <span className="flex items-center">
              <Clock size={14} className="mr-1" />
              {activeCourse.durationMinutes || 30} мин
            </span>
            {hasQuiz && (
              <span className="flex items-center">
                <HelpCircle size={14} className="mr-1" />
                {activeCourse.questions!.length} вопросов
              </span>
            )}
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-2 text-xs">
            {hasVideo && (
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                vidCompleted
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {vidCompleted ? <CheckCircle size={12} /> : <Play size={12} />}
                Видео
              </span>
            )}
            {hasQuiz && (
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                quizPassed
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {quizPassed ? <CheckCircle size={12} /> : <HelpCircle size={12} />}
                Тест
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
          <h2 className="font-semibold mb-3 dark:text-white">Содержание курса</h2>
          <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {activeCourse.content || 'Содержание курса будет доступно после добавления администратором.'}
          </div>
        </div>

        {/* Video section with anti-skip */}
        {hasVideo && (
          <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
            <h2 className="font-semibold mb-3 dark:text-white flex items-center">
              <Play size={18} className="mr-2 text-primary-600" />
              Видеоурок
            </h2>

            {vidCompleted ? (
              <div className="flex items-center text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mb-3">
                <CheckCircle size={18} className="mr-2" />
                Видео просмотрено ✅
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3 rounded-lg mb-3">
                <div className="flex items-center text-yellow-700 dark:text-yellow-400 text-sm mb-2">
                  <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
                  Необходимо просмотреть не менее 80% видео ({formatTime(requiredSec)})
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((videoTimer / requiredSec) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Просмотрено: {formatTime(videoTimer)}</span>
                  <span>Нужно: {formatTime(requiredSec)}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Open video link */}
              <a
                href={activeCourse.videoUrl!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (!vidCompleted) startVideoTimer();
                }}
                className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Play size={20} />
                {vidCompleted ? 'Пересмотреть видео' : 'Смотреть видео'}
              </a>

              {/* Timer controls (only if video not completed) */}
              {!vidCompleted && (
                <div className="flex gap-2">
                  {videoRunning ? (
                    <button
                      onClick={() => {
                        stopVideoTimer();
                        saveVideoProgress();
                      }}
                      disabled={videoSaving}
                      className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
                    >
                      <Eye size={16} className="inline mr-1" />
                      {videoSaving ? 'Сохранение...' : `Остановить и сохранить (${formatTime(videoTimer)})`}
                    </button>
                  ) : videoTimer > 0 ? (
                    <>
                      <button
                        onClick={startVideoTimer}
                        className="flex-1 py-2 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg text-sm"
                      >
                        Продолжить просмотр
                      </button>
                      <button
                        onClick={saveVideoProgress}
                        disabled={videoSaving}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                      >
                        {videoSaving ? '...' : 'Сохранить'}
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quiz / Complete section */}
        {!completed && (
          <div className="space-y-3">
            {hasQuiz ? (
              <button
                onClick={() => {
                  stopVideoTimer();
                  setQuizAnswers({});
                  setViewMode('quiz');
                }}
                disabled={hasVideo && !vidCompleted}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  hasVideo && !vidCompleted
                    ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                <HelpCircle size={18} />
                {hasVideo && !vidCompleted
                  ? 'Сначала посмотрите видео'
                  : 'Пройти тест'}
              </button>
            ) : (
              <button
                onClick={() => handleCompleteCourse(activeCourse.id)}
                disabled={completing || (hasVideo && !vidCompleted)}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  hasVideo && !vidCompleted
                    ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                    : 'btn-primary'
                }`}
              >
                {completing ? 'Завершение...' : (
                  <>
                    <CheckCircle size={18} />
                    {hasVideo && !vidCompleted
                      ? 'Сначала посмотрите видео'
                      : 'Завершить курс'}
                  </>
                )}
              </button>
            )}

            {progress && progress.quizAttempts > 0 && !progress.quizPassedAt && (
              <p className="text-center text-sm text-gray-500">
                Последний результат: {progress.quizScore}% · Попыток: {progress.quizAttempts}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // VIEW: Course List
  // ═══════════════════════════════════════
  return (
    <div className="page-container pb-20">
      <h1 className="page-title">Школа мастеров</h1>

      {/* Progress bar */}
      <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold dark:text-white">Ваш прогресс</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {completedRequired}/{requiredCourses.length} обязательных
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
            Все обязательные курсы пройдены! Вы можете получить верификацию.
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Пройдите все обязательные курсы для верификации аккаунта мастера
          </p>
        )}
      </div>

      {/* No courses */}
      {courses.length === 0 && (
        <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center py-12">
          <BookOpen size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium dark:text-white mb-2">Курсы скоро появятся</h3>
          <p className="text-gray-500 dark:text-gray-400">Администратор ещё не добавил учебные материалы</p>
        </div>
      )}

      {/* Required courses */}
      {requiredCourses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center dark:text-white">
            <Lock size={18} className="mr-2 text-red-500" />
            Обязательные курсы
          </h2>
          <div className="space-y-3">
            {requiredCourses.map((course) => {
              const completed = isCompleted(course.id);
              const hasQuiz = (course._count?.questions || 0) > 0;
              return (
                <button
                  key={course.id}
                  onClick={() => openCourse(course)}
                  className="card dark:bg-gray-800 dark:ring-gray-700 w-full text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                        completed
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-primary-100 dark:bg-primary-900/30'
                      }`}>
                        {completed ? (
                          <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <BookOpen size={20} className="text-primary-600 dark:text-primary-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium dark:text-white">{course.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <span>{course.durationMinutes || 30} мин</span>
                          {hasQuiz && (
                            <span className="flex items-center gap-0.5">
                              <HelpCircle size={12} />
                              Тест
                            </span>
                          )}
                        </div>
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

      {/* Optional courses */}
      {optionalCourses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center dark:text-white">
            <BookOpen size={18} className="mr-2 text-primary-500" />
            Дополнительные курсы
          </h2>
          <div className="space-y-3">
            {optionalCourses.map((course) => {
              const completed = isCompleted(course.id);
              const hasQuiz = (course._count?.questions || 0) > 0;
              return (
                <button
                  key={course.id}
                  onClick={() => openCourse(course)}
                  className="card dark:bg-gray-800 dark:ring-gray-700 w-full text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                        completed
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        {completed ? (
                          <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <Play size={20} className="text-gray-600 dark:text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium dark:text-white">{course.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <span>{course.durationMinutes || 30} мин</span>
                          {hasQuiz && (
                            <span className="flex items-center gap-0.5">
                              <HelpCircle size={12} />
                              Тест
                            </span>
                          )}
                        </div>
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

import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { forumApi } from '../api/client';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MessageSquare, Plus, Pin, Lock, ArrowLeft, Send, Trash2, Camera, Image, X, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Компонент выбора фото (галерея + камера) ───
function PhotoPicker({ images, onChange, max = 5 }: { images: File[]; onChange: (files: File[]) => void; max?: number }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, max - images.length);
    onChange([...images, ...newFiles]);
  };

  const removeFile = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {images.map((file, idx) => (
            <div key={idx} className="relative w-16 h-16">
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < max && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Image size={14} />
            Галерея
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Camera size={14} />
            Камера
          </button>
          <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={e => addFiles(e.target.files)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => addFiles(e.target.files)} />
        </div>
      )}
    </div>
  );
}

// ─── Компонент отображения изображений ───
function ForumImages({ images }: { images?: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (!images || images.length === 0) return null;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {images.map((url, idx) => (
          <img
            key={idx}
            src={url}
            alt={`Фото ${idx + 1}`}
            className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setLightbox(url)}
          />
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] rounded-xl" />
        </div>
      )}
    </>
  );
}

// ─── Список тем ───
export function ForumPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMaster = user?.role === 'MASTER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadTopics(); }, [page]);

  async function loadTopics() {
    setLoading(true);
    try {
      const res = await forumApi.getTopics(page);
      setTopics(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function handleCreateTopic() {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await forumApi.createTopic(newTitle.trim(), newContent.trim(), newImages.length > 0 ? newImages : undefined);
      toast.success(t('forum.topicCreated'));
      setShowCreate(false);
      setNewTitle('');
      setNewContent('');
      setNewImages([]);
      navigate(`/forum/${res.data.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally { setSubmitting(false); }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title mb-0">{t('forum.title')}</h1>
        {isMaster && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
            <Plus size={16} className="mr-1" />
            {t('forum.newTopic')}
          </button>
        )}
      </div>

      {!isMaster && (
        <div className="card mb-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-300 dark:border-yellow-700 text-sm text-yellow-700 dark:text-yellow-400">
          {t('forum.mastersOnly')}
        </div>
      )}

      {showCreate && (
        <div className="card mb-4 border-2 border-primary-300 dark:border-primary-700">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('forum.topicTitle')}
            className="input w-full mb-3"
            maxLength={200}
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={t('forum.topicContent')}
            className="input w-full mb-3"
            rows={4}
            maxLength={5000}
          />
          <div className="mb-3">
            <PhotoPicker images={newImages} onChange={setNewImages} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateTopic}
              disabled={submitting || !newTitle.trim() || !newContent.trim()}
              className="btn-primary text-sm"
            >
              {submitting ? '...' : t('forum.publish')}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('forum.noTopics')}</h3>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              to={`/forum/${topic.id}`}
              className="card block hover:shadow-md dark:hover:shadow-black/20 transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  {topic.isPinned ? <Pin size={18} className="text-primary-600" /> : <MessageSquare size={18} className="text-primary-600 dark:text-primary-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {topic.isPinned && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Pin size={10} className="inline" /></span>}
                    {topic.isLocked && <Lock size={12} className="text-gray-400" />}
                    <h3 className="font-medium text-sm truncate dark:text-white">{topic.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span><Wrench size={12} className="inline" /> {topic.author?.profile?.firstName || '?'}</span>
                    <span><MessageSquare size={12} className="inline" /> {topic._count?.posts || 0}</span>
                    <span>{new Date(topic.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1.5 rounded-lg text-sm ${page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Тема с постами ───
export function ForumTopicPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isMaster = user?.role === 'MASTER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [topic, setTopic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [postImages, setPostImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadTopic(); }, [id]);

  async function loadTopic() {
    setLoading(true);
    try {
      const res = await forumApi.getTopic(id!);
      setTopic(res.data.data);
    } catch {
      toast.error(t('forum.topicNotFound'));
      navigate('/forum');
    } finally { setLoading(false); }
  }

  async function handlePost() {
    if (!newPost.trim()) return;
    setSubmitting(true);
    try {
      await forumApi.createPost(id!, newPost.trim(), postImages.length > 0 ? postImages : undefined);
      setNewPost('');
      setPostImages([]);
      loadTopic();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    try {
      await forumApi.deleteTopic(id!);
      toast.success(t('forum.topicDeleted'));
      navigate('/forum');
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('common.error'));
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!topic) return null;

  return (
    <div className="page-container pb-20">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/forum')} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title mb-0 truncate flex-1">{topic.title}</h1>
        {(topic.authorId === user?.id || isAdmin) && (
          <button onClick={handleDelete} className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Original post */}
      <div className="card mb-4 border-l-4 border-primary-500">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
            <Wrench size={12} className="inline" /> {topic.author?.profile?.firstName || '?'}
          </span>
          <span className="text-xs text-gray-400">{new Date(topic.createdAt).toLocaleString()}</span>
          {topic.isPinned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Pin size={10} className="inline" /></span>}
          {topic.isLocked && <Lock size={12} className="text-gray-400" />}
        </div>
        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{topic.content}</p>
        <ForumImages images={topic.images} />
      </div>

      {/* Posts */}
      {topic.posts?.length > 0 && (
        <div className="space-y-2 mb-4">
          {topic.posts.map((post: any) => (
            <div key={post.id} className="card">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <Wrench size={12} className="inline" /> {post.author?.profile?.firstName || '?'}
                </span>
                <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{post.content}</p>
              <ForumImages images={post.images} />
            </div>
          ))}
        </div>
      )}

      {/* Reply */}
      {isMaster && !topic.isLocked && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder={t('forum.replyPlaceholder')}
              className="input flex-1 text-sm"
              rows={2}
              maxLength={3000}
            />
            <button
              onClick={handlePost}
              disabled={submitting || !newPost.trim()}
              className="btn-primary self-end px-4"
            >
              <Send size={16} />
            </button>
          </div>
          <PhotoPicker images={postImages} onChange={setPostImages} />
        </div>
      )}

      {topic.isLocked && (
        <div className="card bg-gray-50 dark:bg-gray-800 text-sm text-gray-500 flex items-center gap-2">
          <Lock size={14} />
          {t('forum.locked')}
        </div>
      )}
    </div>
  );
}

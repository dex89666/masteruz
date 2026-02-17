// ============================================
// MasterUz — Profile Page (i18n)
// ============================================

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { referralsApi } from '../api/client';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import { ProfileSkeleton } from '../components/PageSkeletons';
import {
  User, Phone, MapPin, Star, Award, Copy, Share2,
  LogOut, Settings, BookOpen, Shield, Edit3, ChevronRight,
  Briefcase, Clock, CreditCard, Camera, Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const [referralLink, setReferralLink] = useState('');
  const [referralStats, setReferralStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadProfileData();
  }, [user]);

  async function loadProfileData() {
    try {
      const promises: Promise<any>[] = [];
      promises.push(
        referralsApi.getLink().then((r) => setReferralLink(r.data.data?.link || '')).catch(() => {})
      );
      promises.push(
        referralsApi.getStats().then((r) => setReferralStats(r.data.data)).catch(() => {})
      );
      await Promise.all(promises);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyReferral() {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast.success(t('profile.linkCopied'));
    }
  }

  function handleShare() {
    if (referralLink && navigator.share) {
      navigator.share({
        title: t('profile.shareTitle'),
        text: t('profile.shareText'),
        url: referralLink,
      });
    } else {
      handleCopyReferral();
    }
  }

  function handleLogout() {
    logout();
    toast.success(t('profile.logoutConfirm'));
    navigate('/');
  }

  if (!user) return null;
  if (loading) return <ProfileSkeleton />;

  const isMaster = user.role === 'MASTER';
  const masterProfile = user.masterProfile;

  return (
    <div className="page-container pb-20">
      <h1 className="page-title">{t('profile.title')}</h1>

      {/* Основная информация */}
      <div className="card mb-4">
        <div className="flex items-center gap-4">
          {user.profile?.avatarUrl ? (
            <img
              src={user.profile.avatarUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <User size={28} className="text-primary-600 dark:text-primary-400" />
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold dark:text-white">
              {user.profile?.firstName || t('profile.user')}{' '}
              {user.profile?.lastName || ''}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username || user.telegramId}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge ${
                user.role === 'MASTER' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                user.role === 'ADMIN' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {t(`roles.${user.role}`)}
              </span>
              {user.isVerified && (
                <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <Shield size={12} className="mr-1" /> {t('common.verified')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link to="/my-orders" className="card flex items-center gap-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
          <Briefcase size={20} className="text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-medium dark:text-white">{t('nav.myOrders')}</span>
        </Link>
        {isMaster && (
          <Link to="/dashboard" className="card flex items-center gap-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
            <Star size={20} className="text-yellow-500" />
            <span className="text-sm font-medium dark:text-white">{t('nav.dashboard')}</span>
          </Link>
        )}
        {!isMaster && (
          <Link to="/orders/create" className="card flex items-center gap-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
            <Edit3 size={20} className="text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium dark:text-white">{t('orders.createOrder')}</span>
          </Link>
        )}
        <Link to="/settings" className="card flex items-center gap-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
          <Settings size={20} className="text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium dark:text-white">{t('settings.title')}</span>
        </Link>
        <Link to="/payments" className="card flex items-center gap-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
          <CreditCard size={20} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium dark:text-white">{t('payments.title')}</span>
        </Link>
        <Link to="/balance" className="card flex items-center gap-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
          <Wallet size={20} className="text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium dark:text-white">{t('balance.title')}</span>
        </Link>
        {isMaster && (
          <Link to="/portfolio" className="card flex items-center gap-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow col-span-2">
            <Camera size={20} className="text-pink-600 dark:text-pink-400" />
            <span className="text-sm font-medium dark:text-white">{t('portfolio.title')}</span>
          </Link>
        )}
      </div>

      {/* Контактная информация */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3 dark:text-white">{t('profile.contactInfo')}</h3>
        <div className="space-y-2 text-sm">
          {user.profile?.phone && (
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <Phone size={16} className="mr-2" />
              {user.profile.phone}
            </div>
          )}
          {user.profile?.city && (
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <MapPin size={16} className="mr-2" />
              {user.profile.city}
            </div>
          )}
        </div>
      </div>

      {/* Профиль мастера */}
      {isMaster && masterProfile && (
        <div className="card mb-4">
          <h3 className="font-semibold mb-3 dark:text-white">{t('profile.masterProfile')}</h3>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="flex items-center justify-center mb-1">
                <Star size={18} className="text-yellow-400 mr-1" />
                <span className="text-xl font-bold dark:text-white">
                  {masterProfile.rating?.toFixed(1) || '—'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.rating')}</p>
            </div>
            <div>
              <div className="text-xl font-bold text-primary-600 dark:text-primary-400">
                {masterProfile.completedOrders || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.ordersCompleted')}</p>
            </div>
            <div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {masterProfile.totalEarnings
                  ? `${(masterProfile.totalEarnings / 1000).toFixed(0)}к`
                  : '0'}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.earnings')}</p>
            </div>
          </div>

          {masterProfile.bio && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{masterProfile.bio}</p>
          )}

          {masterProfile.experience && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <Clock size={14} className="inline mr-1" />
              {t('profile.experience')} {masterProfile.experience} {t('profile.yearsShort')}
            </div>
          )}

          {!masterProfile.schoolCompleted && (
            <Link
              to="/school"
              className="flex items-center justify-between mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
            >
              <div className="flex items-center">
                <BookOpen size={18} className="text-yellow-600 dark:text-yellow-400 mr-2" />
                <span className="text-sm text-yellow-800 dark:text-yellow-300">
                  {t('profile.schoolBanner')}
                </span>
              </div>
              <ChevronRight size={16} className="text-yellow-600 dark:text-yellow-400" />
            </Link>
          )}
        </div>
      )}

      {/* Стать мастером */}
      {!isMaster && user.role === 'CLIENT' && (
        <Link to="/become-master" className="card mb-4 block hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mr-3">
                <Briefcase size={20} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="font-semibold dark:text-white">{t('profile.becomeMaster')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.becomeMasterDesc')}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
          </div>
        </Link>
      )}

      {/* Реферальная программа */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3 dark:text-white">
          <Award size={18} className="inline mr-2 text-primary-500 dark:text-primary-400" />
          {t('profile.referralProgram')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {t('profile.referralDesc')}
        </p>

        {referralLink && (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="input flex-1 text-sm"
            />
            <button onClick={handleCopyReferral} className="btn-secondary">
              <Copy size={16} />
            </button>
            <button onClick={handleShare} className="btn-primary">
              <Share2 size={16} />
            </button>
          </div>
        )}

        {referralStats && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="font-bold text-primary-600 dark:text-primary-400">
                {referralStats.totalReferrals || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.invited')}</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="font-bold text-green-600 dark:text-green-400">
                {referralStats.completedReferrals || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.active')}</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="font-bold text-yellow-600 dark:text-yellow-400">
                {referralStats.totalEarned || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.earned')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Действия */}
      <div className="space-y-2">
        {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <Link
            to="/admin"
            className="flex items-center justify-between p-3 card hover:shadow-md dark:hover:shadow-black/20"
          >
            <div className="flex items-center">
              <Settings size={18} className="text-gray-600 dark:text-gray-400 mr-3" />
              <span className="dark:text-white">{t('profile.adminPanel')}</span>
            </div>
            <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center w-full p-3 card hover:shadow-md dark:hover:shadow-black/20 text-red-600 dark:text-red-400"
        >
          <LogOut size={18} className="mr-3" />
          <span>{t('nav.logout')}</span>
        </button>
      </div>
    </div>
  );
}

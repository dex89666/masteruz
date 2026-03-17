// ============================================
// MasterUz — About / FAQ Page
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import {
  ChevronDown,
  ChevronUp,
  Shield,
  Award,
  Clock,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Star,
  Users,
  Wrench,
  Heart,
} from 'lucide-react';

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="font-medium text-gray-800 dark:text-gray-200 pr-4">{question}</span>
        {open ? (
          <ChevronUp size={20} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}

export function AboutPage() {
  const { t } = useTranslation();

  const faqItems = [
    { q: t('about.faq1q'), a: t('about.faq1a') },
    { q: t('about.faq2q'), a: t('about.faq2a') },
    { q: t('about.faq3q'), a: t('about.faq3a') },
    { q: t('about.faq4q'), a: t('about.faq4a') },
    { q: t('about.faq5q'), a: t('about.faq5a') },
    { q: t('about.faq6q'), a: t('about.faq6a') },
    { q: t('about.faq7q'), a: t('about.faq7a') },
    { q: t('about.faq8q'), a: t('about.faq8a') },
  ];

  const stats = [
    { icon: Users, value: '10 000+', label: t('about.statUsers') },
    { icon: Wrench, value: '300+', label: t('about.statServices') },
    { icon: Star, value: '4.8', label: t('about.statRating') },
    { icon: MapPin, value: '8', label: t('about.statCities') },
  ];

  const advantages = [
    { icon: Shield, title: t('about.adv1title'), desc: t('about.adv1desc') },
    { icon: Award, title: t('about.adv2title'), desc: t('about.adv2desc') },
    { icon: Clock, title: t('about.adv3title'), desc: t('about.adv3desc') },
    { icon: Heart, title: t('about.adv4title'), desc: t('about.adv4desc') },
  ];

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4">
            {t('about.heroTitle')}
          </h1>
          <p className="text-lg text-primary-100 max-w-2xl mx-auto">
            {t('about.heroDesc')}
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-4 -mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 text-center">
              <stat.icon size={28} className="text-primary-600 dark:text-primary-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('about.aboutTitle')}</h2>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{t('about.aboutP1')}</p>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{t('about.aboutP2')}</p>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{t('about.aboutP3')}</p>
      </section>

      {/* Advantages */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            {t('about.advantagesTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {advantages.map((adv, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 flex gap-4">
                <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <adv.icon size={24} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{adv.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{adv.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - for clients */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
          {t('about.howWorksClient')}
        </h2>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                {step}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t(`about.clientStep${step}title` as any)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t(`about.clientStep${step}desc` as any)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works - for masters */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            {t('about.howWorksMaster')}
          </h2>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  {step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {t(`about.masterStep${step}title` as any)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t(`about.masterStep${step}desc` as any)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
          {t('about.faqTitle')}
        </h2>
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <FAQItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </section>

      {/* Contacts */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            {t('about.contactsTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center">
              <Phone size={28} className="text-primary-600 dark:text-primary-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-1 dark:text-white">{t('about.contactPhone')}</h3>
              <a href="tel:+998901234567" className="text-primary-600 dark:text-primary-400 hover:underline text-sm">
                +998 90 123-45-67
              </a>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center">
              <MessageCircle size={28} className="text-primary-600 dark:text-primary-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-1 dark:text-white">Telegram</h3>
              <a href="https://t.me/masteruz_support" className="text-primary-600 dark:text-primary-400 hover:underline text-sm">
                @masteruz_support
              </a>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center">
              <Mail size={28} className="text-primary-600 dark:text-primary-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-1 dark:text-white">Email</h3>
              <a href="mailto:info@masteruz.uz" className="text-primary-600 dark:text-primary-400 hover:underline text-sm">
                info@masteruz.uz
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('about.ctaTitle')}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('about.ctaDesc')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/orders/create" className="btn-primary px-6 py-3 text-sm font-semibold">
            {t('home.findMaster')}
          </Link>
          <Link to="/become-master" className="btn-secondary px-6 py-3 text-sm font-semibold">
            {t('home.becomeMaster')}
          </Link>
        </div>
      </section>
    </div>
  );
}

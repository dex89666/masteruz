// ============================================
// MasterUz — Onboarding Component
// Приветственный тур для новых пользователей
// ============================================

import { useState } from 'react';
import { useTranslation } from '../i18n';
import {
  Search, Shield, Star, Zap, ChevronRight, ChevronLeft, Check, Wrench
} from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    key: 'welcome',
    icon: Wrench,
    gradient: 'from-primary-500 to-primary-700',
  },
  {
    key: 'findMaster',
    icon: Search,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    key: 'quality',
    icon: Shield,
    gradient: 'from-green-500 to-emerald-600',
  },
  {
    key: 'reviews',
    icon: Star,
    gradient: 'from-yellow-500 to-orange-500',
  },
  {
    key: 'getStarted',
    icon: Zap,
    gradient: 'from-purple-500 to-pink-500',
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const currentStep = STEPS[step];

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  }

  function handlePrev() {
    if (step > 0) {
      setStep(step - 1);
    }
  }

  function handleSkip() {
    onComplete();
  }

  const IconComp = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          {t('onboarding.skip')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* Icon */}
        <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${currentStep.gradient} flex items-center justify-center mb-8 shadow-xl animate-scale-in`}>
          <IconComp size={48} className="text-white" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3 animate-fade-in">
          {t(`onboarding.${currentStep.key}_title`)}
        </h1>

        {/* Description */}
        <p className="text-gray-500 leading-relaxed max-w-sm animate-fade-in">
          {t(`onboarding.${currentStep.key}_desc`)}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === step
                ? 'w-8 h-2 bg-primary-500'
                : i < step
                ? 'w-2 h-2 bg-primary-300'
                : 'w-2 h-2 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-8 pb-8 safe-area-pb">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            step === 0
              ? 'text-transparent cursor-default'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ChevronLeft size={18} />
          {t('common.back')}
        </button>

        <button
          onClick={handleNext}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white transition-all shadow-lg hover:shadow-xl bg-gradient-to-r ${currentStep.gradient}`}
        >
          {step === STEPS.length - 1 ? (
            <>
              <Check size={18} />
              {t('onboarding.start')}
            </>
          ) : (
            <>
              {t('onboarding.next')}
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

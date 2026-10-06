// ============================================
// MasterUz — useVoiceInput
// Голосовой ввод для всего сайта.
//
// Два способа распознавания:
//  1. live — Web Speech API (Chrome на десктопе/Android, Safari): текст
//     появляется по мере речи, сервер не нужен;
//  2. server — пишем аудио через MediaRecorder и распознаём на сервере (Whisper).
//
// В Android WebView (наше APK, Telegram Mini App) webkitSpeechRecognition
// объявлен, но не работает: сразу падает с `not-allowed`/`service-not-allowed`,
// хотя доступ к микрофону выдан. Раньше это показывалось как «доступ к
// микрофону запрещён». Поэтому там сразу пишем аудио, а в остальных браузерах
// при любой ошибке сервиса речи переключаемся на запись.
//
// Live-распознавание не держит микрофон параллельным getUserMedia: на Android
// это занимает микрофон и ломает распознавание (`audio-capture`).
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';
import { instantOrderApi } from '../api/client';
import { useTranslation } from '../i18n';

/** Ошибки Web Speech API, после которых пробуем записать аудио и распознать на сервере. */
const SERVER_FALLBACK_ERRORS = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'];

function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/** Android WebView (наше приложение, Telegram, другие встроенные браузеры). */
function isAndroidWebView(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Android/i.test(ua) && (/; wv\)/.test(ua) || /Telegram/i.test(ua) || !!(window as any).Telegram?.WebApp?.initData);
}

interface UseVoiceInputOptions {
  /** Текст по ходу live-распознавания (промежуточный, весь накопленный). */
  onLiveText?: (text: string) => void;
  /** Итоговый текст: конец live-распознавания или ответ сервера. */
  onFinalText: (text: string, source: 'live' | 'server') => void;
  /** Можно ли отправлять аудио на сервер (эндпоинт требует авторизации). */
  serverAllowed: boolean;
  /** Что сказать, если live недоступен, а сервер — нельзя (например, гость). */
  onServerUnavailable?: () => void;
  lang?: string;
}

export function useVoiceInput({
  onLiveText,
  onFinalText,
  serverAllowed,
  onServerUnavailable,
  lang = 'ru-RU',
}: UseVoiceInputOptions) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Колбэки держим в ref, чтобы start/stop не пересоздавались на каждый рендер
  const cbRef = useRef({ onLiveText, onFinalText, onServerUnavailable });
  cbRef.current = { onLiveText, onFinalText, onServerUnavailable };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  // Уходим со страницы — отпускаем микрофон
  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseStream();
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      toast(t('instant.recognizing'), { icon: '🎙️', duration: 2000 });
      const res = await instantOrderApi.transcribe(blob);
      const text = res.data.data?.text?.trim() || '';
      if (!text) {
        toast.error(t('instant.speechNotRecognized'));
        return;
      }
      cbRef.current.onFinalText(text, 'server');
      toast.success(t('instant.voiceRecognized'));
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || t('instant.recognitionError'));
    } finally {
      setIsTranscribing(false);
    }
  }, [t]);

  const startServerRecording = useCallback(async () => {
    if (!serverAllowed) {
      if (cbRef.current.onServerUnavailable) cbRef.current.onServerUnavailable();
      else toast.error(t('calculator.voiceUnsupported'));
      setIsRecording(false);
      return;
    }
    try {
      // На Android (APK) это вызывает системный запрос RECORD_AUDIO через Capacitor
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Android любит audio/webm;opus, iOS — audio/mp4
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        releaseStream();
        recorderRef.current = null;
        setIsRecording(false);
        const blob = new Blob(chunks, { type: (recorder.mimeType || 'audio/webm').split(';')[0] });
        if (blob.size < 1024) {
          toast.error(t('instant.recordingTooShort'));
          return;
        }
        await transcribe(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      toast(t('instant.speakNow'), { icon: '🎙️', duration: 2500 });
    } catch (err: any) {
      releaseStream();
      setIsRecording(false);
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') toast.error(t('instant.micDeniedSettings'));
      else if (name === 'NotFoundError') toast.error(t('instant.micNotFound'));
      else toast.error(t('instant.micAccessFailed'));
    }
  }, [serverAllowed, t, transcribe]);

  const startLive = useCallback((SpeechRecognition: any) => {
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let finalText = '';
    let interim = '';
    let gotResult = false;
    let switchedToServer = false;

    recognition.onresult = (event: any) => {
      gotResult = true;
      interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript + ' ';
        else interim = transcript;
      }
      const text = (finalText + interim).trim();
      if (text) cbRef.current.onLiveText?.(text);
    };

    recognition.onerror = (event: any) => {
      // Сервис речи недоступен (WebView, нет сети к Google) — пишем аудио сами.
      // Если микрофон действительно запрещён, getUserMedia скажет об этом точнее.
      if (!gotResult && SERVER_FALLBACK_ERRORS.includes(event.error)) {
        switchedToServer = true;
        recognitionRef.current = null;
        void startServerRecording();
        return;
      }
      if (event.error === 'no-speech') toast.error(t('instant.noSpeech'));
    };

    recognition.onend = () => {
      if (switchedToServer) return;
      recognitionRef.current = null;
      setIsRecording(false);
      // Последние слова могли не успеть стать isFinal — добавляем промежуточный текст
      const text = (finalText + ' ' + interim).trim();
      if (text) {
        cbRef.current.onFinalText(text, 'live');
        toast.success(t('instant.voiceRecognized'));
      } else if (gotResult) {
        toast.error(t('instant.speechFailed'));
      }
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      toast(t('instant.speakLive'), { duration: 2000 });
    } catch {
      recognitionRef.current = null;
      void startServerRecording();
    }
  }, [lang, startServerRecording, t]);

  const start = useCallback(() => {
    if (isRecording || isTranscribing) return;
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition || isAndroidWebView()) {
      void startServerRecording();
      return;
    }
    startLive(SpeechRecognition);
  }, [isRecording, isTranscribing, startLive, startServerRecording]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return; // isRecording сбросит onend
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop(); // распознавание запустит onstop
      return;
    }
    setIsRecording(false);
  }, []);

  return { isRecording, isTranscribing, start, stop };
}

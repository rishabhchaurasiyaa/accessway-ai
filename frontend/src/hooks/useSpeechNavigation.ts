import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSpeechNavigationReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  currentSpeakingIndex: number | null;
  speak: (text: string, stepIndex?: number) => void;
  speakSequence: (steps: { step: number; speech_text: string }[]) => void;
  stop: () => void;
}

export const useSpeechNavigation = (): UseSpeechNavigationReturn => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentSpeakingIndex, setCurrentSpeakingIndex] = useState<number | null>(null);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (synthRef.current) {
        isCancelledRef.current = true;
        synthRef.current.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    setCurrentSpeakingIndex(null);
  }, []);

  const speak = useCallback((text: string, stepIndex?: number) => {
    if (!synthRef.current) return;

    // Cancel any ongoing speech
    stop();
    isCancelledRef.current = false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Slightly slower, more intelligible speech
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (stepIndex !== undefined) {
        setCurrentSpeakingIndex(stepIndex);
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentSpeakingIndex(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentSpeakingIndex(null);
    };

    synthRef.current.speak(utterance);
  }, [stop]);

  const speakSequence = useCallback((steps: { step: number; speech_text: string }[]) => {
    if (!synthRef.current || steps.length === 0) return;

    stop();
    isCancelledRef.current = false;

    let index = 0;

    const speakNext = () => {
      if (isCancelledRef.current || index >= steps.length) {
        setIsSpeaking(false);
        setCurrentSpeakingIndex(null);
        return;
      }

      const item = steps[index];
      const utterance = new SpeechSynthesisUtterance(`Step ${item.step}: ${item.speech_text}`);
      utterance.rate = 0.95;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setCurrentSpeakingIndex(item.step);
      };

      utterance.onend = () => {
        index++;
        if (!isCancelledRef.current && index < steps.length) {
          // brief pause between steps
          setTimeout(speakNext, 600);
        } else {
          setIsSpeaking(false);
          setCurrentSpeakingIndex(null);
        }
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setCurrentSpeakingIndex(null);
      };

      synthRef.current?.speak(utterance);
    };

    speakNext();
  }, [stop]);

  return {
    isSupported,
    isSpeaking,
    currentSpeakingIndex,
    speak,
    speakSequence,
    stop
  };
};

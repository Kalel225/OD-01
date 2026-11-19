import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const LOGO_CHARS = ['O', 'D', '-', '0', '1'] as const;

interface CharFlightTarget {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const charRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const completedRef = useRef(false);
  const [phase, setPhase] = useState<'REVEAL' | 'FLY'>('REVEAL');
  const [targets, setTargets] = useState<CharFlightTarget[] | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const triggerCompleteOnce = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setReducedMotion(true);
      const t = window.setTimeout(triggerCompleteOnce, 300);
      return () => window.clearTimeout(t);
    }

    let cancelled = false;
    let fallbackTimer: number | undefined;

    const startFlight = () => {
      if (cancelled) return;
      const computed: CharFlightTarget[] = [];

      for (let i = 0; i < LOGO_CHARS.length; i++) {
        const srcEl = charRefs.current[i];
        const dstEl = document.querySelector<HTMLElement>(`[data-od01-nav-char="${i}"]`);

        if (srcEl && dstEl) {
          const srcRect = srcEl.getBoundingClientRect();
          const dstRect = dstEl.getBoundingClientRect();

          // Exact top-left anchor FLIP delta & per-axis glyph box scale
          const dx = dstRect.left - srcRect.left;
          const dy = dstRect.top - srcRect.top;
          const scaleX = srcRect.width > 0 ? dstRect.width / srcRect.width : 1;
          const scaleY = srcRect.height > 0 ? dstRect.height / srcRect.height : scaleX;

          computed.push({ x: dx, y: dy, scaleX, scaleY });
        } else {
          computed.push({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
        }
      }

      setTargets(computed);
      setPhase('FLY');

      // Safety fallback in case tab was backgrounded during motion animation
      fallbackTimer = window.setTimeout(triggerCompleteOnce, 1400);
    };

    // Wait for letter-by-letter reveal AND webfont readiness so measurements are sub-pixel exact
    const revealTimer = window.setTimeout(() => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          window.requestAnimationFrame(startFlight);
        });
      } else {
        window.requestAnimationFrame(startFlight);
      }
    }, 1020);

    return () => {
      cancelled = true;
      window.clearTimeout(revealTimer);
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [onComplete]);

  return (
    <div
      aria-label="Chargement OD-01"
      className="fixed inset-0 z-[100] flex items-center justify-center select-none"
      style={{ pointerEvents: phase === 'FLY' ? 'none' : 'auto' }}
    >
      {/* Pure white gallery backdrop that dissolves smoothly as characters travel to navbar */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === 'FLY' || reducedMotion ? 0 : 1 }}
        transition={{
          delay: phase === 'FLY' ? 0.12 : 0,
          duration: reducedMotion ? 0.25 : 0.68,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="absolute inset-0 bg-white"
      />

      {/* Centered Logo: exact matching typography & tracking-free flex gap for sub-pixel FLIP */}
      <div
        className="relative z-10 inline-flex items-center gap-[0.16em] text-[30px] font-bold leading-none tracking-normal text-black sm:text-[34px]"
        aria-hidden="true"
      >
        {LOGO_CHARS.map((char, index) => {
          const target = targets?.[index];
          const isFlying = phase === 'FLY' && target !== undefined;
          const isLast = index === LOGO_CHARS.length - 1;

          return (
            <motion.span
              key={`${char}-${index}`}
              ref={(el) => {
                charRefs.current[index] = el;
              }}
              initial={{ opacity: 0, y: 12, x: 0, scaleX: 1, scaleY: 1 }}
              animate={
                isFlying
                  ? {
                      opacity: 1,
                      x: target.x,
                      y: target.y,
                      scaleX: target.scaleX,
                      scaleY: target.scaleY,
                    }
                  : {
                      opacity: 1,
                      x: 0,
                      y: 0,
                      scaleX: 1,
                      scaleY: 1,
                    }
              }
              transition={
                isFlying
                  ? {
                      delay: index * 0.085,
                      duration: 0.72,
                      ease: [0.16, 1, 0.3, 1],
                    }
                  : {
                      delay: 0.08 + index * 0.13,
                      duration: 0.34,
                      ease: [0.16, 1, 0.3, 1],
                    }
              }
              onAnimationComplete={() => {
                if (isFlying && isLast) {
                  triggerCompleteOnce();
                }
              }}
              style={{ originX: 0, originY: 0 }}
              className="inline-block leading-none tracking-normal will-change-transform"
            >
              {char}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
};

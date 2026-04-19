/**
 * BuilderOnboarding — 4-step guided tour for first-time builder users.
 *
 * Highlights key UI areas with a spotlight overlay and tooltip.
 * Shows once per user via localStorage key `crr_builder_tour_done`.
 * Can be re-shown from a help menu.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'crr_builder_tour_done';

interface Step {
  title: string;
  body: string;
  /** CSS selector to highlight. If the element isn't found, center on screen. */
  target: string;
  /** Arrow direction relative to the tooltip */
  position: 'bottom' | 'top' | 'left' | 'right';
}

const STEPS: Step[] = [
  {
    title: 'Drag blocks from the left panel',
    body: 'Browse components by category and drag them onto the canvas to build your page layout.',
    target: '[class*="Puck-leftSideBar"], [class*="leftSideBar"], [data-puck-component-list]',
    position: 'right',
  },
  {
    title: 'Click any section to edit',
    body: 'Select a section on the canvas and its settings will appear in the right panel. Edit text, images, and options there.',
    target: '[class*="Puck-rightSideBar"], [class*="rightSideBar"], [data-puck-fields]',
    position: 'left',
  },
  {
    title: 'Preview, checkpoint, or publish',
    body: 'Use the toolbar at the top to toggle viewport sizes, save checkpoints, preview the live page, or publish your changes.',
    target: '[data-builder-toolbar]',
    position: 'bottom',
  },
  {
    title: 'Restore any previous version',
    body: 'Click "History" to see all your saved versions. You can instantly restore any previous state of the page.',
    target: '[data-builder-history-btn]',
    position: 'bottom',
  },
];

interface Props {
  /** Set to true to force-show (from a help menu). */
  forceShow?: boolean;
  onDismiss?: () => void;
}

export function BuilderOnboarding({ forceShow = false, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setStep(0);
      return;
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Delay slightly to let Puck mount
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable
    }
  }, [forceShow]);

  // Find target element rect for the current step
  useEffect(() => {
    if (!visible) return;
    const currentStep = STEPS[step];
    if (!currentStep) return;

    const findTarget = () => {
      const selectors = currentStep.target.split(', ');
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel.trim());
          if (el) {
            setRect(el.getBoundingClientRect());
            return;
          }
        } catch {
          // Invalid selector, skip
        }
      }
      // Fallback: center screen
      setRect(null);
    };

    findTarget();
    const timer = setTimeout(findTarget, 300);
    return () => clearTimeout(timer);
  }, [visible, step]);

  const finish = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage unavailable
    }
    onDismiss?.();
  }, [onDismiss]);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const currentStep = STEPS[step];
  if (!currentStep) return null;

  // Tooltip position
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 100002,
    background: 'var(--c-surface, #fff)',
    border: '1px solid var(--c-border, #e5e5e5)',
    borderRadius: 'var(--r-lg, 8px)',
    padding: 'var(--sp-4, 1rem)',
    boxShadow: '0 8px 30px rgba(0,0,0,.2)',
    maxWidth: 340,
    width: 340,
    fontFamily: 'var(--sans, system-ui, sans-serif)',
  };

  if (rect) {
    const pad = 12;
    switch (currentStep.position) {
      case 'right':
        tooltipStyle.left = rect.right + pad;
        tooltipStyle.top = rect.top + rect.height / 2 - 60;
        break;
      case 'left':
        tooltipStyle.right = window.innerWidth - rect.left + pad;
        tooltipStyle.top = rect.top + rect.height / 2 - 60;
        break;
      case 'bottom':
        tooltipStyle.left = rect.left + rect.width / 2 - 170;
        tooltipStyle.top = rect.bottom + pad;
        break;
      case 'top':
        tooltipStyle.left = rect.left + rect.width / 2 - 170;
        tooltipStyle.bottom = window.innerHeight - rect.top + pad;
        break;
    }
  } else {
    // Center on screen
    tooltipStyle.left = '50%';
    tooltipStyle.top = '40%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  // Clamp tooltip to viewport
  if (typeof tooltipStyle.left === 'number') {
    tooltipStyle.left = Math.max(16, Math.min(tooltipStyle.left, window.innerWidth - 360));
  }
  if (typeof tooltipStyle.top === 'number') {
    tooltipStyle.top = Math.max(16, Math.min(tooltipStyle.top, window.innerHeight - 200));
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.45)',
          zIndex: 100000,
        }}
        onClick={finish}
      />

      {/* Highlight cutout */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            border: '3px solid var(--c-accent, #c4622d)',
            borderRadius: 'var(--r-md, 6px)',
            zIndex: 100001,
            pointerEvents: 'none',
            boxShadow: '0 0 0 9999px rgba(0,0,0,.45)',
          }}
        />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-2, 0.5rem)' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: 24,
                height: 3,
                borderRadius: 2,
                background: i === step ? 'var(--c-accent, #c4622d)' : 'var(--c-border, #e5e5e5)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <div style={{ fontWeight: 600, fontSize: 'var(--fs-base, 0.9375rem)', marginBottom: 'var(--sp-1, 0.25rem)' }}>
          {currentStep.title}
        </div>
        <div style={{ fontSize: 'var(--fs-sm, 0.875rem)', color: 'var(--c-muted, #666)', lineHeight: 1.5, marginBottom: 'var(--sp-3, 0.75rem)' }}>
          {currentStep.body}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={finish}
            style={{ fontSize: 'var(--fs-xs)' }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 'var(--sp-2, 0.5rem)' }}>
            {step > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={prev}>
                Back
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={next}>
              {step === STEPS.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Utility hook: returns { showTour, triggerTour } so a help menu can re-show.
 */
export function useOnboardingTour() {
  const [showTour, setShowTour] = useState(false);

  const triggerTour = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setShowTour(true);
  }, []);

  const dismissTour = useCallback(() => {
    setShowTour(false);
  }, []);

  return { showTour, triggerTour, dismissTour };
}

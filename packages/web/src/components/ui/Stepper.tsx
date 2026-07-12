import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode } from 'react';

export type StepVisualState = 'completed' | 'current' | 'upcoming' | 'failed' | 'skipped';

export interface StepperStepData {
  id: string;
  title: string;
  state: StepVisualState;
  description?: string;
}

interface StepperProps {
  steps: StepperStepData[];
  currentStepIndex: number;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  stepIdPrefix?: string;
}

interface StepNodeProps {
  state: StepVisualState;
  stepNumber: number;
}

function CheckIconAnimated(): JSX.Element {
  return (
    <motion.svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.path
        d="M5 13l4 4L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.05 }}
      />
    </motion.svg>
  );
}

function XIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function StepNodeContent({ state, stepNumber }: StepNodeProps): ReactNode {
  if (state === 'completed') {
    return <CheckIconAnimated />;
  }

  if (state === 'failed') {
    return <XIcon />;
  }

  return <span>{stepNumber}</span>;
}

function getNodeClasses(state: StepVisualState): string {
  if (state === 'completed') {
    return 'bg-emerald-600 text-white';
  }
  if (state === 'current') {
    return 'bg-slate-950 text-white';
  }
  if (state === 'failed') {
    return 'bg-rose-600 text-white';
  }
  if (state === 'skipped') {
    return 'border-2 border-dashed border-slate-300 bg-white text-slate-400';
  }
  return 'border border-slate-300 bg-white text-slate-600';
}

function getStepTitleClassName(state: StepVisualState, isCurrent: boolean): string {
  if (state === 'completed') {
    return 'text-emerald-700';
  }
  if (state === 'failed') {
    return 'text-rose-700';
  }
  if (state === 'current' || isCurrent) {
    return 'text-slate-950';
  }
  if (state === 'skipped') {
    return 'text-slate-400';
  }
  return 'text-slate-500';
}

function StepNode({ state, stepNumber }: StepNodeProps): JSX.Element {
  const baseClasses = 'relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium';

  // 使用 AnimatePresence + key 触发“状态切换”动画，而不是只在首次渲染时动画。
  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${state}-${stepNumber}`}
          className={`${baseClasses} ${getNodeClasses(state)}`}
          initial={{ opacity: 0, scale: 0.92, y: 0 }}
          animate={
            state === 'current'
              ? {
                  opacity: 1,
                  scale: [1, 1.03, 1],
                  boxShadow: ['0 0 0 rgba(15,23,42,0)', '0 0 14px rgba(15,23,42,0.22)', '0 0 0 rgba(15,23,42,0)'],
                }
              : state === 'completed'
                ? {
                    opacity: 1,
                    scale: [0.92, 1.06, 1],
                    boxShadow: ['0 0 0 rgba(5,150,105,0)', '0 0 16px rgba(5,150,105,0.28)', '0 0 0 rgba(5,150,105,0)'],
                  }
                : state === 'failed'
                  ? {
                      opacity: 1,
                      scale: [1, 1.03, 1],
                      x: [0, -3, 3, -2, 2, 0],
                      boxShadow: ['0 0 0 rgba(225,29,72,0)', '0 0 16px rgba(225,29,72,0.3)', '0 0 0 rgba(225,29,72,0)'],
                    }
                  : state === 'upcoming'
                    ? { opacity: 1, scale: 1 }
                    : state === 'skipped'
                      ? { opacity: 0.65, scale: 1 }
                      : { opacity: 1, scale: 1 }
          }
          exit={{ opacity: 0, scale: 0.95, y: 0, x: 0 }}
          transition={
            state === 'current'
              ? { duration: 1.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
            : state === 'completed'
                ? { type: 'spring', stiffness: 520, damping: 26 }
            : state === 'failed'
                  ? { duration: 0.42, ease: 'easeOut' }
              : state === 'upcoming'
                ? { duration: 0.2, ease: 'easeOut' }
              : { duration: 0.25, ease: 'easeOut' }
          }
        >
          <div className="relative z-10">{StepNodeContent({ state, stepNumber })}</div>

          {state === 'current' ? (
            <>
              <motion.div
                className="pointer-events-none absolute -inset-2 z-0 rounded-full bg-slate-950/15 blur-md"
                animate={{ opacity: [0.16, 0.34, 0.16] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="pointer-events-none absolute inset-0 z-0 rounded-full border-2 border-slate-950/40"
                animate={{ scale: [1, 1.32], opacity: [0.24, 0] }}
                transition={{ duration: 1.25, repeat: Infinity, ease: 'easeOut' }}
              />
            </>
          ) : null}

          {state === 'failed' ? (
            <motion.div
              className="pointer-events-none absolute -inset-2 z-0 rounded-full bg-rose-600/15 blur-md"
              animate={{ opacity: [0.12, 0.28, 0.12] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

interface StepConnectorProps {
  state: StepVisualState;
  orientation: 'horizontal' | 'vertical';
}

function StepConnector({ state, orientation }: StepConnectorProps): JSX.Element {
  const baseClasses = orientation === 'horizontal' ? 'h-0.5 flex-1' : 'w-0.5 h-12 mx-auto';

  const trackClasses = 'relative overflow-hidden rounded-full bg-slate-200';
  const fillBaseClasses = 'absolute inset-0 rounded-full';
  const transformOrigin = orientation === 'horizontal' ? '0% 50%' : '50% 0%';
  const axisScale = orientation === 'horizontal' ? 'scaleX' : 'scaleY';

  const fillColorClasses =
    state === 'completed'
      ? 'bg-emerald-600'
      : state === 'failed'
        ? 'bg-rose-600'
        : state === 'current'
          ? 'bg-gradient-to-r from-slate-950 via-slate-700 to-slate-950'
          : state === 'skipped'
            ? 'bg-slate-300'
            : 'bg-slate-300';

  // 用 key 强制重启动画：状态变化时连接线“扫过/填充”。
  return (
    <div className={`${baseClasses} ${trackClasses}`}>
      <motion.div
        key={`${orientation}-${state}`}
        className={`${fillBaseClasses} ${fillColorClasses}`}
        style={{ transformOrigin }}
        initial={{ [axisScale]: 0 } as Record<string, number>}
        animate={
          state === 'completed'
            ? ({ [axisScale]: 1 } as Record<string, number>)
            : state === 'failed'
              ? ({ [axisScale]: 1, opacity: [1, 0.6, 1] } as Record<string, number | number[]>)
              : state === 'current'
                ? ({ [axisScale]: [0.18, 0.72, 0.28] } as Record<string, number[]>)
                : state === 'skipped'
                  ? ({ [axisScale]: 0.25, opacity: 0.4 } as Record<string, number>)
                  : ({ [axisScale]: 0 } as Record<string, number>)
        }
        transition={
          state === 'completed'
            ? { duration: 0.6, ease: 'easeOut' }
            : state === 'failed'
              ? { duration: 0.55, ease: 'easeOut' }
              : state === 'current'
                ? { duration: 1.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
                : { duration: 0.25, ease: 'easeOut' }
        }
      />
    </div>
  );
}

function HorizontalStepper({ steps, currentStepIndex, className, stepIdPrefix }: Omit<StepperProps, 'orientation'>): JSX.Element {
  return (
    <div className={`flex items-center ${className}`}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} id={stepIdPrefix ? `${stepIdPrefix}-${step.id}` : undefined} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <StepNode state={step.state} stepNumber={index + 1} />
              <div className="mt-2 text-center">
                <div
                  className={`text-xs font-medium ${getStepTitleClassName(step.state, index === currentStepIndex)}`}
                  aria-current={index === currentStepIndex ? 'step' : undefined}
                >
                  {step.title}
                </div>
                {step.description ? <div className="mt-0.5 text-xs text-slate-500">{step.description}</div> : null}
              </div>
            </div>

            {!isLast ? <StepConnector state={step.state} orientation="horizontal" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function VerticalStepper({ steps, currentStepIndex, className, stepIdPrefix }: Omit<StepperProps, 'orientation'>): JSX.Element {
  return (
    <div className={`space-y-0 ${className}`}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} id={stepIdPrefix ? `${stepIdPrefix}-${step.id}` : undefined} className="flex">
            <div className="flex flex-col items-center">
              <StepNode state={step.state} stepNumber={index + 1} />
              {!isLast ? <StepConnector state={step.state} orientation="vertical" /> : null}
            </div>

            <div className="ml-4 pb-8">
              <div
                className={`text-sm font-medium ${getStepTitleClassName(step.state, index === currentStepIndex)}`}
                aria-current={index === currentStepIndex ? 'step' : undefined}
              >
                {step.title}
              </div>
              {step.description ? <div className="mt-1 text-xs text-slate-500">{step.description}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Stepper({ steps, currentStepIndex, orientation = 'horizontal', className = '', stepIdPrefix }: StepperProps): JSX.Element {
  if (orientation === 'vertical') {
    return <VerticalStepper steps={steps} currentStepIndex={currentStepIndex} className={className} stepIdPrefix={stepIdPrefix} />;
  }

  return <HorizontalStepper steps={steps} currentStepIndex={currentStepIndex} className={className} stepIdPrefix={stepIdPrefix} />;
}

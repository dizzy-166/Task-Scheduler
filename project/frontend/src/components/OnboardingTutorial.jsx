import { useState, useEffect, useLayoutEffect, useRef } from 'react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в Поток! 👋',
    text: 'Давайте познакомимся с основными возможностями системы. Это займёт меньше минуты.',
    target: null,
  },
  {
    id: 'nav',
    title: 'Разделы системы',
    text: 'Здесь находятся все разделы: Канбан, Список задач, Аналитика, Диаграмма Ганта и Отчёты. Переключайтесь между ними в один клик.',
    target: '.sidebar-nav-views',
    position: 'right',
  },
  {
    id: 'company',
    title: 'Компании и проекты',
    text: 'Выбирайте активную компанию и проект. Вы можете состоять в нескольких компаниях и переключаться между ними.',
    target: '.sidebar-nav-section',
    position: 'right',
  },
  {
    id: 'new-task',
    title: 'Создание задач',
    text: 'Нажмите сюда, чтобы создать новую задачу. Укажите название, исполнителя, срок и приоритет.',
    target: '.btn-new-task',
    position: 'bottom-left',
  },
  {
    id: 'header',
    title: 'Уведомления и настройки',
    text: 'Здесь — уведомления о событиях, переключатель темы оформления и генерация задач с помощью ИИ.',
    target: '.header-actions',
    position: 'bottom-left',
  },
  {
    id: 'done',
    title: 'Всё готово! 🎉',
    text: 'Вы познакомились с основными возможностями. Создайте первую задачу, чтобы начать работу!',
    target: null,
  },
];

const TOOLTIP_W = 320;
const PAD = 16;

function getRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
}

function calcTooltipStyle(rect, position) {
  if (!rect) return {};
  switch (position) {
    case 'right':
      return {
        top:  rect.top + rect.height / 2,
        left: rect.right + PAD,
        transform: 'translateY(-50%)',
      };
    case 'bottom-left':
      return {
        top:   rect.bottom + PAD,
        right: Math.max(PAD, window.innerWidth - rect.right),
      };
    default:
      return {
        top:  rect.top + rect.height / 2,
        left: rect.right + PAD,
        transform: 'translateY(-50%)',
      };
  }
}

export default function OnboardingTutorial({ userId, onDone }) {
  const [step, setStep]   = useState(0);
  const [rect, setRect]   = useState(null);
  const [ready, setReady] = useState(false);
  const rafRef = useRef(null);

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  // Measure target element position
  useLayoutEffect(() => {
    setReady(false);
    if (!current.target) {
      setRect(null);
      setReady(true);
      return;
    }
    // Allow DOM to settle, then measure
    rafRef.current = requestAnimationFrame(() => {
      setRect(getRect(current.target));
      setReady(true);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, current.target]);

  // Re-measure on resize
  useEffect(() => {
    if (!current.target) return;
    const onResize = () => setRect(getRect(current.target));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [current.target]);

  const finish = () => {
    localStorage.setItem(`tutorial_done_${userId}`, '1');
    onDone();
  };

  const next = () => (isLast ? finish() : setStep(s => s + 1));
  const prev = () => setStep(s => s - 1);

  if (!ready) return null;

  const isCentered    = !current.target;
  const tooltipStyle  = isCentered ? {} : calcTooltipStyle(rect, current.position);
  const spotlightInset = rect
    ? { top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }
    : null;

  return (
    <div className={`ob-overlay${isCentered ? ' ob-overlay--dim' : ''}`} onClick={isCentered ? undefined : undefined}>

      {/* Spotlight ring around target */}
      {spotlightInset && (
        <div className="ob-spotlight" style={spotlightInset} />
      )}

      {/* Tooltip card */}
      <div
        className={`ob-tooltip${isCentered ? ' ob-tooltip--center' : ''}`}
        style={isCentered ? undefined : { position: 'fixed', width: TOOLTIP_W, ...tooltipStyle }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress dots */}
        <div className="ob-dots">
          {STEPS.map((_, i) => (
            <button key={i} className={`ob-dot${i === step ? ' ob-dot--active' : ''}`} onClick={() => setStep(i)} />
          ))}
        </div>

        <h3 className="ob-title">{current.title}</h3>
        <p  className="ob-text">{current.text}</p>

        <div className="ob-actions">
          <button className="ob-skip" onClick={finish}>Пропустить</button>
          <div className="ob-nav">
            {step > 0 && (
              <button className="ob-btn ob-btn--secondary" onClick={prev}>Назад</button>
            )}
            <button className="ob-btn ob-btn--primary" onClick={next}>
              {isLast ? '🚀 Начать работу' : 'Далее →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useRef, useEffect, useState } from 'react';

const PRIO_COLOR = {
  Критический: '#EF4444',
  Высокий:     '#F59E0B',
  Средний:     '#3B82F6',
  Низкий:      '#6B7280',
};

const STATUS_LABEL = {
  new: 'Новая', in_progress: 'В работе', review: 'На проверке',
  done: 'Завершена', cancelled: 'Отменена',
};

function startOfDay(d) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function GanttView({ allTasks, onTaskClick }) {
  const today = startOfDay(new Date());
  const outerRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { minDate, maxDate, dayWidth } = useMemo(() => {
    const dated = allTasks.filter(t => t.dueDate || t.createdAt);
    if (!dated.length) {
      return { minDate: addDays(today, -7), maxDate: addDays(today, 30), dayWidth: 30 };
    }
    const allMs = dated.flatMap(t => [
      t.createdAt ? startOfDay(new Date(t.createdAt)).getTime() : null,
      t.dueDate   ? startOfDay(new Date(t.dueDate)).getTime()   : null,
    ]).filter(Boolean);

    // Не уходим дальше 30 дней в прошлое — иначе чарт стартует слишком далеко влево
    const rawMin = addDays(new Date(Math.min(...allMs)), -3);
    const min    = new Date(Math.max(rawMin.getTime(), addDays(today, -30).getTime()));
    const max    = addDays(new Date(Math.max(...allMs)), 5);
    const span   = Math.max(diffDays(min, max), 14);

    // Комфортная ширина дня по диапазону
    const preferred = span <= 30 ? 38 : span <= 90 ? 20 : 11;
    // Автоподбор под экран: доступная ширина = вьюпорт − сайдбар (260) − колонка задач (240) − отступы (48)
    const available = viewportWidth - 260 - 240 - 48;
    const fitDw     = available > 0 ? Math.floor(available / span) : preferred;
    // Берём минимум из комфортного и подогнанного; минимум 5px чтобы бары были видны
    const dw = Math.max(5, Math.min(preferred, fitDw));

    return { minDate: min, maxDate: max, dayWidth: dw };
  }, [allTasks, viewportWidth]);

  // Автоскролл к «сегодня» при смене набора задач
  useEffect(() => {
    if (!outerRef.current) return;
    const todayPx = Math.max(0, diffDays(minDate, today)) * dayWidth;
    const scrollTarget = Math.max(0, todayPx - 120);
    outerRef.current.scrollLeft = scrollTarget;
  }, [allTasks.length, dayWidth]);

  const totalDays  = Math.max(diffDays(minDate, maxDate), 14);
  const totalWidth = totalDays * dayWidth;
  const todayLeft  = Math.max(0, diffDays(minDate, today)) * dayWidth;

  // Month markers for header
  const months = useMemo(() => {
    const result = [];
    let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (d <= maxDate) {
      const left = Math.max(0, diffDays(minDate, d)) * dayWidth;
      result.push({
        label: d.toLocaleDateString('ru-RU', { month: 'long', year: '2-digit' }),
        left,
        key: d.toISOString(),
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return result;
  }, [minDate, maxDate, dayWidth]);

  // Week separators
  const weeks = useMemo(() => {
    const result = [];
    let d = new Date(minDate);
    // align to monday
    const dow = d.getDay() || 7;
    if (dow !== 1) d = addDays(d, 8 - dow);
    while (d <= maxDate) {
      result.push({ left: diffDays(minDate, d) * dayWidth, key: d.toISOString() });
      d = addDays(d, 7);
    }
    return result;
  }, [minDate, maxDate, dayWidth]);

  // Group tasks by project, sort by dueDate within
  const grouped = useMemo(() => {
    const map = new Map();
    allTasks.forEach(t => {
      const proj = t.projectName || '—';
      if (!map.has(proj)) map.set(proj, []);
      map.get(proj).push(t);
    });
    map.forEach(arr =>
      arr.sort((a, b) => {
        const ad = a.dueDate ? new Date(a.dueDate) : new Date('9999-01-01');
        const bd = b.dueDate ? new Date(b.dueDate) : new Date('9999-01-01');
        return ad - bd;
      })
    );
    return Array.from(map.entries());
  }, [allTasks]);

  const LABEL_W = 240;

  if (!allTasks.length) {
    return (
      <div className="gantt-empty-state">
        <div className="gantt-empty-icon">📅</div>
        <p>Нет задач для отображения</p>
      </div>
    );
  }

  return (
    <div className="gantt-outer" ref={outerRef}>

      {/* ── Sticky header ── */}
      <div className="gantt-header-row" style={{ minWidth: LABEL_W + totalWidth }}>
        <div className="gantt-label-col gantt-header-label" style={{ width: LABEL_W }}>
          Задача / Исполнитель
        </div>
        <div className="gantt-scale" style={{ width: totalWidth }}>
          {/* week grid lines */}
          {weeks.map(w => (
            <div key={w.key} className="gantt-week-line" style={{ left: w.left }} />
          ))}
          {/* month labels */}
          {months.map(m => (
            <div key={m.key} className="gantt-month-label" style={{ left: m.left }}>
              {m.label}
            </div>
          ))}
          {/* today marker in header */}
          {todayLeft >= 0 && todayLeft <= totalWidth && (
            <div className="gantt-today-tick" style={{ left: todayLeft }}>
              <span className="gantt-today-badge">Сегодня</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="gantt-body">
        {grouped.map(([projName, projTasks]) => (
          <div key={projName}>
            {/* Project section header */}
            <div className="gantt-proj-row" style={{ minWidth: LABEL_W + totalWidth }}>
              <div className="gantt-label-col gantt-proj-label" style={{ width: LABEL_W }}>
                {projName}
              </div>
              <div className="gantt-proj-track" style={{ width: totalWidth }}>
                {weeks.map(w => (
                  <div key={w.key} className="gantt-week-line" style={{ left: w.left }} />
                ))}
                {todayLeft >= 0 && <div className="gantt-today-line" style={{ left: todayLeft }} />}
              </div>
            </div>

            {/* Task rows */}
            {projTasks.map(task => {
              const start    = task.createdAt ? startOfDay(new Date(task.createdAt)) : today;
              const end      = task.dueDate   ? startOfDay(new Date(task.dueDate))   : addDays(start, 1);
              const barLeft  = Math.max(0, diffDays(minDate, start)) * dayWidth;
              const barSpan  = Math.max(1, diffDays(start, end));
              const barWidth = Math.max(dayWidth * 0.6, barSpan * dayWidth);
              const color    = PRIO_COLOR[task.priority] || '#6B7280';
              const isDone   = task.status === 'done';
              const isOver   = task.dueDate && startOfDay(new Date(task.dueDate)) < today && !isDone;

              return (
                <div
                  key={task.id}
                  className="gantt-row"
                  style={{ minWidth: LABEL_W + totalWidth }}
                  onClick={() => onTaskClick(task)}
                >
                  <div className="gantt-label-col gantt-task-label" style={{ width: LABEL_W }} title={task.title}>
                    <span className="gantt-task-name">{task.title}</span>
                    {task.assignee && task.assignee !== 'Не назначен' && (
                      <span className="gantt-task-assignee">{task.assignee}</span>
                    )}
                  </div>

                  <div className="gantt-track" style={{ width: totalWidth }}>
                    {/* grid */}
                    {weeks.map(w => (
                      <div key={w.key} className="gantt-week-line" style={{ left: w.left }} />
                    ))}
                    {/* today line */}
                    {todayLeft >= 0 && <div className="gantt-today-line" style={{ left: todayLeft }} />}
                    {/* task bar */}
                    <div
                      className={`gantt-bar${isDone ? ' gantt-bar--done' : isOver ? ' gantt-bar--over' : ''}`}
                      style={{
                        left:       barLeft,
                        width:      barWidth,
                        background: isDone ? '#10B981' : isOver ? '#EF4444' : color,
                      }}
                      title={`${task.title}\n${STATUS_LABEL[task.status] || task.status} · ${task.assignee}`}
                    >
                      {barWidth >= 60 && (
                        <span className="gantt-bar-label" style={{ maxWidth: barWidth - 16 }}>
                          {task.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

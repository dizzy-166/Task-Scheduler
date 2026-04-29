import { useMemo } from 'react';

const PRIORITY_DOT = {
  Критический: '#EF4444',
  Высокий:     '#F59E0B',
  Средний:     '#3B82F6',
  Низкий:      '#6B7280',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 17) return 'Добрый день';
  return 'Добрый вечер';
}

export default function HomeView({ stats, allTasks, user, onTaskClick, activeCompany }) {
  const now = new Date();

  const myTasks = useMemo(() => {
    const fullName = user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    return allTasks
      .filter(t => t.assignee === fullName && t.status !== 'done' && t.status !== 'cancelled')
      .slice(0, 7);
  }, [allTasks, user]);

  const upcoming = useMemo(() =>
    allTasks
      .filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d > now && d < new Date(now.getTime() + 7 * 86400000) && t.status !== 'done';
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 7),
    [allTasks]
  );

  const overdue = useMemo(() =>
    allTasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && t.status !== 'cancelled'
    ).slice(0, 7),
    [allTasks]
  );

  const userName = user?.first_name || user?.email?.split('@')[0] || '';
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const kpis = [
    { label: 'Всего задач',  value: stats.total,      color: '#6366f1' },
    { label: 'В работе',     value: stats.inProgress,  color: '#3B82F6' },
    { label: 'На проверке',  value: stats.onReview,    color: '#F59E0B' },
    { label: 'Завершено',    value: stats.completed,   color: '#10B981' },
    { label: 'Просрочено',   value: overdue.length,    color: '#EF4444' },
  ];

  return (
    <div className="home-view">

      {/* Greeting */}
      <div className="home-greeting">
        <div>
          <h2 className="home-greeting-title">{greeting()}, {userName} 👋</h2>
          <p className="home-greeting-sub">{activeCompany?.name} · {dateStr}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="home-kpi-row">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="home-kpi" style={{ borderTopColor: color }}>
            <div className="home-kpi-value" style={{ color }}>{value}</div>
            <div className="home-kpi-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Panels */}
      <div className="home-panels">

        <div className="home-panel">
          <div className="home-panel-hd">
            <span>Мои задачи</span>
            <span className="home-panel-count">{myTasks.length}</span>
          </div>
          {myTasks.length === 0
            ? <p className="home-empty">Нет активных задач</p>
            : myTasks.map(t => (
              <div key={t.id} className="home-task" onClick={() => onTaskClick(t)}>
                <span className="home-task-dot" style={{ background: PRIORITY_DOT[t.priority] || '#6B7280' }} />
                <span className="home-task-title">{t.title}</span>
                {t.dueDate && (
                  <span className="home-task-meta">
                    {new Date(t.dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ))
          }
        </div>

        <div className="home-panel">
          <div className="home-panel-hd">
            <span>Дедлайн — 7 дней</span>
            <span className="home-panel-count">{upcoming.length}</span>
          </div>
          {upcoming.length === 0
            ? <p className="home-empty">Нет ближайших дедлайнов</p>
            : upcoming.map(t => {
              const daysLeft = Math.ceil((new Date(t.dueDate) - now) / 86400000);
              return (
                <div key={t.id} className="home-task" onClick={() => onTaskClick(t)}>
                  <span className="home-task-dot" style={{ background: PRIORITY_DOT[t.priority] || '#6B7280' }} />
                  <span className="home-task-title">{t.title}</span>
                  <span className="home-task-meta home-task-meta--warn">{daysLeft}д</span>
                </div>
              );
            })
          }
        </div>

        {overdue.length > 0 && (
          <div className="home-panel home-panel--danger">
            <div className="home-panel-hd">
              <span>Просрочено</span>
              <span className="home-panel-count home-panel-count--danger">{overdue.length}</span>
            </div>
            {overdue.map(t => (
              <div key={t.id} className="home-task" onClick={() => onTaskClick(t)}>
                <span className="home-task-dot" style={{ background: '#EF4444' }} />
                <span className="home-task-title">{t.title}</span>
                <span className="home-task-meta home-task-meta--danger">{t.assignee}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

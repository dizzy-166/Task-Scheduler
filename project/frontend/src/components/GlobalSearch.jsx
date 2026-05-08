import { useState, useEffect, useRef, useCallback } from 'react';

const NAV_ITEMS = [
  { view: 'home',      label: 'Главная',          icon: '🏠' },
  { view: 'kanban',    label: 'Канбан',            icon: '📋' },
  { view: 'list',      label: 'Список задач',      icon: '📝' },
  { view: 'analytics', label: 'Аналитика',         icon: '📊' },
  { view: 'gantt',     label: 'Диаграмма Ганта',   icon: '📅' },
  { view: 'reports',   label: 'Отчёты',            icon: '📄' },
  { view: 'chat',      label: 'Чат',               icon: '💬' },
  { view: 'company',   label: 'Управление',        icon: '⚙️' },
];

const STATUS_LABEL = {
  new: 'Новая', in_progress: 'В работе', review: 'На проверке',
  done: 'Завершена', cancelled: 'Отменена',
};

export default function GlobalSearch({ allTasksList, onNavigate, onTaskClick, onClose }) {
  const [query, setQuery]       = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const trimmed = query.trim().toLowerCase();

  const navResults = trimmed
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(trimmed))
    : NAV_ITEMS;

  const taskResults = trimmed
    ? allTasksList.filter(t =>
        t.title?.toLowerCase().includes(trimmed) ||
        t.description?.toLowerCase().includes(trimmed) ||
        t.assignee?.toLowerCase().includes(trimmed)
      ).slice(0, 20)
    : [];

  const results = [
    ...navResults.map(n  => ({ type: 'nav',  ...n })),
    ...taskResults.map(t => ({ type: 'task', ...t })),
  ];

  const total = results.length;

  useEffect(() => { setActiveIdx(0); }, [query]);

  const handleSelect = useCallback((item) => {
    if (item.type === 'nav') {
      onNavigate(item.view);
    } else {
      onTaskClick(item);
    }
    onClose();
  }, [onNavigate, onTaskClick, onClose]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + total) % total);
    } else if (e.key === 'Enter') {
      if (results[activeIdx]) handleSelect(results[activeIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <div className="gs-overlay" onMouseDown={onClose}>
      <div className="gs-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="gs-input-wrap">
          <svg className="gs-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="gs-input"
            placeholder="Поиск задач и разделов..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="gs-esc-hint">Esc</kbd>
        </div>

        <div className="gs-list" ref={listRef}>
          {!trimmed && (
            <div className="gs-section-label">Разделы</div>
          )}
          {trimmed && navResults.length > 0 && (
            <div className="gs-section-label">Разделы</div>
          )}
          {navResults.map((item, idx) => (
            <button
              key={item.view}
              className={`gs-item${activeIdx === idx ? ' gs-item--active' : ''}`}
              data-active={activeIdx === idx}
              onClick={() => handleSelect({ type: 'nav', ...item })}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="gs-item-icon">{item.icon}</span>
              <span className="gs-item-label">{item.label}</span>
            </button>
          ))}

          {taskResults.length > 0 && (
            <div className="gs-section-label" style={{ marginTop: 8 }}>Задачи</div>
          )}
          {taskResults.map((task, i) => {
            const idx = navResults.length + i;
            return (
              <button
                key={task.id}
                className={`gs-item${activeIdx === idx ? ' gs-item--active' : ''}`}
                data-active={activeIdx === idx}
                onClick={() => handleSelect({ type: 'task', ...task })}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <span className="gs-task-title">{task.title}</span>
                <span className="gs-task-meta">
                  {STATUS_LABEL[task.status] || task.status}
                  {task.assignee && task.assignee !== 'Не назначен' ? ` · ${task.assignee}` : ''}
                  {task.projectName ? ` · ${task.projectName}` : ''}
                </span>
              </button>
            );
          })}

          {trimmed && total === 0 && (
            <div className="gs-empty">Ничего не найдено</div>
          )}
        </div>

        <div className="gs-footer">
          <span><kbd>↑↓</kbd> навигация</span>
          <span><kbd>Enter</kbd> открыть</span>
          <span><kbd>Esc</kbd> закрыть</span>
        </div>
      </div>
    </div>
  );
}

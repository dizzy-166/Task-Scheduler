import { useState } from 'react';
import { taskService } from '../api/taskService';

const PRIO_COLOR = { low: '#6B7280', medium: '#3B82F6', high: '#F59E0B', critical: '#EF4444' };
const PRIO_LABEL = { low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критический' };

export default function AIGenerateModal({ projectId, projectName, onClose, onTasksCreated }) {
  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [generated,   setGenerated]   = useState(null);
  const [selected,    setSelected]    = useState(new Set());
  const [creating,    setCreating]    = useState(false);
  const [error,       setError]       = useState('');

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError('');
    try {
      const prompt =
        `Ты менеджер проектов. Создай список задач для проекта.\n\n` +
        `Проект: ${projectName || 'Проект'}\n` +
        `Описание: ${description.trim()}\n\n` +
        `Верни JSON-массив из 5-8 задач. Каждая задача:\n` +
        `- title: название (до 100 символов)\n` +
        `- description: краткое описание (1-2 предложения)\n` +
        `- priority: low | medium | high | critical\n` +
        `- due_days: через сколько дней дедлайн (целое, 3-90)\n\n` +
        `Верни ТОЛЬКО JSON-массив без пояснений.\n` +
        `Пример: [{"title":"Название","description":"Описание","priority":"medium","due_days":14}]`;

      const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_CEREBRAS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
          max_tokens: 1500,
        }),
      });
      if (!resp.ok) throw new Error(`Cerebras ${resp.status}`);
      const result = await resp.json();
      const text = result.choices[0].message.content;
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('unexpected format');
      const tasks = JSON.parse(match[0]);
      setGenerated(tasks);
      setSelected(new Set(tasks.map((_, i) => i)));
    } catch (e) {
      console.error('AI generate error:', e);
      setError('Не удалось получить ответ от ИИ. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (i) => {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i); else s.add(i);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === generated.length) setSelected(new Set());
    else setSelected(new Set(generated.map((_, i) => i)));
  };

  const create = async () => {
    if (!generated || selected.size === 0) return;
    setCreating(true);
    setError('');
    try {
      const toCreate = generated.filter((_, i) => selected.has(i));
      await taskService.bulkCreateTasks({ project_id: projectId || null, tasks: toCreate });
      onTasksCreated();
      onClose();
    } catch {
      setError('Ошибка при создании задач. Попробуйте ещё раз.');
    } finally {
      setCreating(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="aigen-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="aigen-hd">
          <div className="aigen-hd-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="aigen-star-icon">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="aigen-hd-title">Генератор задач ИИ</span>
            {projectName && (
              <div className="aigen-project-chip">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {projectName}
              </div>
            )}
          </div>
          <button className="aigen-close" onClick={onClose}>×</button>
        </div>

        {!generated ? (
          /* ── Step 1: describe project ── */
          <>
            <div className="aigen-body">
              <label className="aigen-label">Опишите проект — что нужно сделать, цели, функциональность</label>
              <textarea
                className="aigen-textarea"
                rows={6}
                placeholder={"Например: нужно разработать мобильное приложение для доставки еды.\nОсновные функции: регистрация пользователей, каталог ресторанов, корзина, оплата, отслеживание заказа…"}
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={handleKey}
                autoFocus
              />
              <div className="aigen-hint">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Ctrl+Enter — сгенерировать
              </div>
              {error && <div className="aigen-error">{error}</div>}
            </div>

            <div className="aigen-foot">
              <button className="btn-secondary" onClick={onClose}>Отмена</button>
              <button
                className="btn-primary aigen-gen-btn"
                onClick={generate}
                disabled={loading || !description.trim()}
              >
                {loading ? (
                  <>
                    <span className="aigen-spinner" />
                    Генерирую…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    Сгенерировать задачи
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          /* ── Step 2: review and select ── */
          <>
            <div className="aigen-result-header">
              <span>ИИ предложил <strong>{generated.length}</strong> задач — выберите нужные</span>
              <button className="aigen-select-all-btn" onClick={toggleAll}>
                {selected.size === generated.length ? 'Снять все' : 'Выбрать все'}
              </button>
            </div>

            <div className="aigen-body aigen-body--list">
              <div className="aigen-task-list">
                {generated.map((task, i) => {
                  const pColor = PRIO_COLOR[task.priority] || '#6B7280';
                  return (
                    <label
                      key={i}
                      className={`aigen-task-item${selected.has(i) ? ' aigen-task-item--sel' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggleItem(i)}
                      />
                      <div className="aigen-task-body">
                        <div className="aigen-task-title">{task.title}</div>
                        {task.description && (
                          <div className="aigen-task-desc">{task.description}</div>
                        )}
                        <div className="aigen-task-meta">
                          <span className="lv-badge" style={{ background: pColor + '22', color: pColor }}>
                            {PRIO_LABEL[task.priority] || task.priority}
                          </span>
                          <span className="aigen-due-chip">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            через {task.due_days} дн.
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {error && <div className="aigen-error">{error}</div>}
            </div>

            <div className="aigen-foot">
              <button className="btn-secondary" onClick={() => { setGenerated(null); setError(''); }}>
                ← Назад
              </button>
              <button
                className="btn-primary"
                onClick={create}
                disabled={creating || selected.size === 0}
              >
                {creating ? 'Создаю…' : `Создать ${selected.size} задач${selected.size === 1 ? 'у' : selected.size < 5 ? 'и' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

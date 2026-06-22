import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { taskService } from '../api/taskService';
import useCompanyStore from '../store/companyStore';

const STATUS_COLORS = {
  new:         '#6B7280',
  in_progress: '#3B82F6',
  review:      '#F59E0B',
  done:        '#10B981',
  cancelled:   '#EF4444',
};
const STATUS_LABELS = {
  new: 'Новые', in_progress: 'В работе', review: 'На проверке',
  done: 'Готово', cancelled: 'Отменено',
};
const PRIORITY_COLORS = {
  low: '#6B7280', medium: '#3B82F6', high: '#F59E0B', critical: '#EF4444',
};
const PRIORITY_LABELS = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критический',
};

const CHART_COLORS = ['#6366F1','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#84CC16'];

function renderMd(text) {
  const lines = text.split('\n');
  const out = [];
  let ulBuf = [], olBuf = [];

  const flushUl = () => {
    if (!ulBuf.length) return;
    out.push(<ul key={out.length} className="ai-md-ul">{ulBuf.map((l,i)=><li key={i}>{inlinemd(l)}</li>)}</ul>);
    ulBuf = [];
  };
  const flushOl = () => {
    if (!olBuf.length) return;
    out.push(<ol key={out.length} className="ai-md-ol">{olBuf.map((l,i)=><li key={i}>{inlinemd(l)}</li>)}</ol>);
    olBuf = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const ulMatch = line.match(/^[\*\-]\s+(.*)/);
    const olMatch = line.match(/^\d+\.\s+(.*)/);
    const h3Match = line.match(/^###\s+(.*)/);

    if (ulMatch) {
      flushOl(); ulBuf.push(ulMatch[1]); return;
    }
    if (olMatch) {
      flushUl(); olBuf.push(olMatch[1]); return;
    }
    flushUl(); flushOl();

    if (h3Match) {
      out.push(<p key={idx} className="ai-md-h3">{inlinemd(h3Match[1])}</p>);
    } else if (line === '') {
      out.push(<div key={idx} className="ai-md-gap" />);
    } else {
      out.push(<p key={idx} className="ai-md-p">{inlinemd(line)}</p>);
    }
  });
  flushUl(); flushOl();
  return out;
}

function inlinemd(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      {label && <p className="analytics-tooltip-label">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsView() {
  const { activeCompany } = useCompanyStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiText, setAiText]     = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]   = useState(null);
  const [aiOpen, setAiOpen]     = useState(false);

  useEffect(() => {
    setLoading(true);
    taskService.getStats()
      .then(setData)
      .catch(() => setError('Не удалось загрузить статистику'))
      .finally(() => setLoading(false));
  }, []);

  const handleAI = async () => {
    setAiOpen(true);
    if (aiText) return;
    setAiLoading(true);
    setAiError(null);
    try {
      // Анализ идёт через backend (/ai/analyze/): ключ Cerebras остаётся на
      // сервере, модель и параметры заданы там же. Backend сам строит промпт
      // из отчёта (summary / by_user / by_project).
      const report = await taskService.getReport();
      const companyName = activeCompany?.name || 'Компания';
      const data = await taskService.getAIAnalysis(report, companyName);
      setAiText(data.analysis);
    } catch (e) {
      console.error('AI analysis error:', e);
      setAiError('Не удалось получить анализ. Попробуйте ещё раз.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return (
    <div className="analytics-loading">
      <div className="spinner-large" />
      <p>Загрузка статистики...</p>
    </div>
  );
  if (error) return <div className="analytics-error">{error}</div>;
  if (!data) return null;

  const total = data.total || 0;
  const done = data.by_status?.done || 0;
  const overdue = data.overdue || 0;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalActual = data.total_actual_hours || 0;
  const totalEstimated = data.total_estimated_hours || 0;
  const timeEfficiency = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : null;

  const statusData = Object.entries(data.by_status || {})
    .map(([key, value]) => ({ name: STATUS_LABELS[key] || key, value, color: STATUS_COLORS[key] }))
    .filter(d => d.value > 0);

  const priorityData = Object.entries(data.by_priority || {})
    .map(([key, value]) => ({ name: PRIORITY_LABELS[key] || key, value, fill: PRIORITY_COLORS[key] }))
    .filter(d => d.value > 0);

  const assigneeData = (data.by_assignee || []).slice(0, 8);
  const assigneeHoursData = assigneeData.filter(a => a.actual_hours > 0);
  const projectData  = (data.by_project  || []).slice(0, 8);
  const trendData    = data.weekly_trend  || [];

  return (
    <div className="analytics-view">

      {/* ── AI button ── */}
      <div className="analytics-ai-bar">
        <button className="analytics-ai-btn" onClick={handleAI} disabled={!data}>
          <span className="analytics-ai-icon">✦</span>
          AI-анализ
        </button>
        {aiOpen && (
          <div className="analytics-ai-panel">
            <div className="analytics-ai-panel-header">
              <span><span className="analytics-ai-icon">✦</span> AI-анализ — {activeCompany?.name}</span>
              <button className="analytics-ai-close" onClick={() => { setAiOpen(false); setAiText(null); }}>✕</button>
            </div>
            <div className="analytics-ai-body">
              {aiLoading && <div className="analytics-ai-loading"><div className="spinner-large"/><p>ИИ анализирует…</p></div>}
              {aiError   && <div className="analytics-ai-error">{aiError}</div>}
              {aiText    && <div className="analytics-ai-text">{renderMd(aiText)}</div>}
            </div>
          </div>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div className="analytics-cards">
        <div className="analytics-card">
          <div className="analytics-card-value">{total}</div>
          <div className="analytics-card-label">Всего задач</div>
        </div>
        <div className="analytics-card analytics-card--blue">
          <div className="analytics-card-value">{data.by_status?.in_progress || 0}</div>
          <div className="analytics-card-label">В работе</div>
        </div>
        <div className="analytics-card analytics-card--green">
          <div className="analytics-card-value">{done}</div>
          <div className="analytics-card-label">Завершено</div>
        </div>
        <div className="analytics-card analytics-card--red">
          <div className="analytics-card-value">{overdue}</div>
          <div className="analytics-card-label">Просрочено</div>
        </div>
        <div className="analytics-card analytics-card--purple">
          <div className="analytics-card-value">{completionRate}%</div>
          <div className="analytics-card-label">Выполнено</div>
          <div className="analytics-progress-bar">
            <div className="analytics-progress-fill" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
        <div className="analytics-card analytics-card--teal">
          <div className="analytics-card-value">{totalActual.toFixed(1)}<span className="analytics-card-unit">ч</span></div>
          <div className="analytics-card-label">Потрачено по таймеру</div>
        </div>
        {timeEfficiency !== null && (
          <div className="analytics-card" style={{ borderTop: `3px solid ${timeEfficiency > 100 ? '#EF4444' : '#10B981'}` }}>
            <div className="analytics-card-value" style={{ color: timeEfficiency > 100 ? '#EF4444' : '#10B981' }}>
              {timeEfficiency}%
            </div>
            <div className="analytics-card-label">Факт / Оценка</div>
            <div className="analytics-card-sub">{totalEstimated.toFixed(1)} ч оценка</div>
          </div>
        )}
      </div>

      {/* ── Row 1: status donut + priority bars ── */}
      <div className="analytics-row">
        <div className="analytics-chart-card">
          <h3 className="analytics-chart-title">По статусам</h3>
          {statusData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="analytics-chart-card">
          <h3 className="analytics-chart-title">По приоритетам</h3>
          {priorityData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={priorityData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Задачи" radius={[4, 4, 0, 0]}>
                  {priorityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Trend chart ── */}
      {trendData.length > 0 && (
        <div className="analytics-chart-card analytics-chart-card--wide">
          <h3 className="analytics-chart-title">Динамика задач (по неделям)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={10} />
              <Area type="monotone" dataKey="created" name="Создано"
                stroke="#6366F1" fill="url(#gradCreated)" strokeWidth={2} dot={{ r: 3 }} />
              <Area type="monotone" dataKey="done" name="Завершено"
                stroke="#10B981" fill="url(#gradDone)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Row 2: by assignee + by project ── */}
      <div className="analytics-row">
        {assigneeData.length > 0 && (
          <div className="analytics-chart-card">
            <h3 className="analytics-chart-title">По исполнителям</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, assigneeData.length * 36)}>
              <BarChart data={assigneeData} layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis type="category" dataKey="name" width={110}
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Задачи" radius={[0, 4, 4, 0]}>
                  {assigneeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {assigneeHoursData.length > 0 && (
          <div className="analytics-chart-card">
            <h3 className="analytics-chart-title">Часы по исполнителям</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, assigneeHoursData.length * 36)}>
              <BarChart data={assigneeHoursData} layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  tickFormatter={v => `${v}ч`} />
                <YAxis type="category" dataKey="name" width={110}
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v.toFixed(1)} ч`]} />
                <Bar dataKey="actual_hours" name="Потрачено" radius={[0, 4, 4, 0]} fill="#14B8A6" />
                <Bar dataKey="estimated_hours" name="Оценка" radius={[0, 4, 4, 0]} fill="#6366F1" opacity={0.4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {projectData.length > 0 && (
          <div className="analytics-chart-card">
            <h3 className="analytics-chart-title">По проектам</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, projectData.length * 36)}>
              <BarChart data={projectData} layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis type="category" dataKey="name" width={130}
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Задачи" radius={[0, 4, 4, 0]}>
                  {projectData.map((_, i) => <Cell key={i} fill={CHART_COLORS[(i + 4) % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  );
}

const EmptyChart = () => (
  <div className="analytics-empty-chart">Нет данных</div>
);

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { taskService } from '../api/taskService';
import useCompanyStore from '../store/companyStore';
import projectService from '../api/projectService';
import companyAPI from '../api/companyService';

// ── Dictionaries ─────────────────────────────────────────────────────────────
const SL = { new:'Новая', in_progress:'В работе', review:'На проверке', done:'Завершена', cancelled:'Отменена' };
const SC = { new:'#6B7280', in_progress:'#3B82F6', review:'#F59E0B', done:'#10B981', cancelled:'#EF4444' };
const PL = { low:'Низкий', medium:'Средний', high:'Высокий', critical:'Критический' };
const PC = { low:'#6B7280', medium:'#3B82F6', high:'#F59E0B', critical:'#EF4444' };
const PROJ_S = { active:'Активный', completed:'Завершён', on_hold:'На паузе', cancelled:'Отменён' };
const ALL_S = ['new','in_progress','review','done','cancelled'];
const ALL_P = ['low','medium','high','critical'];

// ── Helpers ──────────────────────────────────────────────────────────────────
const Badge = ({ label, color }) => (
  <span style={{
    display:'inline-block', padding:'2px 8px', borderRadius:10,
    background: color + '22', color, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
  }}>{label}</span>
);

const MiniBar = ({ pct, color = '#6366f1' }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <div style={{ width:56, height:5, background:'var(--border-color)', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3 }} />
    </div>
    <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{pct}%</span>
  </div>
);

// ── Excel export ──────────────────────────────────────────────────────────────
function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

const SE = { new:'🆕 Новая', in_progress:'🔵 В работе', review:'🔶 На проверке', done:'✅ Завершена', cancelled:'🚫 Отменена' };
const PE = { low:'⚪ Низкий', medium:'🟡 Средний', high:'🟠 Высокий', critical:'🔴 Критический' };
const bar = pct => '█'.repeat(Math.round((pct||0)/10)) + '░'.repeat(10-Math.round((pct||0)/10)) + `  ${pct??0}%`;

function doExcel(data, company) {
  const wb = XLSX.utils.book_new();
  const s = data.summary;

  // Sheet 1 — Summary / KPI
  const wsSummary = XLSX.utils.aoa_to_sheet([
    [`📊 Отчёт по задачам — ${company}`],
    [`Сформирован: ${data.generated_at}    ·    Всего задач: ${s.total}`],
    [''],
    ['── СТАТУСЫ ───────────────────────────────'],
    ['✅ Завершено',     s.done,        bar(s.completion_rate), `Выполнено: ${s.completion_rate}%`],
    ['🔵 В работе',      s.in_progress, '', ''],
    ['🔶 На проверке',   s.review,      '', ''],
    ['🆕 Новые',         s.new,         '', ''],
    ['🚫 Отменено',      s.cancelled,   '', ''],
    ['⚠️ Просрочено',    s.overdue,     '', ''],
    [''],
    ['── МЕТРИКИ ──────────────────────────────'],
    ['% выполнения',                    s.completion_rate + '%'],
    ['Среднее время выполнения (дней)', s.avg_completion_days ?? '—'],
  ]);
  setColWidths(wsSummary, [38, 10, 20, 20]);
  XLSX.utils.book_append_sheet(wb, wsSummary, '📊 Сводка');

  // Sheet 2 — By assignee
  const wsUsers = XLSX.utils.aoa_to_sheet([
    ['Исполнитель','Email','Всего','✅ Завершено','🔵 В работе','🔶 Проверка','🆕 Новые','⚠️ Просрочено','Прогресс','Ср. дней'],
    ...data.by_user.map(u => [
      u.name, u.email, u.total, u.done, u.in_progress, u.review, u.new,
      u.overdue > 0 ? `⚠️ ${u.overdue}` : 0,
      bar(u.completion_rate),
      u.avg_completion_days ?? '—',
    ]),
  ]);
  setColWidths(wsUsers, [24, 30, 8, 12, 12, 12, 8, 14, 18, 10]);
  wsUsers['!freeze'] = { xSplit: 0, ySplit: 1 };
  wsUsers['!autofilter'] = { ref: wsUsers['!ref'] };
  XLSX.utils.book_append_sheet(wb, wsUsers, '👤 По исполнителям');

  // Sheet 3 — By project
  const wsProj = XLSX.utils.aoa_to_sheet([
    ['Проект','Статус','Дедлайн','Всего','✅ Завершено','🔵 В работе','🔶 Проверка','⚠️ Просрочено','Прогресс'],
    ...data.by_project.map(p => [
      p.name, PROJ_S[p.status]||p.status, p.deadline,
      p.total, p.done, p.in_progress, p.review,
      p.overdue > 0 ? `⚠️ ${p.overdue}` : 0,
      bar(p.progress_pct),
    ]),
  ]);
  setColWidths(wsProj, [30, 12, 12, 8, 12, 12, 12, 14, 18]);
  wsProj['!freeze'] = { xSplit: 0, ySplit: 1 };
  wsProj['!autofilter'] = { ref: wsProj['!ref'] };
  XLSX.utils.book_append_sheet(wb, wsProj, '📁 По проектам');

  // Sheet 4 — Full task list
  const taskRows = data.tasks.map(t => [
    t.is_overdue ? `⚠️ ${t.title}` : t.title,
    t.description ?? '',
    t.project,
    t.assignee,
    t.creator,
    SE[t.status] || t.status,
    PE[t.priority] || t.priority,
    t.created_at,
    t.due_date,
    t.completed_at ?? '—',
    t.is_overdue ? '⚠️ Да' : 'Нет',
    t.estimated_hours ?? '—',
    t.actual_hours ?? '—',
  ]);
  const wsTasks = XLSX.utils.aoa_to_sheet([
    ['Задача','Описание','Проект','Исполнитель','Автор','Статус','Приоритет','Создана','Срок','Завершена','Просрочена','Оценка (ч)','Факт (ч)'],
    ...taskRows,
  ]);
  setColWidths(wsTasks, [36, 48, 20, 22, 22, 18, 18, 12, 12, 12, 12, 11, 10]);
  wsTasks['!freeze'] = { xSplit: 0, ySplit: 1 };
  wsTasks['!autofilter'] = { ref: wsTasks['!ref'] };
  XLSX.utils.book_append_sheet(wb, wsTasks, '📋 Задачи');

  // Sheet 5 — Overdue tasks only
  const overdueTasks = data.tasks.filter(t => t.is_overdue);
  if (overdueTasks.length) {
    const wsOverdue = XLSX.utils.aoa_to_sheet([
      [`⚠️ ПРОСРОЧЕННЫЕ ЗАДАЧИ — ${overdueTasks.length} шт.`],
      [''],
      ['Задача','Проект','Исполнитель','Статус','Приоритет','Срок','Оценка (ч)','Факт (ч)'],
      ...overdueTasks.map(t => [
        t.title, t.project, t.assignee,
        SE[t.status] || t.status,
        PE[t.priority] || t.priority,
        t.due_date,
        t.estimated_hours ?? '—',
        t.actual_hours ?? '—',
      ]),
    ]);
    setColWidths(wsOverdue, [36, 20, 22, 18, 18, 12, 11, 10]);
    wsOverdue['!freeze'] = { xSplit: 0, ySplit: 3 };
    wsOverdue['!autofilter'] = { ref: `A3:H${overdueTasks.length + 3}` };
    wsOverdue['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    XLSX.utils.book_append_sheet(wb, wsOverdue, '⚠️ Просроченные');
  }

  XLSX.writeFile(wb, `отчёт_${new Date().toLocaleDateString('ru')}.xlsx`);
}

// ── PDF via browser print ─────────────────────────────────────────────────────
function doPDF(data, company) {
  const s = data.summary;
  const row = (cells, cls='') => `<tr class="${cls}">${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`;
  const hrow = cells => `<tr>${cells.map(c=>`<th>${c}</th>`).join('')}</tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Отчёт — ${company}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0 }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; font-size:11px; color:#111; padding:20px 24px; }
  h1 { font-size:20px; font-weight:700; color:#1a1a1a; }
  .meta { font-size:10px; color:#666; margin:4px 0 18px; }
  h2 { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
       color:#6366f1; border-bottom:2px solid #6366f1; padding-bottom:4px; margin:22px 0 8px; }
  .kpi-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:8px; }
  .kpi { background:#f5f6fa; border-radius:8px; padding:10px 14px; min-width:90px; border-left:3px solid #6366f1; }
  .kpi-v { font-size:20px; font-weight:700; }
  .kpi-l { font-size:9px; color:#666; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:10px; margin-bottom:6px; }
  th { background:#6366f1; color:#fff; padding:5px 8px; text-align:left; font-size:9px; font-weight:700; }
  td { padding:5px 8px; border-bottom:1px solid #eaeaea; }
  tr:nth-child(even) td { background:#f9f9fb; }
  .overdue { color:#dc2626; font-weight:600; }
  .done { color:#10b981; }
  .pct { color:#6366f1; font-weight:600; }
  @media print {
    @page { size:A4 landscape; margin:12mm; }
    h2 { page-break-before:auto; }
    table { page-break-inside:auto; }
    tr { page-break-inside:avoid; }
  }
</style></head><body>
<h1>Отчёт по задачам</h1>
<div class="meta">Компания: <b>${company}</b>&nbsp;&nbsp;·&nbsp;&nbsp;Сформирован: ${data.generated_at}&nbsp;&nbsp;·&nbsp;&nbsp;Задач: ${data.tasks.length}</div>

<div class="kpi-row">
  <div class="kpi"><div class="kpi-v">${s.total}</div><div class="kpi-l">Всего задач</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#10b981">${s.done} (${s.completion_rate}%)</div><div class="kpi-l">Завершено</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#3b82f6">${s.in_progress}</div><div class="kpi-l">В работе</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#f59e0b">${s.review}</div><div class="kpi-l">На проверке</div></div>
  <div class="kpi"><div class="kpi-v">${s.new}</div><div class="kpi-l">Новые</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#ef4444">${s.overdue}</div><div class="kpi-l">Просрочено</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#8b5cf6">${s.avg_completion_days??'—'}</div><div class="kpi-l">Среднее дней</div></div>
</div>

${data.by_user.length ? `<h2>По исполнителям</h2>
<table><thead>${hrow(['Исполнитель','Всего','Завершено','В работе','Проверка','Новые','Просрочено','% выполн.','Среднее дн.'])}</thead><tbody>
${data.by_user.map(u=>row([u.name,u.total,`<span class="done">${u.done}</span>`,u.in_progress,u.review,u.new,u.overdue>0?`<span class="overdue">${u.overdue}</span>`:0,`<span class="pct">${u.completion_rate}%</span>`,u.avg_completion_days??'—'])).join('')}
</tbody></table>` : ''}

${data.by_project.length ? `<h2>По проектам</h2>
<table><thead>${hrow(['Проект','Дедлайн','Всего','Завершено','В работе','Проверка','Просрочено','Прогресс'])}</thead><tbody>
${data.by_project.map(p=>row([`<b>${p.name}</b>`,p.deadline,p.total,`<span class="done">${p.done}</span>`,p.in_progress,p.review,p.overdue>0?`<span class="overdue">${p.overdue}</span>`:0,`<span class="pct">${p.progress_pct}%</span>`])).join('')}
</tbody></table>` : ''}

<h2>Список задач (${data.tasks.length})</h2>
<table><thead>${hrow(['Задача','Проект','Исполнитель','Статус','Приоритет','Создана','Срок','Завершена'])}</thead><tbody>
${data.tasks.map(t=>row([t.title,t.project,t.assignee,SL[t.status]||t.status,PL[t.priority]||t.priority,t.created_at,t.is_overdue?`<span class="overdue">${t.due_date}</span>`:t.due_date,t.completed_at],t.is_overdue?'overdue-row':'')).join('')}
</tbody></table>

<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportsView() {
  const { activeCompany } = useCompanyStore();
  const [filters, setFilters] = useState({ date_from:'', date_to:'', project:'', assignee:'', status:[], priority:[] });
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [projects, setProjects] = useState([]);
  const [members,  setMembers]  = useState([]);
  const [exporting,setExporting]= useState(null);

  useEffect(() => {
    if (!activeCompany) return;
    projectService.getProjects().then(r => setProjects(Array.isArray(r) ? r : r?.results || [])).catch(()=>{});
    companyAPI.getMembers(activeCompany.id).then(r => {
      const list = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
      setMembers(list);
    }).catch(()=>{});
  }, [activeCompany]);

  const loadReport = useCallback(async (f = filters) => {
    setLoading(true); setError(null);
    try {
      const p = {};
      if (f.date_from)       p.date_from = f.date_from;
      if (f.date_to)         p.date_to   = f.date_to;
      if (f.project)         p.project   = f.project;
      if (f.assignee)        p.assignee  = f.assignee;
      if (f.status.length)   p.status    = f.status.join(',');
      if (f.priority.length) p.priority  = f.priority.join(',');
      setData(await taskService.getReport(p));
    } catch { setError('Не удалось загрузить отчёт. Попробуйте ещё раз.'); }
    finally  { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadReport(); }, [activeCompany]);

  const toggle = (key, val) => setFilters(f => ({
    ...f, [key]: f[key].includes(val) ? f[key].filter(x=>x!==val) : [...f[key], val],
  }));

  const reset = () => {
    const f = { date_from:'', date_to:'', project:'', assignee:'', status:[], priority:[] };
    setFilters(f); loadReport(f);
  };

  const handleExcel = async () => {
    if (!data) return;
    setExporting('excel');
    try { doExcel(data, activeCompany?.name || ''); }
    finally { setExporting(null); }
  };

  const handlePDF = () => {
    if (!data) return;
    doPDF(data, activeCompany?.name || '');
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="rv">

      {/* ── Filter panel ── */}
      <div className="rv-filters">
        <div className="rv-filters-top">
          <div className="rv-field-group">
            <label>Период с</label>
            <input type="date" value={filters.date_from} onChange={e=>setFilters(f=>({...f,date_from:e.target.value}))} />
          </div>
          <div className="rv-field-group">
            <label>по</label>
            <input type="date" value={filters.date_to} onChange={e=>setFilters(f=>({...f,date_to:e.target.value}))} />
          </div>
          <div className="rv-field-group rv-field-group--grow">
            <label>Проект</label>
            <select value={filters.project} onChange={e=>setFilters(f=>({...f,project:e.target.value}))}>
              <option value="">Все проекты</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="rv-field-group rv-field-group--grow">
            <label>Исполнитель</label>
            <select value={filters.assignee} onChange={e=>setFilters(f=>({...f,assignee:e.target.value}))}>
              <option value="">Все</option>
              {members.map(m=><option key={m.user||m.id} value={m.user||m.id}>{m.user_name||m.user_email}</option>)}
            </select>
          </div>
          <div className="rv-filter-btns">
            <button className="btn-primary btn-small" onClick={()=>loadReport()}>Применить</button>
            <button className="btn-secondary btn-small" onClick={reset}>Сбросить</button>
          </div>
        </div>

        <div className="rv-filters-bottom">
          <div className="rv-checks-group">
            <span className="rv-checks-label">Статус</span>
            {ALL_S.map(s=>(
              <label key={s} className={`rv-check ${filters.status.includes(s)?'rv-check--on':''}`}>
                <input type="checkbox" checked={filters.status.includes(s)} onChange={()=>toggle('status',s)} />
                <span className="rv-check-dot" style={{background:SC[s]}} />
                {SL[s]}
              </label>
            ))}
          </div>
          <div className="rv-checks-group">
            <span className="rv-checks-label">Приоритет</span>
            {ALL_P.map(p=>(
              <label key={p} className={`rv-check ${filters.priority.includes(p)?'rv-check--on':''}`}>
                <input type="checkbox" checked={filters.priority.includes(p)} onChange={()=>toggle('priority',p)} />
                <span className="rv-check-dot" style={{background:PC[p]}} />
                {PL[p]}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="rv-toolbar">
        <span className="rv-toolbar-meta">
          {data ? `Сформирован: ${data.generated_at} · ${data.tasks.length} задач` : ''}
        </span>
        <div className="rv-export-btns">
          <button className="rv-btn-export rv-btn-export--excel" onClick={handleExcel}
            disabled={!data || exporting==='excel'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            {exporting==='excel' ? 'Экспорт…' : 'Excel'}
          </button>
          <button className="rv-btn-export rv-btn-export--pdf" onClick={handlePDF} disabled={!data}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            PDF
          </button>
        </div>
      </div>

      {loading && <div className="rv-loading"><div className="spinner-large"/><p>Формирование отчёта…</p></div>}
      {error   && <div className="rv-error">{error}</div>}

      {data && !loading && <>

        {/* KPI */}
        <div className="rv-kpi-row">
          {[
            { label:'Всего задач',  v: data.summary.total,          accent:'#6366f1' },
            { label:'Завершено',    v: `${data.summary.done} (${data.summary.completion_rate}%)`, accent:'#10B981' },
            { label:'В работе',     v: data.summary.in_progress,    accent:'#3B82F6' },
            { label:'На проверке', v: data.summary.review,          accent:'#F59E0B' },
            { label:'Просрочено',   v: data.summary.overdue,        accent:'#EF4444' },
            { label:'Среднее дней', v: data.summary.avg_completion_days ?? '—', accent:'#8B5CF6' },
          ].map(({ label, v, accent }) => (
            <div key={label} className="rv-kpi" style={{ borderTopColor: accent }}>
              <div className="rv-kpi-value" style={{ color: accent }}>{v}</div>
              <div className="rv-kpi-label">{label}</div>
            </div>
          ))}
        </div>

        {/* By user */}
        {data.by_user.length > 0 && (
          <div className="rv-section">
            <div className="rv-section-header">
              <h3 className="rv-section-title">По исполнителям</h3>
              <span className="rv-section-count">{data.by_user.length}</span>
            </div>
            <div className="rv-table-wrap">
              <table className="rv-table">
                <thead><tr>
                  <th>Исполнитель</th><th>Всего</th><th>Завершено</th>
                  <th>В работе</th><th>На проверке</th><th>Новые</th>
                  <th>Просрочено</th><th>Прогресс</th><th>Среднее дней</th>
                </tr></thead>
                <tbody>
                  {data.by_user.map((u,i)=>(
                    <tr key={i}>
                      <td>
                        <div className="rv-user-cell">
                          <div className="rv-avatar">{u.name[0]}</div>
                          <div>
                            <div className="rv-user-name">{u.name}</div>
                            <div className="rv-user-email">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><strong>{u.total}</strong></td>
                      <td><span className="rv-td-done">{u.done}</span></td>
                      <td>{u.in_progress}</td>
                      <td>{u.review}</td>
                      <td>{u.new}</td>
                      <td>{u.overdue > 0 ? <span className="rv-td-overdue">{u.overdue}</span> : '0'}</td>
                      <td><MiniBar pct={u.completion_rate} /></td>
                      <td className="rv-td-muted">{u.avg_completion_days ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* By project */}
        {data.by_project.length > 0 && (
          <div className="rv-section">
            <div className="rv-section-header">
              <h3 className="rv-section-title">По проектам</h3>
              <span className="rv-section-count">{data.by_project.length}</span>
            </div>
            <div className="rv-table-wrap">
              <table className="rv-table">
                <thead><tr>
                  <th>Проект</th><th>Статус</th><th>Дедлайн</th>
                  <th>Всего</th><th>Завершено</th><th>В работе</th>
                  <th>На проверке</th><th>Просрочено</th><th>Прогресс</th>
                </tr></thead>
                <tbody>
                  {data.by_project.map((p,i)=>(
                    <tr key={i}>
                      <td><strong>{p.name}</strong></td>
                      <td><Badge label={PROJ_S[p.status]||p.status} color={p.status==='active'?'#10B981':'#6B7280'}/></td>
                      <td className="rv-td-muted">{p.deadline}</td>
                      <td><strong>{p.total}</strong></td>
                      <td><span className="rv-td-done">{p.done}</span></td>
                      <td>{p.in_progress}</td>
                      <td>{p.review}</td>
                      <td>{p.overdue > 0 ? <span className="rv-td-overdue">{p.overdue}</span> : '0'}</td>
                      <td><MiniBar pct={p.progress_pct} color="#10B981" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Task list */}
        <div className="rv-section">
          <div className="rv-section-header">
            <h3 className="rv-section-title">Список задач</h3>
            <span className="rv-section-count">{data.tasks.length}</span>
          </div>
          <div className="rv-table-wrap">
            <table className="rv-table rv-table--tasks">
              <thead><tr>
                <th>Задача</th><th>Проект</th><th>Исполнитель</th>
                <th>Статус</th><th>Приоритет</th>
                <th>Создана</th><th>Срок</th><th>Завершена</th><th>Оценка (ч)</th>
              </tr></thead>
              <tbody>
                {data.tasks.map((t,i)=>(
                  <tr key={i} className={t.is_overdue ? 'rv-tr-overdue' : ''}>
                    <td className="rv-td-task">
                      {t.is_overdue && <span className="rv-overdue-dot" title="Просрочено"/>}
                      <span>{t.title}</span>
                    </td>
                    <td className="rv-td-muted">{t.project}</td>
                    <td>{t.assignee}</td>
                    <td><Badge label={SL[t.status]||t.status} color={SC[t.status]||'#6B7280'}/></td>
                    <td><Badge label={PL[t.priority]||t.priority} color={PC[t.priority]||'#6B7280'}/></td>
                    <td className="rv-td-muted">{t.created_at}</td>
                    <td className={t.is_overdue ? 'rv-td-overdue' : 'rv-td-muted'}>{t.due_date}</td>
                    <td className="rv-td-muted">{t.completed_at}</td>
                    <td className="rv-td-muted">{t.estimated_hours ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </>}
    </div>
  );
}

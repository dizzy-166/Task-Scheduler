import { useState, useEffect, useRef } from 'react';
import chatService from '../api/chatService';

const TYPE_ICON = {
  task_assigned:  '👤',
  status_changed: '🔄',
  deadline_soon:  '⏰',
  task_created:   '✅',
};

const MENTION_TYPES = new Set(['comment_mention', 'chat_mention']);

export default function NotificationBell({ onTaskClick, onNewNotifications }) {
  const [data,    setData]    = useState({ results: [], unread: 0 });
  const [open,    setOpen]    = useState(false);
  const ref = useRef(null);
  const lastNotifIdRef = useRef(null);
  const onNewNotifRef = useRef(onNewNotifications);
  useEffect(() => { onNewNotifRef.current = onNewNotifications; }, [onNewNotifications]);

  const load = () =>
    chatService.getNotifications().then(newData => {
      setData(newData);
      const results = newData?.results;
      if (!results?.length) return;
      const maxId = Math.max(...results.map(n => n.id));
      if (lastNotifIdRef.current === null) {
        lastNotifIdRef.current = maxId;
        return;
      }
      if (maxId > lastNotifIdRef.current) {
        const fresh = results.filter(
          n => n.id > lastNotifIdRef.current && MENTION_TYPES.has(n.type)
        );
        lastNotifIdRef.current = maxId;
        if (fresh.length) onNewNotifRef.current?.(fresh);
      }
    }).catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAll = async () => {
    await chatService.markAllRead();
    setData(d => ({ ...d, unread: 0, results: d.results.map(n => ({ ...n, is_read: true })) }));
  };

  const handleMark = async (id) => {
    await chatService.markRead(id);
    setData(d => ({
      ...d,
      unread: Math.max(0, d.unread - 1),
      results: d.results.map(n => n.id === id ? { ...n, is_read: true } : n),
    }));
  };

  const fmt = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60)   return 'только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notif-bell" onClick={() => setOpen(o => !o)} title="Уведомления">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {data.unread > 0 && (
          <span className="notif-badge">{data.unread > 99 ? '99+' : data.unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-header-title">Уведомления</span>
            {data.unread > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAll}>
                Прочитать все
              </button>
            )}
          </div>

          <div className="notif-list">
            {data.results.length === 0 && (
              <div className="notif-empty">Уведомлений нет</div>
            )}
            {data.results.map(n => (
              <div
                key={n.id}
                className={`notif-item${n.is_read ? '' : ' notif-item--unread'}${n.related_task ? ' notif-item--clickable' : ''}`}
                onClick={() => {
                  if (!n.is_read) handleMark(n.id);
                  if (n.related_task && onTaskClick) {
                    setOpen(false);
                    onTaskClick({ id: n.related_task });
                  }
                }}
              >
                <span className="notif-icon">{TYPE_ICON[n.type] || '📌'}</span>
                <div className="notif-content">
                  <div className="notif-title">{n.title}</div>
                  {n.body && <div className="notif-body">{n.body}</div>}
                  <div className="notif-time">{fmt(n.created_at)}</div>
                </div>
                {!n.is_read && <span className="notif-dot" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

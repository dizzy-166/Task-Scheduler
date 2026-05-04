import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import chatService from '../api/chatService';
import useAuthStore from '../store/authStore';
import useCompanyStore from '../store/companyStore';
import projectService from '../api/projectService';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

function groupByDate(messages) {
  const out = [];
  let last = null;
  messages.forEach(m => {
    const d = new Date(m.created_at).toDateString();
    if (d !== last) { out.push({ type: 'date', label: fmtDate(m.created_at), key: d }); last = d; }
    out.push({ type: 'msg', data: m });
  });
  return out;
}

// ── sub-components ────────────────────────────────────────────────────────────
function Avatar({ initials, size = 32 }) {
  return (
    <div className="ch-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

function ReplyQuote({ reply, onCancel }) {
  return (
    <div className="ch-reply-quote">
      <div className="ch-reply-quote-bar" />
      <div className="ch-reply-quote-content">
        <span className="ch-reply-quote-name">{reply.sender_name}</span>
        <span className="ch-reply-quote-text">{reply.text}</span>
      </div>
      {onCancel && <button className="ch-reply-quote-cancel" onClick={onCancel}>✕</button>}
    </div>
  );
}

function ContextMenu({ menu, myId, onClose, onCopy, onReply, onEdit, onDelete }) {
  const ref = useRef(null);
  const isMe = menu.msg.sender === myId;
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });

  // Adjust if menu goes off-screen
  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      left: rect.right  > vw ? menu.x - rect.width  : menu.x,
      top:  rect.bottom > vh ? menu.y - rect.height  : menu.y,
    });
  }, [menu.x, menu.y]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="ch-ctx-menu" style={{ left: pos.left, top: pos.top }} ref={ref}>
      <button className="ch-ctx-item" onClick={onCopy}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Копировать
      </button>
      <button className="ch-ctx-item" onClick={onReply}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
        </svg>
        Ответить
      </button>
      {isMe && <>
        <div className="ch-ctx-divider" />
        <button className="ch-ctx-item" onClick={onEdit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Редактировать
        </button>
        <button className="ch-ctx-item ch-ctx-danger" onClick={onDelete}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Удалить
        </button>
      </>}
    </div>
  );
}

function Message({ m, myId, onReply, onContextMenu, isNew, isEditing, editText, onEditChange, onEditSave, onEditCancel }) {
  const [hover, setHover] = useState(false);
  const hideTimer = useRef(null);
  const editRef   = useRef(null);
  const isMe = m.sender === myId;

  const onEnter = () => { clearTimeout(hideTimer.current); setHover(true); };
  const onLeave = () => { hideTimer.current = setTimeout(() => setHover(false), 300); };

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleEditKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEditSave(); }
    if (e.key === 'Escape') onEditCancel();
  };

  return (
    <div
      className={`ch-msg${isMe ? ' ch-msg--me' : ''}${isNew ? ' ch-msg--new' : ''}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, m); }}
    >
      {!isMe && <Avatar initials={m.sender_initials} />}
      <div className="ch-bubble-wrap">
        {!isMe && <div className="ch-sender-name">{m.sender_name}</div>}
        {m.reply_to_data && <ReplyQuote reply={m.reply_to_data} />}
        {isEditing ? (
          <div className="ch-edit-wrap">
            <textarea
              ref={editRef}
              className="ch-edit-input"
              value={editText}
              onChange={e => onEditChange(e.target.value)}
              onKeyDown={handleEditKey}
              rows={Math.min(6, Math.max(1, (editText.match(/\n/g) || []).length + 1))}
            />
            <div className="ch-edit-actions">
              <span className="ch-edit-hint">Enter — сохранить · Esc — отмена</span>
              <button className="ch-edit-save-btn" onClick={onEditSave}>Сохранить</button>
              <button className="ch-edit-cancel-btn" onClick={onEditCancel}>Отмена</button>
            </div>
          </div>
        ) : (
          <div className="ch-bubble">
            <span className="ch-text">{m.text}</span>
            <span className="ch-time">
              {m.edited_at && <span className="ch-edited">ред.&nbsp;</span>}
              {fmtTime(m.created_at)}
            </span>
          </div>
        )}
      </div>
      {hover && !isEditing && (
        <button
          className="ch-reply-btn"
          onClick={() => onReply(m)}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          title="Ответить"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function ChatView() {
  const { user }          = useAuthStore();
  const { activeCompany } = useCompanyStore();

  const [projects,  setProjects]  = useState([]);
  const [members,   setMembers]   = useState([]);
  const [channel,   setChannel]   = useState({ type: 'company', id: null, name: 'Общий' });
  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState('');
  const [replyTo,   setReplyTo]   = useState(null);
  const [sending,   setSending]   = useState(false);
  const [newCount,  setNewCount]  = useState(0);
  const [newIds,    setNewIds]    = useState(new Set());

  // Edit & context menu
  const [editingId, setEditingId] = useState(null);
  const [editText,  setEditText]  = useState('');
  const [ctxMenu,   setCtxMenu]   = useState(null); // { x, y, msg }

  const bottomRef       = useRef(null);
  const inputRef        = useRef(null);
  const messagesAreaRef = useRef(null);
  const lastIdRef       = useRef(0);
  const nearBottomRef   = useRef(true);
  const myIdRef         = useRef(user?.id);

  useEffect(() => { myIdRef.current = user?.id; }, [user?.id]);

  useEffect(() => {
    if (!newIds.size) return;
    const t = setTimeout(() => setNewIds(new Set()), 2500);
    return () => clearTimeout(t);
  }, [newIds]);

  // ── scroll tracking ───────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = fromBottom < 80;
    if (fromBottom < 80) setNewCount(0);
  }, []);

  const scrollToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewCount(0);
  }, []);

  // ── sidebar data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCompany) return;
    projectService.getProjects().then(r => setProjects(Array.isArray(r) ? r : r?.results || [])).catch(() => {});
    chatService.getMembers().then(setMembers).catch(() => {});
  }, [activeCompany]);

  // ── load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (initial = false) => {
    try {
      const params = { type: channel.type };
      if (channel.type === 'project') params.project_id = channel.id;
      if (channel.type === 'direct')  params.with_user  = channel.id;
      const data = await chatService.getMessages(params);
      const msgs = Array.isArray(data) ? data : [];

      if (initial || !lastIdRef.current) {
        setMessages(msgs);
        if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 60);
        return;
      }

      const freshAll    = msgs.filter(m => m.id > lastIdRef.current);
      const freshOthers = freshAll.filter(m => m.sender !== myIdRef.current);
      if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;

      // Preserve in-progress edits
      setMessages(prev => {
        const editId = editingId;
        return msgs.map(m => (m.id === editId ? prev.find(p => p.id === editId) || m : m));
      });

      if (!freshAll.length) return;
      if (freshOthers.length) {
        setNewIds(prev => { const n = new Set(prev); freshOthers.forEach(m => n.add(m.id)); return n; });
        if (nearBottomRef.current)
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        else
          setNewCount(n => n + freshOthers.length);
      } else if (nearBottomRef.current) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      }
    } catch {}
  }, [channel, editingId]);

  useEffect(() => {
    lastIdRef.current   = 0;
    nearBottomRef.current = true;
    setNewCount(0);
    setNewIds(new Set());
    setEditingId(null);
    setEditText('');
    setCtxMenu(null);
    loadMessages(true);
    const id = setInterval(() => loadMessages(false), 4000);
    return () => clearInterval(id);
  }, [loadMessages]);

  // ── send ──────────────────────────────────────────────────────────────────
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const payload = { text: text.trim(), channel_type: channel.type, reply_to_id: replyTo?.id || null };
      if (channel.type === 'project') payload.project_id   = channel.id;
      if (channel.type === 'direct')  payload.recipient_id = channel.id;
      const msg = await chatService.sendMessage(payload);
      lastIdRef.current = msg.id;
      setMessages(m => [...m, msg]);
      setText('');
      setReplyTo(null);
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); inputRef.current?.focus(); }, 50);
    } catch {}
    finally { setSending(false); }
  };

  // ── edit ──────────────────────────────────────────────────────────────────
  const startEdit = (msg) => { setEditingId(msg.id); setEditText(msg.text); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
  const saveEdit = async () => {
    if (!editText.trim() || !editingId) return;
    try {
      const updated = await chatService.editMessage(editingId, editText.trim());
      setMessages(prev => prev.map(m => m.id === editingId ? updated : m));
      setEditingId(null);
      setEditText('');
    } catch {}
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const deleteMsg = async (id) => {
    try {
      await chatService.deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  // ── context menu ──────────────────────────────────────────────────────────
  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const selectChannel = (ch) => { setChannel(ch); setReplyTo(null); setText(''); setEditingId(null); setCtxMenu(null); };

  const grouped = groupByDate(messages);
  const myId    = user?.id;
  const newLabel = newCount === 1 ? '1 новое сообщение' : newCount < 5 ? `${newCount} новых сообщения` : `${newCount} новых сообщений`;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="ch-wrap">

      {/* Sidebar */}
      <aside className="ch-sidebar">
        <div className="ch-sidebar-section">
          <div className="ch-sidebar-label">Каналы</div>
          <button
            className={`ch-channel-item${channel.type === 'company' ? ' active' : ''}`}
            onClick={() => selectChannel({ type: 'company', id: null, name: 'Общий' })}
          >
            <span className="ch-channel-hash">#</span> Общий
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              className={`ch-channel-item${channel.type === 'project' && channel.id === p.id ? ' active' : ''}`}
              onClick={() => selectChannel({ type: 'project', id: p.id, name: p.name })}
            >
              <span className="ch-channel-hash">#</span>
              <span className="ch-channel-name">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="ch-sidebar-section">
          <div className="ch-sidebar-label">Личные сообщения</div>
          {members.map(m => (
            <button
              key={m.id}
              className={`ch-channel-item ch-dm-item${channel.type === 'direct' && channel.id === m.id ? ' active' : ''}`}
              onClick={() => selectChannel({ type: 'direct', id: m.id, name: m.name })}
            >
              <div className="ch-dm-avatar">{m.initials}</div>
              <span className="ch-channel-name">{m.name}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="ch-main">
        <div className="ch-main-header">
          <span className="ch-main-title">
            {channel.type === 'direct'
              ? <><div className="ch-dm-avatar ch-dm-avatar--sm">{members.find(m => m.id === channel.id)?.initials}</div>{channel.name}</>
              : <><span className="ch-channel-hash ch-channel-hash--lg">#</span>{channel.name}</>
            }
          </span>
        </div>

        <div className="ch-messages-wrap">
          <div className="ch-messages" ref={messagesAreaRef} onScroll={handleScroll}>
            {messages.length === 0 && <div className="ch-empty">Нет сообщений. Начните общение!</div>}
            {grouped.map((item) => {
              if (item.type === 'date') return (
                <div key={item.key} className="ch-date-sep"><span>{item.label}</span></div>
              );
              return (
                <Message
                  key={item.data.id}
                  m={item.data}
                  myId={myId}
                  onReply={setReplyTo}
                  onContextMenu={handleContextMenu}
                  isNew={newIds.has(item.data.id)}
                  isEditing={editingId === item.data.id}
                  editText={editText}
                  onEditChange={setEditText}
                  onEditSave={saveEdit}
                  onEditCancel={cancelEdit}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>

          {newCount > 0 && (
            <button className="ch-new-msg-btn" onClick={scrollToLatest}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              {newLabel}
            </button>
          )}
        </div>

        <div className="ch-input-area">
          {replyTo && (
            <ReplyQuote
              reply={{ sender_name: replyTo.sender_name, text: replyTo.text }}
              onCancel={() => setReplyTo(null)}
            />
          )}
          <div className="ch-input-row">
            <textarea
              ref={inputRef}
              className="ch-input"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Написать в ${channel.type === 'direct' ? channel.name : '#' + channel.name}…`}
              rows={1}
            />
            <button className="ch-send-btn" onClick={send} disabled={!text.trim() || sending} title="Отправить (Enter)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          myId={myId}
          onClose={() => setCtxMenu(null)}
          onCopy={() => { navigator.clipboard.writeText(ctxMenu.msg.text); setCtxMenu(null); }}
          onReply={() => { setReplyTo(ctxMenu.msg); setCtxMenu(null); }}
          onEdit={() => { startEdit(ctxMenu.msg); setCtxMenu(null); }}
          onDelete={() => { deleteMsg(ctxMenu.msg.id); setCtxMenu(null); }}
        />
      )}
    </div>
  );
}

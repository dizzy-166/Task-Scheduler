// components/TaskContextMenu.jsx
import { useState, useEffect } from 'react';

const TaskContextMenu = ({ x, y, task, onClose, onStatusChange }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleClickOutside = () => {
      setVisible(false);
      onClose();
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  if (!visible) return null;

  const statuses = [
    { value: 'new', label: 'К выполнению' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'review', label: 'На проверке' },
    { value: 'done', label: 'Завершено' }
  ];

  return (
    <div 
      className="task-context-menu"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="context-menu-header">
        <strong>{task.title}</strong>
      </div>
      <div className="context-menu-divider"></div>
      {statuses.map(status => (
        <button
          key={status.value}
          className="context-menu-item"
          onClick={() => {
            onStatusChange(task.id, status.value);
            onClose();
          }}
          disabled={task.status === status.value}
        >
          {status.label}
          {task.status === status.value && <span> ✓</span>}
        </button>
      ))}
    </div>
  );
};

export default TaskContextMenu;
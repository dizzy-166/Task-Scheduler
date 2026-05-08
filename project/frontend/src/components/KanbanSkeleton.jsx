export default function KanbanSkeleton({ columns = 4, cardsPerCol = 3 }) {
  return (
    <div className="kanban-skeleton">
      {Array.from({ length: columns }).map((_, ci) => (
        <div key={ci} className="kanban-skeleton-col">
          <div className="skel skel-col-header" />
          {Array.from({ length: cardsPerCol }).map((_, ri) => (
            <div key={ri} className="kanban-skeleton-card">
              <div className="skel skel-title" style={{ width: `${60 + (ri * 13) % 35}%` }} />
              <div className="skel skel-line" style={{ width: `${40 + (ci * 17 + ri * 11) % 45}%` }} />
              <div className="skel-footer">
                <div className="skel skel-avatar" />
                <div className="skel skel-chip" style={{ width: 56 }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

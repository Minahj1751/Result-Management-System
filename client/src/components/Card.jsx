export default function Card({ children, title, className = '', actions }) {
  return (
    <div className={`ui-card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-4">
          {title && <h2 className="ui-card-title">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

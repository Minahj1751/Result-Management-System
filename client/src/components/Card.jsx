export default function Card({ children, title, className = '', actions }) {
  return (
    <div className={`ui-card ${className}`}>
      {(title || actions) && (
        <div className="flex justify-between items-center mb-4">
          {title && <h2 className="ui-card-title">{title}</h2>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

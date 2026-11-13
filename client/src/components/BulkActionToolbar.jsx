/**
 * Sticky toolbar shown when rows are selected.
 * Props: count, onClear, children (action buttons)
 */
export default function BulkActionToolbar({ count, onClear, children }) {
  if (!count) return null;
  return (
    <div className="ui-bulk-toolbar">
      <span className="ui-bulk-count">{count} selected</span>
      <div className="ui-bulk-actions">{children}</div>
      <button type="button" className="ui-bulk-clear" onClick={onClear}>
        Clear selection
      </button>
    </div>
  );
}

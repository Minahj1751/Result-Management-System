const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Pagination bar.
 *
 * Props:
 *  - pagination: { page, limit, total, totalPages }
 *  - onPageChange(page)
 *  - onLimitChange(limit) — optional; renders a page-size selector
 *  - pageSizeOptions — optional override
 */
export default function Pagination({ pagination, onPageChange, onLimitChange, pageSizeOptions = PAGE_SIZE_OPTIONS }) {
  if (!pagination || !pagination.total) return null;

  const { page, limit, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = [];
  const windowSize = 2;
  let start = Math.max(1, page - windowSize);
  let end = Math.min(totalPages, page + windowSize);
  if (end - start < windowSize * 2) {
    if (start === 1) end = Math.min(totalPages, start + windowSize * 2);
    else start = Math.max(1, end - windowSize * 2);
  }
  for (let i = start; i <= end; i++) pages.push(i);

  const btn = 'ui-page-btn';
  const btnDisabled = `${btn} ui-page-btn-disabled`;

  return (
    <div className="ui-pagination">
      <div className="ui-pagination-info">
        Showing {from}–{to} of {total} records
      </div>
      <div className="ui-pagination-controls">
        <button type="button" className={page <= 1 ? btnDisabled : btn} disabled={page <= 1} onClick={() => onPageChange(1)}>
          « First
        </button>
        <button type="button" className={page <= 1 ? btnDisabled : btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ‹ Prev
        </button>
        {start > 1 && (
          <>
            <button type="button" className={btn} onClick={() => onPageChange(1)}>1</button>
            {start > 2 && <span className="ui-page-ellipsis">…</span>}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`${btn} ${p === page ? 'ui-page-btn-active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="ui-page-ellipsis">…</span>}
            <button type="button" className={btn} onClick={() => onPageChange(totalPages)}>{totalPages}</button>
          </>
        )}
        <button type="button" className={page >= totalPages ? btnDisabled : btn} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next ›
        </button>
        <button type="button" className={page >= totalPages ? btnDisabled : btn} disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          Last »
        </button>
      </div>
      {onLimitChange && (
        <div className="ui-pagination-size">
          <label htmlFor="page-size-select">Rows:</label>
          <select
            id="page-size-select"
            className="ui-select ui-page-size-select"
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

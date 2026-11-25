import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Reusable multi-select dropdown.
 *
 * Props:
 *  - options: [{ value, label, disabled? }]
 *  - value: array of selected values
 *  - onChange(values): called with the new array of selected values
 *  - label, placeholder, loading, emptyMessage, disabled, required
 *  - getLabel(value): optional resolver for chip labels when options change
 */
export default function MultiSelect({
  options = [],
  value = [],
  onChange,
  label,
  name,
  placeholder = 'Select...',
  loading = false,
  emptyMessage = 'No options available',
  disabled = false,
  required = false,
  getLabel,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [panelStyle, setPanelStyle] = useState(null);
  const triggerRef = useRef(null);

  const computePanelStyle = () => {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const gap = 6;
    const width = Math.min(Math.max(rect.width, 240), vw - margin * 2);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, margin),
      vw - width - margin
    );
    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(openUp ? spaceAbove : spaceBelow, vh - margin * 2));
    return openUp
      ? { bottom: vh - rect.top + gap, left, width, maxHeight }
      : { top: rect.bottom + gap, left, width, maxHeight };
  };

  useEffect(() => {
    if (!open) return undefined;
    const update = () => setPanelStyle(computePanelStyle());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, search]);

  const filteredSelectedCount = filteredOptions.filter((o) => selectedSet.has(o.value)).length;
  const allFilteredSelected = filteredOptions.length > 0 && filteredSelectedCount === filteredOptions.length;

  const labelFor = (v) => {
    const opt = options.find((o) => o.value === v);
    if (opt) return opt.label;
    return getLabel ? getLabel(v) : v;
  };

  const toggle = (optionValue, checked) => {
    if (checked) onChange([...value, optionValue]);
    else onChange(value.filter((v) => v !== optionValue));
  };

  const toggleAllFiltered = (checked) => {
    if (checked) {
      const merged = new Set(value);
      filteredOptions.forEach((o) => { if (!o.disabled) merged.add(o.value); });
      onChange([...merged]);
    } else {
      const remove = new Set(filteredOptions.map((o) => o.value));
      onChange(value.filter((v) => !remove.has(v)));
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className="relative">
      {label && (
        <label className="ui-field-label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`ui-input ui-multiselect-trigger ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className={value.length ? 'text-gray-800' : 'text-gray-400'}>
          {value.length === 0
            ? placeholder
            : `${value.length} selected`}
        </span>
        <span className="ui-multiselect-chevron" aria-hidden="true">▾</span>
      </button>

      {value.length > 0 && (
        <div className="ui-chip-list">
          {value.map((v) => (
            <span key={v} className="ui-chip">
              {labelFor(v)}
              <button
                type="button"
                className="ui-chip-remove"
                aria-label={`Remove ${labelFor(v)}`}
                onClick={() => toggle(v, false)}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="ui-chip-clear" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}

      {open && panelStyle && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="ui-multiselect-panel" style={{ position: 'fixed', zIndex: 40, ...panelStyle }}>
            <div className="ui-multiselect-search-wrap">
              <input
                type="text"
                className="ui-input"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {filteredOptions.length > 0 && (
              <label className="ui-multiselect-all">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(e) => toggleAllFiltered(e.target.checked)}
                />
                <span>
                  {search.trim()
                    ? `Select all matching (${filteredOptions.length})`
                    : `Select all (${filteredOptions.length})`}
                </span>
              </label>
            )}

            <div className="ui-multiselect-options">
              {loading ? (
                <div className="ui-multiselect-empty">Loading...</div>
              ) : filteredOptions.length === 0 ? (
                <div className="ui-multiselect-empty">{emptyMessage}</div>
              ) : (
                filteredOptions.map((option) => (
                  <label key={option.value} className={`ui-multiselect-option ${option.disabled ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(option.value)}
                      disabled={option.disabled}
                      onChange={(e) => toggle(option.value, e.target.checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))
              )}
            </div>

            <div className="ui-multiselect-footer">
              {value.length} selected
              {search.trim() && filteredOptions.length !== options.length && (
                <span className="text-gray-400"> · {filteredOptions.length} of {options.length} shown</span>
              )}
            </div>
          </div>
        </>
      )}
      {name && <input type="hidden" name={name} value={value.join(',')} />}
    </div>
  );
}

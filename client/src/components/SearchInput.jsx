import { useEffect, useState } from 'react';
import useDebounce from '../hooks/useDebounce';

/**
 * Search input with built-in debounce.
 * Calls onSearch(debouncedValue) whenever the debounced text changes.
 */
export default function SearchInput({ value, onChange, onSearch, placeholder = 'Search...', className = '', delay = 350, ...props }) {
  const [text, setText] = useState(value || '');
  const debounced = useDebounce(text, delay);

  useEffect(() => {
    setText(value || '');
  }, [value]);

  useEffect(() => {
    if (onSearch) onSearch(debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="text"
      className={`ui-input ${className}`}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (onChange) onChange(e.target.value);
      }}
      {...props}
    />
  );
}

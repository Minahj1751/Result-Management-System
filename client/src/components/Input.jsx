export default function Input({ label, type = 'text', name, value, onChange, placeholder, required = false, error = '', onWheel, ...props }) {
  const handleWheel = (e) => {
    if (type === 'number') e.target.blur();
    onWheel?.(e);
  };
  return (
    <div>
      {label && (
        <label htmlFor={name} className="ui-field-label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onWheel={handleWheel}
        placeholder={placeholder}
        required={required}
        className={`ui-input ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        {...props}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

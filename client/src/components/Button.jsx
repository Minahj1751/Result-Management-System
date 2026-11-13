export default function Button({ children, onClick, type = 'button', disabled = false, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'ui-button-primary',
    secondary: 'ui-button-secondary',
    danger: 'ui-button-danger',
    success: 'ui-button-success',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ui-button ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

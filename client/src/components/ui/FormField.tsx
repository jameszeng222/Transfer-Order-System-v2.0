

type FieldType =
  | 'text'
  | 'select'
  | 'textarea'
  | 'number'
  | 'date'
  | 'switch'
  | 'password';

interface SelectOption {
  label: string;
  value: string;
}

interface FormFieldProps {
  label?: string;
  name: string;
  type?: FieldType;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
  error?: string;
  required?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  options = [],
  placeholder,
  disabled = false,
  className = '',
}: FormFieldProps) {
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    if (type === 'switch') return;
    const v = type === 'number' ? Number(e.target.value) : e.target.value;
    onChange(name, v);
  };

  const inputClasses =
    'w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400';

  const borderClass = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-blue-500';

  const renderInput = () => {
    switch (type) {
      case 'select':
        return (
          <select
            name={name}
            value={(value as string) || ''}
            onChange={handleChange}
            disabled={disabled}
            className={`${inputClasses} ${borderClass}`}
          >
            <option value="">{placeholder || '请选择'}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            name={name}
            value={(value as string) || ''}
            onChange={handleChange}
            disabled={disabled}
            placeholder={placeholder}
            rows={3}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${borderClass}`}
          />
        );

      case 'switch':
        return (
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            disabled={disabled}
            onClick={() => onChange(name, !value)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              value ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                value ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        );

      case 'number':
        return (
          <input
            type="number"
            name={name}
            value={(value as number | string) ?? ''}
            onChange={handleChange}
            disabled={disabled}
            placeholder={placeholder}
            className={`${inputClasses} ${borderClass}`}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            name={name}
            value={(value as string) || ''}
            onChange={handleChange}
            disabled={disabled}
            className={`${inputClasses} ${borderClass}`}
          />
        );

      case 'password':
        return (
          <input
            type="password"
            name={name}
            value={(value as string) || ''}
            onChange={handleChange}
            disabled={disabled}
            placeholder={placeholder}
            className={`${inputClasses} ${borderClass}`}
          />
        );

      default:
        return (
          <input
            type="text"
            name={name}
            value={(value as string) || ''}
            onChange={handleChange}
            disabled={disabled}
            placeholder={placeholder}
            className={`${inputClasses} ${borderClass}`}
          />
        );
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {renderInput()}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

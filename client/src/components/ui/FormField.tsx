import { useRef, useEffect } from 'react';

type FieldType =
  | 'text'
  | 'select'
  | 'multiSelect'
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
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (type === 'select' && selectRef.current) {
      selectRef.current.style.backgroundImage = "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3b4' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")";
      selectRef.current.style.backgroundPosition = 'right 8px center';
      selectRef.current.style.backgroundRepeat = 'no-repeat';
      selectRef.current.style.backgroundSize = '16px';
      selectRef.current.style.appearance = 'none';
      selectRef.current.style.paddingRight = '28px';
    }
  }, [type]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    if (type === 'switch' || type === 'multiSelect') return;
    const v = type === 'number' ? Number(e.target.value) : e.target.value;
    onChange(name, v);
  };

  const handleMultiSelectToggle = (optValue: string) => {
    const current = String(value || '');
    const parts = current ? current.split(',') : [];
    const idx = parts.indexOf(optValue);
    if (idx >= 0) {
      parts.splice(idx, 1);
    } else {
      parts.push(optValue);
    }
    onChange(name, parts.join(','));
  };

  const inputClasses =
    'w-full px-3 py-[7px] border border-border rounded-md text-[13px] bg-bg-card outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const borderClass = error
    ? 'border-red focus:border-red'
    : '';

  const renderInput = () => {
    switch (type) {
      case 'select':
        return (
          <select
            ref={selectRef}
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

      case 'multiSelect':
        return (
          <div className={`flex flex-wrap gap-1.5 p-2 border ${error ? 'border-red' : 'border-border'} rounded-md bg-bg-card min-h-[38px]`}>
            {options.map((opt) => {
              const current = String(value || '');
              const selected = current ? current.split(',').includes(opt.value) : false;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleMultiSelectToggle(opt.value)}
                  className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors cursor-pointer ${
                    selected
                      ? 'bg-accent text-white'
                      : 'bg-bg-hover text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
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
            className={`${inputClasses} ${borderClass}`}
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
              value ? 'bg-accent' : 'bg-bg-hover'
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
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="text-[11px] font-medium text-text-tertiary mb-1">
          {label}
          {required && <span className="text-red ml-0.5">*</span>}
        </label>
      )}
      {renderInput()}
      {error && <p className="text-[11px] text-red mt-1">{error}</p>}
    </div>
  );
}

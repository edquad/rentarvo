import React, { useCallback, useState } from 'react';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export function CurrencyInput({ value, onChange, className = '', ...rest }: Props) {
  const [display, setDisplay] = useState(() => {
    if (!value) return '';
    const num = parseFloat(value);
    return isNaN(num) ? '' : num.toFixed(2);
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    // Allow only one decimal point, allow extra decimals during typing (blur will round)
    const parts = raw.split('.');
    let cleaned = parts[0];
    if (parts.length > 1) {
      cleaned += '.' + parts[1];
    }
    setDisplay(cleaned);
    onChange(cleaned);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    if (!display) return;
    const num = parseFloat(display);
    if (!isNaN(num)) {
      const formatted = num.toFixed(2);
      setDisplay(formatted);
      onChange(formatted);
    }
  }, [display, onChange]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`pl-7 ${className}`}
        {...rest}
      />
    </div>
  );
}

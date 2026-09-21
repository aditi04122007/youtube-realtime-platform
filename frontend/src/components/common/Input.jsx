import React from 'react';

const Input = ({
  label,
  error,
  helperText,
  id,
  className = '',
  required = false,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        required={required}
        className={`w-full h-10 px-3.5 text-xs bg-slate-50 dark:bg-slate-900 border ${
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
            : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
        } rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
      {!error && helperText && (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      )}
    </div>
  );
};

export default Input;

import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** Consistent label + hint + error wrapper for any input flavor. */
export function Field({ label, hint, error, required, children, className = '', id }: FieldShellProps) {
  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <div className="form-hint">{hint}</div>}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function TextInput({ label, hint, error, required, className = '', id, ...rest }: TextInputProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={fieldId}>
      <input
        id={fieldId}
        required={required}
        {...rest}
        className={`input ${error ? 'is-invalid' : ''} ${className}`}
      />
    </Field>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function TextArea({ label, hint, error, required, className = '', id, ...rest }: TextAreaProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={fieldId}>
      <textarea
        id={fieldId}
        required={required}
        {...rest}
        className={`textarea ${error ? 'is-invalid' : ''} ${className}`}
      />
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function Select({ label, hint, error, required, className = '', id, children, ...rest }: SelectProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={fieldId}>
      <select
        id={fieldId}
        required={required}
        {...rest}
        className={`select ${error ? 'is-invalid' : ''} ${className}`}
      >
        {children}
      </select>
    </Field>
  );
}

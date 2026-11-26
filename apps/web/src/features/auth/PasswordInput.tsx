import type { InputHTMLAttributes } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}

/** Ô nhập mật khẩu kèm nút icon con mắt bật/tắt hiển thị mật khẩu. */
export function PasswordInput({
  visible,
  onToggle,
  showLabel,
  hideLabel,
  className,
  ...inputProps
}: PasswordInputProps) {
  const label = visible ? hideLabel : showLabel;
  return (
    <div className="fit-password-wrap">
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={`portal-input fit-password-input ${className ?? ''}`.trim()}
      />
      <button
        type="button"
        className="fit-password-toggle"
        aria-label={label}
        aria-pressed={visible}
        title={label}
        onClick={onToggle}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.17 4.49" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

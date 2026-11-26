import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/language';
import './timepicker.css';

export interface TimePickerProps {
  id?: string;
  name?: string;
  value: string; // HH:mm (e.g. '08:00')
  onChange: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Chỉ cho chọn giờ chẵn (phút luôn là 00), ẩn cột phút. */
  wholeHour?: boolean;
  'data-field'?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

const HOURS = Array.from({ length: 24 }, (_, i) => (i < 10 ? `0${i}` : `${i}`));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const POPOVER_WIDTH = 252;
const POPOVER_HEIGHT = 330;

export function TimePicker({
  id,
  name,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder,
  className = '',
  style,
  wholeHour = false,
  'data-field': dataField,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: TimePickerProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; v: 'up' | 'down' } | null>(null);
  const triggerPlaceholder = placeholder ?? t('Chọn giờ...', 'Select time...');
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);

  const focusTrigger = () => {
    containerRef.current?.querySelector<HTMLButtonElement>('.luxury-timepicker-trigger')?.focus();
  };

  // Phân tích giờ và phút; khi giá trị rỗng thì không tô sáng giả 08:00.
  const { hasValue, hour, minute } = useMemo(() => {
    if (value && /^\d{1,2}:\d{2}$/.test(value)) {
      const parts = value.split(':');
      const h = parts[0].padStart(2, '0');
      const m = parts[1];
      return { hasValue: true, hour: h, minute: m };
    }
    return { hasValue: false, hour: null as string | null, minute: null as string | null };
  }, [value]);

  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        focusTrigger();
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Auto scroll active item into view when popover opens (without scrolling ancestor containers)
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      for (const col of [hourScrollRef.current, minuteScrollRef.current]) {
        const item = col?.querySelector<HTMLElement>('.is-active');
        if (col && item) col.scrollTop = Math.max(0, item.offsetTop - (col.clientHeight - item.offsetHeight) / 2);
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Dùng position: fixed theo viewport (tương tự DatePicker) để popover không bị cắt trong <dialog>.
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    const reposition = () => {
      const trigger = containerRef.current?.querySelector<HTMLElement>('.luxury-timepicker-trigger');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - 32);
      const height = popoverRef.current?.offsetHeight || POPOVER_HEIGHT;
      const gap = 6;
      const margin = 8;
      const below = window.innerHeight - rect.bottom - gap - margin;
      const above = rect.top - gap - margin;
      const openUp = below < height && above > below;
      const rawTop = openUp ? rect.top - gap - height : rect.bottom + gap;
      const top = Math.max(margin, Math.min(rawTop, window.innerHeight - height - margin));
      const alignRight = rect.left + width > window.innerWidth - margin && rect.right - width >= margin;
      const rawLeft = alignRight ? rect.right - width : rect.left;
      const left = Math.max(margin, Math.min(rawLeft, window.innerWidth - width - margin));
      setPosition({ top, left, v: openUp ? 'up' : 'down' });
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, wholeHour]);

  const handleSelectHour = (h: string) => {
    const newVal = `${h}:${wholeHour ? '00' : (minute ?? '00')}`;
    onChange({ target: { value: newVal } });
    if (wholeHour) {
      setIsOpen(false);
      focusTrigger();
    }
  };

  const handleSelectMinute = (m: string) => {
    const newVal = `${hour ?? '08'}:${m}`;
    onChange({ target: { value: newVal } });
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ target: { value: '' } });
    setIsOpen(false);
    focusTrigger();
  };

  const handleDone = () => {
    setIsOpen(false);
    focusTrigger();
  };

  return (
    <div className={`luxury-timepicker-wrap ${className}`} ref={containerRef} style={style}>
      <input
        type="hidden"
        name={name ?? id}
        value={value}
        readOnly
      />
      <button
        id={id}
        type="button"
        data-field={dataField}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        className={`luxury-timepicker-trigger ${isOpen ? 'is-open' : ''}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={`luxury-timepicker-value ${!value ? 'luxury-timepicker-placeholder' : ''}`}>
          {value || triggerPlaceholder}
        </span>
        <span className="luxury-timepicker-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
      </button>

      {/* Hidden input for form validation if required */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          required={required}
          value={value}
          onChange={() => {}}
          onInvalid={(event) => {
            event.preventDefault();
            if (!disabled) {
              setIsOpen(true);
              focusTrigger();
            }
          }}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
      )}

      {isOpen && (
        <div
          ref={popoverRef}
          className={`luxury-timepicker-popover luxury-timepicker-popover--${position?.v ?? 'down'}`}
          style={{
            position: 'fixed',
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            bottom: 'auto',
            right: 'auto',
            visibility: position ? 'visible' : 'hidden',
          }}
          role="dialog"
          aria-label={t('Chọn giờ', 'Select time')}
        >
          <div className="ltp-header">
            <span className="ltp-title">{t('Khung giờ', 'Time')}</span>
            <span className="ltp-preview-badge">
              {hasValue ? `${hour}:${wholeHour ? '00' : minute}` : '--:--'}
            </span>
          </div>

          <div className="ltp-columns">
            <div className="ltp-col">
              <span className="ltp-col-label">{t('Giờ', 'Hour')}</span>
              <div className="ltp-col-scroll" ref={hourScrollRef}>
                {HOURS.map((h) => {
                  const active = hasValue && h === hour;
                  return (
                    <button
                      key={h}
                      type="button"
                      className={`ltp-item-btn ${active ? 'is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => handleSelectHour(h)}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {!wholeHour && <div className="ltp-col">
              <span className="ltp-col-label">{t('Phút', 'Min')}</span>
              <div className="ltp-col-scroll" ref={minuteScrollRef}>
                {MINUTES.map((m) => {
                  const active = hasValue && m === minute;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`ltp-item-btn ${active ? 'is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => handleSelectMinute(m)}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>}
          </div>

          <div className="ltp-footer">
            <button
              type="button"
              className="ltp-clear-btn"
              onClick={handleClear}
            >
              {t('Xóa giờ', 'Clear')}
            </button>
            <button
              type="button"
              className="ltp-done-btn"
              onClick={handleDone}
            >
              {t('Xong', 'Done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

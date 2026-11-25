import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/language';
import { centerNowParts } from '../lib/centerTime';
import './datepicker.css';

/** Props của ô chọn ngày: giá trị YYYY-MM-DD, giới hạn min/max, trạng thái và các thuộc tính trợ năng. */
export interface DatePickerProps {
  id?: string;
  name?: string;
  value: string; // YYYY-MM-DD
  // Gọi lại theo dạng sự kiện giả { target: { value } } để dùng thay thẻ input gốc.
  onChange: (e: { target: { value: string } }) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  'data-field'?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

const WEEKDAYS_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const POPOVER_WIDTH = 296;
const POPOVER_HEIGHT = 412;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Thêm số 0 đứng trước cho số nhỏ hơn 10.
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

// Kẹp chuỗi YYYY-MM-DD vào trong khoảng [min, max] nếu hợp lệ.
function clampDateToRange(dateStr: string, min?: string, max?: string): string {
  let result = dateStr;
  if (min && ISO_DATE_RE.test(min) && result < min) result = min;
  if (max && ISO_DATE_RE.test(max) && result > max) result = max;
  return result;
}

// Cộng/trừ số ngày trên chuỗi YYYY-MM-DD bằng UTC để tránh lệch giờ mùa hè.
function addIsoDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

// Cộng/trừ số tháng trên chuỗi YYYY-MM-DD (kẹp ngày vào cuối tháng đích).
function addIsoMonths(dateStr: string, deltaMonths: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const monthIndex = y * 12 + (m - 1) + deltaMonths;
  const ty = Math.floor(monthIndex / 12);
  const tm = ((monthIndex % 12) + 12) % 12;
  const maxDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${pad2(tm + 1)}-${pad2(Math.min(d, maxDay))}`;
}

/**
 * Ô chọn ngày với lịch popup tự vẽ (tuần bắt đầu từ thứ Hai, theo giờ trung tâm): chọn ngày, chọn năm, nút Hôm
 * nay và Xóa, tôn trọng min/max và phím Esc.
 */
export function DatePicker({
  id,
  name,
  value,
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  placeholder,
  className = '',
  style,
  'data-field': dataField,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: DatePickerProps) {
  const { lang, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; v: 'up' | 'down' } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pendingFocusDateRef = useRef<string | null>(null);
  const triggerPlaceholder = placeholder ?? t('Chọn ngày...', 'Select date...');

  const focusTrigger = () => {
    containerRef.current?.querySelector<HTMLButtonElement>('.luxury-datepicker-trigger')?.focus();
  };

  // Phân tích năm và tháng ban đầu từ giá trị hiện tại nếu hợp lệ; khi rỗng thì kẹp hôm nay vào [min, max].
  const initialDate = useMemo(() => {
    const source = value && ISO_DATE_RE.test(value)
      ? value
      : clampDateToRange(centerNowParts().date, min, max);
    const [y, m, d] = source.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
  }, [value, min, max]);

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  // Chế độ chọn năm: bấm vào tiêu đề tháng để nhảy nhanh (ví dụ ngày sinh)
  const [yearMode, setYearMode] = useState(false);
  const [yearPageStart, setYearPageStart] = useState(initialDate.year - 4);

  const todayStr = centerNowParts().date;
  const minYear = min && ISO_DATE_RE.test(min) ? Number(min.slice(0, 4)) : null;
  const minMonth = min && ISO_DATE_RE.test(min) ? Number(min.slice(5, 7)) - 1 : null;
  const minYm = minYear !== null && minMonth !== null ? minYear * 12 + minMonth : null;
  const maxYear = max && ISO_DATE_RE.test(max) ? Number(max.slice(0, 4)) : null;
  const maxMonth = max && ISO_DATE_RE.test(max) ? Number(max.slice(5, 7)) - 1 : null;
  const maxYm = maxYear !== null && maxMonth !== null ? maxYear * 12 + maxMonth : null;
  const viewYm = viewYear * 12 + viewMonth;
  const isPrevDisabled = yearMode
    ? (minYear !== null && yearPageStart <= minYear)
    : (minYm !== null && viewYm <= minYm);
  const isNextDisabled = yearMode
    ? (maxYear !== null && yearPageStart + 11 >= maxYear)
    : (maxYm !== null && viewYm >= maxYm);
  const isTodayDisabled = disabled
    || Boolean((min && ISO_DATE_RE.test(min) && todayStr < min) || (max && ISO_DATE_RE.test(max) && todayStr > max));

  // Đồng bộ tháng/năm đang xem khi giá trị hoặc phạm vi [min, max] thay đổi từ bên ngoài.
  useEffect(() => {
    if (value && ISO_DATE_RE.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
      return;
    }
    const clamped = clampDateToRange(centerNowParts().date, min, max);
    const [y, m] = clamped.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
  }, [value, min, max]);

  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  // Sau khi chuyển tháng bằng phím mũi tên, đưa focus sang đúng ô ngày đích.
  useEffect(() => {
    if (!isOpen || !pendingFocusDateRef.current) return;
    const targetDate = pendingFocusDateRef.current;
    pendingFocusDateRef.current = null;
    popoverRef.current?.querySelector<HTMLButtonElement>(`button.ldp-day-cell[data-date="${targetDate}"]:not(:disabled)`)?.focus();
  }, [isOpen, viewYear, viewMonth]);

  // Bấm ra ngoài để đóng lịch
  useEffect(() => {
    if (!isOpen) return;
    // Bấm ra ngoài lịch thì đóng.
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    // Nhấn Esc thì chỉ đóng lịch (không đóng hộp thoại chứa nó).
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        containerRef.current?.querySelector<HTMLButtonElement>('.luxury-datepicker-trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Popover dùng position: fixed theo viewport để không bị cắt bởi vùng cuộn của <dialog>.
  // Mở xuống khi đủ chỗ, lật lên khi phía trên rộng hơn, và luôn kẹp trong viewport.
  useLayoutEffect(() => {
    if (!isOpen) {
      setYearMode(false);
      setPosition(null);
      return;
    }
    // Tính lại vị trí và hướng mở popup cho vừa viewport.
    const reposition = () => {
      const trigger = containerRef.current?.querySelector<HTMLElement>('.luxury-datepicker-trigger');
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
  }, [isOpen, yearMode, viewMonth, viewYear]);

  // Định dạng nhãn hiển thị DD/MM/YYYY của giá trị hiện tại.
  const displayLabel = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }, [value]);

  // Các hàm điều hướng tháng/năm
  // Lùi một tháng (hoặc một trang năm khi đang chọn năm).
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPrevDisabled) return;
    if (yearMode) {
      setYearPageStart((y) => y - 12);
      return;
    }
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  // Tiến một tháng (hoặc một trang năm khi đang chọn năm).
  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isNextDisabled) return;
    if (yearMode) {
      setYearPageStart((y) => y + 12);
      return;
    }
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Xây dựng lưới ô ngày của tháng đang xem, kèm cờ tháng hiện tại, bị vô hiệu, được chọn và hôm nay.
  const calendarDays = useMemo(() => {
    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = centerNowParts().date;

    // Thứ của ngày đầu tháng hiện tại (0: Chủ Nhật, 1: Thứ Hai, ... 6: Thứ Bảy)
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    // Chuyển sang tuần bắt đầu từ Thứ Hai (Thứ Hai = 0, Chủ Nhật = 6)
    const shift = (firstDayIndex + 6) % 7;

    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Các ngày tràn từ tháng trước
    for (let i = shift - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYear}-${pad2(prevMonth + 1)}-${pad2(dayNum)}`;
      const isDisabled = (min && dateStr < min) || (max && dateStr > max);
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isDisabled: !!isDisabled,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
      });
    }

    // Các ngày trong tháng hiện tại
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
      const isDisabled = (min && dateStr < min) || (max && dateStr > max);
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isDisabled: !!isDisabled,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
      });
    }

    // Các ngày điền thêm của tháng sau (làm tròn theo bội số của 7, thường là 35 hoặc 42)
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYear}-${pad2(nextMonth + 1)}-${pad2(d)}`;
      const isDisabled = (min && dateStr < min) || (max && dateStr > max);
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isDisabled: !!isDisabled,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [viewYear, viewMonth, value, min, max]);

  const tabbableDate = useMemo(() => {
    const enabled = calendarDays.filter((d) => !d.isDisabled);
    if (enabled.length === 0) return null;
    if (focusedDate && enabled.some((d) => d.dateStr === focusedDate)) return focusedDate;
    const selectedDay = enabled.find((d) => d.isSelected);
    if (selectedDay) return selectedDay.dateStr;
    const todayDay = enabled.find((d) => d.isToday);
    if (todayDay) return todayDay.dateStr;
    const firstCurrent = enabled.find((d) => d.isCurrentMonth);
    return (firstCurrent ?? enabled[0]).dateStr;
  }, [calendarDays, focusedDate]);

  // Điều hướng lưới ngày bằng bàn phím (mũi tên, Home/End, PageUp/PageDown).
  const handleDayKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, dateStr: string, index: number) => {
    let target: string;
    switch (e.key) {
      case 'ArrowRight':
        target = addIsoDays(dateStr, 1);
        break;
      case 'ArrowLeft':
        target = addIsoDays(dateStr, -1);
        break;
      case 'ArrowDown':
        target = addIsoDays(dateStr, 7);
        break;
      case 'ArrowUp':
        target = addIsoDays(dateStr, -7);
        break;
      case 'Home':
        target = addIsoDays(dateStr, -(index % 7));
        break;
      case 'End':
        target = addIsoDays(dateStr, 6 - (index % 7));
        break;
      case 'PageUp':
        target = addIsoMonths(dateStr, -1);
        break;
      case 'PageDown':
        target = addIsoMonths(dateStr, 1);
        break;
      default:
        return;
    }
    e.preventDefault();
    const clamped = clampDateToRange(target, min, max);
    if (clamped === dateStr) return;
    setFocusedDate(clamped);
    const [ty, tm] = clamped.split('-').map(Number);
    if (ty !== viewYear || tm - 1 !== viewMonth) {
      pendingFocusDateRef.current = clamped;
      setViewYear(ty);
      setViewMonth(tm - 1);
    } else {
      popoverRef.current?.querySelector<HTMLButtonElement>(`button.ldp-day-cell[data-date="${clamped}"]:not(:disabled)`)?.focus();
    }
  };

  // Chọn một ngày (bỏ qua ngày bị vô hiệu), báo giá trị mới, đóng lịch và trả focus về nút kích hoạt.
  const handleSelectDate = (dateStr: string, isDisabled: boolean) => {
    if (isDisabled || disabled) return;
    onChange({ target: { value: dateStr } });
    setIsOpen(false);
    focusTrigger();
  };

  // Xóa giá trị đã chọn, đóng lịch và trả focus về nút kích hoạt.
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ target: { value: '' } });
    setIsOpen(false);
    focusTrigger();
  };

  // Về tháng hôm nay và chọn hôm nay nếu nằm trong khoảng min/max.
  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTodayDisabled) return;
    const [ty, tm] = todayStr.split('-').map(Number);
    setViewYear(ty);
    setViewMonth(tm - 1);
    onChange({ target: { value: todayStr } });
    setIsOpen(false);
    focusTrigger();
  };

  return (
    <div className={`luxury-datepicker-wrap ${className}`} ref={containerRef} style={style}>
      <input
        type="hidden"
        name={name ?? id}
        value={value}
        min={min}
        max={max}
        readOnly
      />
      <button
        id={id}
        type="button"
        data-field={dataField}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        className={`luxury-datepicker-trigger ${isOpen ? 'is-open' : ''}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={`luxury-datepicker-value ${!displayLabel ? 'luxury-datepicker-placeholder' : ''}`}>
          {displayLabel || triggerPlaceholder}
        </span>
        <span className="luxury-datepicker-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      </button>

      {/* Ô nhập ẩn phục vụ kiểm tra hợp lệ của form khi trường là bắt buộc */}
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
          className={`luxury-datepicker-popover luxury-datepicker-popover--${position?.v ?? 'down'}`}
          style={{
            position: 'fixed',
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            bottom: 'auto',
            right: 'auto',
            visibility: position ? 'visible' : 'hidden',
          }}
          role="dialog"
          aria-label={t('Chọn ngày', 'Select date')}
        >
          <div className="ldp-header">
            <button
              type="button"
              className="ldp-title ldp-title-btn"
              aria-live="polite"
              aria-expanded={yearMode}
              aria-label={t('Chọn năm', 'Choose year')}
              onClick={() => {
                setYearPageStart(viewYear - 4);
                setYearMode((v) => !v);
              }}
            >
              {lang === 'en'
                ? new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : `Tháng ${viewMonth + 1}, ${viewYear}`}
              <svg className="ldp-title-chevron" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2 4.25 6 8l4-3.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="ldp-nav-btns">
              <button
                type="button"
                className="ldp-nav-btn"
                disabled={isPrevDisabled}
                onClick={handlePrevMonth}
                aria-label={yearMode ? t('Các năm trước', 'Earlier years') : t('Tháng trước', 'Previous month')}
              >
                ‹
              </button>
              <button
                type="button"
                className="ldp-nav-btn"
                disabled={isNextDisabled}
                onClick={handleNextMonth}
                aria-label={yearMode ? t('Các năm sau', 'Later years') : t('Tháng sau', 'Next month')}
              >
                ›
              </button>
            </div>
          </div>

          {yearMode ? (
            <div className="ldp-years-grid" role="group" aria-label={t('Chọn năm', 'Choose year')}>
              {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
                const outOfRange = (minYear !== null && y < minYear) || (maxYear !== null && y > maxYear);
                return (
                  <button
                    key={y}
                    type="button"
                    className={`ldp-year-cell${y === viewYear ? ' is-selected' : ''}${outOfRange ? ' is-disabled' : ''}`}
                    disabled={!!outOfRange}
                    aria-pressed={y === viewYear}
                    onClick={() => {
                      let nextMonth = viewMonth;
                      if (minYear !== null && minMonth !== null && y === minYear && nextMonth < minMonth) nextMonth = minMonth;
                      if (maxYear !== null && maxMonth !== null && y === maxYear && nextMonth > maxMonth) nextMonth = maxMonth;
                      setViewYear(y);
                      setViewMonth(nextMonth);
                      setYearMode(false);
                    }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
          <div className="ldp-weekdays">
            {(lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_VI).map((wd) => (
              <span key={wd} className="ldp-weekday">
                {wd}
              </span>
            ))}
          </div>

          <div className="ldp-days-grid">
            {calendarDays.map((d, index) => {
              const classNames = [
                'ldp-day-cell',
                d.isCurrentMonth ? 'is-current-month' : 'is-other-month',
                d.isSelected ? 'is-selected' : '',
                d.isToday ? 'is-today' : '',
                d.isDisabled ? 'is-disabled' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={`${d.dateStr}-${index}`}
                  type="button"
                  data-date={d.dateStr}
                  className={classNames}
                  disabled={d.isDisabled}
                  tabIndex={d.dateStr === tabbableDate ? 0 : -1}
                  aria-label={d.dateStr}
                  aria-pressed={d.isSelected}
                  aria-current={d.isToday ? 'date' : undefined}
                  onFocus={() => setFocusedDate(d.dateStr)}
                  onKeyDown={(e) => handleDayKeyDown(e, d.dateStr, index)}
                  onClick={() => handleSelectDate(d.dateStr, d.isDisabled)}
                >
                  {d.dayNum}
                </button>
              );
            })}
          </div>

            </>
          )}

          <div className="ldp-footer">
            <button type="button" className="ldp-action-btn btn-clear" onClick={handleClear}>
              {t('Xóa ngày', 'Clear')}
            </button>
            <button type="button" className="ldp-action-btn" disabled={isTodayDisabled} onClick={handleToday}>
              {t('Hôm nay', 'Today')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { popoverPlacement, type PopoverPlacement } from './popoverPlacement';
import './select.css';

/** Một lựa chọn đã đọc ra từ các thẻ <option>: giá trị, nhãn và có bị vô hiệu không. */
interface Opt {
  value: string;
  label: string;
  disabled: boolean;
}

/** Props của ô chọn tùy biến: thuộc tính giống <select> gốc, nhận các thẻ <option> làm children. */
interface SelectProps {
  id?: string;
  className?: string;
  style?: CSSProperties;
  value: string;
  // Gọi lại theo dạng sự kiện giả { target: { value } } để dùng thay <select> gốc.
  onChange: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  /** Neo focus khi form báo lỗi (xem `[data-field]` ở checkout/editor). Gắn lên nút kích hoạt. */
  'data-field'?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  /** Thêm ô tìm kiếm trong menu để lọc các lựa chọn theo nhãn (không phân biệt hoa thường, dấu). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Dùng các thẻ <option> như <select> gốc (hỗ trợ cả Fragment/map). */
  children: ReactNode;
}

const EXIT_MS = 160;
const MENU_MAX = 280;

/** Gom nội dung React (chuỗi, mảng, phần tử) thành chuỗi chữ thuần. */
function toText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (isValidElement(node)) return toText((node.props as { children?: ReactNode }).children);
  return '';
}

/** Chuẩn hóa để tìm kiếm: chữ thường, bỏ dấu tiếng Việt. */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

/** Đọc các thẻ <option> (kể cả trong Fragment) từ children thành danh sách lựa chọn. */
function collect(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string; disabled?: boolean; children?: ReactNode }>;
    if (el.type === Fragment) collect(el.props.children, out);
    else if (el.type === 'option') {
      const label = toText(el.props.children);
      out.push({ value: el.props.value != null ? String(el.props.value) : label, label, disabled: !!el.props.disabled });
    }
  });
  return out;
}

/**
 * Dropdown tùy biến thay cho <select>: cùng API (value/onChange/<option>) nhưng có
 * animation mở/đóng, mũi tên xoay, dấu chọn, điều hướng bàn phím và tự lật lên/xuống.
 */
export function Select({
  id,
  className = '',
  style,
  value,
  onChange,
  disabled,
  required,
  name,
  searchable = false,
  searchPlaceholder,
  children,
  ...aria
}: SelectProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeRef = useRef({ buf: '', t: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const allOptions = collect(children);
  const selected = allOptions.find((o) => o.value === value);
  // Khi tìm kiếm, mọi chỉ số (active, id option) đều tính trên danh sách đã lọc.
  const options = searchable && query.trim() ? allOptions.filter((o) => fold(o.label).includes(fold(query.trim()))) : allOptions;
  const selectedIndex = options.findIndex((o) => o.value === value);
  const firstEnabledIndex = options.findIndex((o) => !o.disabled);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState<PopoverPlacement>({ v: 'down', h: 'left' });
  const [maxH, setMaxH] = useState(MENU_MAX);

  // Mở menu và đặt mục đang chọn (hoặc mục đầu tiên chưa bị vô hiệu) làm mục đang trỏ.
  const openMenu = useCallback(() => {
    if (disabled) return;
    setMounted(true);
    setOpen(true);
    setActive(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
  }, [disabled, selectedIndex, firstEnabledIndex]);

  // Dọn hẹn giờ gõ tìm kiếm nhanh khi unmount.
  useEffect(() => {
    const tr = typeRef.current;
    return () => window.clearTimeout(tr.t);
  }, []);

  // Kẹp chỉ số active khi danh sách options rút ngắn trong lúc menu đang mở.
  useEffect(() => {
    if (!open) return;
    if (active >= options.length) {
      setActive(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
    }
  }, [open, active, options.length, selectedIndex, firstEnabledIndex]);

  // Đóng menu, tùy chọn trả focus về nút kích hoạt.
  const closeMenu = useCallback((refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Mở menu có tìm kiếm thì đưa focus vào ô tìm kiếm.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  // Giữ DOM thêm một nhịp để chạy animation đóng
  useEffect(() => {
    if (open || !mounted) return;
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // Chọn hướng mở dựa trên vùng nhìn thấy (viewport hoặc <dialog> chứa nó)
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dialog = triggerRef.current.closest('dialog')?.getBoundingClientRect();
    const top = dialog ? Math.max(dialog.top, 0) : 0;
    const bottom = dialog ? Math.min(dialog.bottom, window.innerHeight) : window.innerHeight;
    const below = bottom - rect.bottom - 12;
    const above = rect.top - top - 12;
    const need = Math.min(listRef.current?.scrollHeight || options.length * 42 + 12, MENU_MAX);
    const width = Math.max(listRef.current?.offsetWidth || 0, rect.width, 220);
    const nextPlacement = popoverPlacement(triggerRef.current, width, need);
    setPlacement(nextPlacement);
    setMaxH(Math.max(120, Math.min(MENU_MAX, nextPlacement.v === 'up' ? above : below)));
  }, [open, options.length]);

  // Đóng khi bấm ra ngoài
  useEffect(() => {
    if (!open) return;
    // Bấm ra ngoài thì đóng menu.
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closeMenu(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, closeMenu]);

  // Cuộn mục đang active trong riêng menu, không kéo vùng cuộn cha (bảng, hộp thoại, trang)
  useEffect(() => {
    if (!open || active < 0) return;
    const list = listRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [open, active]);

  // Chọn một mục (bỏ qua mục bị vô hiệu hoặc ngoài biên), báo giá trị mới nếu khác giá trị cũ rồi đóng menu.
  const pick = (opt: Opt | undefined) => {
    if (!opt || opt.disabled) return;
    if (opt.value !== value) onChange({ target: { value: opt.value } });
    closeMenu();
  };

  // Di chuyển mục đang trỏ lên/xuống theo vòng, bỏ qua mục bị vô hiệu.
  const move = (dir: 1 | -1, from = active) => {
    if (options.length === 0 || !options.some((o) => !o.disabled)) return;
    let i = from >= 0 && from < options.length ? from : (dir === 1 ? -1 : 0);
    let steps = 0;
    do {
      i = (i + dir + options.length) % options.length;
      steps += 1;
    } while (options[i]?.disabled && steps <= options.length);
    if (options[i] && !options[i].disabled) setActive(i);
  };

  // Điều khiển bằng bàn phím: mũi tên, Home/End, Enter/Space, Esc và Tab.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const fromSearch = e.currentTarget === searchRef.current;
    // Trong ô tìm kiếm, ký tự (kể cả phím cách) và Home/End là thao tác gõ, không phải lệnh chọn.
    if (fromSearch && (e.key.length === 1 || e.key === 'Home' || e.key === 'End')) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        if (!open) openMenu();
        else move(e.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Home':
      case 'End':
        if (!open) return;
        e.preventDefault();
        setActive(e.key === 'Home' ? options.findIndex((o) => !o.disabled) : options.map((o) => !o.disabled).lastIndexOf(true));
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) openMenu();
        else if (active >= 0 && active < options.length) pick(options[active]);
        return;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // không đóng <dialog> cha
          closeMenu();
        }
        return;
      case 'Tab':
        if (open) closeMenu(false);
        return;
    }
    // Gõ ký tự để nhảy tới mục tương ứng
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const tr = typeRef.current;
      window.clearTimeout(tr.t);
      tr.buf += e.key.toLowerCase();
      tr.t = window.setTimeout(() => (tr.buf = ''), 600);
      const hit = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(tr.buf));
      if (hit >= 0) {
        if (!open) openMenu();
        setActive(hit);
      }
    }
  };

  const menuClass = `ui-select__menu ui-select__menu--${placement.v} ui-select__menu--${placement.h} ${open ? 'is-open' : 'is-closing'}`;
  const list = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      className={searchable ? 'ui-select__list' : menuClass}
      style={searchable ? undefined : { maxHeight: maxH }}
    >
      {options.map((o, i) => (
        <li
          key={`${o.value}-${i}`}
          id={`${uid}-opt-${i}`}
          role="option"
          aria-selected={o.value === value}
          aria-disabled={o.disabled || undefined}
          className={`ui-select__option${o.value === value ? ' is-selected' : ''}${i === active ? ' is-active' : ''}${o.disabled ? ' is-disabled' : ''}`}
          style={{ '--i': i } as CSSProperties}
          onMouseDown={(e) => e.preventDefault()}
          onPointerEnter={() => !o.disabled && setActive(i)}
          onClick={() => pick(o)}
        >
          <span className="ui-select__label">{o.label}</span>
          <svg className="ui-select__check" viewBox="0 0 12 12" aria-hidden="true">
            <path d="m2.5 6.4 2.4 2.4 4.6-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </li>
      ))}
      {searchable && options.length === 0 && <li className="ui-select__empty" role="presentation">—</li>}
    </ul>
  );
  const menu = !mounted ? null : !searchable ? list : (
      <div className={`${menuClass} ui-select__menu--search`} style={{ maxHeight: maxH }}>
        <input
          ref={searchRef}
          type="search"
          className="portal-input ui-select__search"
          value={query}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder ?? aria['aria-label']}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && active < options.length ? `${uid}-opt-${active}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {list}
      </div>
  );

  return (
    <div
      ref={wrapRef}
      className={`ui-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={style}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`portal-select ui-select__trigger ${className}`.trim()}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={mounted ? listId : undefined}
        aria-activedescendant={open && active >= 0 && active < options.length ? `${uid}-opt-${active}` : undefined}
        aria-label={aria['aria-label']}
        aria-invalid={aria['aria-invalid']}
        data-field={aria['data-field']}
        disabled={disabled}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={`ui-select__value ${selected && selected.value !== '' ? '' : 'is-placeholder'}`}>
          {selected?.label ?? '—'}
        </span>
        <svg className="ui-select__chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 4.25 6 8l4-3.75" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

        <select
          className="ui-select__native"
          tabIndex={-1}
          aria-hidden="true"
          aria-label={aria['aria-label']}
          name={name}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange({ target: { value: e.target.value } })}
          onInvalid={(e) => {
            e.preventDefault();
            if (!disabled) triggerRef.current?.focus();
          }}
        >
          {!allOptions.some((o) => o.value === value) && <option value={value} />}
          {allOptions.map((o, i) => (
            <option key={`${o.value}-${i}`} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

      {menu}
    </div>
  );
}

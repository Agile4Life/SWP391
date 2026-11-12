import { useSourceLanguage, sourceText, sourceFormat } from "../shopI18n";
import { formatCenterDateTime } from '../../../shared/lib/centerTime';
import { formatVnd } from '../shopFormat';
import type { OrderDto } from '../shopTypes';
import { OrderStatusPill } from './OrderStatusPill';

export interface OrderTableProps {
  orders: OrderDto[];
  onOpen: (order: OrderDto) => void;
}

/** Total units in the order across all lines. */
function totalQuantity(order: OrderDto): number {
  return (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
}

/** The first product leads; any others collapse into a count so a row stays one or two lines. */
function ProductSummary({ order }: { order: OrderDto }) {
  const [first, ...rest] = order.items ?? [];
  if (!first) return <span>—</span>;
  return (
    <div>
      <strong>{first.productName}</strong>
      <div className="muted">
        {first.variantLabel ? `${first.variantLabel} · ` : ''}{'×'}{first.quantity}
        {rest.length > 0 ? sourceFormat(" · và {0} sản phẩm khác", rest.length) : ''}
      </div>
    </div>
  );
}

export function OrderTable({ orders, onOpen }: OrderTableProps) {
  useSourceLanguage();
  return (
    <div className="portal-table-wrapper" role="region" aria-label={sourceText("Danh sách đơn hàng")} tabIndex={0}>
      <table className="portal-table">
        <thead>
          <tr>
            <th scope="col">{sourceText("Sản phẩm")}</th>
            <th scope="col">{sourceText("Số lượng")}</th>
            <th scope="col">{sourceText("Mã đơn")}</th>
            <th scope="col">{sourceText("Thời gian")}</th>
            <th scope="col">{sourceText("Hội viên")}</th>
            <th scope="col">{sourceText("SĐT")}</th>
            <th scope="col">{sourceText("Hình thức nhận")}</th>
            <th scope="col">{sourceText("Tổng cộng")}</th>
            <th scope="col">{sourceText("Trạng thái")}</th>
            <th scope="col">{sourceText("Thao tác")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td>
                <ProductSummary order={order} />
              </td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                <strong>{totalQuantity(order)}</strong>
              </td>
              <td>
                <strong>{order.code}</strong>
              </td>
              <td>{formatCenterDateTime(order.createdAt)}</td>
              <td>{order.member?.fullName ?? '—'}</td>
              <td>{order.member?.phone ?? order.shipping?.phone ?? '—'}</td>
              <td>{order.fulfillment === 'pickup' ? sourceText('Nhận tại quầy') : sourceText('Giao tận nơi')}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                <strong>{formatVnd(order.total)}</strong>
              </td>
              <td>
                <OrderStatusPill
                  status={order.status}
                  fulfillment={order.fulfillment}
                  paymentMethod={order.paymentMethod}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => onOpen(order)}
                  aria-label={sourceFormat("Mở đơn {0}", order.code)}
                >
                  {sourceText("Mở")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

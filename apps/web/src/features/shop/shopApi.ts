import { apiFetch } from '../../shared/api/client';
import type {
  AddressDto,
  AddressRequest,
  CategoryAdminDto,
  CategoryDto,
  CategoryUpsertRequest,
  CounterPaymentMethod,
  CreateOrderRequest,
  GeoRegion,
  ManagerOrderSummaryDto,
  OrderCountsDto,
  OrderDto,
  OrderSummaryDto,
  Page,
  ProductAdminDto,
  ProductAdminSummaryDto,
  ProductDetailDto,
  ProductGoal,
  ProductSort,
  ProductSummaryDto,
  ProductUpsertRequest,
  QuoteDto,
  QuoteRequest,
  ShopConfigDto,
  StockAdjustmentRequest,
  VariantAdminDto,
} from './shopTypes';

const publicInit = (init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: '',
  },
});

export interface ListProductsParams {
  q?: string;
  goal?: ProductGoal | '';
  category?: string;
  inStock?: boolean;
  featuredFirst?: boolean;
  sort?: ProductSort;
  page?: number;
  size?: number;
  signal?: AbortSignal;
}

function normalizePage<T>(res: Page<T> | T[] | null | undefined, fallbackSize = 12): Page<T> {
  if (Array.isArray(res)) {
    return {
      content: res,
      number: 0,
      size: res.length || fallbackSize,
      totalElements: res.length,
      totalPages: res.length > 0 ? 1 : 0,
    };
  }
  if (!res || typeof res !== 'object') {
    return { content: [], number: 0, size: fallbackSize, totalElements: 0, totalPages: 0 };
  }
  const content = Array.isArray(res.content) ? res.content : [];
  return {
    ...res,
    content,
    number: typeof res.number === 'number' ? res.number : 0,
    size: typeof res.size === 'number' ? res.size : fallbackSize,
    totalElements: typeof res.totalElements === 'number' ? res.totalElements : content.length,
    totalPages: typeof res.totalPages === 'number' ? res.totalPages : (content.length > 0 ? 1 : 0),
  };
}

export const shopApi = {
  listCategories: (signal?: AbortSignal) =>
    apiFetch<CategoryDto[]>('/public/product-categories', publicInit({ signal })).then(res =>
      Array.isArray(res) ? res : [],
    ),

  listProducts: async (params: ListProductsParams = {}) => {
    const query = new URLSearchParams();
    if (params.q && params.q.trim()) query.set('q', params.q.trim());
    if (params.goal) query.set('goal', params.goal);
    if (params.category) query.set('category', params.category);
    if (params.inStock) query.set('inStock', 'true');
    if (params.featuredFirst) query.set('featuredFirst', 'true');
    if (params.sort) query.set('sort', params.sort);
    if (params.page != null) query.set('page', String(params.page));
    if (params.size != null) query.set('size', String(params.size));
    const qs = query.toString();
    const res = await apiFetch<Page<ProductSummaryDto>>(
      `/public/products${qs ? `?${qs}` : ''}`,
      publicInit({ signal: params.signal }),
    );
    return normalizePage(res, params.size ?? 12);
  },

  getProduct: (slug: string, signal?: AbortSignal) =>
    apiFetch<ProductDetailDto>(`/public/products/${encodeURIComponent(slug)}`, publicInit({ signal })),

  getShopConfig: (signal?: AbortSignal) =>
    apiFetch<ShopConfigDto>('/public/shop/config', publicInit({ signal })),

  // Not publicInit: the Bearer token must go along so the quote carries the member's tier discount,
  // otherwise expectedTotal differs from the order total and checkout fails with ORDER_PRICE_CHANGED.
  quote: (request: QuoteRequest, signal?: AbortSignal) =>
    apiFetch<QuoteDto>('/public/shop/quote', { method: 'POST', body: JSON.stringify(request), signal }),

  listProvinces: (signal?: AbortSignal) =>
    apiFetch<GeoRegion[]>('/public/geo/provinces', publicInit({ signal })).then(res =>
      Array.isArray(res) ? res : [],
    ),

  listWards: (provinceCode: string, signal?: AbortSignal) =>
    apiFetch<GeoRegion[]>(
      `/public/geo/provinces/${encodeURIComponent(provinceCode)}/wards`,
      publicInit({ signal }),
    ).then(res => (Array.isArray(res) ? res : [])),

  // Member addresses
  listAddresses: () =>
    apiFetch<AddressDto[]>('/shop/addresses').then(res => (Array.isArray(res) ? res : [])),

  saveAddress: (request: AddressRequest, id?: number | null) =>
    id != null
      ? apiFetch<AddressDto>(`/shop/addresses/${id}`, { method: 'PUT', body: JSON.stringify(request) })
      : apiFetch<AddressDto>('/shop/addresses', { method: 'POST', body: JSON.stringify(request) }),

  makeDefaultAddress: (id: number) =>
    apiFetch<AddressDto[]>(`/shop/addresses/${id}/default`, { method: 'POST' }),

  deleteAddress: (id: number) =>
    apiFetch<AddressDto[]>(`/shop/addresses/${id}`, { method: 'DELETE' }),

  // Member orders
  createOrder: (request: CreateOrderRequest) =>
    apiFetch<OrderDto>('/shop/orders', { method: 'POST', body: JSON.stringify(request) }),

  listMyOrders: async (params: { status?: string; page?: number; size?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.page != null) query.set('page', String(params.page));
    if (params.size != null) query.set('size', String(params.size));
    const qs = query.toString();
    const res = await apiFetch<Page<OrderSummaryDto>>(`/shop/orders${qs ? `?${qs}` : ''}`);
    return normalizePage(res, params.size ?? 10);
  },

  getMyOrder: (id: number) => apiFetch<OrderDto>(`/shop/orders/${id}`),

  cancelMyOrder: (id: number, reason?: string) =>
    apiFetch<OrderDto>(`/shop/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    }),

  // Staff order fulfillment
  staff: {
    listOrders: async (params: { status?: string; q?: string; page?: number; size?: number } = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.q && params.q.trim()) query.set('q', params.q.trim());
      if (params.page != null) query.set('page', String(params.page));
      if (params.size != null) query.set('size', String(params.size));
      const qs = query.toString();
      const res = await apiFetch<Page<OrderDto>>(`/staff/product-orders${qs ? `?${qs}` : ''}`);
      return normalizePage(res, params.size ?? 20);
    },
    counts: () => apiFetch<OrderCountsDto>('/staff/product-orders/counts'),
    getOrder: (id: number) => apiFetch<OrderDto>(`/staff/product-orders/${id}`),
    startProcessing: (id: number) =>
      apiFetch<OrderDto>(`/staff/product-orders/${id}/start-processing`, { method: 'POST' }),
    ship: (id: number, payload: { carrier: string; trackingNumber: string }) =>
      apiFetch<OrderDto>(`/staff/product-orders/${id}/ship`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    readyForPickup: (id: number) =>
      apiFetch<OrderDto>(`/staff/product-orders/${id}/ready-for-pickup`, { method: 'POST' }),
    complete: (id: number) =>
      apiFetch<OrderDto>(`/staff/product-orders/${id}/complete`, { method: 'POST' }),
    counterPayment: (id: number, method: CounterPaymentMethod) =>
      apiFetch<OrderDto>(`/staff/product-orders/${id}/counter-payment`, {
        method: 'POST',
        body: JSON.stringify({ method }),
      }),
    cancel: (id: number, payload: { reason: string; restock?: boolean }) =>
      apiFetch<OrderDto>(`/staff/product-orders/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: payload.reason, restock: payload.restock ?? true }),
      }),
  },

  // Manager administration
  manager: {
    listCategories: () =>
      apiFetch<CategoryAdminDto[]>('/manager/product-categories').then(res =>
        Array.isArray(res) ? res : [],
      ),
    createCategory: (payload: CategoryUpsertRequest) =>
      apiFetch<CategoryAdminDto>('/manager/product-categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateCategory: (id: number, payload: CategoryUpsertRequest) =>
      apiFetch<CategoryAdminDto>(`/manager/product-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteCategory: (id: number) =>
      apiFetch<void>(`/manager/product-categories/${id}`, { method: 'DELETE' }),

    listProducts: async (
      params: { q?: string; active?: boolean; lowStock?: boolean; page?: number; size?: number } = {},
    ) => {
      const query = new URLSearchParams();
      if (params.q && params.q.trim()) query.set('q', params.q.trim());
      if (params.active != null) query.set('active', String(params.active));
      if (params.lowStock != null) query.set('lowStock', String(params.lowStock));
      if (params.page != null) query.set('page', String(params.page));
      if (params.size != null) query.set('size', String(params.size));
      const qs = query.toString();
      const res = await apiFetch<Page<ProductAdminSummaryDto>>(`/manager/products${qs ? `?${qs}` : ''}`);
      return normalizePage(res, params.size ?? 12);
    },
    getProduct: (id: number) => apiFetch<ProductAdminDto>(`/manager/products/${id}`),
    createProduct: (payload: ProductUpsertRequest) =>
      apiFetch<ProductAdminDto>('/manager/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateProduct: (id: number, payload: ProductUpsertRequest) =>
      apiFetch<ProductAdminDto>(`/manager/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    setProductActive: (id: number, active: boolean) =>
      apiFetch<ProductAdminDto>(`/manager/products/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    deleteProduct: (id: number) =>
      apiFetch<void>(`/manager/products/${id}`, { method: 'DELETE' }),
    addImage: (productId: number, payload: { dataUrl: string; altText: string }) =>
      apiFetch<ProductAdminDto>(`/manager/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    removeImage: (productId: number, imageId: number) =>
      apiFetch<ProductAdminDto>(`/manager/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
      }),
    reorderImages: (productId: number, imageIds: number[]) =>
      apiFetch<ProductAdminDto>(`/manager/products/${productId}/images/order`, {
        method: 'PUT',
        body: JSON.stringify({ imageIds }),
      }),
    adjustStock: (variantId: number, payload: StockAdjustmentRequest) =>
      apiFetch<VariantAdminDto>(`/manager/product-variants/${variantId}/stock-adjustments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    orderSummary: () => apiFetch<ManagerOrderSummaryDto>('/manager/product-orders/summary'),
  },
};

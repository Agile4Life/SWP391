import './route-state.css';

export function RouteLoading() {
  return <main className="route-state" role="status" aria-live="polite" aria-busy="true">
    <p>Đang tải trang…</p>
  </main>;
}

export function RouteLoadError() {
  return <main className="route-state" role="alert">
    <h1>Không thể tải trang</h1>
    <p>Kiểm tra kết nối rồi tải lại trang để tiếp tục.</p>
    <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
  </main>;
}

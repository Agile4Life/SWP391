import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VnpayPayButton } from './VnpayPayButton';
import * as api from './vnpayApi';
import * as session from './vnpaySession';
vi.mock('./vnpayApi',()=>({createVnpayCheckout:vi.fn(),navigateToVnpay:vi.fn()}));
vi.mock('./vnpaySession',()=>({
  rememberActiveVnpay:vi.fn(),
  releaseAbandonedVnpay:vi.fn(()=>Promise.resolve(false)),
  cancelVnpayTarget:vi.fn(()=>Promise.resolve()),
}));
let host: HTMLDivElement;let root: Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();vi.unstubAllGlobals();});
it('never sends an amount and cannot double submit while starting checkout',async()=>{
 let resolve!:(value: api.VnpayCheckout)=>void;
 vi.mocked(api.createVnpayCheckout).mockReturnValue(new Promise(done=>{resolve=done;}));
 await act(async()=>root.render(<VnpayPayButton target={{coachBookingId:81}} />));
 const button=host.querySelector('button')!;await act(async()=>{button.click();button.click();});
 expect(api.createVnpayCheckout).toHaveBeenCalledTimes(1);expect(api.createVnpayCheckout).toHaveBeenCalledWith({coachBookingId:81});expect(button.disabled).toBe(true);
 await act(async()=>resolve({reference:'ABC',paymentUrl:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',amount:200000,expiresAt:'2026-11-03T12:15:00'}));
 expect(api.navigateToVnpay).toHaveBeenCalledTimes(1);
});
it('becomes usable again when the browser restores the page after leaving VNPay without paying',async()=>{
 vi.mocked(api.createVnpayCheckout).mockResolvedValue({reference:'ABC',paymentUrl:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',amount:200000,expiresAt:'2026-11-03T12:15:00'});
 await act(async()=>root.render(<VnpayPayButton target={{coachBookingId:81}} />));
 const button=host.querySelector('button')!;await act(async()=>button.click());
 expect(button.disabled).toBe(true);expect(button.textContent).toContain('Đang chuyển');
 const pageshow=(persisted:boolean)=>Object.assign(new Event('pageshow'),{persisted});
 await act(async()=>{window.dispatchEvent(pageshow(false));});expect(button.disabled).toBe(true);
 await act(async()=>{window.dispatchEvent(pageshow(true));});
 expect(button.disabled).toBe(false);expect(button.textContent).toContain('Thanh toán VNPay');
 await act(async()=>button.click());expect(api.createVnpayCheckout).toHaveBeenCalledTimes(2);
});
it('allows retry after an API error and shows the error inline',async()=>{
 vi.mocked(api.createVnpayCheckout).mockRejectedValue(new Error('private error'));
 await act(async()=>root.render(<VnpayPayButton target={{courtBookingId:82}} />));
 await act(async()=>host.querySelector('button')!.click());
 expect(host.querySelector('[role="alert"]')).not.toBeNull();expect(host.querySelector('button')!.disabled).toBe(false);
 await act(async()=>host.querySelector('button')!.click());expect(api.createVnpayCheckout).toHaveBeenCalledTimes(2);
});
it('records reference before redirecting and releases abandoned attempt on browser return',async()=>{
 vi.mocked(api.createVnpayCheckout).mockResolvedValue({reference:'REF88',paymentUrl:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',amount:200000,expiresAt:'2026-11-03T12:15:00'});
 await act(async()=>root.render(<VnpayPayButton target={{coachBookingId:81}} />));
 expect(session.releaseAbandonedVnpay).toHaveBeenCalledTimes(1);
 await act(async()=>host.querySelector('button')!.click());
 expect(session.rememberActiveVnpay).toHaveBeenCalledWith('REF88');
 await act(async()=>{window.dispatchEvent(Object.assign(new Event('pageshow'),{persisted:true}));});
 expect(session.releaseAbandonedVnpay).toHaveBeenCalledTimes(2);
});
it('lets member manually unlock a stuck VNPay attempt when VNPAY_AWAITING_CONFIRMATION occurs',async()=>{
 const conflict = Object.assign(new Error('Giao dịch VNPay đang chờ xác nhận.'), { code: 'VNPAY_AWAITING_CONFIRMATION' });
 vi.mocked(api.createVnpayCheckout).mockRejectedValueOnce(conflict);
 await act(async()=>root.render(<VnpayPayButton target={{subscriptionId:11}} />));
 await act(async()=>host.querySelector('button')!.click());
 const unlockBtn = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Mở khóa'));
 expect(unlockBtn).toBeDefined();
 await act(async()=>unlockBtn!.click());
 expect(session.cancelVnpayTarget).toHaveBeenCalledWith({subscriptionId:11});
 expect(host.querySelector('[role="alert"]')).toBeNull();
});

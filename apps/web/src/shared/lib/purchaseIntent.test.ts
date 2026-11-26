import { beforeEach, expect, it } from 'vitest';
import { authDestination, clearPurchaseIntent, purchaseAuthPath, rememberPurchaseIntent, selectedPackageId } from './purchaseIntent';

beforeEach(() => sessionStorage.clear());

it('keeps the selected package through register and login for members only', () => {
  const search = '?returnTo=' + encodeURIComponent('/member/packages?packageId=2');
  expect(purchaseAuthPath('/login', search)).toBe('/login' + search);
  expect(authDestination('MEMBER', search)).toBe('/member/packages?packageId=2');
  expect(authDestination('MANAGER', search)).toBe('/manager/reports');
  expect(selectedPackageId('?packageId=2')).toBe(2);
});

it.each(['https://evil.test', '//evil.test', '/manager/users', '/member/packages?packageId=-1', '/member/packages?packageId=1.5', '/member/packages?packageId=1e2'])('rejects untrusted purchase return paths: %s', returnTo => {
  const search = '?returnTo=' + encodeURIComponent(returnTo);
  expect(authDestination('MEMBER', search)).toBe('/member/dashboard');
  expect(purchaseAuthPath('/login', search)).toBe('/login');
});

// P3-FE-12: strict integer regex for selectedPackageId
it.each(['?packageId=1e2', '?packageId=%2B5', '?packageId=0x10', '?packageId=0', '?packageId=-3', '?packageId=1.5'])('rejects non-strict integer packageId: %s', search => {
  expect(selectedPackageId(search)).toBeNull();
});

it('recovers the purchase intent after an OAuth redirect and consumes it on arrival', () => {
  rememberPurchaseIntent('?returnTo=' + encodeURIComponent('/member/packages?packageId=2'));
  expect(authDestination('MEMBER', '?google_oauth=authenticated')).toBe('/member/packages?packageId=2');
  expect(authDestination('MEMBER', '')).toBe('/member/dashboard');
});

// P2-FE-23: Non-member login clears stale purchase intent so subsequent member logins are not misrouted
it('clears stale purchase intent when a non-member signs in', () => {
  rememberPurchaseIntent('?returnTo=' + encodeURIComponent('/member/packages?packageId=9'));
  expect(authDestination('STAFF', '')).toBe('/staff/reception');
  expect(authDestination('MEMBER', '')).toBe('/member/dashboard');
  clearPurchaseIntent();
});

it.each(['/checkout', '/products', '/products/sol-whey-isolate'])('rejects retired shop return path %s', path => {
  expect(purchaseAuthPath('/login', `?returnTo=${encodeURIComponent(path)}`)).toBe('/login');
  expect(authDestination('MEMBER', `?returnTo=${encodeURIComponent(path)}`)).toBe('/member/dashboard');
});

it.each(['//evil.com', '/products/../admin/users', 'https://x.y/checkout', '/checkout?next=//evil'])('rejects %s', path => {
  expect(purchaseAuthPath('/login', `?returnTo=${encodeURIComponent(path)}`)).toBe('/login');
});

it('ignores a persisted Shop intent after OAuth while keeping a new membership intent', () => {
  sessionStorage.setItem('scms_purchase_return', '/checkout');
  expect(authDestination('MEMBER', '?google_oauth=authenticated')).toBe('/member/dashboard');
  rememberPurchaseIntent('?returnTo=' + encodeURIComponent('/member/packages?packageId=7'));
  expect(authDestination('MEMBER', '')).toBe('/member/packages?packageId=7');
});

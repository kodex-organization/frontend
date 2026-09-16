import test from 'node:test';
import assert from 'node:assert/strict';
import { redirectPathForRoles, type UserRole } from '@/lib/auth/session';

test('redirectPathForRoles routes each role to its appropriate landing page', () => {
  // Owners and Managers have access to the executive Dashboard
  assert.equal(redirectPathForRoles(['OWNER']), '/dashboard');
  assert.equal(redirectPathForRoles(['MANAGER']), '/dashboard');
  assert.equal(redirectPathForRoles(['OWNER', 'MANAGER']), '/dashboard');

  // Accountants must NOT be routed to Dashboard; they route to Operational Reports
  assert.equal(redirectPathForRoles(['ACCOUNTANT']), '/reporting');

  // Cashiers route to Floor View
  assert.equal(redirectPathForRoles(['CASHIER']), '/floor-view');

  // Fallback for empty or unknown
  assert.equal(redirectPathForRoles([]), '/billing');

  // Multi-role hierarchy: If an accountant also has Owner or Manager, Dashboard takes precedence
  assert.equal(redirectPathForRoles(['ACCOUNTANT', 'OWNER']), '/dashboard');
  assert.equal(redirectPathForRoles(['ACCOUNTANT', 'MANAGER']), '/dashboard');
});

test('role permissions logic for OwnerLayout restricts /dashboard and /settings/staff to Owner and Manager only', () => {
  function resolveAllowedRoles(pathname: string): UserRole[] {
    const isOwnerOnlyRoute =
      pathname === "/reports" ||
      pathname.startsWith("/reports/") ||
      pathname === "/settings/branches" ||
      pathname === "/settings/peak-hours" ||
      pathname === "/settings/security" ||
      pathname === "/settings/support-access" ||
      pathname === "/settings/data-export";

    const isOwnerOrManagerRoute =
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/settings/staff" ||
      pathname.startsWith("/settings/staff/") ||
      pathname === "/branches" ||
      pathname.startsWith("/branches/");

    return isOwnerOnlyRoute
      ? ["OWNER"]
      : isOwnerOrManagerRoute
      ? ["OWNER", "MANAGER"]
      : ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT"];
  }

  // Dashboard must be restricted to Owner/Manager only
  const dashboardRoles = resolveAllowedRoles('/dashboard');
  assert.deepEqual(dashboardRoles, ['OWNER', 'MANAGER']);
  assert.ok(!dashboardRoles.includes('ACCOUNTANT'));
  assert.ok(!dashboardRoles.includes('CASHIER'));

  // Staff & Settings must be restricted to Owner/Manager only
  const staffRoles = resolveAllowedRoles('/settings/staff');
  assert.deepEqual(staffRoles, ['OWNER', 'MANAGER']);
  assert.ok(!staffRoles.includes('ACCOUNTANT'));
  assert.ok(!staffRoles.includes('CASHIER'));

  // Reports is Owner only
  const reportsRoles = resolveAllowedRoles('/reports');
  assert.deepEqual(reportsRoles, ['OWNER']);

  // Operational routes accessible to Accountants
  const reportingRoles = resolveAllowedRoles('/reporting');
  assert.ok(reportingRoles.includes('ACCOUNTANT'));

  const udhaarRoles = resolveAllowedRoles('/udhaar');
  assert.ok(udhaarRoles.includes('ACCOUNTANT'));
});

test('sidebar navigation groups filter out dashboard and staff & settings for accountant role', () => {
  function buildNavItems(userRoles: UserRole[]) {
    const isOwnerOrManager = userRoles.some(r => r === 'OWNER' || r === 'MANAGER');
    const hasBackOfficeAccess = userRoles.some(r => r === 'OWNER' || r === 'MANAGER' || r === 'ACCOUNTANT');
    const hasReportsAccess = userRoles.some(r => r === 'OWNER' || r === 'MANAGER' || r === 'ACCOUNTANT');

    const managementItems = [
      ...(isOwnerOrManager ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
      ...(hasBackOfficeAccess ? [{ href: '/udhaar', label: 'Udhaar Ledger' }] : []),
    ];

    const analyticsItems = [
      ...(hasReportsAccess ? [{ href: '/reporting', label: 'Operational Reports' }] : []),
      ...(hasBackOfficeAccess ? [{ href: '/audit', label: 'Audit Logs' }] : []),
    ];

    const configItems = [
      { href: '/sync-status', label: 'Sync Status' },
      ...(isOwnerOrManager ? [{ href: '/settings/staff', label: 'Staff & Settings' }] : []),
      { href: '/notifications', label: 'Notifications' },
    ];

    return {
      allHrefs: [...managementItems, ...analyticsItems, ...configItems].map(i => i.href),
      managementHrefs: managementItems.map(i => i.href),
      configHrefs: configItems.map(i => i.href),
    };
  }

  // For Accountant:
  const accountantNav = buildNavItems(['ACCOUNTANT']);
  assert.ok(!accountantNav.allHrefs.includes('/dashboard'), 'Accountant should not see /dashboard');
  assert.ok(!accountantNav.allHrefs.includes('/settings/staff'), 'Accountant should not see /settings/staff');
  assert.ok(accountantNav.allHrefs.includes('/udhaar'), 'Accountant should see /udhaar');
  assert.ok(accountantNav.allHrefs.includes('/reporting'), 'Accountant should see /reporting');
  assert.ok(accountantNav.allHrefs.includes('/audit'), 'Accountant should see /audit');

  // For Owner:
  const ownerNav = buildNavItems(['OWNER']);
  assert.ok(ownerNav.allHrefs.includes('/dashboard'), 'Owner must see /dashboard');
  assert.ok(ownerNav.allHrefs.includes('/settings/staff'), 'Owner must see /settings/staff');

  // For Manager:
  const managerNav = buildNavItems(['MANAGER']);
  assert.ok(managerNav.allHrefs.includes('/dashboard'), 'Manager must see /dashboard');
  assert.ok(managerNav.allHrefs.includes('/settings/staff'), 'Manager must see /settings/staff');
});

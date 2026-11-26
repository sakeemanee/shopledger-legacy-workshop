var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function hsnItem(overrides) {
  var item = { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 2 };
  Object.assign(item, overrides || {});
  return item;
}

test('CURRENT BEHAVIOUR: checkout uses HSN GST while invoice falls back to 18%', function () {
  var items = [hsnItem()];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });
  assert.deepEqual({ subtotal: billed.subtotal, tax: billed.tax, total: billed.total }, { subtotal: 200, tax: 10, total: 210 });
  assert.deepEqual({ subtotal: printed.subtotal, tax: printed.tax, total: printed.total }, { subtotal: 200, tax: 36, total: 236 });
});

test('CURRENT BEHAVIOUR: invoice GST matches checkout only with redundant gstRate', function () {
  var items = [hsnItem({ gstRate: 5 })];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });
  assert.equal(billed.tax, 10);
  assert.equal(printed.tax, 10);
  assert.equal(printed.total, billed.total);
});

test('CURRENT BEHAVIOUR: checkout discounts before GST but invoice discounts subtotal plus GST', function () {
  var items = [hsnItem({ price: 600, qty: 1 })];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });
  assert.deepEqual({ discount: billed.discount, tax: billed.tax, total: billed.total }, { discount: 60, tax: 27, total: 567 });
  assert.deepEqual({ discount: printed.discount, tax: printed.tax, total: printed.total }, { discount: 70.8, tax: 108, total: 637.2 });
});

test('CURRENT BEHAVIOUR: GST reconciliation reports invoice mismatch from in-memory order', function () {
  var db = { orders: [{ id: 42, date: '26/11/2026', customer: 'Asha', status: 'completed', items: [hsnItem()], coupon: '', subtotal: 200, discount: 0, tax: 10, total: 210 }] };
  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 26);
  assert.equal(result.rows[0].invoiceTotal, 236);
  assert.equal(result.rows[0].matched, false);
});

test('CURRENT BEHAVIOUR: rendered invoice includes reconciliation notice when totals differ', function () {
  var html = invoice.render({ id: 42, date: '26/11/2026', customer: 'Asha', items: [hsnItem()], coupon: '', total: 210 });
  assert.match(html, /Invoice Total/);
  assert.match(html, /Invoice computed total/);
  assert.match(html, /236\.00/);
  assert.match(html, /210\.00/);
});

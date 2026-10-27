// backend/src/lib/serializers.js
// Maps live DB columns to frontend expected field names

function serializeProduct(prod) {
  if (!prod) return null;
  const price = parseFloat(prod.price || prod.saleout_price || 0);
  const cost = parseFloat(prod.cost || prod.buyin_price || 0);
  const stock = parseInt(prod.stock ?? prod.qtyinstock ?? prod.qtyavailable ?? 0, 10);
  return {
    ...prod,
    id: prod.id,
    name: prod.name,
    name_en: prod.name_en || prod.name,
    name_kh: prod.name_kh || '',
    price: price,
    saleout_price: price,
    cost: cost,
    buyin_price: cost,
    stock: stock,
    qtyinstock: stock,
    qty_available: stock,
    barcode: prod.barcode || '',
    image_url: prod.image_url || '',
    category_id: prod.category_id,
    tenant_id: prod.tenant_id,
    status: prod.status || 'Active'
  };
}

function serializeStock(stock) {
  if (!stock) return null;
  const qty = parseInt(stock.qtyinstock ?? stock.qtyavailable ?? stock.stock ?? 0, 10);
  return {
    ...stock,
    qtyinstock: qty,
    qtyavailable: qty,
    stock: qty
  };
}

function serializeOrder(order) {
  if (!order) return null;
  const total = parseFloat(order.total || 0);
  return {
    ...order,
    or_id: order.or_id || order.id,
    id: order.or_id || order.id,
    order_no: order.order_no || '',
    total: total,
    totalamount: total,
    discount: parseFloat(order.discount || 0),
    status: order.status || 'Completed',
    payment_method: order.payment_method || 'Cash',
    order_date: order.created_at || order.order_date,
    created_at: order.created_at,
    created_by: order.created_by || order.user_id,
    user_id: order.user_id || order.created_by
  };
}

function serializeCustomer(cust) {
  if (!cust) return null;
  return {
    ...cust,
    id: cust.id,
    name: cust.name,
    name_en: cust.name_en || cust.name,
    phone: cust.phone || '',
    email: cust.email || '',
    address: cust.address || ''
  };
}

function serializeSupplier(sup) {
  if (!sup) return null;
  const name = sup.sup_name || sup.company || '';
  return {
    ...sup,
    id: sup.id,
    sup_id: sup.sup_id || `SUP${sup.id}`,
    sup_name: name,
    company: name,
    name_en: name,
    phone: sup.phone || '',
    email: sup.email || sup.e_mail || '',
    e_mail: sup.email || sup.e_mail || '',
    address: sup.address || '',
    status: sup.status || 'Active'
  };
}

function serializeCategory(cat) {
  if (!cat) return null;
  return {
    ...cat,
    id: cat.id,
    name: cat.name,
    category_en: cat.category_en || cat.name,
    category_kh: cat.category_kh || ''
  };
}

function serializeUser(user) {
  if (!user) return null;
  return {
    ...user,
    userid: user.userid || user.id,
    createdat: user.created_at || user.createdat,
    created_at: user.created_at || user.createdat
  };
}

module.exports = {
  serializeProduct,
  serializeStock,
  serializeOrder,
  serializeCustomer,
  serializeSupplier,
  serializeCategory,
  serializeUser
};

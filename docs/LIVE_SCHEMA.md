
store_settings (0 rows)
  id integer NOT NULL
  tenant_id integer
  slug character varying NOT NULL
  store_name character varying NOT NULL
  logo_url text
  phone character varying
  address text
  currency character varying
  exchange_rate numeric
  is_open boolean
  accepts_online_orders boolean
  delivery_enabled boolean
  pickup_enabled boolean
  tax_rate numeric
  created_at timestamp without time zone

tbl_activity_logs (0 rows)
  id integer NOT NULL
  user_id integer
  action character varying NOT NULL
  target_table character varying
  target_id integer
  tenant_id integer
  created_at timestamp without time zone

tbl_categories (0 rows)
  id integer NOT NULL
  name character varying NOT NULL
  tenant_id integer
  created_at timestamp without time zone

tbl_customers (0 rows)
  id integer NOT NULL
  cus_id character varying NOT NULL
  name character varying NOT NULL
  email character varying
  phone character varying
  address text
  tenant_id integer
  created_at timestamp without time zone

tbl_order_items (0 rows)
  id integer NOT NULL
  order_id integer
  product_id integer
  qty integer NOT NULL
  unit_price numeric NOT NULL
  subtotal numeric NOT NULL
  tenant_id integer
  buy_price numeric
  refunded_qty integer
  refunded_amount numeric

tbl_orders (0 rows)
  or_id integer NOT NULL
  order_no character varying NOT NULL
  customer_id integer
  user_id integer
  total numeric NOT NULL
  discount numeric
  payment_method character varying
  status character varying
  tenant_id integer
  created_at timestamp without time zone
  source character varying
  tracking_code character varying
  idempotency_key character varying
  customer_name character varying
  customer_phone character varying
  delivery_type character varying
  delivery_address text
  notes text

tbl_payment (0 rows)
  id integer NOT NULL
  order_id integer
  tenant_id integer
  amount numeric NOT NULL
  payment_method character varying NOT NULL
  status character varying
  created_at timestamp without time zone

tbl_products (0 rows)
  id integer NOT NULL
  name character varying NOT NULL
  name_kh character varying
  category_id integer
  price numeric NOT NULL
  cost numeric
  stock integer
  barcode character varying
  image_url text
  tenant_id integer
  created_at timestamp without time zone
  status character varying
  qty_alert integer
  is_published boolean
  sort_order integer
  description_en text
  description_kh text

tbl_stock (0 rows)
  id integer NOT NULL
  productid integer
  qtyinstock integer
  qtyavailable integer
  tenant_id integer

tbl_stock_log (0 rows)
  id integer NOT NULL
  tenant_id integer
  product_id integer
  change_qty integer NOT NULL
  type character varying NOT NULL
  reference_id integer
  notes text
  created_at timestamp without time zone

tbl_suppliers (0 rows)
  id integer NOT NULL
  sup_name character varying NOT NULL
  contact_person character varying
  phone character varying
  email character varying
  address text
  tenant_id integer
  created_at timestamp without time zone

tbl_users (0 rows)
  userid integer NOT NULL
  username character varying NOT NULL
  email character varying NOT NULL
  password character varying NOT NULL
  fullname character varying
  role character varying
  role_name character varying
  status character varying
  is_super_admin boolean
  tenant_id integer
  created_at timestamp without time zone

tenants (0 rows)
  id integer NOT NULL
  name character varying NOT NULL
  subdomain character varying NOT NULL
  status character varying
  created_at timestamp without time zone

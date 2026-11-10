--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: sync_product_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_product_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE tbl_products SET stock = NEW.qtyavailable WHERE id = NEW.productid;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename character varying(255) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: store_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_settings (
    id integer NOT NULL,
    tenant_id integer,
    slug character varying(100) NOT NULL,
    store_name character varying(255) NOT NULL,
    logo_url text,
    phone character varying(50),
    address text,
    currency character varying(10) DEFAULT 'USD'::character varying,
    exchange_rate numeric(10,4) DEFAULT 4000.0000,
    is_open boolean DEFAULT true,
    accepts_online_orders boolean DEFAULT true,
    delivery_enabled boolean DEFAULT true,
    pickup_enabled boolean DEFAULT true,
    opening_hours jsonb DEFAULT '{}'::jsonb,
    tax_rate numeric(5,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: store_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.store_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: store_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.store_settings_id_seq OWNED BY public.store_settings.id;


--
-- Name: tbl_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_activity_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(255) NOT NULL,
    target_table character varying(100),
    target_id integer,
    tenant_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_activity_logs_id_seq OWNED BY public.tbl_activity_logs.id;


--
-- Name: tbl_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_categories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    tenant_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_categories_id_seq OWNED BY public.tbl_categories.id;


--
-- Name: tbl_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_customers (
    id integer NOT NULL,
    cus_id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    address text,
    tenant_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'Active'::character varying
);


--
-- Name: tbl_customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_customers_id_seq OWNED BY public.tbl_customers.id;


--
-- Name: tbl_held_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_held_sales (
    id integer NOT NULL,
    tenant_id integer,
    user_id integer,
    customer_id integer,
    cart_json jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_held_sales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_held_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_held_sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_held_sales_id_seq OWNED BY public.tbl_held_sales.id;


--
-- Name: tbl_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_order_items (
    id integer NOT NULL,
    order_id integer,
    product_id integer,
    qty integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    tenant_id integer,
    buy_price numeric(12,2) DEFAULT 0,
    refunded_qty integer DEFAULT 0,
    refunded_amount numeric(10,2) DEFAULT 0
);


--
-- Name: tbl_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_order_items_id_seq OWNED BY public.tbl_order_items.id;


--
-- Name: tbl_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_orders (
    id integer NOT NULL,
    or_id integer NOT NULL,
    order_no character varying(100) NOT NULL,
    customer_id integer,
    user_id integer,
    total numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    payment_method character varying(50),
    status character varying(50) DEFAULT 'Completed'::character varying,
    tenant_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    idempotency_key character varying(100),
    order_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source character varying(20) DEFAULT 'POS'::character varying,
    customer_name character varying(255),
    customer_phone character varying(50),
    delivery_type character varying(20) DEFAULT 'pickup'::character varying,
    delivery_address text,
    notes text,
    tracking_code character varying(100),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_orders_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_orders_details (
    id integer NOT NULL,
    order_id integer,
    product_id integer,
    qty_order integer DEFAULT 1 NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    buy_price numeric(12,2) DEFAULT 0,
    discount numeric(12,2) DEFAULT 0,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    refunded_qty integer DEFAULT 0,
    refunded_amount numeric(12,2) DEFAULT 0,
    tenant_id integer
);


--
-- Name: tbl_orders_details_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_orders_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_orders_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_orders_details_id_seq OWNED BY public.tbl_orders_details.id;


--
-- Name: tbl_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_orders_id_seq OWNED BY public.tbl_orders.id;


--
-- Name: tbl_orders_or_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_orders_or_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_orders_or_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_orders_or_id_seq OWNED BY public.tbl_orders.or_id;


--
-- Name: tbl_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_payment (
    id integer NOT NULL,
    order_id integer,
    tenant_id integer,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'COMPLETED'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_payment_id_seq OWNED BY public.tbl_payment.id;


--
-- Name: tbl_payment_method; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_payment_method (
    id integer NOT NULL,
    tenant_id integer,
    name character varying(100) NOT NULL,
    name_kh character varying(100),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_payment_method_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_payment_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_payment_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_payment_method_id_seq OWNED BY public.tbl_payment_method.id;


--
-- Name: tbl_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_products (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    name_kh character varying(255),
    category_id integer,
    price numeric(10,2) NOT NULL,
    cost numeric(10,2),
    stock integer DEFAULT 0,
    barcode character varying(100),
    image_url text,
    status character varying(50) DEFAULT 'Active'::character varying,
    tenant_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_published boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    description_en text,
    description_kh text,
    qty_alert integer DEFAULT 5,
    supplier_id integer,
    brand character varying(100),
    model character varying(100)
);


--
-- Name: tbl_products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_products_id_seq OWNED BY public.tbl_products.id;


--
-- Name: tbl_service_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_service_requests (
    serviceid integer NOT NULL,
    tenant_id integer,
    customerid integer,
    productid integer,
    serialnumber character varying(100),
    issuedescription text,
    servicetype character varying(50) DEFAULT 'Repair'::character varying,
    status character varying(50) DEFAULT 'Pending'::character varying,
    receiveddate date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_service_requests_serviceid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_service_requests_serviceid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_service_requests_serviceid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_service_requests_serviceid_seq OWNED BY public.tbl_service_requests.serviceid;


--
-- Name: tbl_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_stock (
    id integer NOT NULL,
    productid integer,
    qtyinstock integer DEFAULT 0,
    qtyavailable integer DEFAULT 0,
    tenant_id integer,
    qtyreserved integer DEFAULT 0,
    minstocklevel integer DEFAULT 5
);


--
-- Name: tbl_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_stock_id_seq OWNED BY public.tbl_stock.id;


--
-- Name: tbl_stock_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_stock_log (
    id integer NOT NULL,
    product_id integer,
    tenant_id integer,
    change_qty integer NOT NULL,
    transaction_type character varying(50) NOT NULL,
    reference_type character varying(50) NOT NULL,
    reference_id integer,
    user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_stock_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_stock_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_stock_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_stock_log_id_seq OWNED BY public.tbl_stock_log.id;


--
-- Name: tbl_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_suppliers (
    id integer NOT NULL,
    sup_name character varying(255) NOT NULL,
    contact_person character varying(255),
    phone character varying(50),
    email character varying(255),
    address text,
    tenant_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'Active'::character varying
);


--
-- Name: tbl_suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_suppliers_id_seq OWNED BY public.tbl_suppliers.id;


--
-- Name: tbl_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_users (
    userid integer NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    fullname character varying(255),
    role character varying(50) DEFAULT 'Admin'::character varying,
    role_name character varying(50),
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    is_super_admin boolean DEFAULT false,
    tenant_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_users_userid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_users_userid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_users_userid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_users_userid_seq OWNED BY public.tbl_users.userid;


--
-- Name: tbl_warranty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_warranty (
    warrantyid integer NOT NULL,
    tenant_id integer,
    customerid integer,
    productid integer,
    serialnumber character varying(100),
    warrantyperiod integer DEFAULT 12,
    warrantystartdate date,
    warrantyenddate date,
    status character varying(50) DEFAULT 'Active'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tbl_warranty_warrantyid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_warranty_warrantyid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_warranty_warrantyid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_warranty_warrantyid_seq OWNED BY public.tbl_warranty.warrantyid;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    subdomain character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: store_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_settings ALTER COLUMN id SET DEFAULT nextval('public.store_settings_id_seq'::regclass);


--
-- Name: tbl_activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.tbl_activity_logs_id_seq'::regclass);


--
-- Name: tbl_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_categories ALTER COLUMN id SET DEFAULT nextval('public.tbl_categories_id_seq'::regclass);


--
-- Name: tbl_customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_customers ALTER COLUMN id SET DEFAULT nextval('public.tbl_customers_id_seq'::regclass);


--
-- Name: tbl_held_sales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_held_sales ALTER COLUMN id SET DEFAULT nextval('public.tbl_held_sales_id_seq'::regclass);


--
-- Name: tbl_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_order_items ALTER COLUMN id SET DEFAULT nextval('public.tbl_order_items_id_seq'::regclass);


--
-- Name: tbl_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders ALTER COLUMN id SET DEFAULT nextval('public.tbl_orders_id_seq'::regclass);


--
-- Name: tbl_orders or_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders ALTER COLUMN or_id SET DEFAULT nextval('public.tbl_orders_or_id_seq'::regclass);


--
-- Name: tbl_orders_details id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders_details ALTER COLUMN id SET DEFAULT nextval('public.tbl_orders_details_id_seq'::regclass);


--
-- Name: tbl_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_payment ALTER COLUMN id SET DEFAULT nextval('public.tbl_payment_id_seq'::regclass);


--
-- Name: tbl_payment_method id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_payment_method ALTER COLUMN id SET DEFAULT nextval('public.tbl_payment_method_id_seq'::regclass);


--
-- Name: tbl_products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_products ALTER COLUMN id SET DEFAULT nextval('public.tbl_products_id_seq'::regclass);


--
-- Name: tbl_service_requests serviceid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_service_requests ALTER COLUMN serviceid SET DEFAULT nextval('public.tbl_service_requests_serviceid_seq'::regclass);


--
-- Name: tbl_stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock ALTER COLUMN id SET DEFAULT nextval('public.tbl_stock_id_seq'::regclass);


--
-- Name: tbl_stock_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock_log ALTER COLUMN id SET DEFAULT nextval('public.tbl_stock_log_id_seq'::regclass);


--
-- Name: tbl_suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_suppliers ALTER COLUMN id SET DEFAULT nextval('public.tbl_suppliers_id_seq'::regclass);


--
-- Name: tbl_users userid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_users ALTER COLUMN userid SET DEFAULT nextval('public.tbl_users_userid_seq'::regclass);


--
-- Name: tbl_warranty warrantyid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_warranty ALTER COLUMN warrantyid SET DEFAULT nextval('public.tbl_warranty_warrantyid_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: store_settings store_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id);


--
-- Name: store_settings store_settings_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_slug_key UNIQUE (slug);


--
-- Name: tbl_activity_logs tbl_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_activity_logs
    ADD CONSTRAINT tbl_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: tbl_categories tbl_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_categories
    ADD CONSTRAINT tbl_categories_pkey PRIMARY KEY (id);


--
-- Name: tbl_customers tbl_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_customers
    ADD CONSTRAINT tbl_customers_pkey PRIMARY KEY (id);


--
-- Name: tbl_held_sales tbl_held_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_held_sales
    ADD CONSTRAINT tbl_held_sales_pkey PRIMARY KEY (id);


--
-- Name: tbl_order_items tbl_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_order_items
    ADD CONSTRAINT tbl_order_items_pkey PRIMARY KEY (id);


--
-- Name: tbl_orders_details tbl_orders_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders_details
    ADD CONSTRAINT tbl_orders_details_pkey PRIMARY KEY (id);


--
-- Name: tbl_orders tbl_orders_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders
    ADD CONSTRAINT tbl_orders_id_key UNIQUE (id);


--
-- Name: tbl_orders tbl_orders_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders
    ADD CONSTRAINT tbl_orders_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: tbl_orders tbl_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders
    ADD CONSTRAINT tbl_orders_pkey PRIMARY KEY (or_id);


--
-- Name: tbl_orders tbl_orders_tracking_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders
    ADD CONSTRAINT tbl_orders_tracking_code_key UNIQUE (tracking_code);


--
-- Name: tbl_payment_method tbl_payment_method_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_payment_method
    ADD CONSTRAINT tbl_payment_method_pkey PRIMARY KEY (id);


--
-- Name: tbl_payment tbl_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_payment
    ADD CONSTRAINT tbl_payment_pkey PRIMARY KEY (id);


--
-- Name: tbl_products tbl_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_products
    ADD CONSTRAINT tbl_products_pkey PRIMARY KEY (id);


--
-- Name: tbl_service_requests tbl_service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_service_requests
    ADD CONSTRAINT tbl_service_requests_pkey PRIMARY KEY (serviceid);


--
-- Name: tbl_stock_log tbl_stock_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock_log
    ADD CONSTRAINT tbl_stock_log_pkey PRIMARY KEY (id);


--
-- Name: tbl_stock tbl_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock
    ADD CONSTRAINT tbl_stock_pkey PRIMARY KEY (id);


--
-- Name: tbl_suppliers tbl_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_suppliers
    ADD CONSTRAINT tbl_suppliers_pkey PRIMARY KEY (id);


--
-- Name: tbl_users tbl_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_users
    ADD CONSTRAINT tbl_users_email_key UNIQUE (email);


--
-- Name: tbl_users tbl_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_users
    ADD CONSTRAINT tbl_users_pkey PRIMARY KEY (userid);


--
-- Name: tbl_users tbl_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_users
    ADD CONSTRAINT tbl_users_username_key UNIQUE (username);


--
-- Name: tbl_warranty tbl_warranty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_warranty
    ADD CONSTRAINT tbl_warranty_pkey PRIMARY KEY (warrantyid);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_subdomain_key UNIQUE (subdomain);


--
-- Name: idx_held_sales_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_held_sales_tenant ON public.tbl_held_sales USING btree (tenant_id, user_id);


--
-- Name: idx_orders_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_idempotency ON public.tbl_orders USING btree (idempotency_key);


--
-- Name: idx_orders_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_source ON public.tbl_orders USING btree (tenant_id, source);


--
-- Name: idx_orders_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_tenant_created ON public.tbl_orders USING btree (tenant_id, created_at);


--
-- Name: idx_orders_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_tenant_date ON public.tbl_orders USING btree (tenant_id, created_at);


--
-- Name: idx_orders_tenant_order_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_tenant_order_date ON public.tbl_orders USING btree (tenant_id, order_date);


--
-- Name: idx_orders_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_tenant_status ON public.tbl_orders USING btree (tenant_id, status);


--
-- Name: idx_orders_tracking_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_tracking_code ON public.tbl_orders USING btree (tracking_code);


--
-- Name: idx_payment_method_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_method_tenant ON public.tbl_payment_method USING btree (tenant_id);


--
-- Name: idx_products_tenant_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_tenant_published ON public.tbl_products USING btree (tenant_id, is_published, status);


--
-- Name: idx_products_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_tenant_status ON public.tbl_products USING btree (tenant_id, status);


--
-- Name: idx_services_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_customer ON public.tbl_service_requests USING btree (customerid);


--
-- Name: idx_services_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_product ON public.tbl_service_requests USING btree (productid);


--
-- Name: idx_services_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_tenant ON public.tbl_service_requests USING btree (tenant_id);


--
-- Name: idx_stock_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_product ON public.tbl_stock USING btree (productid);


--
-- Name: idx_stock_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_product_id ON public.tbl_stock USING btree (productid);


--
-- Name: idx_stock_productid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_productid ON public.tbl_stock USING btree (productid);


--
-- Name: idx_store_settings_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_settings_slug ON public.store_settings USING btree (slug);


--
-- Name: idx_store_settings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_settings_tenant ON public.store_settings USING btree (tenant_id);


--
-- Name: idx_warranty_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warranty_customer ON public.tbl_warranty USING btree (customerid);


--
-- Name: idx_warranty_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warranty_product ON public.tbl_warranty USING btree (productid);


--
-- Name: idx_warranty_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warranty_tenant ON public.tbl_warranty USING btree (tenant_id);


--
-- Name: tbl_stock trg_sync_product_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_product_stock AFTER INSERT OR UPDATE OF qtyavailable ON public.tbl_stock FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock();


--
-- Name: store_settings store_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_activity_logs tbl_activity_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_activity_logs
    ADD CONSTRAINT tbl_activity_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_activity_logs tbl_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_activity_logs
    ADD CONSTRAINT tbl_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.tbl_users(userid);


--
-- Name: tbl_categories tbl_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_categories
    ADD CONSTRAINT tbl_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_customers tbl_customers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_customers
    ADD CONSTRAINT tbl_customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_held_sales tbl_held_sales_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_held_sales
    ADD CONSTRAINT tbl_held_sales_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_order_items tbl_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_order_items
    ADD CONSTRAINT tbl_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.tbl_orders(or_id) ON DELETE CASCADE;


--
-- Name: tbl_order_items tbl_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_order_items
    ADD CONSTRAINT tbl_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.tbl_products(id);


--
-- Name: tbl_order_items tbl_order_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_order_items
    ADD CONSTRAINT tbl_order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_orders tbl_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders
    ADD CONSTRAINT tbl_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.tbl_customers(id);


--
-- Name: tbl_orders_details tbl_orders_details_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders_details
    ADD CONSTRAINT tbl_orders_details_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.tbl_orders(or_id) ON DELETE CASCADE;


--
-- Name: tbl_orders_details tbl_orders_details_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders_details
    ADD CONSTRAINT tbl_orders_details_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.tbl_products(id) ON DELETE CASCADE;


--
-- Name: tbl_orders_details tbl_orders_details_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders_details
    ADD CONSTRAINT tbl_orders_details_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_orders tbl_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders
    ADD CONSTRAINT tbl_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_orders tbl_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_orders
    ADD CONSTRAINT tbl_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.tbl_users(userid);


--
-- Name: tbl_payment_method tbl_payment_method_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_payment_method
    ADD CONSTRAINT tbl_payment_method_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_payment tbl_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_payment
    ADD CONSTRAINT tbl_payment_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.tbl_orders(id) ON DELETE CASCADE;


--
-- Name: tbl_payment tbl_payment_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_payment
    ADD CONSTRAINT tbl_payment_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_products tbl_products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_products
    ADD CONSTRAINT tbl_products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.tbl_categories(id);


--
-- Name: tbl_products tbl_products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_products
    ADD CONSTRAINT tbl_products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.tbl_suppliers(id) ON DELETE SET NULL;


--
-- Name: tbl_products tbl_products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_products
    ADD CONSTRAINT tbl_products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_service_requests tbl_service_requests_customerid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_service_requests
    ADD CONSTRAINT tbl_service_requests_customerid_fkey FOREIGN KEY (customerid) REFERENCES public.tbl_customers(id) ON DELETE SET NULL;


--
-- Name: tbl_service_requests tbl_service_requests_productid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_service_requests
    ADD CONSTRAINT tbl_service_requests_productid_fkey FOREIGN KEY (productid) REFERENCES public.tbl_products(id) ON DELETE SET NULL;


--
-- Name: tbl_service_requests tbl_service_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_service_requests
    ADD CONSTRAINT tbl_service_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_stock_log tbl_stock_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock_log
    ADD CONSTRAINT tbl_stock_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.tbl_products(id) ON DELETE CASCADE;


--
-- Name: tbl_stock_log tbl_stock_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock_log
    ADD CONSTRAINT tbl_stock_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_stock_log tbl_stock_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock_log
    ADD CONSTRAINT tbl_stock_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.tbl_users(userid);


--
-- Name: tbl_stock tbl_stock_productid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock
    ADD CONSTRAINT tbl_stock_productid_fkey FOREIGN KEY (productid) REFERENCES public.tbl_products(id) ON DELETE CASCADE;


--
-- Name: tbl_stock tbl_stock_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_stock
    ADD CONSTRAINT tbl_stock_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_suppliers tbl_suppliers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_suppliers
    ADD CONSTRAINT tbl_suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_users tbl_users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_users
    ADD CONSTRAINT tbl_users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_warranty tbl_warranty_customerid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_warranty
    ADD CONSTRAINT tbl_warranty_customerid_fkey FOREIGN KEY (customerid) REFERENCES public.tbl_customers(id) ON DELETE SET NULL;


--
-- Name: tbl_warranty tbl_warranty_productid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_warranty
    ADD CONSTRAINT tbl_warranty_productid_fkey FOREIGN KEY (productid) REFERENCES public.tbl_products(id) ON DELETE SET NULL;


--
-- Name: tbl_warranty tbl_warranty_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_warranty
    ADD CONSTRAINT tbl_warranty_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tbl_held_sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tbl_held_sales ENABLE ROW LEVEL SECURITY;

--
-- Name: tbl_payment_method; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tbl_payment_method ENABLE ROW LEVEL SECURITY;

--
-- Name: tbl_service_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tbl_service_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: tbl_warranty; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tbl_warranty ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



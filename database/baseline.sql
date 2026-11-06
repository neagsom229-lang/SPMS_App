


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS vault;



COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
EXCEPTION WHEN others THEN
    NULL;
END $$;






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_product_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE tbl_products SET stock = NEW.qtyavailable WHERE id = NEW.productid;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_product_stock"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."khqr_sessions" (
    "id" integer NOT NULL,
    "order_id" character varying(255) NOT NULL,
    "tenant_id" integer,
    "user_id" integer,
    "plan" character varying(100),
    "period_months" integer DEFAULT 1,
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(10) DEFAULT 'USD'::character varying,
    "md5" character varying(255) NOT NULL,
    "bakong_hash" character varying(255),
    "qr_string" "text" NOT NULL,
    "status" character varying(50) DEFAULT 'PENDING'::character varying,
    "expires_at" timestamp without time zone,
    "paid_at" timestamp without time zone,
    "verified_by" character varying(100),
    "raw_response" "jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."khqr_sessions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."khqr_sessions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."khqr_sessions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."khqr_sessions_id_seq" OWNED BY "public"."khqr_sessions"."id";



CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "filename" character varying(255) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_settings" (
    "id" integer NOT NULL,
    "tenant_id" integer,
    "slug" character varying(100) NOT NULL,
    "store_name" character varying(255) NOT NULL,
    "logo_url" "text",
    "phone" character varying(50),
    "address" "text",
    "currency" character varying(10) DEFAULT 'USD'::character varying,
    "exchange_rate" numeric(10,4) DEFAULT 4000.0000,
    "is_open" boolean DEFAULT true,
    "accepts_online_orders" boolean DEFAULT true,
    "delivery_enabled" boolean DEFAULT true,
    "pickup_enabled" boolean DEFAULT true,
    "tax_rate" numeric(5,2) DEFAULT 0.00,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "opening_hours" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."store_settings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."store_settings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."store_settings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."store_settings_id_seq" OWNED BY "public"."store_settings"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_activity_logs" (
    "id" integer NOT NULL,
    "user_id" integer,
    "action" character varying(255) NOT NULL,
    "target_table" character varying(100),
    "target_id" integer,
    "tenant_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbl_activity_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_activity_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_activity_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_activity_logs_id_seq" OWNED BY "public"."tbl_activity_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_categories" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "tenant_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbl_categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_categories_id_seq" OWNED BY "public"."tbl_categories"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_customers" (
    "id" integer NOT NULL,
    "cus_id" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "email" character varying(255),
    "phone" character varying(50),
    "address" "text",
    "tenant_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "status" character varying(20) DEFAULT 'Active'::character varying
);


ALTER TABLE "public"."tbl_customers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_customers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_customers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_customers_id_seq" OWNED BY "public"."tbl_customers"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_held_sales" (
    "id" integer NOT NULL,
    "tenant_id" integer,
    "user_id" integer,
    "customer_id" integer,
    "cart_json" "jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbl_held_sales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_held_sales_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_held_sales_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_held_sales_id_seq" OWNED BY "public"."tbl_held_sales"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_order_items" (
    "id" integer NOT NULL,
    "order_id" integer,
    "product_id" integer,
    "qty" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "tenant_id" integer,
    "buy_price" numeric(10,2) DEFAULT 0,
    "refunded_qty" integer DEFAULT 0,
    "refunded_amount" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."tbl_order_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_order_items_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_order_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_order_items_id_seq" OWNED BY "public"."tbl_order_items"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_orders" (
    "or_id" integer NOT NULL,
    "order_no" character varying(100) NOT NULL,
    "customer_id" integer,
    "user_id" integer,
    "total" numeric(10,2) NOT NULL,
    "discount" numeric(10,2) DEFAULT 0,
    "payment_method" character varying(50),
    "status" character varying(50) DEFAULT 'Completed'::character varying,
    "tenant_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "source" character varying(20) DEFAULT 'POS'::character varying,
    "tracking_code" character varying(100),
    "idempotency_key" character varying(255),
    "customer_name" character varying(255),
    "customer_phone" character varying(50),
    "delivery_type" character varying(20) DEFAULT 'pickup'::character varying,
    "delivery_address" "text",
    "notes" "text",
    "order_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "voided_at" timestamp without time zone,
    "voided_by" integer,
    "void_reason" "text"
);


ALTER TABLE "public"."tbl_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbl_orders_details" (
    "id" integer NOT NULL,
    "order_id" integer,
    "product_id" integer,
    "qty_order" integer DEFAULT 1 NOT NULL,
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "buy_price" numeric(12,2) DEFAULT 0,
    "discount" numeric(12,2) DEFAULT 0,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "refunded_qty" integer DEFAULT 0,
    "refunded_amount" numeric(12,2) DEFAULT 0,
    "tenant_id" integer
);


ALTER TABLE "public"."tbl_orders_details" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_orders_details_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_orders_details_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_orders_details_id_seq" OWNED BY "public"."tbl_orders_details"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."tbl_orders_or_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_orders_or_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_orders_or_id_seq" OWNED BY "public"."tbl_orders"."or_id";



CREATE TABLE IF NOT EXISTS "public"."tbl_payment" (
    "id" integer NOT NULL,
    "order_id" integer,
    "tenant_id" integer,
    "amount" numeric(12,2) NOT NULL,
    "payment_method" character varying(50) NOT NULL,
    "status" character varying(50) DEFAULT 'COMPLETED'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbl_payment" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_payment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_payment_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_payment_id_seq" OWNED BY "public"."tbl_payment"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_payment_method" (
    "id" integer NOT NULL,
    "tenant_id" integer,
    "name" character varying(100) NOT NULL,
    "name_kh" character varying(100),
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbl_payment_method" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_payment_method_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_payment_method_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_payment_method_id_seq" OWNED BY "public"."tbl_payment_method"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_products" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "name_kh" character varying(255),
    "category_id" integer,
    "price" numeric(10,2) NOT NULL,
    "cost" numeric(10,2),
    "stock" integer DEFAULT 0,
    "barcode" character varying(100),
    "image_url" "text",
    "tenant_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "status" character varying(50) DEFAULT 'Active'::character varying,
    "qty_alert" integer DEFAULT 5,
    "is_published" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "description_en" "text",
    "description_kh" "text",
    "supplier_id" integer,
    "brand" character varying(100),
    "model" character varying(100)
);


ALTER TABLE "public"."tbl_products" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_products_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_products_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_products_id_seq" OWNED BY "public"."tbl_products"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_service_requests" (
    "serviceid" integer NOT NULL,
    "tenant_id" integer,
    "customerid" integer,
    "productid" integer,
    "serialnumber" character varying(100),
    "issuedescription" "text",
    "servicetype" character varying(50) DEFAULT 'Repair'::character varying,
    "status" character varying(50) DEFAULT 'Pending'::character varying,
    "receiveddate" "date",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbl_service_requests" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_service_requests_serviceid_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_service_requests_serviceid_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_service_requests_serviceid_seq" OWNED BY "public"."tbl_service_requests"."serviceid";



CREATE TABLE IF NOT EXISTS "public"."tbl_stock" (
    "id" integer NOT NULL,
    "productid" integer,
    "qtyinstock" integer DEFAULT 0,
    "qtyavailable" integer DEFAULT 0,
    "tenant_id" integer,
    "qtyreserved" integer DEFAULT 0,
    "minstocklevel" integer DEFAULT 5,
    CONSTRAINT "chk_stock_non_negative" CHECK ((("qtyavailable" >= 0) AND ("qtyinstock" >= 0)))
);


ALTER TABLE "public"."tbl_stock" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_stock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_stock_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_stock_id_seq" OWNED BY "public"."tbl_stock"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_stock_log" (
    "id" integer NOT NULL,
    "tenant_id" integer,
    "product_id" integer,
    "change_qty" integer NOT NULL,
    "type" character varying(50) NOT NULL,
    "reference_id" integer,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "transaction_type" character varying(50),
    "reference_type" character varying(50) DEFAULT 'ORDER'::character varying,
    "user_id" integer
);


ALTER TABLE "public"."tbl_stock_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_stock_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_stock_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_stock_log_id_seq" OWNED BY "public"."tbl_stock_log"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_suppliers" (
    "id" integer NOT NULL,
    "sup_name" character varying(255) NOT NULL,
    "contact_person" character varying(255),
    "phone" character varying(50),
    "email" character varying(255),
    "address" "text",
    "tenant_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "status" character varying(20) DEFAULT 'Active'::character varying
);


ALTER TABLE "public"."tbl_suppliers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_suppliers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_suppliers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_suppliers_id_seq" OWNED BY "public"."tbl_suppliers"."id";



CREATE TABLE IF NOT EXISTS "public"."tbl_users" (
    "userid" integer NOT NULL,
    "username" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "password" character varying(255) NOT NULL,
    "fullname" character varying(255),
    "role" character varying(50) DEFAULT 'Admin'::character varying,
    "role_name" character varying(50),
    "status" character varying(50) DEFAULT 'ACTIVE'::character varying,
    "is_super_admin" boolean DEFAULT false,
    "tenant_id" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "must_change_password" boolean DEFAULT false,
    "token_version" integer DEFAULT 1,
    "subscription_plan" character varying(100),
    "subscription_expires" timestamp without time zone
);


ALTER TABLE "public"."tbl_users" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_users_userid_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_users_userid_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_users_userid_seq" OWNED BY "public"."tbl_users"."userid";



CREATE TABLE IF NOT EXISTS "public"."tbl_warranty" (
    "warrantyid" integer NOT NULL,
    "tenant_id" integer,
    "customerid" integer,
    "productid" integer,
    "serialnumber" character varying(100),
    "warrantyperiod" integer DEFAULT 12,
    "warrantystartdate" "date",
    "warrantyenddate" "date",
    "status" character varying(50) DEFAULT 'Active'::character varying,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbl_warranty" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbl_warranty_warrantyid_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbl_warranty_warrantyid_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbl_warranty_warrantyid_seq" OWNED BY "public"."tbl_warranty"."warrantyid";



CREATE TABLE IF NOT EXISTS "public"."tenant_order_counters" (
    "tenant_id" integer NOT NULL,
    "last_seq" integer DEFAULT 0
);


ALTER TABLE "public"."tenant_order_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "subdomain" character varying(100) NOT NULL,
    "status" character varying(50) DEFAULT 'ACTIVE'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "plan" character varying(50) DEFAULT 'FREE'::character varying,
    "plan_expires_at" timestamp without time zone
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tenants_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tenants_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tenants_id_seq" OWNED BY "public"."tenants"."id";



ALTER TABLE ONLY "public"."khqr_sessions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."khqr_sessions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."store_settings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."store_settings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_activity_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_activity_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_customers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_customers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_held_sales" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_held_sales_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_order_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_order_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_orders" ALTER COLUMN "or_id" SET DEFAULT "nextval"('"public"."tbl_orders_or_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_orders_details" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_orders_details_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_payment" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_payment_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_payment_method" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_payment_method_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_products" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_products_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_service_requests" ALTER COLUMN "serviceid" SET DEFAULT "nextval"('"public"."tbl_service_requests_serviceid_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_stock" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_stock_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_stock_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_stock_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_suppliers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbl_suppliers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_users" ALTER COLUMN "userid" SET DEFAULT "nextval"('"public"."tbl_users_userid_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbl_warranty" ALTER COLUMN "warrantyid" SET DEFAULT "nextval"('"public"."tbl_warranty_warrantyid_seq"'::"regclass");



ALTER TABLE ONLY "public"."tenants" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tenants_id_seq"'::"regclass");



ALTER TABLE "public"."tbl_payment"
    ADD CONSTRAINT "chk_payment_status" CHECK ((("status")::"text" = ANY ((ARRAY['COMPLETED'::character varying, 'REFUNDED'::character varying, 'CANCELLED'::character varying, 'VOIDED'::character varying, 'PENDING'::character varying, 'FAILED'::character varying])::"text"[]))) NOT VALID;



ALTER TABLE "public"."tbl_users"
    ADD CONSTRAINT "chk_user_tenant" CHECK ((("is_super_admin" = true) OR ("tenant_id" IS NOT NULL))) NOT VALID;



ALTER TABLE ONLY "public"."khqr_sessions"
    ADD CONSTRAINT "khqr_sessions_bakong_hash_key" UNIQUE ("bakong_hash");



ALTER TABLE ONLY "public"."khqr_sessions"
    ADD CONSTRAINT "khqr_sessions_md5_key" UNIQUE ("md5");



ALTER TABLE ONLY "public"."khqr_sessions"
    ADD CONSTRAINT "khqr_sessions_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."khqr_sessions"
    ADD CONSTRAINT "khqr_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("filename");



ALTER TABLE ONLY "public"."store_settings"
    ADD CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_settings"
    ADD CONSTRAINT "store_settings_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."tbl_activity_logs"
    ADD CONSTRAINT "tbl_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_categories"
    ADD CONSTRAINT "tbl_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_customers"
    ADD CONSTRAINT "tbl_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_held_sales"
    ADD CONSTRAINT "tbl_held_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_order_items"
    ADD CONSTRAINT "tbl_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_orders_details"
    ADD CONSTRAINT "tbl_orders_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_orders"
    ADD CONSTRAINT "tbl_orders_pkey" PRIMARY KEY ("or_id");



ALTER TABLE ONLY "public"."tbl_orders"
    ADD CONSTRAINT "tbl_orders_tracking_code_key" UNIQUE ("tracking_code");



ALTER TABLE ONLY "public"."tbl_payment_method"
    ADD CONSTRAINT "tbl_payment_method_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_payment"
    ADD CONSTRAINT "tbl_payment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_products"
    ADD CONSTRAINT "tbl_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_service_requests"
    ADD CONSTRAINT "tbl_service_requests_pkey" PRIMARY KEY ("serviceid");



ALTER TABLE ONLY "public"."tbl_stock_log"
    ADD CONSTRAINT "tbl_stock_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_stock"
    ADD CONSTRAINT "tbl_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_suppliers"
    ADD CONSTRAINT "tbl_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbl_users"
    ADD CONSTRAINT "tbl_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."tbl_users"
    ADD CONSTRAINT "tbl_users_pkey" PRIMARY KEY ("userid");



ALTER TABLE ONLY "public"."tbl_users"
    ADD CONSTRAINT "tbl_users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."tbl_warranty"
    ADD CONSTRAINT "tbl_warranty_pkey" PRIMARY KEY ("warrantyid");



ALTER TABLE ONLY "public"."tenant_order_counters"
    ADD CONSTRAINT "tenant_order_counters_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_subdomain_key" UNIQUE ("subdomain");



ALTER TABLE ONLY "public"."tbl_orders"
    ADD CONSTRAINT "uq_tenant_idempotency" UNIQUE ("tenant_id", "idempotency_key");



ALTER TABLE ONLY "public"."tbl_orders"
    ADD CONSTRAINT "uq_tenant_order_no" UNIQUE ("tenant_id", "order_no");



ALTER TABLE ONLY "public"."tbl_stock"
    ADD CONSTRAINT "uq_tenant_product_stock" UNIQUE ("tenant_id", "productid");



CREATE INDEX "idx_held_sales_tenant" ON "public"."tbl_held_sales" USING "btree" ("tenant_id", "user_id");



CREATE INDEX "idx_orders_idempotency" ON "public"."tbl_orders" USING "btree" ("idempotency_key");



CREATE INDEX "idx_orders_source" ON "public"."tbl_orders" USING "btree" ("tenant_id", "source");



CREATE INDEX "idx_orders_tenant_created" ON "public"."tbl_orders" USING "btree" ("tenant_id", "created_at");



CREATE INDEX "idx_orders_tenant_date" ON "public"."tbl_orders" USING "btree" ("tenant_id", "created_at");



CREATE INDEX "idx_orders_tenant_order_date" ON "public"."tbl_orders" USING "btree" ("tenant_id", "order_date");



CREATE INDEX "idx_orders_tenant_status" ON "public"."tbl_orders" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_orders_tracking_code" ON "public"."tbl_orders" USING "btree" ("tracking_code");



CREATE INDEX "idx_payment_method_tenant" ON "public"."tbl_payment_method" USING "btree" ("tenant_id");



CREATE INDEX "idx_products_tenant_published" ON "public"."tbl_products" USING "btree" ("tenant_id", "is_published", "status");



CREATE INDEX "idx_products_tenant_status" ON "public"."tbl_products" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_services_customer" ON "public"."tbl_service_requests" USING "btree" ("customerid");



CREATE INDEX "idx_services_product" ON "public"."tbl_service_requests" USING "btree" ("productid");



CREATE INDEX "idx_services_tenant" ON "public"."tbl_service_requests" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_product" ON "public"."tbl_stock" USING "btree" ("productid");



CREATE INDEX "idx_stock_product_id" ON "public"."tbl_stock" USING "btree" ("productid");



CREATE INDEX "idx_stock_productid" ON "public"."tbl_stock" USING "btree" ("productid");



CREATE INDEX "idx_store_settings_slug" ON "public"."store_settings" USING "btree" ("slug");



CREATE INDEX "idx_store_settings_tenant" ON "public"."store_settings" USING "btree" ("tenant_id");



CREATE INDEX "idx_warranty_customer" ON "public"."tbl_warranty" USING "btree" ("customerid");



CREATE INDEX "idx_warranty_product" ON "public"."tbl_warranty" USING "btree" ("productid");



CREATE INDEX "idx_warranty_tenant" ON "public"."tbl_warranty" USING "btree" ("tenant_id");



CREATE OR REPLACE TRIGGER "trg_sync_product_stock" AFTER INSERT OR UPDATE OF "qtyavailable" ON "public"."tbl_stock" FOR EACH ROW EXECUTE FUNCTION "public"."sync_product_stock"();



ALTER TABLE ONLY "public"."khqr_sessions"
    ADD CONSTRAINT "khqr_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."khqr_sessions"
    ADD CONSTRAINT "khqr_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."tbl_users"("userid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_settings"
    ADD CONSTRAINT "store_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_activity_logs"
    ADD CONSTRAINT "tbl_activity_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_activity_logs"
    ADD CONSTRAINT "tbl_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."tbl_users"("userid");



ALTER TABLE ONLY "public"."tbl_categories"
    ADD CONSTRAINT "tbl_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_customers"
    ADD CONSTRAINT "tbl_customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_held_sales"
    ADD CONSTRAINT "tbl_held_sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_order_items"
    ADD CONSTRAINT "tbl_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."tbl_orders"("or_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_order_items"
    ADD CONSTRAINT "tbl_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."tbl_products"("id");



ALTER TABLE ONLY "public"."tbl_order_items"
    ADD CONSTRAINT "tbl_order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_orders"
    ADD CONSTRAINT "tbl_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."tbl_customers"("id");



ALTER TABLE ONLY "public"."tbl_orders_details"
    ADD CONSTRAINT "tbl_orders_details_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."tbl_orders"("or_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_orders_details"
    ADD CONSTRAINT "tbl_orders_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."tbl_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_orders_details"
    ADD CONSTRAINT "tbl_orders_details_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_orders"
    ADD CONSTRAINT "tbl_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_orders"
    ADD CONSTRAINT "tbl_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."tbl_users"("userid");



ALTER TABLE ONLY "public"."tbl_payment_method"
    ADD CONSTRAINT "tbl_payment_method_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_payment"
    ADD CONSTRAINT "tbl_payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."tbl_orders"("or_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_payment"
    ADD CONSTRAINT "tbl_payment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_products"
    ADD CONSTRAINT "tbl_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."tbl_categories"("id");



ALTER TABLE ONLY "public"."tbl_products"
    ADD CONSTRAINT "tbl_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."tbl_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbl_products"
    ADD CONSTRAINT "tbl_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_service_requests"
    ADD CONSTRAINT "tbl_service_requests_customerid_fkey" FOREIGN KEY ("customerid") REFERENCES "public"."tbl_customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbl_service_requests"
    ADD CONSTRAINT "tbl_service_requests_productid_fkey" FOREIGN KEY ("productid") REFERENCES "public"."tbl_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbl_service_requests"
    ADD CONSTRAINT "tbl_service_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_stock_log"
    ADD CONSTRAINT "tbl_stock_log_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."tbl_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_stock_log"
    ADD CONSTRAINT "tbl_stock_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_stock"
    ADD CONSTRAINT "tbl_stock_productid_fkey" FOREIGN KEY ("productid") REFERENCES "public"."tbl_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_stock"
    ADD CONSTRAINT "tbl_stock_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_suppliers"
    ADD CONSTRAINT "tbl_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_users"
    ADD CONSTRAINT "tbl_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbl_warranty"
    ADD CONSTRAINT "tbl_warranty_customerid_fkey" FOREIGN KEY ("customerid") REFERENCES "public"."tbl_customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbl_warranty"
    ADD CONSTRAINT "tbl_warranty_productid_fkey" FOREIGN KEY ("productid") REFERENCES "public"."tbl_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbl_warranty"
    ADD CONSTRAINT "tbl_warranty_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_order_counters"
    ADD CONSTRAINT "tenant_order_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE "public"."khqr_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_held_sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_orders_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_payment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_payment_method" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_service_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_stock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_stock_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbl_warranty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_order_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;




DO $$
BEGIN
    CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_product_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_product_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_product_stock"() TO "service_role";


















GRANT ALL ON TABLE "public"."khqr_sessions" TO "anon";
GRANT ALL ON TABLE "public"."khqr_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."khqr_sessions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."khqr_sessions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."khqr_sessions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."khqr_sessions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."store_settings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."store_settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_activity_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_activity_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_customers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_held_sales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_held_sales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_order_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_orders" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_orders_details" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_orders_details_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_orders_or_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_payment" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_payment_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_payment_method" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_payment_method_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_service_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_service_requests_serviceid_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_stock" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_stock_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_stock_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_stock_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_suppliers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_suppliers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_users_userid_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tbl_warranty" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tbl_warranty_warrantyid_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_order_counters" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tenants_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




































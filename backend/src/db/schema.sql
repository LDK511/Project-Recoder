-- 참고용 스키마 스냅샷 (자동 생성). 실제 적용은 src/db/migrations.ts 의 마이그레이션이 담당합니다.
-- 직접 수정하지 말고 새 마이그레이션을 추가하세요.

\restrict lkgqSskFhG8WiwbtfD0c7KTrAzyHPIAPcdjM5vRKTt6hPwWSQaumdYPjUjAT6k1
CREATE TABLE public.cart_items (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);
CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;
CREATE TABLE public.inventory_reservations (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    reserved_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    released_at timestamp without time zone,
    CONSTRAINT inventory_reservations_quantity_check CHECK ((quantity > 0))
);
CREATE SEQUENCE public.inventory_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.inventory_reservations_id_seq OWNED BY public.inventory_reservations.id;
CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    quantity integer NOT NULL,
    price_cents integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    product_name character varying(255),
    image_url character varying(500),
    CONSTRAINT order_items_price_cents_check CHECK ((price_cents > 0)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);
CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;
CREATE TABLE public.order_status_history (
    id integer NOT NULL,
    order_id integer NOT NULL,
    from_status character varying(20),
    to_status character varying(20) NOT NULL,
    note character varying(255),
    actor character varying(100) DEFAULT 'system'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE public.order_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;
CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    total_cents integer NOT NULL,
    currency character varying(3) DEFAULT 'KRW'::character varying,
    idempotency_key character varying(255) NOT NULL,
    payment_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    order_number character varying(32),
    subtotal_cents integer,
    shipping_fee_cents integer DEFAULT 0 NOT NULL,
    recipient_name character varying(50),
    recipient_phone character varying(20),
    postal_code character varying(10),
    address1 character varying(255),
    address2 character varying(255),
    delivery_memo character varying(200),
    tracking_carrier character varying(50),
    tracking_number character varying(50),
    cancel_reason character varying(255),
    paid_at timestamp without time zone,
    shipped_at timestamp without time zone,
    delivered_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'preparing'::character varying, 'shipping'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'refunded'::character varying])::text[]))),
    CONSTRAINT orders_total_cents_check CHECK ((total_cents > 0))
);
CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;
CREATE TABLE public.payment_events (
    id integer NOT NULL,
    order_id integer NOT NULL,
    event_id character varying(255) NOT NULL,
    event_type character varying(50) NOT NULL,
    payload jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['completed'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::text[])))
);
CREATE SEQUENCE public.payment_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payment_events_id_seq OWNED BY public.payment_events.id;
CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price_cents integer NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    image_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    category character varying(50),
    compare_at_price_cents integer,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT products_compare_at_price_cents_check CHECK (((compare_at_price_cents IS NULL) OR (compare_at_price_cents > 0))),
    CONSTRAINT products_price_cents_check CHECK ((price_cents > 0)),
    CONSTRAINT products_stock_check CHECK ((stock >= 0))
);
CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;
CREATE TABLE public.schema_migrations (
    version integer NOT NULL,
    name character varying(100) NOT NULL,
    applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'customer'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['customer'::character varying, 'admin'::character varying])::text[])))
);
CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);
ALTER TABLE ONLY public.inventory_reservations ALTER COLUMN id SET DEFAULT nextval('public.inventory_reservations_id_seq'::regclass);
ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);
ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);
ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);
ALTER TABLE ONLY public.payment_events ALTER COLUMN id SET DEFAULT nextval('public.payment_events_id_seq'::regclass);
ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_product_id_key UNIQUE (user_id, product_id);
ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_event_id_key UNIQUE (event_id);
ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE INDEX idx_cart_items_user_id ON public.cart_items USING btree (user_id);
CREATE INDEX idx_inventory_reservations_order_id ON public.inventory_reservations USING btree (order_id);
CREATE INDEX idx_inventory_reservations_product_id ON public.inventory_reservations USING btree (product_id);
CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);
CREATE INDEX idx_order_status_history_order ON public.order_status_history USING btree (order_id, created_at);
CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);
CREATE UNIQUE INDEX idx_orders_order_number ON public.orders USING btree (order_number);
CREATE INDEX idx_orders_pending_expiry ON public.orders USING btree (expires_at) WHERE ((status)::text = 'pending'::text);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);
CREATE INDEX idx_payment_events_order_id ON public.payment_events USING btree (order_id);
CREATE INDEX idx_products_active_created ON public.products USING btree (is_active, created_at DESC);
CREATE INDEX idx_products_category ON public.products USING btree (category);
CREATE INDEX idx_products_created_at ON public.products USING btree (created_at);
CREATE INDEX idx_products_name ON public.products USING btree (name);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE UNIQUE INDEX idx_users_email_lower ON public.users USING btree (lower((email)::text));
ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
\unrestrict lkgqSskFhG8WiwbtfD0c7KTrAzyHPIAPcdjM5vRKTt6hPwWSQaumdYPjUjAT6k1

import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'ferrostock',
        user: process.env.PGUSER || 'ferrostock',
        password: process.env.PGPASSWORD || 'ferrostock',
      }),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      sku VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT '',
      unit VARCHAR(20) NOT NULL DEFAULT 'unidad',
      purchase_price NUMERIC(14, 2) NOT NULL CHECK (purchase_price >= 0),
      sale_price NUMERIC(14, 2) NOT NULL CHECK (sale_price >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS customers (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      phone VARCHAR(40) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      phone VARCHAR(40) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      type VARCHAR(10) NOT NULL CHECK (type IN ('sale', 'purchase')),
      customer_id BIGINT REFERENCES customers(id),
      supplier_id BIGINT REFERENCES suppliers(id),
      party_name VARCHAR(120) NOT NULL,
      party_phone VARCHAR(40) NOT NULL DEFAULT '',
      notes VARCHAR(250) NOT NULL DEFAULT '',
      total NUMERIC(14, 2) NOT NULL CHECK (total >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transaction_items (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES products(id),
      product_name VARCHAR(120) NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
      subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0)
    );
    CREATE TABLE IF NOT EXISTS movements (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id),
      type VARCHAR(10) NOT NULL CHECK (type IN ('entrada', 'salida')),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      reference VARCHAR(120) NOT NULL DEFAULT '',
      notes VARCHAR(250) NOT NULL DEFAULT '',
      transaction_id BIGINT REFERENCES transactions(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS movements_created_at_idx ON movements (created_at DESC);
    CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions (created_at DESC);
    CREATE INDEX IF NOT EXISTS transaction_items_transaction_id_idx ON transaction_items (transaction_id);
    CREATE INDEX IF NOT EXISTS products_active_name_idx ON products (is_active, name);
  `);
}

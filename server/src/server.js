import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, initializeDatabase } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4000);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) fail(`${label} debe ser un número entero mayor a cero.`);
  return number;
}

function nonNegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) fail(`${label} debe ser un número igual o mayor a cero.`);
  return number;
}

function requiredText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} es obligatorio.`);
  const text = value.trim();
  if (text.length > maxLength) fail(`${label} no puede superar ${maxLength} caracteres.`);
  return text;
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
}));

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const [summary, lowStock, monthSales] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)::INTEGER AS product_count,
             COALESCE(SUM(stock), 0)::INTEGER AS total_units,
             COALESCE(SUM(stock * purchase_price), 0)::NUMERIC(14,2) AS inventory_value,
             COUNT(*) FILTER (WHERE stock <= min_stock)::INTEGER AS low_stock_count
      FROM products WHERE is_active = TRUE
    `),
    pool.query(`
      SELECT id, name, sku, unit, stock, min_stock AS "minStock"
      FROM products WHERE is_active = TRUE AND stock <= min_stock
      ORDER BY stock ASC, name ASC LIMIT 8
    `),
    pool.query(`
      SELECT COALESCE(SUM(total), 0)::NUMERIC(14,2) AS total
      FROM transactions WHERE type = 'sale' AND created_at >= date_trunc('month', NOW())
    `),
  ]);
  const data = summary.rows[0];
  res.json({
    productCount: data.product_count,
    totalUnits: data.total_units,
    inventoryValue: data.inventory_value,
    lowStockCount: data.low_stock_count,
    monthSales: monthSales.rows[0].total,
    lowStock: lowStock.rows,
  });
}));

app.get('/api/products', asyncRoute(async (_req, res) => {
  const result = await pool.query(`
    SELECT id, sku, name, category, unit, purchase_price AS "purchasePrice",
           sale_price AS "salePrice", stock, min_stock AS "minStock"
    FROM products WHERE is_active = TRUE ORDER BY name ASC
  `);
  res.json(result.rows);
}));

app.post('/api/products', asyncRoute(async (req, res) => {
  const sku = requiredText(req.body.sku, 'El código', 50);
  const name = requiredText(req.body.name, 'El nombre', 120);
  const category = typeof req.body.category === 'string' ? req.body.category.trim().slice(0, 80) : '';
  const unit = requiredText(req.body.unit, 'La unidad', 20);
  const purchasePrice = nonNegativeNumber(req.body.purchasePrice, 'El precio de compra');
  const salePrice = nonNegativeNumber(req.body.salePrice, 'El precio de venta');
  const minStock = nonNegativeNumber(req.body.minStock ?? 0, 'El stock mínimo');
  const initialStock = nonNegativeNumber(req.body.initialStock ?? 0, 'Las existencias iniciales');
  if (!Number.isSafeInteger(minStock) || !Number.isSafeInteger(initialStock)) fail('Las existencias deben ser números enteros.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(`
      INSERT INTO products (sku, name, category, unit, purchase_price, sale_price, stock, min_stock)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, sku, name, category, unit, purchase_price AS "purchasePrice",
                sale_price AS "salePrice", stock, min_stock AS "minStock"
    `, [sku, name, category, unit, purchasePrice, salePrice, initialStock, minStock]);
    if (initialStock > 0) {
      await client.query(`
        INSERT INTO movements (product_id, type, quantity, reference)
        VALUES ($1, 'entrada', $2, 'Stock de apertura')
      `, [inserted.rows[0].id, initialStock]);
    }
    await client.query('COMMIT');
    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.patch('/api/products/:id', asyncRoute(async (req, res) => {
  const id = positiveInteger(req.params.id, 'El producto');
  const sku = requiredText(req.body.sku, 'El código', 50);
  const name = requiredText(req.body.name, 'El nombre', 120);
  const category = typeof req.body.category === 'string' ? req.body.category.trim().slice(0, 80) : '';
  const unit = requiredText(req.body.unit, 'La unidad', 20);
  const purchasePrice = nonNegativeNumber(req.body.purchasePrice, 'El precio de compra');
  const salePrice = nonNegativeNumber(req.body.salePrice, 'El precio de venta');
  const minStock = nonNegativeNumber(req.body.minStock, 'El stock mínimo');
  if (!Number.isSafeInteger(minStock)) fail('El stock mínimo debe ser un número entero.');
  const result = await pool.query(`
    UPDATE products
    SET sku = $2, name = $3, category = $4, unit = $5, purchase_price = $6,
        sale_price = $7, min_stock = $8, updated_at = NOW()
    WHERE id = $1 AND is_active = TRUE
    RETURNING id, sku, name, category, unit, purchase_price AS "purchasePrice",
              sale_price AS "salePrice", stock, min_stock AS "minStock"
  `, [id, sku, name, category, unit, purchasePrice, salePrice, minStock]);
  if (!result.rowCount) fail('No se encontró el producto solicitado.', 404);
  res.json(result.rows[0]);
}));

app.delete('/api/products/:id', asyncRoute(async (req, res) => {
  const id = positiveInteger(req.params.id, 'El producto');
  const result = await pool.query(`
    UPDATE products SET is_active = FALSE, updated_at = NOW()
    WHERE id = $1 AND is_active = TRUE RETURNING id
  `, [id]);
  if (!result.rowCount) fail('No se encontró el producto solicitado.', 404);
  res.status(204).end();
}));

app.get('/api/movements', asyncRoute(async (_req, res) => {
  const result = await pool.query(`
    SELECT m.id, m.type, m.quantity, m.reference, m.notes, m.created_at AS "createdAt",
           p.name AS "productName", p.unit
    FROM movements m JOIN products p ON p.id = m.product_id
    ORDER BY m.created_at DESC, m.id DESC LIMIT 100
  `);
  res.json(result.rows);
}));

app.post('/api/movements', asyncRoute(async (req, res) => {
  const productId = positiveInteger(req.body.productId, 'El producto');
  const quantity = positiveInteger(req.body.quantity, 'La cantidad');
  const type = req.body.type;
  if (!['entrada', 'salida'].includes(type)) fail('El tipo debe ser entrada o salida.');
  const reference = typeof req.body.reference === 'string' ? req.body.reference.trim().slice(0, 120) : '';
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim().slice(0, 250) : '';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const product = await client.query('SELECT id, stock FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE', [productId]);
    if (!product.rowCount) fail('No se encontró el producto seleccionado.', 404);
    if (type === 'salida' && product.rows[0].stock < quantity) fail('No hay suficiente stock para registrar esta salida.');
    await client.query(`UPDATE products SET stock = stock ${type === 'entrada' ? '+' : '-'} $2, updated_at = NOW() WHERE id = $1`, [productId, quantity]);
    const movement = await client.query(`
      INSERT INTO movements (product_id, type, quantity, reference, notes)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [productId, type, quantity, reference, notes]);
    await client.query('COMMIT');
    res.status(201).json({ id: movement.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/transactions', asyncRoute(async (_req, res) => {
  const result = await pool.query(`
    SELECT t.id, t.type, t.party_name AS "partyName", t.party_phone AS "partyPhone",
           t.notes, t.total, t.created_at AS "createdAt", COUNT(i.id)::INTEGER AS "itemCount",
           COALESCE(STRING_AGG(i.product_name || ' × ' || i.quantity, ', ' ORDER BY i.id), '') AS items
    FROM transactions t LEFT JOIN transaction_items i ON i.transaction_id = t.id
    GROUP BY t.id ORDER BY t.created_at DESC, t.id DESC LIMIT 100
  `);
  res.json(result.rows);
}));

app.post('/api/transactions', asyncRoute(async (req, res) => {
  const type = req.body.type;
  if (!['sale', 'purchase'].includes(type)) fail('La operación debe ser una venta o una compra.');
  const partyName = requiredText(req.body.partyName, type === 'sale' ? 'El nombre del cliente' : 'El nombre del proveedor', 120);
  const partyPhone = typeof req.body.partyPhone === 'string' ? req.body.partyPhone.trim().slice(0, 40) : '';
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim().slice(0, 250) : '';
  if (!Array.isArray(req.body.items) || !req.body.items.length || req.body.items.length > 50) fail('Agrega entre 1 y 50 productos a la operación.');
  const items = req.body.items.map((item) => ({
    productId: positiveInteger(item.productId, 'El producto'),
    quantity: positiveInteger(item.quantity, 'La cantidad'),
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const partyTable = type === 'sale' ? 'customers' : 'suppliers';
    const partyKey = type === 'sale' ? 'customer_id' : 'supplier_id';
    const party = await client.query(`
      INSERT INTO ${partyTable} (name, phone) VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET phone = CASE WHEN EXCLUDED.phone = '' THEN ${partyTable}.phone ELSE EXCLUDED.phone END
      RETURNING id
    `, [partyName, partyPhone]);

    const productIds = [...new Set(items.map((item) => item.productId))].sort((a, b) => a - b);
    const lockedProducts = await client.query(`
      SELECT id, name, stock, purchase_price, sale_price
      FROM products WHERE id = ANY($1::bigint[]) AND is_active = TRUE ORDER BY id FOR UPDATE
    `, [productIds]);
    if (lockedProducts.rowCount !== productIds.length) fail('Uno o más productos ya no están disponibles.', 404);
    const productsById = new Map(lockedProducts.rows.map((product) => [String(product.id), product]));
    const quantities = new Map();
    for (const item of items) quantities.set(String(item.productId), (quantities.get(String(item.productId)) || 0) + item.quantity);
    if (type === 'sale') {
      for (const [productId, quantity] of quantities) {
        if (Number(productsById.get(productId).stock) < quantity) fail(`Stock insuficiente para ${productsById.get(productId).name}.`);
      }
    }

    const pricedItems = items.map((item) => {
      const product = productsById.get(String(item.productId));
      const price = Number(type === 'sale' ? product.sale_price : product.purchase_price);
      return { ...item, name: product.name, price, subtotal: price * item.quantity };
    });
    const total = pricedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const partyColumn = type === 'sale' ? 'customer_id' : 'supplier_id';
    const inserted = await client.query(`
      INSERT INTO transactions (type, ${partyColumn}, party_name, party_phone, notes, total)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [type, party.rows[0].id, partyName, partyPhone, notes, total]);
    const transactionId = inserted.rows[0].id;

    for (const item of pricedItems) {
      await client.query(`
        INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [transactionId, item.productId, item.name, item.quantity, item.price, item.subtotal]);
    }
    for (const [productId, quantity] of quantities) {
      const movementType = type === 'sale' ? 'salida' : 'entrada';
      await client.query(`UPDATE products SET stock = stock ${type === 'sale' ? '-' : '+'} $2, updated_at = NOW() WHERE id = $1`, [productId, quantity]);
      await client.query(`
        INSERT INTO movements (product_id, type, quantity, reference, transaction_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [productId, movementType, quantity, `${type === 'sale' ? 'Venta' : 'Compra'} · ${partyName}`, transactionId]);
    }
    await client.query('COMMIT');
    res.status(201).json({ id: transactionId, total });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'La ruta de API solicitada no existe.' });
});

const frontendDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res, next) => {
    res.sendFile(join(frontendDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error, _req, res, _next) => {
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con ese código o nombre.' });
  console.error(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({ error: status === 500 ? 'Ocurrió un error interno. Intenta nuevamente.' : error.message });
});

async function start() {
  await initializeDatabase();
  app.listen(port, '0.0.0.0', () => console.log(`FerroStock API disponible en el puerto ${port}`));
}

start().catch((error) => {
  console.error('No se pudo iniciar la API:', error);
  process.exitCode = 1;
});

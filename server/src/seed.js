const demoProducts = [
  { sku: 'FER-001', name: 'Taladro percutor 13 mm', category: 'Herramientas eléctricas', unit: 'unidad', purchasePrice: 185000, salePrice: 239000, minStock: 2, finalStock: 6 },
  { sku: 'FER-002', name: 'Martillo de uña 16 oz', category: 'Herramientas manuales', unit: 'unidad', purchasePrice: 28000, salePrice: 39000, minStock: 5, finalStock: 18 },
  { sku: 'FER-003', name: 'Juego de destornilladores x6', category: 'Herramientas manuales', unit: 'juego', purchasePrice: 36000, salePrice: 52000, minStock: 2, finalStock: 4 },
  { sku: 'FER-004', name: 'Tornillo drywall 1/2 pulg. x 1 kg', category: 'Tornillería', unit: 'caja', purchasePrice: 12000, salePrice: 18000, minStock: 3, finalStock: 12 },
  { sku: 'FER-005', name: 'Cemento gris 50 kg', category: 'Construcción', unit: 'unidad', purchasePrice: 31500, salePrice: 39000, minStock: 5, finalStock: 15 },
  { sku: 'FER-006', name: 'Pintura blanca tipo 1 galón', category: 'Pinturas', unit: 'galón', purchasePrice: 62000, salePrice: 79000, minStock: 4, finalStock: 3 },
  { sku: 'FER-007', name: 'Cable de cobre 12 AWG', category: 'Electricidad', unit: 'metro', purchasePrice: 4200, salePrice: 6000, minStock: 10, finalStock: 35 },
  { sku: 'FER-008', name: 'Tubo PVC 1/2 pulg. x 3 m', category: 'Plomería', unit: 'unidad', purchasePrice: 8800, salePrice: 13000, minStock: 6, finalStock: 4 },
  { sku: 'FER-009', name: 'Brocha de 3 pulgadas', category: 'Pinturas', unit: 'unidad', purchasePrice: 9500, salePrice: 14500, minStock: 4, finalStock: 16 },
  { sku: 'FER-010', name: 'Cinta aislante negra', category: 'Electricidad', unit: 'unidad', purchasePrice: 2800, salePrice: 4500, minStock: 5, finalStock: 2 },
];

const demoSale = [
  { sku: 'FER-001', quantity: 2 },
  { sku: 'FER-003', quantity: 4 },
  { sku: 'FER-004', quantity: 8 },
  { sku: 'FER-006', quantity: 7 },
  { sku: 'FER-007', quantity: 15 },
  { sku: 'FER-008', quantity: 8 },
];

async function insertDemoTransaction(client, { type, partyId, partyName, partyPhone, items, productsBySku }) {
  const partyColumn = type === 'purchase' ? 'supplier_id' : 'customer_id';
  const inserted = await client.query(`
    INSERT INTO transactions (type, ${partyColumn}, party_name, party_phone, notes, total)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [
    type,
    partyId,
    partyName,
    partyPhone,
    'Operación ficticia para demostración del sistema.',
    items.reduce((total, item) => {
      const product = productsBySku.get(item.sku);
      const price = type === 'purchase' ? product.purchasePrice : product.salePrice;
      return total + price * item.quantity;
    }, 0),
  ]);
  const transactionId = inserted.rows[0].id;

  for (const item of items) {
    const product = productsBySku.get(item.sku);
    const price = type === 'purchase' ? product.purchasePrice : product.salePrice;
    const movementType = type === 'purchase' ? 'entrada' : 'salida';
    await client.query(`
      INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [transactionId, product.id, product.name, item.quantity, price, price * item.quantity]);
    await client.query(`
      UPDATE products
      SET stock = stock ${type === 'purchase' ? '+' : '-'} $2, updated_at = NOW()
      WHERE id = $1
    `, [product.id, item.quantity]);
    await client.query(`
      INSERT INTO movements (product_id, type, quantity, reference, notes, transaction_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      product.id,
      movementType,
      item.quantity,
      `${type === 'purchase' ? 'Compra' : 'Venta'} · ${partyName}`,
      'Movimiento ficticio de demostración.',
      transactionId,
    ]);
  }
}

export async function seedDemoData(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [684217503]);
    const existingProducts = await client.query('SELECT EXISTS (SELECT 1 FROM products) AS has_products');
    if (existingProducts.rows[0].has_products) {
      await client.query('COMMIT');
      return false;
    }

    const productsBySku = new Map();
    for (const product of demoProducts) {
      const inserted = await client.query(`
        INSERT INTO products (sku, name, category, unit, purchase_price, sale_price, stock, min_stock)
        VALUES ($1, $2, $3, $4, $5, $6, 0, $7)
        RETURNING id
      `, [
        product.sku,
        product.name,
        product.category,
        product.unit,
        product.purchasePrice,
        product.salePrice,
        product.minStock,
      ]);
      productsBySku.set(product.sku, { ...product, id: inserted.rows[0].id });
    }

    const supplier = await client.query(`
      INSERT INTO suppliers (name, phone)
      VALUES ('Distribuidora Ferretera Demo', '3000000001')
      RETURNING id
    `);
    const customer = await client.query(`
      INSERT INTO customers (name, phone)
      VALUES ('Carlos Cliente Demo', '3000000002')
      RETURNING id
    `);

    const soldQuantities = new Map(demoSale.map((item) => [item.sku, item.quantity]));
    const purchaseItems = demoProducts.map((product) => ({
      sku: product.sku,
      quantity: product.finalStock + (soldQuantities.get(product.sku) || 0),
    }));

    await insertDemoTransaction(client, {
      type: 'purchase',
      partyId: supplier.rows[0].id,
      partyName: 'Distribuidora Ferretera Demo',
      partyPhone: '3000000001',
      items: purchaseItems,
      productsBySku,
    });
    await insertDemoTransaction(client, {
      type: 'sale',
      partyId: customer.rows[0].id,
      partyName: 'Carlos Cliente Demo',
      partyPhone: '3000000002',
      items: demoSale,
      productsBySku,
    });

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

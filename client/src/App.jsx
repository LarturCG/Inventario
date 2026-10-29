import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ArrowUpRight, Boxes,
  BriefcaseBusiness, Check, ChevronDown, CircleAlert, ClipboardList, Hammer,
  LayoutDashboard, LoaderCircle, Menu, PackagePlus, Plus, Search, ShoppingBag,
  ShoppingCart, SlidersHorizontal, Truck, X,
} from 'lucide-react';

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const navItems = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { id: 'products', label: 'Productos', icon: Boxes },
  { id: 'movements', label: 'Movimientos', icon: ArrowLeftRight },
  { id: 'transactions', label: 'Ventas y compras', icon: ShoppingBag },
];

async function request(path, options) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud.');
  return payload;
}

function App() {
  const [page, setPage] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overview, catalog, history, activity] = await Promise.all([
        request('/dashboard'),
        request('/products'),
        request('/transactions'),
        request('/movements'),
      ]);
      setDashboard(overview);
      setProducts(catalog);
      setTransactions(history);
      setMovements(activity);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.category].some((value) => value?.toLocaleLowerCase('es').includes(term)),
    );
  }, [products, search]);

  const completeAction = async (message) => {
    setModal(null);
    setNotice(message);
    await refresh();
    window.setTimeout(() => setNotice(''), 3500);
  };

  const archiveProduct = async (product) => {
    if (!window.confirm(`¿Archivar "${product.name}"? Se conservará su historial y dejará de aparecer en el catálogo.`)) return;
    setError('');
    try {
      await request(`/products/${product.id}`, { method: 'DELETE' });
      setNotice('Producto archivado. Su historial se conservó.');
      await refresh();
      window.setTimeout(() => setNotice(''), 3500);
    } catch (err) {
      setError(err.message);
    }
  };

  const navigate = (id) => {
    setPage(id);
    setSearch('');
    setMobileNav(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Hammer size={21} strokeWidth={2.4} /></span>
          <span><strong>ferro<span>stock</span></strong><small>CONTROL DE INVENTARIO</small></span>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <div className="store-chip"><span className="store-icon"><BriefcaseBusiness size={16} /></span><span><b>Mi ferretería</b><small>Panel de administración</small></span><ChevronDown size={15} /></div>
        <p className="nav-heading">MENÚ PRINCIPAL</p>
        <nav className="navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {id === 'products' && dashboard?.lowStockCount > 0 && <span className="nav-count">{dashboard.lowStockCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleAlert size={18} /></span><b>Un inventario ordenado</b><p>Registra cada entrada y venta para mantener tus existencias al día.</p></div>
          <div className="profile"><span className="avatar">F</span><span><b>Ferretería</b><small>Administrador</small></span><ChevronDown size={15} /></div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Cerrar menú" />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Ferretería</span><span className="crumb-slash">/</span><b>{navItems.find((item) => item.id === page)?.label}</b></div>
          <div className="topbar-right"><span className="live-dot" /> Inventario actualizado <span className="topbar-date">{new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date())}</span></div>
        </header>

        <div className="content">
          {error && <div className="alert alert-error"><CircleAlert size={17} />{error}<button onClick={refresh}>Reintentar</button></div>}
          {notice && <div className="alert alert-success"><Check size={17} />{notice}</div>}
          {loading && !dashboard ? <div className="loading-state"><LoaderCircle className="spin" size={27} />Cargando inventario…</div> : (
            <>
              {page === 'dashboard' && <Dashboard dashboard={dashboard} products={products} movements={movements} navigate={navigate} />}
              {page === 'products' && (
                <ProductsPage products={filteredProducts} search={search} setSearch={setSearch}
                  onAdd={() => setModal({ type: 'product' })}
                  onEdit={(product) => setModal({ type: 'product', product })}
                  onArchive={archiveProduct}
                  onMovement={() => setModal({ type: 'movement' })} />
              )}
              {page === 'movements' && <MovementsPage movements={movements} onAdd={() => setModal({ type: 'movement' })} />}
              {page === 'transactions' && (
                <TransactionsPage transactions={transactions}
                  onSale={() => setModal({ type: 'transaction', kind: 'sale' })}
                  onPurchase={() => setModal({ type: 'transaction', kind: 'purchase' })} />
              )}
            </>
          )}
        </div>
        <footer className="footer">FerroStock <span>·</span> Inventario claro, ferretería en marcha.</footer>
      </main>

      {modal && <Modal onClose={() => setModal(null)}>
        {modal.type === 'product' && <ProductForm product={modal.product} onCancel={() => setModal(null)}
          onSaved={() => completeAction(modal.product ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.')} />}
        {modal.type === 'movement' && <MovementForm products={products} onCancel={() => setModal(null)}
          onSaved={() => completeAction('Movimiento de inventario registrado.')} />}
        {modal.type === 'transaction' && <TransactionForm kind={modal.kind} products={products} onCancel={() => setModal(null)}
          onSaved={() => completeAction(modal.kind === 'sale' ? 'Venta registrada y stock actualizado.' : 'Compra registrada y stock actualizado.')} />}
      </Modal>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, actions }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div><div className="heading-actions">{actions}</div></div>;
}

function Dashboard({ dashboard, products, movements, navigate }) {
  if (!dashboard) return null;
  const cards = [
    { label: 'Productos registrados', value: dashboard.productCount, icon: Boxes, color: 'green', note: 'Productos activos en catálogo' },
    { label: 'Unidades en stock', value: dashboard.totalUnits.toLocaleString('es-CO'), icon: PackagePlus, color: 'blue', note: 'Existencias totales actuales' },
    { label: 'Por reabastecer', value: dashboard.lowStockCount, icon: CircleAlert, color: 'amber', note: 'Productos en nivel mínimo' },
    { label: 'Ventas del mes', value: money.format(Number(dashboard.monthSales)), icon: ShoppingCart, color: 'violet', note: 'Total vendido este mes' },
  ];
  return <>
    <PageHeading eyebrow="PANEL GENERAL" title="Resumen del inventario" description="Esto es lo que está pasando hoy en tu ferretería."
      actions={<button className="button button-primary" onClick={() => navigate('transactions')}><Plus size={17} /> Registrar operación</button>} />
    <section className="stat-grid">{cards.map(({ label, value, icon: Icon, color, note }) => <article className="stat-card" key={label}>
      <div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon size={18} /></span></div>
      <strong className="stat-value">{value}</strong><span className="stat-note">{note}</span>
    </article>)}</section>
    <section className="dashboard-grid">
      <article className="panel stock-panel">
        <div className="panel-heading"><div><h2>Stock por reabastecer</h2><p>Productos que llegaron a su nivel mínimo</p></div><button className="text-button" onClick={() => navigate('products')}>Ver productos <ArrowUpRight size={15} /></button></div>
        {dashboard.lowStock.length ? <div className="table-wrap"><table><thead><tr><th>PRODUCTO</th><th>CÓDIGO</th><th>STOCK ACTUAL</th><th>MÍNIMO</th><th>ESTADO</th></tr></thead><tbody>
          {dashboard.lowStock.map((item) => <tr key={item.id}><td><div className="product-cell"><span className="product-thumb"><Hammer size={16} /></span><b>{item.name}</b></div></td><td className="muted-cell">{item.sku}</td><td className="quantity-cell">{item.stock} {item.unit}</td><td className="muted-cell">{item.minStock} {item.unit}</td><td><span className="status-pill status-low">Stock bajo</span></td></tr>)}
        </tbody></table></div> : <EmptyState icon={Check} title="Todo bien por aquí" text="Ningún producto necesita reabastecimiento por ahora." />}
      </article>
      <article className="panel quick-panel">
        <div className="panel-heading"><div><h2>Accesos rápidos</h2><p>Las tareas más frecuentes</p></div></div>
        <div className="quick-actions">
          <button onClick={() => navigate('products')}><span className="quick-icon quick-green"><PackagePlus size={19} /></span><span><b>Agregar producto</b><small>Registra un artículo nuevo</small></span><ArrowUpRight size={16} /></button>
          <button onClick={() => navigate('transactions')}><span className="quick-icon quick-blue"><ShoppingCart size={19} /></span><span><b>Registrar una venta</b><small>Guarda cliente y productos</small></span><ArrowUpRight size={16} /></button>
          <button onClick={() => navigate('movements')}><span className="quick-icon quick-amber"><ArrowLeftRight size={19} /></span><span><b>Ajustar existencias</b><small>Registra entradas o salidas</small></span><ArrowUpRight size={16} /></button>
        </div>
        <div className="inventory-note"><span><SlidersHorizontal size={16} /></span><p><b>Valor del inventario</b><strong>{money.format(Number(dashboard.inventoryValue))}</strong><small>Calculado al costo de compra</small></p></div>
      </article>
    </section>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><h2>Actividad reciente</h2><p>Últimos movimientos del inventario</p></div><button className="text-button" onClick={() => navigate('movements')}>Ver movimientos <ArrowUpRight size={15} /></button></div>
      <MovementTable movements={movements.slice(0, 5)} />
    </section>
  </>;
}

function ProductsPage({ products, search, setSearch, onAdd, onEdit, onArchive, onMovement }) {
  return <>
    <PageHeading eyebrow="CATÁLOGO" title="Productos" description="Administra tus artículos, precios y niveles de existencias."
      actions={<><button className="button button-secondary" onClick={onMovement}><ArrowLeftRight size={17} /> Ajustar stock</button><button className="button button-primary" onClick={onAdd}><Plus size={17} /> Nuevo producto</button></>} />
    <section className="panel list-panel">
      <div className="list-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, código o categoría…" /></div><span className="result-count">{products.length} productos</span></div>
      <ProductTable products={products} onEdit={onEdit} onArchive={onArchive} />
    </section>
  </>;
}

function ProductTable({ products, onEdit, onArchive }) {
  if (!products.length) return <EmptyState icon={Boxes} title="Aún no hay productos" text="Agrega tu primer artículo para comenzar a controlar las existencias." />;
  return <div className="table-wrap"><table><thead><tr><th>PRODUCTO</th><th>CÓDIGO</th><th>CATEGORÍA</th><th>PRECIO VENTA</th><th>EXISTENCIAS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>
    {products.map((item) => {
      const low = Number(item.stock) <= Number(item.minStock);
      return <tr key={item.id}><td><div className="product-cell"><span className="product-thumb"><Hammer size={16} /></span><b>{item.name}</b></div></td><td className="muted-cell">{item.sku}</td><td className="muted-cell">{item.category || '—'}</td><td className="price-cell">{money.format(Number(item.salePrice))}</td><td className="quantity-cell">{item.stock} <span>{item.unit}</span></td><td><span className={`status-pill ${low ? 'status-low' : 'status-ok'}`}>{low ? 'Stock bajo' : 'Disponible'}</span></td><td><div className="row-actions"><button className="small-action" onClick={() => onEdit(item)}>Editar</button><button className="small-action small-action-danger" onClick={() => onArchive(item)}>Archivar</button></div></td></tr>;
    })}
  </tbody></table></div>;
}

function MovementsPage({ movements, onAdd }) {
  const [search, setSearch] = useState('');
  const filteredMovements = movements.filter((movement) =>
    [movement.productName, movement.reference, movement.notes, movement.type]
      .some((value) => value?.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))),
  );
  return <>
    <PageHeading eyebrow="TRAZABILIDAD" title="Movimientos de stock" description="Consulta entradas, salidas y ajustes registrados para cada producto."
      actions={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Registrar movimiento</button>} />
    <section className="panel list-panel"><div className="panel-heading panel-heading-inset"><div><h2>Historial de movimientos</h2><p>Cada movimiento conserva su motivo y fecha.</p></div><div className="movement-tools"><div className="search-box"><Search size={15} /><input aria-label="Filtrar movimientos" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar por producto o referencia…" /></div><span className="result-count">{filteredMovements.length} registros</span></div></div><MovementTable movements={filteredMovements} /></section>
  </>;
}

function MovementTable({ movements }) {
  if (!movements.length) return <EmptyState icon={ArrowLeftRight} title="Sin movimientos todavía" text="Las entradas, salidas y ventas aparecerán aquí." />;
  return <div className="table-wrap"><table><thead><tr><th>TIPO</th><th>PRODUCTO</th><th>CANTIDAD</th><th>REFERENCIA</th><th>FECHA</th></tr></thead><tbody>
    {movements.map((movement) => {
      const incoming = movement.type === 'entrada';
      return <tr key={movement.id}><td><span className={`movement-type ${incoming ? 'movement-in' : 'movement-out'}`}>{incoming ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{movement.type}</span></td><td><div className="product-cell"><span className="product-thumb"><Hammer size={16} /></span><b>{movement.productName}</b></div></td><td className={`quantity-cell ${incoming ? 'positive' : 'negative'}`}>{incoming ? '+' : '−'}{movement.quantity} <span>{movement.unit}</span></td><td className="muted-cell">{movement.reference || 'Movimiento manual'}</td><td className="muted-cell">{dateTime.format(new Date(movement.createdAt))}</td></tr>;
    })}
  </tbody></table></div>;
}

function TransactionsPage({ transactions, onSale, onPurchase }) {
  return <>
    <PageHeading eyebrow="OPERACIONES" title="Ventas y compras" description="Registra ventas a clientes y compras a proveedores con actualización automática del stock."
      actions={<><button className="button button-secondary" onClick={onPurchase}><Truck size={17} /> Registrar compra</button><button className="button button-primary" onClick={onSale}><Plus size={17} /> Registrar venta</button></>} />
    <section className="panel list-panel"><div className="panel-heading panel-heading-inset"><div><h2>Historial de operaciones</h2><p>Consulta qué se vendió, compró y a quién.</p></div><span className="result-count">{transactions.length} operaciones recientes</span></div>
      {!transactions.length ? <EmptyState icon={ClipboardList} title="Aún no hay operaciones" text="Registra una venta o una compra para iniciar el historial." /> :
        <div className="table-wrap"><table><thead><tr><th>OPERACIÓN</th><th>CLIENTE / PROVEEDOR</th><th>PRODUCTOS</th><th>TOTAL</th><th>FECHA</th></tr></thead><tbody>
          {transactions.map((item) => <tr key={item.id}><td><span className={`movement-type ${item.type === 'sale' ? 'movement-out' : 'movement-in'}`}>{item.type === 'sale' ? <ShoppingCart size={14} /> : <Truck size={14} />}{item.type === 'sale' ? 'Venta' : 'Compra'}</span></td><td><div className="party-cell"><b>{item.partyName}</b><small>{item.partyPhone || 'Sin teléfono'}</small></div></td><td><div className="transaction-products"><b>{item.itemCount} {Number(item.itemCount) === 1 ? 'artículo' : 'artículos'}</b><small>{item.items}</small></div></td><td className="price-cell">{money.format(Number(item.total))}</td><td className="muted-cell">{dateTime.format(new Date(item.createdAt))}</td></tr>)}
        </tbody></table></div>}
    </section>
  </>;
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty-state"><span><Icon size={22} /></span><b>{title}</b><p>{text}</p></div>;
}

function Modal({ children, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card">{children}</section></div>;
}

function FormHeader({ eyebrow, title, description, onClose }) {
  return <div className="form-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>;
}

function ProductForm({ product, onCancel, onSaved }) {
  const [form, setForm] = useState({
    sku: product?.sku || '', name: product?.name || '', category: product?.category || '',
    unit: product?.unit || 'unidad', purchasePrice: product?.purchasePrice || '',
    salePrice: product?.salePrice || '', minStock: product?.minStock || 0, initialStock: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { ...form, purchasePrice: Number(form.purchasePrice), salePrice: Number(form.salePrice), minStock: Number(form.minStock), initialStock: Number(form.initialStock || 0) };
      await request(product ? `/products/${product.id}` : '/products', { method: product ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <form onSubmit={submit}><FormHeader eyebrow="CATÁLOGO" title={product ? 'Editar producto' : 'Nuevo producto'} description="Completa la información básica del artículo." onClose={onCancel} />
    <div className="form-grid">
      <label className="field"><span>Nombre del producto *</span><input required maxLength="120" value={form.name} onChange={update('name')} placeholder="Ej. Taladro percutor" /></label>
      <label className="field"><span>Código / SKU *</span><input required maxLength="50" value={form.sku} onChange={update('sku')} placeholder="Ej. HERR-001" /></label>
      <label className="field"><span>Categoría</span><input maxLength="80" value={form.category} onChange={update('category')} placeholder="Ej. Herramientas eléctricas" /></label>
      <label className="field"><span>Unidad de medida *</span><select value={form.unit} onChange={update('unit')}><option value="unidad">Unidad</option><option value="caja">Caja</option><option value="metro">Metro</option><option value="kg">Kilogramo</option><option value="litro">Litro</option><option value="par">Par</option></select></label>
      <label className="field"><span>Precio de compra *</span><input required min="0" step="0.01" type="number" value={form.purchasePrice} onChange={update('purchasePrice')} placeholder="0" /></label>
      <label className="field"><span>Precio de venta *</span><input required min="0" step="0.01" type="number" value={form.salePrice} onChange={update('salePrice')} placeholder="0" /></label>
      <label className="field"><span>Stock mínimo *</span><input required min="0" step="1" type="number" value={form.minStock} onChange={update('minStock')} /></label>
      {!product && <label className="field"><span>Existencias iniciales</span><input min="0" step="1" type="number" value={form.initialStock} onChange={update('initialStock')} placeholder="0" /><small>Se guardarán como movimiento de apertura.</small></label>}
    </div>
    {error && <div className="form-error"><CircleAlert size={16} />{error}</div>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="spin" />}{product ? 'Guardar cambios' : 'Crear producto'}</button></div>
  </form>;
}

function MovementForm({ products, onCancel, onSaved }) {
  const [form, setForm] = useState({ productId: products[0]?.id || '', type: 'entrada', quantity: '', reference: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await request('/movements', { method: 'POST', body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) });
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <form onSubmit={submit}><FormHeader eyebrow="CONTROL DE STOCK" title="Registrar movimiento" description="Registra una entrada o salida manual de existencias." onClose={onCancel} />
    {products.length ? <div className="form-grid">
      <label className="field field-wide"><span>Producto *</span><select required value={form.productId} onChange={update('productId')}>{products.map((item) => <option key={item.id} value={item.id}>{item.name} · stock: {item.stock} {item.unit}</option>)}</select></label>
      <label className="field"><span>Tipo de movimiento *</span><select value={form.type} onChange={update('type')}><option value="entrada">Entrada de stock</option><option value="salida">Salida de stock</option></select></label>
      <label className="field"><span>Cantidad *</span><input required min="1" step="1" type="number" value={form.quantity} onChange={update('quantity')} placeholder="0" /></label>
      <label className="field"><span>Motivo / referencia</span><input maxLength="120" value={form.reference} onChange={update('reference')} placeholder="Ej. Devolución o pérdida" /></label>
      <label className="field"><span>Nota adicional</span><input maxLength="250" value={form.notes} onChange={update('notes')} placeholder="Detalle opcional" /></label>
    </div> : <EmptyState icon={Boxes} title="Primero agrega un producto" text="Necesitas un producto para poder registrar movimientos." />}
    {error && <div className="form-error"><CircleAlert size={16} />{error}</div>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button className="button button-primary" disabled={saving || !products.length}>{saving && <LoaderCircle size={16} className="spin" />}Guardar movimiento</button></div>
  </form>;
}

function TransactionForm({ kind, products, onCancel, onSaved }) {
  const sale = kind === 'sale';
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: products[0]?.id || '', quantity: 1 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const addLine = () => setItems((current) => [...current, { productId: products[0]?.id || '', quantity: 1 }]);
  const updateLine = (index, field, value) => setItems((current) => current.map((line, i) => i === index ? { ...line, [field]: value } : line));
  const removeLine = (index) => setItems((current) => current.length === 1 ? current : current.filter((_, i) => i !== index));
  const total = items.reduce((sum, line) => {
    const item = products.find((product) => product.id === line.productId);
    return sum + Number(line.quantity || 0) * Number(sale ? item?.salePrice || 0 : item?.purchasePrice || 0);
  }, 0);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await request('/transactions', { method: 'POST', body: JSON.stringify({ type: kind, partyName, partyPhone, notes, items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })) }) });
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <form onSubmit={submit}><FormHeader eyebrow="OPERACIÓN DE INVENTARIO" title={sale ? 'Registrar venta' : 'Registrar compra'} description={sale ? 'El stock se descontará al confirmar la venta.' : 'Los productos recibidos se sumarán al stock.'} onClose={onCancel} />
    {products.length ? <>
      <div className="form-grid">
        <label className="field"><span>{sale ? 'Nombre del cliente' : 'Nombre del proveedor'} *</span><input required maxLength="120" value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder={sale ? 'Ej. Carlos Rodríguez' : 'Ej. Distribuidora Central'} /></label>
        <label className="field"><span>Teléfono de contacto</span><input maxLength="40" value={partyPhone} onChange={(event) => setPartyPhone(event.target.value)} placeholder="Opcional" /></label>
      </div>
      <div className="line-items-heading"><b>Productos de la operación</b><span>Precio según catálogo</span></div>
      <div className="line-items">{items.map((line, index) => {
        const product = products.find((item) => item.id === line.productId);
        const price = Number(sale ? product?.salePrice || 0 : product?.purchasePrice || 0);
        return <div className="line-item" key={index}>
          <label className="field line-product"><span>Producto</span><select required value={line.productId} onChange={(event) => updateLine(index, 'productId', event.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.name} · stock {item.stock}</option>)}</select></label>
          <label className="field line-quantity"><span>Cantidad</span><input required min="1" step="1" type="number" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} /></label>
          <div className="line-subtotal"><span>Subtotal</span><b>{money.format(price * Number(line.quantity || 0))}</b></div>
          <button type="button" className="line-remove" onClick={() => removeLine(index)} disabled={items.length === 1} aria-label="Quitar producto"><X size={16} /></button>
        </div>;
      })}</div>
      <button type="button" className="add-line" onClick={addLine}><Plus size={15} /> Agregar otro producto</button>
      <label className="field notes-field"><span>Notas</span><input maxLength="250" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle opcional de la operación" /></label>
      <div className="transaction-total"><span>Total de la operación</span><b>{money.format(total)}</b></div>
    </> : <EmptyState icon={Boxes} title="Primero agrega un producto" text="Necesitas productos para registrar una venta o compra." />}
    {error && <div className="form-error"><CircleAlert size={16} />{error}</div>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button className="button button-primary" disabled={saving || !products.length}>{saving && <LoaderCircle size={16} className="spin" />}{sale ? 'Confirmar venta' : 'Confirmar compra'}</button></div>
  </form>;
}

export default App;

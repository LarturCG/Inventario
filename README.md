# FerroStock

Sistema sencillo de inventario para una ferretería. Incluye catálogo de productos, existencias y mínimos de stock, historial de entradas/salidas, registro de compras y ventas por cliente/proveedor y un resumen de ventas del mes. Está construido con React, Node.js, Express y PostgreSQL.

## Ejecutar con Docker

Requisitos: Docker Desktop o Docker Engine con Docker Compose.

1. Copia `.env.example` a `.env`.
2. Cambia `POSTGRES_PASSWORD` por una clave segura, especialmente antes de desplegar.
3. Desde la carpeta del proyecto, ejecuta:

   ```powershell
   docker compose up --build
   ```

4. Abre `http://localhost:8080`. La API queda disponible detrás de `/api` y PostgreSQL conserva los datos en el volumen `postgres_data`.

Para detener el sistema: `docker compose down`. Los datos persisten en el volumen. `docker compose down -v` también elimina el volumen y borra la base de datos; úsalo solo si quieres empezar de cero.

## Publicar gratis aplicación y base de datos en Render

El archivo [`render.yaml`](./render.yaml) configura la página, la API y una base de datos PostgreSQL en **una misma cuenta de Render**. No requiere Neon, Docker Desktop en tu PC ni mantener la computadora encendida una vez desplegado.

1. Sube el proyecto a un repositorio de GitHub. No subas `.env`; ya está excluido por `.gitignore`.
2. Crea una cuenta en [Render](https://render.com/).
3. En el panel elige **New → Blueprint**, conecta GitHub y selecciona el repositorio de FerroStock.
4. Render leerá `render.yaml` y mostrará los dos servicios que va a crear: la aplicación y la base de datos PostgreSQL. Revisa y confirma la creación con los planes **Free**.
5. Espera a que ambos servicios terminen de desplegarse y abre la dirección `onrender.com` de la aplicación.

Render configura la conexión a la base automáticamente y crea las tablas al iniciar la API. El despliegue empieza con un inventario vacío; no copia automáticamente los datos de tu computadora.

**Límites importantes del plan gratuito de Render:** la web se suspende tras 15 minutos sin visitas y puede tardar alrededor de un minuto en responder al volver a abrirla. La base PostgreSQL gratuita vence a los 30 días; después de su periodo de gracia, Render puede borrarla y perderás sus datos si no la actualizas. Comprueba los límites vigentes antes de desplegar.

**Es una demostración pública y sin autenticación.** Cualquier persona con el enlace puede modificar el inventario. Usa exclusivamente datos ficticios.

## Ejecutar para desarrollo

Necesitas Node.js 22 o superior y una instancia PostgreSQL disponible.

1. Configura la variable `DATABASE_URL`, por ejemplo:

   ```powershell
   $env:DATABASE_URL="postgres://ferrostock:tu-clave@localhost:5432/ferrostock"
   ```

2. En una terminal instala dependencias e inicia la API:

   ```powershell
   cd server
   npm install
   npm run dev
   ```

3. En otra terminal instala dependencias e inicia React:

   ```powershell
   cd client
   npm install
   npm run dev
   ```

4. Abre la dirección local que muestra Vite (normalmente `http://localhost:5173`).

## Qué incluye

- Alta y edición de productos con código único, categoría, unidad, costos y precio de venta.
- Registro de existencias iniciales, siempre trazadas como movimiento de apertura.
- Entradas y salidas manuales con referencia y nota; una salida no puede dejar stock negativo.
- Compras a proveedores y ventas a clientes, con varios productos por operación.
- Actualización atómica del stock y registro automático del movimiento de cada compra/venta.
- Búsqueda de productos, filtro de movimientos por producto, alertas por stock mínimo e historial reciente de operaciones con el detalle de los artículos vendidos o comprados.
- API JSON bajo `/api`; la base de datos crea sus tablas e índices al iniciar por primera vez.

## API principal

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/products`, `POST /api/products`, `PATCH /api/products/:id`
- `GET /api/movements`, `POST /api/movements`
- `GET /api/transactions`, `POST /api/transactions`

Las operaciones de venta/compra aceptan un tipo (`sale` o `purchase`), nombre de cliente/proveedor, teléfono opcional, notas e items con `productId` y `quantity`. Los precios se toman del catálogo y no del navegador.

## Antes de publicar

- Configura una contraseña robusta en `.env` y no publiques ese archivo.
- Esta versión no incluye inicio de sesión ni roles de usuario. En una demo pública, cualquiera puede modificar los datos; usa solo información ficticia. Para una tienda real, añade autenticación y autorización antes de publicarla.
- Usa HTTPS y restringe el acceso al servidor según las necesidades de la tienda.
- Configura copias de seguridad del volumen/base de datos y prueba su restauración.
- Los montos se muestran en pesos colombianos (COP); adapta el formato de moneda si tu tienda utiliza otra moneda.

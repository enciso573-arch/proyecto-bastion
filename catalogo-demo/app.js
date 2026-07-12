/* ============================================================
   PLATA & LUNA — Lógica del catálogo
   Vanilla JS (sin librerías): carga productos.json, pinta el
   catálogo, maneja el carrito en memoria y arma el link wa.me.
   ============================================================ */

/* ============================================================
   ⚙️ CONFIGURACIÓN — LO ÚNICO QUE HAY QUE CAMBIAR
   ------------------------------------------------------------
   📱 NÚMERO DE WHATSAPP DE LA DUEÑA (PLACEHOLDER — CAMBIAR):
   Formato internacional SIN "+", sin espacios ni guiones.
   México celular = 52 + 1 + número de 10 dígitos.
   Ejemplo real: "5215512345678"
   Nota: si productos.json trae "negocio.whatsapp", ese valor
   tiene prioridad (así el bot de Telegram podrá configurarlo).
   ============================================================ */
const WHATSAPP_FALLBACK = "521XXXXXXXXXX"; // ← ⚠️ PLACEHOLDER, reemplazar

// Orden y etiquetas bonitas de las categorías
const CATEGORIAS = {
  pulseras: "Pulseras",
  collares: "Collares",
  aretes: "Aretes",
};

// ------------------------------------------------------------
// ESTADO EN MEMORIA
// "estado" vive solo mientras la página está abierta.
// Si se recarga, el carrito se vacía (a propósito: simple).
// ------------------------------------------------------------
const estado = {
  productos: [],          // catálogo cargado desde productos.json
  whatsapp: WHATSAPP_FALLBACK,
  carrito: new Map(),     // Map: id del producto → cantidad
  filtro: "todas",
};

// Accesos rápidos a elementos del HTML
const $ = (sel) => document.querySelector(sel);
const elCatalogo = $("#catalogo");
const elCarrito = $("#carrito");
const elOverlay = $("#overlay");
const elItems = $("#carrito-items");
const elTotal = $("#carrito-total");
const elContador = $("#contador-carrito");
const elFinalizar = $("#btn-finalizar");

// ============================================================
// 1) CARGA DE DATOS
// fetch() pide productos.json al servidor. Si abres el archivo
// con doble clic (file://) el navegador bloquea fetch por
// seguridad; en ese caso usamos datos de respaldo para que el
// prototipo siempre se vea. En GitHub Pages funciona el JSON.
// ============================================================
async function cargarProductos() {
  try {
    const respuesta = await fetch("productos.json", { cache: "no-store" });
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    const datos = await respuesta.json();
    estado.productos = datos.productos.filter((p) => p.disponible !== false);
    if (datos.negocio) {
      if (datos.negocio.whatsapp) estado.whatsapp = datos.negocio.whatsapp;
      if (datos.negocio.nombre) $("#nombre-negocio").textContent = datos.negocio.nombre;
      if (datos.negocio.eslogan) $("#eslogan-negocio").textContent = datos.negocio.eslogan;
    }
  } catch (err) {
    console.warn("No se pudo leer productos.json (¿abriste con file://?). Usando datos de respaldo.", err);
    estado.productos = DATOS_RESPALDO;
  }
  pintarCatalogo();
}

// ============================================================
// 2) IMÁGENES PLACEHOLDER (SVG con degradado)
// Mientras no haya fotos reales, generamos una imagen SVG
// elegante por categoría, convertida a data-URI (una "URL"
// que contiene la imagen adentro, sin archivos externos).
// Cuando el bot de Telegram suba fotos reales, solo llenará
// el campo "imagen" del JSON y esto deja de usarse.
// ============================================================
const ICONOS = {
  pulseras:
    '<circle cx="100" cy="105" r="38" fill="none" stroke="#e8eaf1" stroke-width="5" opacity="0.9"/><circle cx="100" cy="105" r="38" fill="none" stroke="#9aa0b4" stroke-width="1.5" stroke-dasharray="4 6" transform="rotate(20 100 105)"/><circle cx="100" cy="67" r="6" fill="#f4f5f9"/>',
  collares:
    '<path d="M55 70 Q100 135 145 70" fill="none" stroke="#e8eaf1" stroke-width="4.5" opacity="0.9"/><path d="M55 70 Q100 128 145 70" fill="none" stroke="#9aa0b4" stroke-width="1.2" stroke-dasharray="3 5"/><path d="M100 118 l9 12 -9 16 -9 -16 z" fill="#f4f5f9"/>',
  aretes:
    '<circle cx="76" cy="72" r="9" fill="none" stroke="#e8eaf1" stroke-width="4"/><path d="M76 81 q-7 22 0 34" stroke="#e8eaf1" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="124" cy="72" r="9" fill="none" stroke="#e8eaf1" stroke-width="4"/><path d="M124 81 q7 22 0 34" stroke="#e8eaf1" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="76" cy="120" r="4.5" fill="#f4f5f9"/><circle cx="124" cy="120" r="4.5" fill="#f4f5f9"/>',
};

const DEGRADADOS = {
  pulseras: ["#42465a", "#181a22"],
  collares: ["#3a4152", "#14161d"],
  aretes: ["#4a4658", "#1a1720"],
};

function imagenPlaceholder(categoria) {
  const [c1, c2] = DEGRADADOS[categoria] || ["#3d3d4a", "#16161d"];
  const icono = ICONOS[categoria] || "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </linearGradient>
      <radialGradient id="brillo" cx="0.3" cy="0.25" r="0.9">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <rect width="200" height="200" fill="url(#brillo)"/>
    ${icono}
    <text x="100" y="172" text-anchor="middle" font-family="Georgia, serif" font-size="11"
      fill="#aab0c2" letter-spacing="3">PLATA .925</text>
  </svg>`;
  // encodeURIComponent convierte el SVG en texto seguro para usarlo como URL
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function urlImagen(producto) {
  return producto.imagen && producto.imagen.trim() !== ""
    ? producto.imagen
    : imagenPlaceholder(producto.categoria);
}

// ============================================================
// 3) PINTAR EL CATÁLOGO
// Recorremos las categorías y creamos el HTML de cada tarjeta.
// ============================================================
const formatoPrecio = new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN", maximumFractionDigits: 0,
});

function pintarCatalogo() {
  elCatalogo.innerHTML = "";

  const categoriasAMostrar =
    estado.filtro === "todas" ? Object.keys(CATEGORIAS) : [estado.filtro];

  for (const cat of categoriasAMostrar) {
    const productos = estado.productos.filter((p) => p.categoria === cat);
    if (productos.length === 0) continue;

    const seccion = document.createElement("section");
    seccion.innerHTML = `<h2 class="categoria__titulo">${CATEGORIAS[cat]}</h2>`;

    const grid = document.createElement("div");
    grid.className = "grid";

    for (const p of productos) {
      const tarjeta = document.createElement("article");
      tarjeta.className = "tarjeta";
      tarjeta.innerHTML = `
        <img class="tarjeta__imagen" src="${urlImagen(p)}" alt="${p.nombre}" loading="lazy">
        <div class="tarjeta__cuerpo">
          <h3 class="tarjeta__nombre">${p.nombre}</h3>
          <p class="tarjeta__descripcion">${p.descripcion}</p>
          <div class="tarjeta__pie">
            <span class="tarjeta__precio">${formatoPrecio.format(p.precio)}</span>
            <button class="tarjeta__agregar" data-id="${p.id}">Agregar</button>
          </div>
        </div>`;
      grid.appendChild(tarjeta);
    }

    seccion.appendChild(grid);
    elCatalogo.appendChild(seccion);
  }
}

// Delegación de eventos: un solo listener en el catálogo atiende
// los clics de TODOS los botones "Agregar" (más eficiente que
// poner un listener por botón).
elCatalogo.addEventListener("click", (e) => {
  const btn = e.target.closest(".tarjeta__agregar");
  if (!btn) return;
  agregarAlCarrito(btn.dataset.id);
  // Pequeña confirmación visual en el botón
  btn.textContent = "✓ Agregado";
  btn.classList.add("tarjeta__agregar--listo");
  setTimeout(() => {
    btn.textContent = "Agregar";
    btn.classList.remove("tarjeta__agregar--listo");
  }, 900);
});

// ============================================================
// 4) FILTROS DE CATEGORÍA
// ============================================================
$("#filtros").addEventListener("click", (e) => {
  const btn = e.target.closest(".filtros__btn");
  if (!btn) return;
  estado.filtro = btn.dataset.categoria;
  document.querySelectorAll(".filtros__btn").forEach((b) =>
    b.classList.toggle("filtros__btn--activo", b === btn)
  );
  pintarCatalogo();
});

// ============================================================
// 5) CARRITO EN MEMORIA
// Un Map guarda { idProducto → cantidad }. Todo se recalcula
// a partir de ahí: lista, total y contador.
// ============================================================
function agregarAlCarrito(id) {
  estado.carrito.set(id, (estado.carrito.get(id) || 0) + 1);
  pintarCarrito();
}

function cambiarCantidad(id, delta) {
  const nueva = (estado.carrito.get(id) || 0) + delta;
  if (nueva <= 0) estado.carrito.delete(id);
  else estado.carrito.set(id, nueva);
  pintarCarrito();
}

function obtenerLineasPedido() {
  // Convierte el Map en una lista de {producto, cantidad, subtotal}
  const lineas = [];
  for (const [id, cantidad] of estado.carrito) {
    const producto = estado.productos.find((p) => p.id === id);
    if (producto) lineas.push({ producto, cantidad, subtotal: producto.precio * cantidad });
  }
  return lineas;
}

function pintarCarrito() {
  const lineas = obtenerLineasPedido();
  const totalPiezas = lineas.reduce((n, l) => n + l.cantidad, 0);
  const totalPesos = lineas.reduce((n, l) => n + l.subtotal, 0);

  // Contador del botón del header
  elContador.hidden = totalPiezas === 0;
  elContador.textContent = totalPiezas;

  // Lista de items
  if (lineas.length === 0) {
    elItems.innerHTML = `<p class="carrito__vacio">Tu carrito está vacío. ¡Agrega algo bonito! ✨</p>`;
  } else {
    elItems.innerHTML = lineas.map(({ producto: p, cantidad }) => `
      <div class="item">
        <img class="item__imagen" src="${urlImagen(p)}" alt="">
        <div class="item__info">
          <div class="item__nombre">${p.nombre}</div>
          <div class="item__precio">${formatoPrecio.format(p.precio)} c/u</div>
        </div>
        <div class="item__controles">
          <button class="item__btn" data-accion="menos" data-id="${p.id}" aria-label="Quitar uno">−</button>
          <span class="item__cantidad">${cantidad}</span>
          <button class="item__btn" data-accion="mas" data-id="${p.id}" aria-label="Agregar uno">+</button>
        </div>
      </div>`).join("");
  }

  elTotal.textContent = formatoPrecio.format(totalPesos);
  elFinalizar.disabled = lineas.length === 0;
}

// Botones + / − dentro del carrito (delegación de eventos otra vez)
elItems.addEventListener("click", (e) => {
  const btn = e.target.closest(".item__btn");
  if (!btn) return;
  cambiarCantidad(btn.dataset.id, btn.dataset.accion === "mas" ? 1 : -1);
});

// ============================================================
// 6) ABRIR / CERRAR EL PANEL DEL CARRITO
// ============================================================
function alternarCarrito(abrir) {
  elCarrito.classList.toggle("carrito--abierto", abrir);
  elOverlay.hidden = !abrir;
  document.body.style.overflow = abrir ? "hidden" : ""; // evita scroll de fondo
}

$("#btn-carrito").addEventListener("click", () => alternarCarrito(true));
$("#btn-cerrar-carrito").addEventListener("click", () => alternarCarrito(false));
elOverlay.addEventListener("click", () => alternarCarrito(false));

// ============================================================
// 7) FINALIZAR PEDIDO → LINK DE WHATSAPP (wa.me)
// wa.me es un servicio oficial de WhatsApp: al abrir
// https://wa.me/NUMERO?text=MENSAJE se abre un chat con ese
// número y el mensaje ya escrito (el cliente solo da "enviar").
// encodeURIComponent convierte saltos de línea, acentos y
// emojis en texto válido para una URL.
// ============================================================
function construirMensaje() {
  const lineas = obtenerLineasPedido();
  const total = lineas.reduce((n, l) => n + l.subtotal, 0);

  let msg = "¡Hola! 🌙 Quiero hacer un pedido del catálogo Plata & Luna:\n\n";
  for (const { producto: p, cantidad, subtotal } of lineas) {
    msg += `• ${cantidad} × ${p.nombre} — ${formatoPrecio.format(subtotal)}\n`;
  }
  msg += `\n*Total estimado: ${formatoPrecio.format(total)}*\n\n`;
  msg += "¿Me confirmas disponibilidad y forma de entrega? ¡Gracias!";
  return msg;
}

elFinalizar.addEventListener("click", () => {
  if (estado.carrito.size === 0) return;

  if (estado.whatsapp.includes("X")) {
    alert("⚠️ Falta configurar el número de WhatsApp de la vendedora.\n(Edita 'whatsapp' en productos.json o WHATSAPP_FALLBACK en app.js)");
  }

  const url = `https://wa.me/${estado.whatsapp}?text=${encodeURIComponent(construirMensaje())}`;
  // "_blank" abre WhatsApp en pestaña/app nueva sin perder el catálogo
  window.open(url, "_blank");
});

// ============================================================
// 8) DATOS DE RESPALDO
// Copia mínima del catálogo para cuando fetch() no puede leer
// productos.json (por ejemplo, al abrir el archivo con doble
// clic). En producción (GitHub Pages) siempre manda el JSON.
// ============================================================
const DATOS_RESPALDO = [
  { id: "pul-001", categoria: "pulseras", nombre: "Pulsera Trenzada Clásica", descripcion: "Pulsera de plata .925 con tejido trenzado, cierre de gancho.", precio: 380 },
  { id: "pul-002", categoria: "pulseras", nombre: "Pulsera de Corazones", descripcion: "Eslabones en forma de corazón, plata .925. Ideal para regalo.", precio: 450 },
  { id: "col-001", categoria: "collares", nombre: "Collar Gota de Luna", descripcion: "Dije de gota con circonia, cadena de 45 cm en plata .925.", precio: 650 },
  { id: "col-002", categoria: "collares", nombre: "Cadena Veneciana 50 cm", descripcion: "Cadena veneciana clásica, brillo intenso, cierre reforzado.", precio: 580 },
  { id: "are-001", categoria: "aretes", nombre: "Aretes Huggie con Zirconias", descripcion: "Arracadas pequeñas con línea de zirconias.", precio: 320 },
  { id: "are-002", categoria: "aretes", nombre: "Broqueles de Estrella", descripcion: "Broqueles en forma de estrella, poste hipoalergénico.", precio: 250 },
];

// 🚀 Arranque
cargarProductos();

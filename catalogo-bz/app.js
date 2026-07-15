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
  anillos: "Anillos",
  arracadas: "Arracadas",
  dijes: "Dijes y charms",
  collares: "Collares y cadenas",
  pulseras: "Pulseras",
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
  credito: null,          // config de pagos semanales (productos.json → negocio.credito)
  modalidad: "contado",   // "contado" | "semanal"
  semanas: null,          // semanas elegidas para el plan
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
    // ---- VISTA PREVIA del panel de administración ----
    // Si la URL trae ?previa y el panel dejó un borrador guardado
    // en este navegador, se muestra ESE borrador en lugar del JSON
    // publicado. Nada viaja a internet: es un ensayo local.
    let datos;
    const esPrevia = new URLSearchParams(location.search).has("previa");
    const borrador = esPrevia ? localStorage.getItem("bz_borrador") : null;
    if (borrador) {
      datos = JSON.parse(borrador);
      mostrarBannerPrevia();
    } else {
      const respuesta = await fetch("productos.json", { cache: "no-store" });
      if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
      datos = await respuesta.json();
    }
    estado.productos = datos.productos.filter((p) => p.disponible !== false);
    if (datos.negocio) {
      if (datos.negocio.whatsapp) estado.whatsapp = datos.negocio.whatsapp;
      if (datos.negocio.nombre) $("#nombre-negocio").textContent = datos.negocio.nombre;
      if (datos.negocio.eslogan) $("#eslogan-negocio").textContent = datos.negocio.eslogan;
      configurarCredito(datos.negocio.credito);
    }
  } catch (err) {
    console.warn("No se pudo leer productos.json (¿abriste con file://?). Usando datos de respaldo.", err);
    estado.productos = DATOS_RESPALDO;
  }
  pintarCatalogo();
}

// Barrita fija que avisa que estás viendo un ensayo, no la página real
function mostrarBannerPrevia() {
  const b = document.createElement("div");
  b.textContent = "Vista previa — estos cambios aún no están publicados";
  b.style.cssText = "position:sticky;top:0;z-index:200;text-align:center;font-size:.75rem;" +
    "letter-spacing:.08em;padding:.45rem .8rem;background:#2E2B26;color:#F2E7CF;";
  document.body.prepend(b);
}

// ============================================================
// 2) IMÁGENES PLACEHOLDER (SVG con degradado)
// Mientras no haya fotos reales, generamos una imagen SVG
// elegante por categoría, convertida a data-URI (una "URL"
// que contiene la imagen adentro, sin archivos externos).
// Cuando el bot de Telegram suba fotos reales, solo llenará
// el campo "imagen" del JSON y esto deja de usarse.
// ============================================================
/* Tema claro: trazos en plata media (#A7ACB8 / #82889A) que resaltan
   sobre los fondos marfil/arena; los "brillos" de gema en blanco puro. */
const ICONOS = {
  pulseras:
    '<circle cx="100" cy="105" r="38" fill="none" stroke="#A7ACB8" stroke-width="5" opacity="0.9"/><circle cx="100" cy="105" r="38" fill="none" stroke="#82889A" stroke-width="1.5" stroke-dasharray="4 6" transform="rotate(20 100 105)"/><circle cx="100" cy="67" r="6" fill="#FFFFFF"/>',
  collares:
    '<path d="M55 70 Q100 135 145 70" fill="none" stroke="#A7ACB8" stroke-width="4.5" opacity="0.9"/><path d="M55 70 Q100 128 145 70" fill="none" stroke="#82889A" stroke-width="1.2" stroke-dasharray="3 5"/><path d="M100 118 l9 12 -9 16 -9 -16 z" fill="#FFFFFF"/>',
  aretes:
    '<circle cx="76" cy="72" r="9" fill="none" stroke="#A7ACB8" stroke-width="4"/><path d="M76 81 q-7 22 0 34" stroke="#A7ACB8" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="124" cy="72" r="9" fill="none" stroke="#A7ACB8" stroke-width="4"/><path d="M124 81 q7 22 0 34" stroke="#A7ACB8" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="76" cy="120" r="4.5" fill="#FFFFFF"/><circle cx="124" cy="120" r="4.5" fill="#FFFFFF"/>',
};

/* Fondos por categoría: arrancan casi blancos (como el fondo de la
   página) y bajan a beige arena — así la "foto" se ve iluminada
   arriba y se funde con el cuerpo beige de la card abajo. */
const DEGRADADOS = {
  pulseras: ["#FDFAF2", "#E9DCC2"],
  collares: ["#FEFCF6", "#ECE1CB"],
  aretes: ["#FCF8EF", "#E7D8BE"],
};

function imagenPlaceholder(categoria) {
  const [c1, c2] = DEGRADADOS[categoria] || ["#FDFAF2", "#E8DAC0"];
  const icono = ICONOS[categoria] || "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </linearGradient>
      <radialGradient id="brillo" cx="0.3" cy="0.25" r="0.9">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <rect width="200" height="200" fill="url(#brillo)"/>
    ${icono}
    <text x="100" y="172" text-anchor="middle" font-family="Georgia, serif" font-size="11"
      fill="#9C8654" letter-spacing="3">PLATA .925</text>
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
      // Campos OPCIONALES del panel de administración:
      // - stock: si existe y llega a 0, la pieza se muestra "Agotado".
      // - precioAntes: si existe y es mayor, se pinta tachado (promoción).
      const agotado = typeof p.stock === "number" && p.stock <= 0;
      const enPromo = typeof p.precioAntes === "number" && p.precioAntes > p.precio;

      const htmlPrecio = enPromo
        ? `<span class="tarjeta__precio"><s class="tarjeta__antes">${formatoPrecio.format(p.precioAntes)}</s> ${formatoPrecio.format(p.precio)}</span>`
        : `<span class="tarjeta__precio">${formatoPrecio.format(p.precio)}</span>`;

      const htmlBoton = agotado
        ? `<button class="tarjeta__agregar" disabled>Agotado</button>`
        : `<button class="tarjeta__agregar" data-id="${p.id}">Agregar</button>`;

      const tarjeta = document.createElement("article");
      tarjeta.className = "tarjeta";
      tarjeta.innerHTML = `
        ${enPromo ? '<span class="tarjeta__promo">Oferta</span>' : ""}
        <img class="tarjeta__imagen" src="${urlImagen(p)}" alt="${p.nombre}" loading="lazy">
        <div class="tarjeta__cuerpo">
          <h3 class="tarjeta__nombre">${p.nombre}</h3>
          <p class="tarjeta__descripcion">${p.descripcion}</p>
          <div class="tarjeta__pie">
            ${htmlPrecio}
            ${htmlBoton}
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

  actualizarModalidad(totalPesos);
}

// Botones + / − dentro del carrito (delegación de eventos otra vez)
elItems.addEventListener("click", (e) => {
  const btn = e.target.closest(".item__btn");
  if (!btn) return;
  cambiarCantidad(btn.dataset.id, btn.dataset.accion === "mas" ? 1 : -1);
});

// ============================================================
// 5b) PAGOS SEMANALES (crédito de palabra, sin pasarela)
// Se configura en productos.json → negocio.credito:
//   habilitado (true/false), semanas [4,6,8], montoMinimo,
//   mensajeBanner. Aquí NO se valida crédito ni se cobra:
//   solo se calcula un estimado y se informa en el WhatsApp;
//   la dueña cierra el trato en el chat.
// ============================================================
function configurarCredito(cfg) {
  if (!cfg || cfg.habilitado === false) return;
  estado.credito = {
    semanas: Array.isArray(cfg.semanas) && cfg.semanas.length ? cfg.semanas : [4, 6, 8],
    montoMinimo: Number(cfg.montoMinimo) || 0,
  };
  estado.semanas = estado.credito.semanas[0];
  $("#banner-credito").hidden = false;
  if (cfg.mensajeBanner) $("#banner-credito-texto").textContent = cfg.mensajeBanner;
  $("#modalidad").hidden = false;
}

function seleccionarModalidad(m) {
  estado.modalidad = m;
  document.querySelectorAll(".modalidad__btn").forEach((b) =>
    b.classList.toggle("modalidad__btn--activo", b.dataset.modalidad === m)
  );
  pintarCarrito();
}

function actualizarModalidad(total) {
  if (!estado.credito) return;
  const btnSemanal = document.querySelector('.modalidad__btn[data-modalidad="semanal"]');
  const elPlan = $("#modalidad-plan");
  const elMinimo = $("#modalidad-minimo");
  const bajoMinimo = total > 0 && total < estado.credito.montoMinimo;

  btnSemanal.disabled = bajoMinimo || total === 0;
  elMinimo.hidden = !bajoMinimo;
  if (bajoMinimo) {
    elMinimo.textContent =
      `El plan de pagos semanales aplica en compras desde ${formatoPrecio.format(estado.credito.montoMinimo)}.`;
    if (estado.modalidad === "semanal") { seleccionarModalidad("contado"); return; }
  }

  const mostrarPlan = estado.modalidad === "semanal" && !bajoMinimo && total > 0;
  elPlan.hidden = !mostrarPlan;
  if (mostrarPlan) {
    $("#modalidad-semanas").innerHTML = estado.credito.semanas.map((n) =>
      `<button class="semana-chip${n === estado.semanas ? " semana-chip--activa" : ""}" data-semanas="${n}">${n} sem</button>`
    ).join("");
    const cuota = Math.ceil(total / estado.semanas);
    $("#modalidad-estimado").innerHTML =
      `${estado.semanas} pagos semanales de aprox. <strong>${formatoPrecio.format(cuota)}</strong>`;
  }
}

// Clics en el selector de modalidad y en los chips de semanas
$("#modalidad").addEventListener("click", (e) => {
  const btn = e.target.closest(".modalidad__btn");
  if (btn && !btn.disabled) { seleccionarModalidad(btn.dataset.modalidad); return; }
  const chip = e.target.closest(".semana-chip");
  if (chip) { estado.semanas = Number(chip.dataset.semanas); pintarCarrito(); }
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
  msg += `\n*Total estimado: ${formatoPrecio.format(total)}*\n`;

  // Modalidad elegida — para que la vendedora cierre el trato en el chat
  if (estado.modalidad === "semanal" && estado.credito && estado.semanas) {
    const cuota = Math.ceil(total / estado.semanas);
    msg += `Modalidad: pagos semanales — ${estado.semanas} semanas de aprox. ${formatoPrecio.format(cuota)} 📅\n`;
    msg += "(Es un estimado del catálogo; ¿me confirmas el plan y las fechas?)\n\n";
  } else {
    msg += "Modalidad: pago de contado\n\n";
  }

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
  { id: "an-001", categoria: "anillos", nombre: "Anillo Churumbela Completa", descripcion: "Churumbela completa en plata .925, brillo continuo.", precio: 300 },
  { id: "ar-001", categoria: "arracadas", nombre: "Arracadas Mickey y Minnie", descripcion: "Arracadas de plata .925 con silueta divertida.", precio: 180 },
];

// 🚀 Arranque del catálogo
cargarProductos();

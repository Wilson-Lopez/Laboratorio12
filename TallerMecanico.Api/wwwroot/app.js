// Panel del taller. Consume la API del mismo sitio con fetch, por eso no depende de CORS.
// Los datos se insertan siempre como texto (nunca con innerHTML) para evitar inyección de código.

const $ = (selector, raiz = document) => raiz.querySelector(selector);
const SVG = 'http://www.w3.org/2000/svg';

class ErrorApi extends Error {
  constructor(codigo, cuerpo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
    this.cuerpo = cuerpo;
  }
}

async function pedir(ruta, { metodo = 'GET', datos } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: datos ? { 'Content-Type': 'application/json' } : undefined,
      body: datos ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw new ErrorApi(0, null, 'No se pudo conectar con la API. Revisa tu conexión e inténtalo de nuevo.');
  }

  if (respuesta.status === 204) return null;

  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, cuerpo, cuerpo?.mensaje ?? cuerpo?.title ?? 'Ocurrió un error inesperado.');
  }
  return cuerpo;
}

// --- Utilidades de interfaz ---

function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (nombre.startsWith('on')) nodo[nombre] = valor;
    else nodo.setAttribute(nombre, valor);
  }
  nodo.append(...hijos);
  return nodo;
}

function icono(nombre) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('aria-hidden', 'true');
  const uso = document.createElementNS(SVG, 'use');
  uso.setAttribute('href', `#i-${nombre}`);
  svg.append(uso);
  return svg;
}

function avisar(mensaje, tipo = 'exito') {
  const toast = el('div', { class: `toast toast--${tipo}` }, icono(tipo === 'exito' ? 'listo' : 'alerta'), el('span', {}, mensaje));
  const avisos = $('#avisos');
  avisos.append(toast);
  // Si se acumulan, se quita el más antiguo para no tapar la tabla
  if (avisos.children.length > 3) avisos.firstElementChild.remove();
  setTimeout(() => toast.remove(), 4000);
}

function mostrarEstadoApi(estado, texto) {
  const indicador = $('#estado-api');
  indicador.dataset.estado = estado;
  indicador.textContent = texto;
}

function mostrarCargando(cuerpo, columnas) {
  cuerpo.replaceChildren(...Array.from({ length: 4 }, () =>
    el('tr', { class: 'fila-esqueleto' }, ...Array.from({ length: columnas }, () =>
      el('td', {}, el('span', { class: 'esqueleto' }))))));
}

function mostrarMensaje(cuerpo, columnas, titulo, detalle, accion) {
  const contenido = el('div', { class: 'estado-vacio' },
    el('p', { class: 'estado-vacio__titulo' }, titulo),
    el('p', { class: 'estado-vacio__detalle' }, detalle));
  if (accion) {
    contenido.append(el('button', { class: 'boton boton--secundario', type: 'button', onclick: accion.alPulsar }, accion.texto));
  }
  cuerpo.replaceChildren(el('tr', { class: 'fila-estado' }, el('td', { colspan: columnas }, contenido)));
}

function botonAccion(nombreIcono, etiqueta, alPulsar, clase = '') {
  return el('button', { class: `boton-icono ${clase}`, type: 'button', title: etiqueta, 'aria-label': etiqueta, onclick: alPulsar }, icono(nombreIcono));
}

const formatoNumero = new Intl.NumberFormat('es-PE');
const sinAcentos = (texto) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const etiquetaVehiculos = (n) => (n === 0 ? 'Sin vehículos' : n === 1 ? '1 vehículo' : `${n} vehículos`);

// --- Formularios y errores de la API ---

function limpiarErrores(formulario) {
  const aviso = $('.aviso', formulario);
  aviso.hidden = true;
  aviso.replaceChildren();
  formulario.querySelectorAll('.campo__error').forEach((error) => error.remove());
  formulario.querySelectorAll('[aria-invalid]').forEach((campo) => {
    campo.removeAttribute('aria-invalid');
    campo.removeAttribute('aria-describedby');
  });
}

function mostrarAviso(contenedor, mensaje) {
  const aviso = $('.aviso', contenedor);
  aviso.replaceChildren(icono('alerta'), el('span', {}, mensaje));
  aviso.hidden = false;
}

// Coloca cada error junto a su campo. Las claves llegan como "Dni" o "$.anio" según qué los generó.
function mostrarErrores(formulario, errores) {
  const campos = [...formulario.elements].filter((campo) => campo.name);
  const sueltos = [];

  for (const [clave, mensajes] of Object.entries(errores)) {
    const nombre = clave.replace(/^\$\./, '').toLowerCase();
    const campo = campos.find((c) => c.name.toLowerCase() === nombre);
    if (!campo) {
      sueltos.push(...mensajes);
      continue;
    }
    const idError = `${campo.id}-error`;
    campo.setAttribute('aria-invalid', 'true');
    campo.setAttribute('aria-describedby', idError);
    // Basta con el primero: un DNI vacío, por ejemplo, incumple también la longitud
    campo.closest('.campo').append(el('p', { class: 'campo__error', id: idError }, mensajes[0]));
  }

  if (sueltos.length) mostrarAviso(formulario, sueltos.join(' '));
  // La API ordena los errores por nombre; el foco va al primero según el orden del formulario
  campos.find((campo) => campo.hasAttribute('aria-invalid'))?.focus();
}

async function enviarFormulario(formulario, operacion, mensajeExito) {
  limpiarErrores(formulario);
  const boton = $('[type="submit"]', formulario);
  boton.disabled = true;
  boton.textContent = 'Guardando…';

  try {
    await operacion();
    formulario.closest('dialog').close();
    avisar(mensajeExito);
    await actualizarTodo();
  } catch (error) {
    if (error.cuerpo?.errors) mostrarErrores(formulario, error.cuerpo.errors);
    else mostrarAviso(formulario, error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }
}

// --- Clientes ---

const estado = { clientes: [], conteoPorCliente: new Map() };
const filasClientes = $('#filas-clientes');

function pintarClientes() {
  const texto = sinAcentos($('#buscar-cliente').value.trim());
  const visibles = estado.clientes.filter((c) => !texto || sinAcentos(`${c.nombres} ${c.dni}`).includes(texto));

  if (estado.clientes.length === 0) {
    mostrarMensaje(filasClientes, 5, 'Aún no hay clientes', 'Registra el primero para empezar.');
    return;
  }
  if (visibles.length === 0) {
    mostrarMensaje(filasClientes, 5, 'Sin resultados', 'Ningún cliente coincide con tu búsqueda.');
    return;
  }

  filasClientes.replaceChildren(...visibles.map((cliente) => {
    const cantidad = estado.conteoPorCliente.get(cliente.id) ?? 0;
    return el('tr', {},
      el('td', { class: 'celda-principal' },
        el('div', { class: 'titulo-fila' }, cliente.nombres),
        el('div', { class: 'subtitulo-fila' }, cliente.correo ?? 'Sin correo')),
      el('td', { class: 'dato-fijo', 'data-etiqueta': 'DNI' }, cliente.dni),
      el('td', { class: 'dato-fijo', 'data-etiqueta': 'Teléfono' }, cliente.telefono),
      el('td', { 'data-etiqueta': 'Vehículos' },
        el('button', {
          class: `enlace-conteo ${cantidad === 0 ? 'enlace-conteo--vacio' : ''}`,
          type: 'button',
          onclick: () => abrirDetalle(cliente),
        }, etiquetaVehiculos(cantidad))),
      el('td', { class: 'celda-acciones' },
        el('div', { class: 'acciones-fila' },
          botonAccion('editar', `Editar a ${cliente.nombres}`, () => editarCliente(cliente.id)),
          botonAccion('eliminar', `Eliminar a ${cliente.nombres}`, () => eliminarCliente(cliente), 'boton-icono--peligro'))));
  }));
}

function llenarSelectoresDeCliente() {
  for (const selector of [$('#filtro-cliente'), $('#vehiculo-cliente')]) {
    const elegido = selector.value;
    const primera = selector.options[0];
    selector.replaceChildren(primera, ...estado.clientes.map((c) => el('option', { value: c.id }, c.nombres)));
    selector.value = estado.clientes.some((c) => String(c.id) === elegido) ? elegido : '';
  }
}

async function cargarClientes() {
  if (estado.clientes.length === 0) mostrarCargando(filasClientes, 5);
  try {
    // El listado completo de vehículos da el conteo por cliente sin importar los filtros de su sección
    const [clientes, vehiculos] = await Promise.all([pedir('/clientes'), pedir('/vehiculos')]);
    estado.clientes = clientes;
    estado.conteoPorCliente = new Map();
    for (const { clienteId } of vehiculos) {
      estado.conteoPorCliente.set(clienteId, (estado.conteoPorCliente.get(clienteId) ?? 0) + 1);
    }
    $('#conteo-clientes').textContent = clientes.length;
    $('#conteo-vehiculos').textContent = vehiculos.length;
    llenarSelectoresDeCliente();
    pintarClientes();
  } catch (error) {
    mostrarMensaje(filasClientes, 5, 'No se pudieron cargar los clientes', error.message, { texto: 'Reintentar', alPulsar: actualizarTodo });
    throw error;
  }
}

const formCliente = $('#form-cliente');

function abrirFormularioCliente(cliente = null) {
  formCliente.reset();
  limpiarErrores(formCliente);
  formCliente.dataset.id = cliente?.id ?? '';
  $('#titulo-form-cliente').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
  if (cliente) {
    formCliente.elements.nombres.value = cliente.nombres;
    formCliente.elements.dni.value = cliente.dni;
    formCliente.elements.telefono.value = cliente.telefono;
    formCliente.elements.correo.value = cliente.correo ?? '';
  }
  $('#dialogo-cliente').showModal();
}

async function editarCliente(id) {
  try {
    abrirFormularioCliente(await pedir(`/clientes/${id}`));
  } catch (error) {
    avisar(error.message, 'error');
    if (error.codigo === 404) await actualizarTodo();
  }
}

function eliminarCliente(cliente) {
  confirmarEliminacion(`¿Eliminar a ${cliente.nombres}?`, () => pedir(`/clientes/${cliente.id}`, { metodo: 'DELETE' }), 'Cliente eliminado.');
}

formCliente.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campos = formCliente.elements;
  const id = formCliente.dataset.id;
  const datos = {
    nombres: campos.nombres.value.trim(),
    dni: campos.dni.value.trim(),
    telefono: campos.telefono.value.trim(),
    correo: campos.correo.value.trim() || null,
  };
  enviarFormulario(formCliente,
    () => (id
      ? pedir(`/clientes/${id}`, { metodo: 'PUT', datos: { id: Number(id), ...datos } })
      : pedir('/clientes', { metodo: 'POST', datos })),
    id ? 'Cliente actualizado.' : 'Cliente registrado.');
});

// --- Vehículos de un cliente (ruta anidada) ---

let clienteEnDetalle = null;

async function abrirDetalle(cliente) {
  clienteEnDetalle = cliente;
  const lista = $('#lista-detalle');
  $('#titulo-detalle').textContent = 'Vehículos del cliente';
  $('#subtitulo-detalle').textContent = cliente.nombres;
  lista.replaceChildren(el('li', { class: 'mensaje-lista' }, 'Cargando…'));
  $('#dialogo-detalle').showModal();

  try {
    const vehiculos = await pedir(`/clientes/${cliente.id}/vehiculos`);
    lista.replaceChildren(...(vehiculos.length
      ? vehiculos.map((v) => el('li', {},
        el('span', { class: 'placa' }, v.placa),
        el('span', { class: 'titulo-fila' }, `${v.marca} ${v.modelo} (${v.anio})`),
        el('span', { class: 'lista-vehiculos__km' }, `${formatoNumero.format(v.kilometraje)} km`)))
      : [el('li', { class: 'mensaje-lista' }, 'Este cliente aún no tiene vehículos.')]));
  } catch (error) {
    lista.replaceChildren(el('li', { class: 'mensaje-lista' }, error.message));
  }
}

$('#detalle-agregar').addEventListener('click', () => {
  $('#dialogo-detalle').close();
  abrirFormularioVehiculo(null, clienteEnDetalle.id);
});

// --- Vehículos ---

const filasVehiculos = $('#filas-vehiculos');
const filtros = $('#filtros-vehiculos');
let turnoVehiculos = 0;

function pintarVehiculos(vehiculos) {
  if (vehiculos.length === 0) {
    const hayFiltros = [...new FormData(filtros).values()].some(Boolean);
    mostrarMensaje(filasVehiculos, 6,
      hayFiltros ? 'Sin resultados' : 'Aún no hay vehículos',
      hayFiltros ? 'Ningún vehículo coincide con los filtros.' : 'Registra el primero para empezar.');
    return;
  }

  filasVehiculos.replaceChildren(...vehiculos.map((vehiculo) => el('tr', {},
    el('td', { class: 'celda-principal' }, el('span', { class: 'placa' }, vehiculo.placa)),
    el('td', { 'data-etiqueta': 'Vehículo' }, el('span', { class: 'titulo-fila' }, `${vehiculo.marca} ${vehiculo.modelo}`)),
    el('td', { class: 'numero', 'data-etiqueta': 'Año' }, vehiculo.anio),
    el('td', { class: 'numero', 'data-etiqueta': 'Kilometraje' }, `${formatoNumero.format(vehiculo.kilometraje)} km`),
    el('td', { 'data-etiqueta': 'Propietario' }, vehiculo.cliente?.nombres ?? ''),
    el('td', { class: 'celda-acciones' },
      el('div', { class: 'acciones-fila' },
        botonAccion('editar', `Editar ${vehiculo.placa}`, () => editarVehiculo(vehiculo.id)),
        botonAccion('eliminar', `Eliminar ${vehiculo.placa}`, () => eliminarVehiculo(vehiculo), 'boton-icono--peligro'))))));
}

async function cargarVehiculos() {
  const turno = ++turnoVehiculos;
  if (filasVehiculos.children.length === 0) mostrarCargando(filasVehiculos, 6);

  // Los filtros se resuelven en la API, con el GET por query string
  const consulta = new URLSearchParams();
  for (const [nombre, valor] of new FormData(filtros)) {
    if (String(valor).trim()) consulta.set(nombre, String(valor).trim());
  }

  try {
    const vehiculos = await pedir(`/vehiculos?${consulta}`);
    // Si el usuario siguió escribiendo, se descarta esta respuesta porque ya hay otra más reciente
    if (turno === turnoVehiculos) pintarVehiculos(vehiculos);
  } catch (error) {
    if (turno === turnoVehiculos) {
      mostrarMensaje(filasVehiculos, 6, 'No se pudieron cargar los vehículos', error.message, { texto: 'Reintentar', alPulsar: actualizarTodo });
    }
    throw error;
  }
}

let esperaFiltro;
filtros.addEventListener('input', () => {
  clearTimeout(esperaFiltro);
  esperaFiltro = setTimeout(() => cargarVehiculos().catch(() => {}), 300);
});
filtros.addEventListener('reset', () => {
  // El evento ocurre antes de vaciar los campos, por eso se espera al siguiente ciclo
  setTimeout(() => cargarVehiculos().catch(() => {}));
});
filtros.addEventListener('submit', (evento) => evento.preventDefault());

const formVehiculo = $('#form-vehiculo');

function abrirFormularioVehiculo(vehiculo = null, clienteId = null) {
  formVehiculo.reset();
  limpiarErrores(formVehiculo);
  formVehiculo.dataset.id = vehiculo?.id ?? '';
  $('#titulo-form-vehiculo').textContent = vehiculo ? 'Editar vehículo' : 'Nuevo vehículo';
  const campos = formVehiculo.elements;
  campos.clienteId.value = vehiculo?.clienteId ?? clienteId ?? '';
  if (vehiculo) {
    campos.placa.value = vehiculo.placa;
    campos.marca.value = vehiculo.marca;
    campos.modelo.value = vehiculo.modelo;
    campos.anio.value = vehiculo.anio;
    campos.kilometraje.value = vehiculo.kilometraje;
  }
  $('#dialogo-vehiculo').showModal();
}

async function editarVehiculo(id) {
  try {
    abrirFormularioVehiculo(await pedir(`/vehiculos/${id}`));
  } catch (error) {
    avisar(error.message, 'error');
    if (error.codigo === 404) await actualizarTodo();
  }
}

function eliminarVehiculo(vehiculo) {
  confirmarEliminacion(`¿Eliminar el vehículo ${vehiculo.placa}?`, () => pedir(`/vehiculos/${vehiculo.id}`, { metodo: 'DELETE' }), 'Vehículo eliminado.');
}

$('#vehiculo-placa').addEventListener('input', (evento) => {
  evento.target.value = evento.target.value.toUpperCase();
});

formVehiculo.addEventListener('submit', (evento) => {
  evento.preventDefault();
  limpiarErrores(formVehiculo);
  const campos = formVehiculo.elements;
  const id = formVehiculo.dataset.id;

  // Un número o una lista vacíos no se pueden enviar como JSON válido; el resto lo valida la API
  const faltantes = {};
  if (!campos.clienteId.value) faltantes.clienteId = ['Selecciona un cliente.'];
  if (!campos.anio.value.trim()) faltantes.anio = ['El año es obligatorio.'];
  if (!campos.kilometraje.value.trim()) faltantes.kilometraje = ['El kilometraje es obligatorio.'];
  if (Object.keys(faltantes).length) {
    mostrarErrores(formVehiculo, faltantes);
    return;
  }

  const datos = {
    placa: campos.placa.value.trim(),
    marca: campos.marca.value.trim(),
    modelo: campos.modelo.value.trim(),
    anio: Number(campos.anio.value),
    kilometraje: Number(campos.kilometraje.value),
    clienteId: Number(campos.clienteId.value),
  };
  enviarFormulario(formVehiculo,
    () => (id
      ? pedir(`/vehiculos/${id}`, { metodo: 'PUT', datos: { id: Number(id), ...datos } })
      : pedir('/vehiculos', { metodo: 'POST', datos })),
    id ? 'Vehículo actualizado.' : 'Vehículo registrado.');
});

// --- Confirmación de eliminación ---

function confirmarEliminacion(texto, operacion, mensajeExito) {
  const dialogo = $('#dialogo-confirmar');
  const boton = $('#confirmar-eliminar');
  $('.aviso', dialogo).hidden = true;
  $('#titulo-confirmar').textContent = 'Confirmar eliminación';
  $('#texto-confirmar').textContent = texto;
  $('#detalle-confirmar').hidden = false;
  $('#cancelar-eliminar').textContent = 'Cancelar';
  boton.hidden = false;

  boton.onclick = async () => {
    boton.disabled = true;
    boton.textContent = 'Eliminando…';
    try {
      await operacion();
      dialogo.close();
      avisar(mensajeExito);
      await actualizarTodo();
    } catch (error) {
      mostrarAviso(dialogo, error.message);
      // Sin conexión se puede reintentar. Si la API lo rechazó, como un cliente con vehículos (409), no.
      if (error.codigo !== 0) {
        $('#titulo-confirmar').textContent = 'No se pudo eliminar';
        $('#detalle-confirmar').hidden = true;
        $('#cancelar-eliminar').textContent = 'Entendido';
        boton.hidden = true;
      }
      if (error.codigo === 404) await actualizarTodo();
    } finally {
      boton.disabled = false;
      boton.textContent = 'Eliminar';
    }
  };

  dialogo.showModal();
}

// --- Navegación y carga inicial ---

function mostrarSeccion() {
  const actual = location.hash === '#vehiculos' ? 'vehiculos' : 'clientes';
  for (const nombre of ['clientes', 'vehiculos']) {
    $(`#seccion-${nombre}`).hidden = nombre !== actual;
    const pestana = $(`.pestana[data-seccion="${nombre}"]`);
    if (nombre === actual) pestana.setAttribute('aria-current', 'page');
    else pestana.removeAttribute('aria-current');
  }
}

async function actualizarTodo() {
  // En hosting gratuito el primer request puede tardar mientras el servidor despierta
  const despertando = setTimeout(() => mostrarEstadoApi('cargando', 'Despertando el servidor…'), 3000);
  try {
    await Promise.all([cargarClientes(), cargarVehiculos()]);
    mostrarEstadoApi('activo', 'API conectada');
  } catch {
    mostrarEstadoApi('error', 'API sin respuesta');
  } finally {
    clearTimeout(despertando);
  }
}

document.querySelectorAll('[data-cerrar]').forEach((boton) => {
  boton.addEventListener('click', () => boton.closest('dialog').close());
});
$('#nuevo-cliente').addEventListener('click', () => abrirFormularioCliente());
$('#nuevo-vehiculo').addEventListener('click', () => abrirFormularioVehiculo());
$('#buscar-cliente').addEventListener('input', pintarClientes);
window.addEventListener('hashchange', mostrarSeccion);

mostrarSeccion();
actualizarTodo();

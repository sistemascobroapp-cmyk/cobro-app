// ==========================================
// LÓGICA COMPLETA DE PRESTAMISTAS, DÍAS, SIMULACIONES, CALENDARIO, ATRASOS Y COBROS
// ==========================================

let fechaSemanaSeleccionada = new Date();
let fechaMesCalendarioVisual = new Date();
let simulacionActual = null;
let pestanaResumenActual = 'activos';

// VARIABLES AUXILIARES DE COBRO CON RECARGO Y MODALES
let datosPagoCuotaActual = null;
let datosPagoAtrasadoAgrupadoActual = null;
let idPrestamoAFinalizar = null;
let idPrestamoAEliminar = null;
let comprobantePrestamoReciente = null;
var datosComprobantePagoReciente = null;
let datosCuotaSeleccionadaWhatsApp = null;

// FUNCIÓN AUXILIAR PARA CÁLCULO EXACTO DE DÍAS ENTRE FECHAS ISO
function calcularDiasDeDiferencia(fechaISOInicial, fechaISOFinal) {
  if (!fechaISOInicial || !fechaISOFinal) return 0;
  const [y1, m1, d1] = fechaISOInicial.split('-').map(Number);
  const [y2, m2, d2] = fechaISOFinal.split('-').map(Number);
  const f1 = new Date(y1, m1 - 1, d1);
  const f2 = new Date(y2, m2 - 1, d2);
  return Math.round((f2 - f1) / (1000 * 60 * 60 * 24));
}

// FUNCIONES DE CONVERSIÓN A LETRAS EN TIEMPO REAL
function convertirMontoEnLetras(val) {
  const elem = document.getElementById('monto-en-letras');
  if (elem) elem.innerText = typeof numeroALetras === 'function' ? numeroALetras(val) : '';
}

function convertirMontoPagoEnLetras(val) {
  const elem = document.getElementById('pago-monto-en-letras');
  if (elem) elem.innerText = typeof numeroALetras === 'function' ? numeroALetras(val) : '';
}

function convertirMontoPagoAtrasadoEnLetras(val) {
  const elem = document.getElementById('pago-atrasado-monto-en-letras');
  if (elem) elem.innerText = typeof numeroALetras === 'function' ? numeroALetras(val) : '';
}

// ==========================================
// VERIFICACIÓN DE ALQUILER Y SUSPENSIÓN (REGLA DEL DÍA 5)
// ==========================================
function verificarEstadoSuscripcionPrestamista(usuarioData) {
  const bannerAviso = document.getElementById('banner-alquiler-pendiente');
  const modalSuspendido = document.getElementById('modal-cuenta-suspendida');

  // 1. BLOQUEO SOLO SI VOS LO SUSPENDISTE MANUALMENTE DESDE EL PANEL MASTER
  if (usuarioData && (usuarioData.estadoCuenta === 'suspendido' || usuarioData.suspendido === true)) {
    if (modalSuspendido) modalSuspendido.classList.remove('hidden');
    return;
  } else {
    if (modalSuspendido) modalSuspendido.classList.add('hidden');
  }

  // 2. CALCULAR FECHA Y PERÍODO ACTUAL (AÑO-MES)
  const hoy = new Date();
  const diaDelMes = hoy.getDate();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();
  const periodoActual = `${anioActual}-${mesActual}`;

  // Verificar si el usuario ya pagó el alquiler del mes actual
  const ultimoAbonado = usuarioData ? (usuarioData.ultimoPeriodoAbonado || usuarioData.ultimoPago) : null;
  const estaAlDia = ultimoAbonado === periodoActual;

  // 3. REGLA DÍA 5: Mostrar aviso SOLO si NO pagó Y YA ES DÍA 5 O MÁS
  if (!estaAlDia && diaDelMes >= 5) {
    if (bannerAviso) bannerAviso.classList.remove('hidden');
  } else {
    if (bannerAviso) bannerAviso.classList.add('hidden');
  }
}

// ==========================================
// ADAPTACIÓN DE INTERFAZ SEGÚN ROL (VERSIÓN DEFINITIVA Y COMPLETA)
// ==========================================
function adaptarInterfazSegunRol() {
  const emailAdmin = window.usuarioActual?.email ? window.usuarioActual.email.toLowerCase() : '';
  const rol = window.rolUsuarioActual || window.datosUsuarioActual?.rol || 'prestamista';

  const esAdmin = window.esAdmin || rol === 'admin' || emailAdmin === 'sistemas.cobroapp@gmail.com';
  const esCobrador = rol === 'cobrador';

  // 1. INYECTAR REGLA CSS PERMANENTE EN EL NAVEGADOR (Para que no reaparezca el botón en PC)
  let styleTag = document.getElementById('css-bloqueo-admin');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'css-bloqueo-admin';
    document.head.appendChild(styleTag);
  }

  if (esAdmin) {
    styleTag.innerHTML = ''; 
  } else {
    styleTag.innerHTML = `
      #btn-sec-admin, 
      #btn-accesos-prestamistas, 
      #m-btn-admin, 
      #sec-admin-master, 
      .solo-admin {
        display: none !important;
      }
    `;
  }

  // 2. OCULTAR BOTÓN "ACCESOS PRESTAMISTAS" EN EL MENÚ LATERAL
  document.querySelectorAll('button, a, li').forEach(el => {
    if (el.textContent && el.textContent.trim().includes('Accesos Prestamistas')) {
      if (!esAdmin) {
        el.classList.add('solo-admin');
        el.style.setProperty('display', 'none', 'important');
      } else {
        el.classList.remove('solo-admin');
        el.style.removeProperty('display');
      }
    }
  });

  // 3. OCULTAR FINANZAS Y CONFIGURACIÓN AL COBRADOR
  const elementosPrivados = [
    'resumen-capital-box',
    'resumen-ganancia-box',
    'btn-sec-configuracion',
    'm-btn-configuracion',
    'sec-config-intereses-card'
  ];

  elementosPrivados.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (esCobrador) {
        el.style.setProperty('display', 'none', 'important');
      } else {
        el.style.removeProperty('display');
        el.classList.remove('hidden');
      }
    }
  });

  // 4. ADAPTACIÓN DE TEXTOS Y FORMULARIOS SEGÚN ROL
  const btnMenuRegistrar = document.getElementById('btn-sec-registrar');
  const mBtnRegistrar = document.getElementById('m-btn-registrar');
  const tituloSec = document.getElementById('titulo-sec-registrar');
  const lblMonto = document.getElementById('lbl-monto-prestamo');
  const lblInteres = document.getElementById('lbl-interes-prestamo');
  const inputInteres = document.getElementById('interes-prestamo');

  if (esAdmin) {
    if (btnMenuRegistrar) btnMenuRegistrar.innerHTML = '<span>💳</span> Registro de Pago';
    if (mBtnRegistrar) {
      const spanTxt = mBtnRegistrar.querySelector('span:last-child');
      if (spanTxt) spanTxt.innerText = 'Registro Pago';
    }
    if (tituloSec) tituloSec.innerText = 'Registro de Pago';
    if (lblMonto) lblMonto.innerText = 'Monto a Pagar ($) *';
    if (lblInteres) lblInteres.innerText = 'Fecha en la que se registra *';
    
    if (inputInteres) {
      inputInteres.type = 'date';
      inputInteres.value = typeof obtenerFechaLocalISO === 'function' ? obtenerFechaLocalISO() : new Date().toISOString().split('T')[0];
      inputInteres.removeAttribute('min');
      inputInteres.removeAttribute('step');
    }
  } else {
    if (btnMenuRegistrar) btnMenuRegistrar.innerHTML = '<span>💳</span> Registrar Préstamo';
    if (mBtnRegistrar) {
      const spanTxt = mBtnRegistrar.querySelector('span:last-child');
      if (spanTxt) spanTxt.innerText = 'Registrar';
    }
    if (tituloSec) tituloSec.innerText = 'Simulador & Registro de Préstamo';
    if (lblMonto) lblMonto.innerText = 'Monto a Prestar ($) *';
    if (lblInteres) lblInteres.innerText = 'Interés (%) *';

    if (inputInteres) {
      inputInteres.type = 'number';
      inputInteres.min = '0';
      inputInteres.step = '0.1';
    }

    if (typeof inicializarValoresPredeterminadosPrestamo === 'function') {
      inicializarValoresPredeterminadosPrestamo();
    }
  }

  if (typeof cargarConfigMercadoPagoUI === 'function') {
    cargarConfigMercadoPagoUI();
  }

  if (window.datosUsuarioActual) {
    verificarEstadoSuscripcionPrestamista(window.datosUsuarioActual);
  }
}

// 5. PARCHE DE NAVEGACIÓN EN PC: Vuelve a ocultar el botón Admin en cada cambio de pestaña
if (typeof window.mostrarSeccion === 'function' && !window.mostrarSeccionParchada) {
  const funcionMostrarOriginal = window.mostrarSeccion;
  window.mostrarSeccion = function(idSeccion) {
    funcionMostrarOriginal(idSeccion);
    adaptarInterfazSegunRol(); 
  };
  window.mostrarSeccionParchada = true;
}

// ==========================================
// 1. CONFIGURACIÓN DE INTERESES, TASAS Y CREDENCIALES ⚙️
// ==========================================

async function guardarConfigInteresesPrestamista(event) {
  if (event && event.preventDefault) event.preventDefault();

  const intDiario = parseFloat(document.getElementById('cfg-int-diario')?.value) || 0;
  const intSemanal = parseFloat(document.getElementById('cfg-int-semanal')?.value) || 0;
  const intMensual = parseFloat(document.getElementById('cfg-int-mensual')?.value) || 0;

  const retDiario = parseFloat(document.getElementById('cfg-ret-diario')?.value) || 0;
  const retSemanal = parseFloat(document.getElementById('cfg-ret-semanal')?.value) || 0;
  const retMensual = parseFloat(document.getElementById('cfg-ret-mensual')?.value) || 0;

  if (!window.usuarioActual) return;

  try {
    await db.collection('usuarios').doc(window.usuarioActual.uid).set({
      tasasConfig: {
        intDiario, intSemanal, intMensual,
        retDiario, retSemanal, retMensual
      },
      configIntereses: {
        intDiario, intSemanal, intMensual,
        retrasoDiario: retDiario, retrasoSemanal: retSemanal, retrasoMensual: retMensual
      }
    }, { merge: true });

    if (!window.datosUsuarioActual) window.datosUsuarioActual = {};
    window.datosUsuarioActual.tasasConfig = { intDiario, intSemanal, intMensual, retDiario, retSemanal, retMensual };
    window.datosUsuarioActual.configIntereses = { intDiario, intSemanal, intMensual, retrasoDiario: retDiario, retrasoSemanal: retSemanal, retrasoMensual: retMensual };

    if (typeof mostrarToast === 'function') {
      mostrarToast("⚙️ Tasas e intereses guardados con éxito");
    }
  } catch (error) {
    console.error("Error al guardar tasas:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al guardar tasas", "error");
  }
}

async function cargarCamposConfigIntereses() {
  if (!window.usuarioActual) return;
  try {
    const doc = await db.collection('usuarios').doc(window.usuarioActual.uid).get();
    if (doc.exists) {
      const data = doc.data();
      const cfg = data.tasasConfig || data.configIntereses || {};

      if (!window.datosUsuarioActual) window.datosUsuarioActual = {};
      window.datosUsuarioActual.tasasConfig = cfg;
      window.datosUsuarioActual.cuentasCobro = data.cuentasCobro || [];
      window.datosUsuarioActual.configMercadoPago = data.configMercadoPago || {};

      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

      setVal('cfg-int-diario', cfg.intDiario ?? 1);
      setVal('cfg-int-semanal', cfg.intSemanal ?? 5);
      setVal('cfg-int-mensual', cfg.intMensual ?? 20);

      setVal('cfg-ret-diario', cfg.retDiario ?? cfg.retrasoDiario ?? 0.5);
      setVal('cfg-ret-semanal', cfg.retSemanal ?? cfg.retrasoSemanal ?? 2);
      setVal('cfg-ret-mensual', cfg.retMensual ?? cfg.retrasoMensual ?? 5);

      setVal('cfg-mi-email', window.usuarioActual.email || data.email || '');
    }
  } catch (error) {
    console.error("Error al cargar configuración de intereses:", error);
  }

  if (typeof renderizarCuentasBancariasConfig === 'function') {
    renderizarCuentasBancariasConfig();
  }
}

async function actualizarCredencialesUsuario() {
  if (!window.usuarioActual) return mostrarToast("No hay usuario autenticado", "error");

  const nuevoEmail = document.getElementById('cfg-mi-email')?.value.trim();
  const nuevaPass = document.getElementById('cfg-mi-pass')?.value.trim();

  if (!nuevoEmail && !nuevaPass) {
    return mostrarToast("Ingresá un nuevo correo o contraseña para actualizar", "error");
  }

  try {
    const updatesFirestore = {};
    const cambiosRealizados = [];

    // 1. CAMBIO DE CORREO DIRECTO (Soporta correos internos/ficticios)
    if (nuevoEmail && nuevoEmail.toLowerCase() !== window.usuarioActual.email.toLowerCase()) {
      const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regexEmail.test(nuevoEmail)) {
        return mostrarToast("Ingresá un formato de correo válido (ej: usuario@cobroapp.com)", "error");
      }

      try {
        // Forzamos el cambio directo en Firebase Auth sin pedir verificaciones por casilla
        await window.usuarioActual.updateEmail(nuevoEmail);
        updatesFirestore.email = nuevoEmail;
        if (window.datosUsuarioActual) window.datosUsuarioActual.email = nuevoEmail;
        cambiosRealizados.push("Correo");
      } catch (errEmail) {
        if (errEmail.code === 'auth/requires-recent-login') {
          return mostrarToast("🔒 Por seguridad, cerrá sesión y volvé a ingresar con tu clave actual para autorizar el cambio de correo.", "error");
        }
        throw errEmail;
      }
    }

    // 2. CAMBIO DE CONTRASEÑA
    if (nuevaPass) {
      if (nuevaPass.length < 6) {
        return mostrarToast("La contraseña debe tener al menos 6 caracteres", "error");
      }
      await window.usuarioActual.updatePassword(nuevaPass);
      updatesFirestore.passwordVisual = nuevaPass;
      cambiosRealizados.push("Contraseña");
    }

    // Actualizamos los datos en Firestore para que lo veas en el Panel Master
    if (Object.keys(updatesFirestore).length > 0) {
      await db.collection('usuarios').doc(window.usuarioActual.uid).update(updatesFirestore);
    }

    if (cambiosRealizados.length > 0) {
      mostrarToast(`🔐 ${cambiosRealizados.join(" y ")} actualizado(s) correctamente`);
    }

    if (document.getElementById('cfg-mi-pass')) {
      document.getElementById('cfg-mi-pass').value = '';
    }

  } catch (error) {
    console.error("Error al actualizar credenciales:", error);
    mostrarToast("Error al actualizar: " + error.message, "error");
  }
}

async function guardarInteresesConfig(event) {
  await guardarConfigInteresesPrestamista(event);
}

function abrirModalConfigIntereses() {
  cargarCamposConfigIntereses();
  const modal = document.getElementById('modal-config-intereses');
  if (modal) modal.classList.remove('hidden');
}

function cerrarModalConfigIntereses() {
  const modal = document.getElementById('modal-config-intereses');
  if (modal) modal.classList.add('hidden');
}

async function guardarInteresesConfigDesdeModal(event) {
  await guardarConfigInteresesPrestamista(event);
  cerrarModalConfigIntereses();
}

function calcularPorcentajeRecargoEscalonado(diasAtraso) {
  if (diasAtraso <= 0) return 0;
  const cfg = window.datosUsuarioActual?.tasasConfig || window.datosUsuarioActual?.configIntereses || {};
  const retDiario = parseFloat(cfg.retDiario ?? cfg.retrasoDiario) || 0;
  const retSemanal = parseFloat(cfg.retSemanal ?? cfg.retrasoSemanal) || 0;
  const retMensual = parseFloat(cfg.retMensual ?? cfg.retrasoMensual) || 0;

  const meses = Math.floor(diasAtraso / 30);
  const remMes = diasAtraso % 30;
  const semanas = Math.floor(remMes / 7);
  const dias = remMes % 7;

  return (meses * retMensual) + (semanas * retSemanal) + (dias * retDiario);
}

// ==========================================
// 2. CLIENTES Y VALIDACIÓN DE 10 DÍGITOS
// ==========================================

function renderizarClientesSelect() {
  const select = document.getElementById('input-cliente');
  if (!select) return;

  const valActual = select.value;
  select.innerHTML = '<option value="">-- Sin cliente seleccionado (Solo Simular) --</option>';

  const clientes = window.clientes || [];
  clientes.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nombre} (${c.telefono})</option>`;
  });

  select.value = valActual;
}

// ==========================================
// CÁLCULO DE REPUTACIÓN / SCORING DEL CLIENTE
// ==========================================
function calcularReputacionCliente(clienteId) {
  const prestamosCli = (window.prestamos || []).filter(p => p.clienteId === clienteId);
  const hoyISO = typeof obtenerFechaLocalISO === 'function' ? obtenerFechaLocalISO() : new Date().toISOString().split('T')[0];

  let totalCuotasEvaluadas = 0;
  let cuotasAtrasadasCount = 0;

  prestamosCli.forEach(p => {
    (p.cuotasDetalle || []).forEach(c => {
      const estaPagado = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
      
      if (estaPagado || c.fecha < hoyISO) {
        totalCuotasEvaluadas++;
        if (!estaPagado && c.fecha < hoyISO) {
          cuotasAtrasadasCount++;
        }
      }
    });
  });

  if (totalCuotasEvaluadas === 0) {
    return {
      etiqueta: '⚪ Sin Historial',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      cardClass: 'bg-[#1E293B]/60 border-slate-700/80'
    };
  }

  const porcentajeAtrasos = (cuotasAtrasadasCount / totalCuotasEvaluadas) * 100;

  if (porcentajeAtrasos === 0) {
    return {
      etiqueta: '🟢 Excelente Pagador',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      cardClass: 'bg-emerald-950/20 border-emerald-500/50'
    };
  } else if (porcentajeAtrasos <= 30) {
    return {
      etiqueta: '🟡 Demora Ocasional',
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      cardClass: 'bg-amber-950/20 border-amber-500/50'
    };
  } else {
    return {
      etiqueta: '🔴 Atrasador Frecuente',
      badgeClass: 'bg-red-500/20 text-red-400 border-red-500/40',
      cardClass: 'bg-red-950/30 border-red-500/70'
    };
  }
}

// ==========================================
// DIRECTORIO DE CLIENTES CON COLORES DE REPUTACIÓN
// ==========================================
function renderizarDirectorioClientes() {
  const container = document.getElementById('grid-clientes-directorio');
  if (!container) return;

  container.innerHTML = '';
  const clientes = window.clientes || [];
  const prestamos = window.prestamos || [];

  if (clientes.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic">No tenés clientes registrados aún.</p>';
    return;
  }

  clientes.forEach(c => {
    const prestamosCliente = prestamos.filter(p => p.clienteId === c.id && p.estado !== 'finalizado');
    const tieneActivo = prestamosCliente.length > 0;
    const reputacion = calcularReputacionCliente(c.id);

    container.innerHTML += `
      <div class="p-4 rounded-2xl border ${reputacion.cardClass} space-y-3 transition shadow-md">
        <div class="flex justify-between items-start gap-2">
          <div>
            <h5 class="font-extrabold text-white text-base">${c.nombre}</h5>
            <p class="text-xs text-slate-300">📞 ${c.telefono} | 🚨 ${c.emergencia || 'S/E'}</p>
            <p class="text-xs text-slate-400">📍 ${c.direccion}</p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class="text-[10px] px-2.5 py-0.5 rounded-full font-extrabold border ${reputacion.badgeClass}">
              ${reputacion.etiqueta}
            </span>
            ${tieneActivo ? '<span class="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">💳 Con Préstamo</span>' : ''}
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-800/80 pt-2">
          <button onclick="abrirModalInfoCliente('${c.id}')" class="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-fuchsia-400 rounded-lg border border-slate-700 font-bold">📜 Ficha & Historial</button>
          <button onclick="editarCliente('${c.id}')" class="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 font-bold">✏️ Editar</button>
          <button onclick="eliminarCliente('${c.id}')" class="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 font-bold">🗑️</button>
        </div>
      </div>
    `;
  });
}

function abrirModalNuevoCliente() {
  document.getElementById('cli-edit-id').value = '';
  document.getElementById('cli-nombre').value = '';
  document.getElementById('cli-tel').value = '';
  document.getElementById('cli-emergencia').value = '';
  document.getElementById('cli-direccion').value = '';
  document.getElementById('cli-redes').value = '';
  document.getElementById('modal-cliente-titulo').innerText = '👤 Registrar Nuevo Cliente';
  document.getElementById('modal-nuevo-cliente').classList.remove('hidden');
}

function cerrarModalCliente() {
  document.getElementById('modal-nuevo-cliente').classList.add('hidden');
}

async function guardarYVincularCliente(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (!window.usuarioActual) return;

  const editId = document.getElementById('cli-edit-id').value;
  const nombre = document.getElementById('cli-nombre').value.trim();
  const telefono = document.getElementById('cli-tel').value.trim();
  const emergencia = document.getElementById('cli-emergencia').value.trim();
  const direccion = document.getElementById('cli-direccion').value.trim();
  const redes = document.getElementById('cli-redes').value.trim();

  const regexTel = /^[0-9]{10}$/;
  if (!regexTel.test(telefono)) {
    return mostrarToast("El teléfono personal debe tener exactamente 10 dígitos numéricos.", "error");
  }
  if (!regexTel.test(emergencia)) {
    return mostrarToast("El teléfono de emergencia debe tener exactamente 10 dígitos numéricos.", "error");
  }

  const dataCliente = {
    nombre, telefono, emergencia, direccion, redes,
    usuarioId: window.usuarioActual.uid
  };

  try {
    if (editId) {
      await db.collection('clientes').doc(editId).update(dataCliente);
      mostrarToast("Cliente actualizado correctamente");
    } else {
      const docRef = await db.collection('clientes').add(dataCliente);
      mostrarToast("¡Cliente registrado con éxito!");

      if (simulacionActual && !simulacionActual.clienteId) {
        simulacionActual.clienteId = docRef.id;
        simulacionActual.nombreCliente = nombre;
        const inputCli = document.getElementById('input-cliente');
        if (inputCli) inputCli.value = docRef.id;
        cerrarModalVincularClienteSimulacion();
      }
    }
    cerrarModalCliente();
  } catch (error) {
    mostrarToast("Error al guardar cliente", "error");
  }
}

function editarCliente(id) {
  const cli = (window.clientes || []).find(c => c.id === id);
  if (!cli) return;

  document.getElementById('cli-edit-id').value = cli.id;
  document.getElementById('cli-nombre').value = cli.nombre;
  document.getElementById('cli-tel').value = cli.telefono;
  document.getElementById('cli-emergencia').value = cli.emergencia || '';
  document.getElementById('cli-direccion').value = cli.direccion;
  document.getElementById('cli-redes').value = cli.redes || '';
  document.getElementById('modal-cliente-titulo').innerText = '✏️ Editar Cliente';
  document.getElementById('modal-nuevo-cliente').classList.remove('hidden');
}

async function eliminarCliente(id) {
  if (confirm("¿Estás seguro de eliminar este cliente?")) {
    try {
      await db.collection('clientes').doc(id).delete();
      mostrarToast("Cliente eliminado");
    } catch (error) {
      mostrarToast("Error al eliminar cliente", "error");
    }
  }
}

function abrirModalInfoCliente(id) {
  const cli = (window.clientes || []).find(c => c.id === id);
  if (!cli) return;

  document.getElementById('info-cli-nombre').innerText = cli.nombre;
  document.getElementById('info-cli-tel').innerText = cli.telefono;
  document.getElementById('info-cli-emer').innerText = cli.emergencia || 'No registrado';
  document.getElementById('info-cli-dir').innerText = cli.direccion;
  document.getElementById('info-cli-redes').innerText = cli.redes || 'Sin notas adicionales';

  const contHistorial = document.getElementById('contenedor-historial-prestamos-cliente');
  if (contHistorial) {
    contHistorial.innerHTML = '';
    const prestamosCli = (window.prestamos || []).filter(p => p.clienteId === id);

    if (prestamosCli.length === 0) {
      contHistorial.innerHTML = '<p class="text-xs text-slate-500 italic">Este cliente no tiene historial de préstamos.</p>';
    } else {
      prestamosCli.forEach(p => {
        let cobrado = 0;
        (p.cuotasDetalle || []).forEach(c => {
          const estaPagado = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
          if (estaPagado) cobrado += Math.round(parseFloat(c.montoCuota));
        });
        const restante = Math.max(0, Math.round(parseFloat(p.montoTotal) - cobrado));

        contHistorial.innerHTML += `
          <div class="bg-[#1E293B] p-3.5 rounded-xl text-xs space-y-2 border border-slate-700/80">
            <div class="flex justify-between items-center font-bold">
              <span class="text-white">Monto: $${Math.round(parseFloat(p.monto)).toLocaleString('es-AR')}</span>
              <span class="${p.estado === 'finalizado' ? 'text-emerald-400' : 'text-amber-400'}">${p.estado === 'finalizado' ? '🏁 Finalizado' : '🟢 Activo'}</span>
            </div>
            <p class="text-slate-300">Total a Devolver: <strong class="text-fuchsia-400">$${Math.round(parseFloat(p.montoTotal)).toLocaleString('es-AR')}</strong> | Cuotas: <strong>${p.cuotas} (${p.frecuencia})</strong></p>
            <p class="text-xs text-slate-400">Cobrado: <strong class="text-emerald-400">$${cobrado.toLocaleString('es-AR')}</strong> | Cuánto Falta: <strong class="text-amber-400">$${restante.toLocaleString('es-AR')}</strong></p>
          </div>
        `;
      });
    }
  }

  document.getElementById('modal-info-cliente').classList.remove('hidden');
}

function cerrarModalInfoCliente() {
  document.getElementById('modal-info-cliente').classList.add('hidden');
}

// ==========================================
// 3. SIMULADOR Y REGISTRO DE PAGO / PRÉSTAMO
// ==========================================

async function inicializarValoresPredeterminadosPrestamo() {
  const selectFrecuencia = document.getElementById('frecuencia-prestamo');
  const inputInt = document.getElementById('interes-prestamo');
  
  if (selectFrecuencia) selectFrecuencia.value = '';
  if (inputInt) {
    inputInt.value = '';
    inputInt.placeholder = 'Seleccioná frecuencia...';
  }
}

async function alCambiarFrecuencia() {
  const emailAdmin = window.usuarioActual?.email ? window.usuarioActual.email.toLowerCase() : '';
  const esAdmin = window.esAdmin || window.rolUsuarioActual === 'admin' || emailAdmin === 'sistemas.cobroapp@gmail.com';
  if (esAdmin) return;

  const frecSelect = document.getElementById('frecuencia-prestamo');
  const inputInt = document.getElementById('interes-prestamo');
  if (!frecSelect || !inputInt) return;

  const frec = frecSelect.value;
  
  if (!frec) {
    inputInt.value = '';
    return;
  }

  const usuario = window.usuarioActual || (typeof firebase !== 'undefined' && firebase.auth().currentUser);

  if ((!window.datosUsuarioActual?.tasasConfig || window.datosUsuarioActual.tasasConfig.intMensual === undefined) && usuario) {
    try {
      const doc = await db.collection('usuarios').doc(usuario.uid).get();
      if (doc.exists) {
        const data = doc.data();
        const cfg = data.tasasConfig || data.configIntereses || {};
        if (!window.datosUsuarioActual) window.datosUsuarioActual = {};
        window.datosUsuarioActual.tasasConfig = cfg;
        window.datosUsuarioActual.configIntereses = cfg;
      }
    } catch (e) {
      console.error("Error al cargar tasas:", e);
    }
  }

  const tasas = window.datosUsuarioActual?.tasasConfig || window.datosUsuarioActual?.configIntereses || {};

  if (frec === 'diario') {
    inputInt.value = tasas.intDiario ?? 1;
  } else if (frec === 'semanal') {
    inputInt.value = tasas.intSemanal ?? 5;
  } else if (frec === 'mensual') {
    inputInt.value = tasas.intMensual ?? 30;
  }
}

function generarSimulacion(event) {
  if (event && event.preventDefault) event.preventDefault();

  const emailAdmin = window.usuarioActual?.email ? window.usuarioActual.email.toLowerCase() : '';
  const esAdmin = window.esAdmin || window.rolUsuarioActual === 'admin' || emailAdmin === 'sistemas.cobroapp@gmail.com';

  const clienteId = document.getElementById('input-cliente')?.value || '';
  const monto = Math.round(parseFloat(document.getElementById('monto-prestamo')?.value) || 0);
  const cuotas = parseInt(document.getElementById('cuotas-prestamo')?.value) || 1;
  const frecuencia = document.getElementById('frecuencia-prestamo')?.value;
  const fechaInicioStr = document.getElementById('fecha-inicio')?.value;

  if (!frecuencia || frecuencia === '') {
    return mostrarToast("Por favor seleccioná una frecuencia de cobro", "error");
  }

  if (monto <= 0 || cuotas <= 0 || !fechaInicioStr) {
    return mostrarToast("Completá todos los campos requeridos", "error");
  }

  let interesPorPeriodo = 0;
  let fechaRegistroAdmin = null;

  if (esAdmin) {
    interesPorPeriodo = 0;
    fechaRegistroAdmin = document.getElementById('interes-prestamo')?.value || obtenerFechaLocalISO();
  } else {
    interesPorPeriodo = parseFloat(document.getElementById('interes-prestamo')?.value) || 0;
  }

  const porcentajeTotalInteres = interesPorPeriodo * cuotas;
  const ganancia = Math.round(monto * (porcentajeTotalInteres / 100));
  const montoTotal = monto + ganancia;
  const valorCuota = Math.round(montoTotal / cuotas);

  let clienteObj = (window.clientes || []).find(c => c.id === clienteId);
  const nombreCliente = clienteObj ? clienteObj.nombre : 'Sin Cliente Seleccionado';

  const fechasCuotas = [];
  let fechaCursor = new Date(fechaInicioStr + 'T00:00:00');

  for (let i = 1; i <= cuotas; i++) {
    const isoFecha = obtenerFechaLocalISO(fechaCursor);
    fechasCuotas.push({
      id: 'cuota_' + i + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      numero: i,
      fecha: isoFecha,
      montoCuota: valorCuota,
      montoPendiente: valorCuota,
      pagado: false
    });

    if (frecuencia === 'diario') {
      fechaCursor.setDate(fechaCursor.getDate() + 1);
    } else if (frecuencia === 'semanal') {
      fechaCursor.setDate(fechaCursor.getDate() + 7);
    } else if (frecuencia === 'mensual') {
      const diaOriginal = fechaCursor.getDate();
      fechaCursor.setMonth(fechaCursor.getMonth() + 1);
      if (fechaCursor.getDate() !== diaOriginal) {
        fechaCursor.setDate(0);
      }
    }
  }

  simulacionActual = {
    clienteId,
    nombreCliente,
    monto,
    interesPorPeriodo,
    porcentajeTotalInteres,
    cuotas,
    frecuencia,
    montoTotal,
    ganancia,
    valorCuota,
    fechaInicio: fechaInicioStr,
    fechaRegistroAdmin: fechaRegistroAdmin,
    cuotasDetalle: fechasCuotas
  };

  document.getElementById('sim-total').innerText = '$' + montoTotal.toLocaleString('es-AR');
  document.getElementById('sim-ganancia').innerText = esAdmin ? '$0' : '+$' + ganancia.toLocaleString('es-AR') + ` (${porcentajeTotalInteres}%)`;
  document.getElementById('sim-cuota').innerText = '$' + valorCuota.toLocaleString('es-AR');
  document.getElementById('sim-plan').innerText = `${cuotas} cuota(s) ${frecuencia}s`;

  const badgeCli = document.getElementById('badge-cliente');
  if (badgeCli) {
    badgeCli.innerText = nombreCliente;
    badgeCli.className = clienteObj ? "text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30";
  }

  const tablaFechas = document.getElementById('sim-tabla-fechas');
  if (tablaFechas) {
    tablaFechas.innerHTML = '';
    fechasCuotas.forEach(c => {
      const fPartes = c.fecha.split('-');
      tablaFechas.innerHTML += `
        <div class="flex justify-between p-2.5 px-4 items-center">
          <span>Cuota #${c.numero} (${fPartes[2]}/${fPartes[1]}/${fPartes[0]})</span>
          <strong class="text-fuchsia-400">$${valorCuota.toLocaleString('es-AR')}</strong>
        </div>
      `;
    });
  }

  const contAcciones = document.getElementById('contenedor-acciones-prestamo');
  if (contAcciones) {
    contAcciones.innerHTML = `
      <button type="button" onclick="guardarPrestamoOficial()" class="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-extrabold py-3.5 rounded-xl shadow-lg flex justify-center items-center gap-2">
        <span>✨</span> ${esAdmin ? 'Guardar Registro de Pago' : 'Otorgar Préstamo Oficialmente'}
      </button>
    `;
  }

  document.getElementById('vista-simulacion').classList.remove('hidden');
  mostrarToast(esAdmin ? "Registro de pago generado" : "Simulación realizada con éxito");
}

function guardarPrestamoOficial() {
  if (!simulacionActual) return;

  if (!simulacionActual.clienteId) {
    abrirModalVincularClienteSimulacion();
    return;
  }

  const prestamoDuplicado = (window.prestamos || []).find(p => p.clienteId === simulacionActual.clienteId && p.estado !== 'finalizado');

  if (prestamoDuplicado) {
    document.getElementById('adv-cli-nombre').innerText = simulacionActual.nombreCliente;
    document.getElementById('modal-advertencia-prestamo-activo').classList.remove('hidden');
  } else {
    guardarPrestamoFirestore();
  }
}

function abrirModalVincularClienteSimulacion() {
  const select = document.getElementById('select-vincular-cliente');
  if (select) {
    select.innerHTML = '<option value="">-- Seleccioná un cliente --</option>';
    (window.clientes || []).forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.nombre} (${c.telefono})</option>`;
    });
  }
  document.getElementById('modal-vincular-cliente-simulacion')?.classList.remove('hidden');
}

function cerrarModalVincularClienteSimulacion() {
  document.getElementById('modal-vincular-cliente-simulacion')?.classList.add('hidden');
}

function confirmarVinculacionClienteSimulacion() {
  const select = document.getElementById('select-vincular-cliente');
  const clienteId = select?.value;

  if (!clienteId) {
    return mostrarToast("Seleccioná un cliente de la lista", "error");
  }

  const cli = (window.clientes || []).find(c => c.id === clienteId);
  if (!cli) return;

  simulacionActual.clienteId = cli.id;
  simulacionActual.nombreCliente = cli.nombre;

  const badgeCli = document.getElementById('badge-cliente');
  if (badgeCli) {
    badgeCli.innerText = cli.nombre;
    badgeCli.className = "text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  }

  const inputCli = document.getElementById('input-cliente');
  if (inputCli) inputCli.value = cli.id;

  cerrarModalVincularClienteSimulacion();
  guardarPrestamoOficial();
}

function cancelarPrestamoDuplicado() {
  document.getElementById('modal-advertencia-prestamo-activo').classList.add('hidden');
}

function aceptarPrestamoDuplicado() {
  document.getElementById('modal-advertencia-prestamo-activo').classList.add('hidden');
  guardarPrestamoFirestore();
}

// GUARDADO BLINDADO DE PRÉSTAMO Y APERTURA DE COMPROBANTE
async function guardarPrestamoFirestore() {
  if (!simulacionActual || !window.usuarioActual) return;

  try {
    const dataGuardar = {
      ...simulacionActual,
      estado: 'activo',
      usuarioId: window.usuarioActual.uid,
      fechaCreacion: new Date().toISOString()
    };

    await db.collection('prestamos').add(dataGuardar);
    mostrarToast("🎉 ¡Préstamo guardado con éxito!");

    const cli = (window.clientes || []).find(c => c.id === simulacionActual.clienteId);
    const copiaPrestamo = { ...dataGuardar };

    document.getElementById('form-prestamo')?.reset();
    inicializarValoresPredeterminadosPrestamo();
    document.getElementById('vista-simulacion')?.classList.add('hidden');
    simulacionActual = null;

    try {
      abrirModalComprobantePrestamo(copiaPrestamo, cli);
    } catch (eModal) {
      console.warn("No se pudo abrir el modal de comprobante:", eModal);
      if (typeof mostrarSeccion === 'function') mostrarSeccion('sec-por-cobrar');
    }

  } catch (error) {
    console.error("Error al guardar préstamo:", error);
    mostrarToast("Error al guardar en el sistema", "error");
  }
}

// FUNCIONES DEL COMPROBANTE DIGITAL
function abrirModalComprobantePrestamo(prestamo, cliente) {
  comprobantePrestamoReciente = { prestamo, cliente };

  const setTexto = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  setTexto('recibo-pres-cliente', cliente ? cliente.nombre : (prestamo.nombreCliente || 'Sin Cliente'));
  setTexto('recibo-pres-tel', cliente ? cliente.telefono : 'Sin teléfono registrado');
  setTexto('recibo-pres-fechainicio', prestamo.fechaInicio || '-');
  setTexto('recibo-pres-monto', '$' + Math.round(parseFloat(prestamo.monto || 0)).toLocaleString('es-AR'));
  setTexto('recibo-pres-total', '$' + Math.round(parseFloat(prestamo.montoTotal || 0)).toLocaleString('es-AR'));
  setTexto('recibo-pres-plan', `${prestamo.cuotas} cuota(s) ${prestamo.frecuencia}s de $${Math.round(parseFloat(prestamo.valorCuota || 0)).toLocaleString('es-AR')}`);

  const contenedorCronograma = document.getElementById('recibo-pres-cronograma');
  if (contenedorCronograma) {
    contenedorCronograma.innerHTML = '';
    (prestamo.cuotasDetalle || []).forEach(c => {
      const fPartes = (c.fecha || '').split('-');
      const fechaFormateada = fPartes.length === 3 ? `${fPartes[2]}/${fPartes[1]}/${fPartes[0]}` : c.fecha;
      contenedorCronograma.innerHTML += `
        <div class="flex justify-between items-center border-b border-slate-800/60 pb-1">
          <span class="text-slate-300">Cuota #${c.numero} (${fechaFormateada})</span>
          <strong class="text-fuchsia-400">$${Math.round(parseFloat(c.montoCuota || 0)).toLocaleString('es-AR')}</strong>
        </div>
      `;
    });
  }

  const modal = document.getElementById('modal-comprobante-prestamo-otorgado');
  if (modal) {
    modal.classList.remove('hidden');
  } else {
    if (typeof mostrarSeccion === 'function') mostrarSeccion('sec-por-cobrar');
  }
}

function cerrarModalComprobantePrestamo() {
  const modal = document.getElementById('modal-comprobante-prestamo-otorgado');
  if (modal) modal.classList.add('hidden');
  comprobantePrestamoReciente = null;
  if (typeof mostrarSeccion === 'function') {
    mostrarSeccion('sec-por-cobrar');
  }
}

function compartirComprobantePrestamoImagen() {
  const card = document.getElementById('ticket-prestamo-otorgado-card');
  if (!card) return;

  if (typeof html2canvas !== 'function') {
    return mostrarToast("Librería de captura no cargada", "error");
  }

  html2canvas(card).then(canvas => {
    canvas.toBlob(blob => {
      const file = new File([blob], 'comprobante-prestamo.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          title: 'Comprobante de Préstamo',
          text: 'Resumen Oficial de Préstamo - CobroApp',
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comprobante-prestamo.png';
        a.click();
        mostrarToast("📸 Ficha descargada en tu dispositivo");
      }
    });
  });
}

// ==========================================
// 4. CALENDARIO VISUAL CON FECHA LOCAL EXACTA
// ==========================================

function cambiarMesCalendarioVisual(offset) {
  fechaMesCalendarioVisual.setMonth(fechaMesCalendarioVisual.getMonth() + offset);
  renderizarGridCalendarioVisual();
}

function renderizarGridCalendarioVisual() {
  const container = document.getElementById('cal-vis-grid-dias');
  const txtTitulo = document.getElementById('cal-vis-titulo-mes');
  if (!container) return;

  container.innerHTML = '';
  const anio = fechaMesCalendarioVisual.getFullYear();
  const mes = fechaMesCalendarioVisual.getMonth();

  const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  if (txtTitulo) txtTitulo.innerText = `${mesesNombres[mes]} ${anio}`;

  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);

  let primerDiaSemana = primerDia.getDay() - 1;
  if (primerDiaSemana === -1) primerDiaSemana = 6;

  for (let i = 0; i < primerDiaSemana; i++) {
    container.innerHTML += `<div class="p-2 opacity-20"></div>`;
  }

  const hoyISO = obtenerFechaLocalISO();

  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    const fechaIter = new Date(anio, mes, d);
    const isoDia = obtenerFechaLocalISO(fechaIter);

    let tieneCuotas = false;
    let tieneAtraso = false;
    let tienePendiente = false;
    let todoCobrado = true;

    (window.prestamos || []).forEach(p => {
      if (p.estado === 'finalizado') return;
      (p.cuotasDetalle || []).forEach(c => {
        if (c.fecha === isoDia) {
          tieneCuotas = true;
          const estaPagado = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
          if (!estaPagado) {
            todoCobrado = false;
            if (isoDia <= hoyISO) tieneAtraso = true;
            else tienePendiente = true;
          }
        }
      });
    });

    let claseBg = "bg-slate-800/40 text-slate-300 border-slate-800";
    if (tieneCuotas) {
      if (todoCobrado) claseBg = "bg-emerald-950/60 text-emerald-300 border-emerald-500/50 font-bold";
      else if (tieneAtraso) claseBg = "bg-red-950/60 text-red-300 border-red-500/50 font-bold";
      else if (tienePendiente) claseBg = "bg-amber-950/60 text-amber-300 border-amber-500/50 font-bold";
    }

    if (isoDia === hoyISO) claseBg += " ring-2 ring-fuchsia-500 font-extrabold";

    container.innerHTML += `
      <div onclick="seleccionarDiaCalendarioVisual('${isoDia}')" class="p-2 rounded-xl border ${claseBg} cursor-pointer transition hover:scale-105 flex flex-col items-center justify-between min-h-[42px]">
        <span>${d}</span>
        ${tieneCuotas ? `<span class="w-2 h-2 rounded-full ${todoCobrado ? 'bg-emerald-400' : (tieneAtraso ? 'bg-red-400' : 'bg-amber-400')}"></span>` : ''}
      </div>
    `;
  }

  renderizarDeudasPasadasBajoCalendario();
}

function seleccionarDiaCalendarioVisual(isoFecha) {
  const [y, m, d] = isoFecha.split('-').map(Number);
  fechaSemanaSeleccionada = new Date(y, m - 1, d);
  renderizarPlanificadorSemanal();
  mostrarToast(`📅 Mostrando cobros para el ${isoFecha}`);
}

// ==========================================
// 5. DEUDAS PASADAS Y PLANIFICADOR SEMANAL
// ==========================================

function renderizarDeudasPasadasBajoCalendario() {
  const contenedorPadre = document.getElementById('sec-deudas-pasadas-contenedor');
  const listaDeudas = document.getElementById('lista-deudas-pasadas');
  const badgeTotal = document.getElementById('badge-total-deudas-pasadas');
  if (!contenedorPadre || !listaDeudas) return;

  const hoyISO = obtenerFechaLocalISO();
  listaDeudas.innerHTML = '';
  let cantidadDeudasPasadas = 0;

  (window.prestamos || []).forEach(p => {
    if (p.estado === 'finalizado') return;

    const cli = (window.clientes || []).find(c => c.id === p.clienteId);
    const cuotasVencidas = (p.cuotasDetalle || []).filter(c => {
      const pag = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
      return !pag && c.fecha < hoyISO;
    });

    if (cuotasVencidas.length > 0) {
      cantidadDeudasPasadas += cuotasVencidas.length;

      let sumaBaseDeuda = 0;
      let diasMax = 0;

      cuotasVencidas.forEach(cv => {
        const valPend = cv.montoPendiente !== undefined ? cv.montoPendiente : cv.montoCuota;
        sumaBaseDeuda += Math.round(parseFloat(valPend || 0));
        
        const diff = calcularDiasDeDiferencia(cv.fecha, hoyISO);
        if (diff > diasMax) diasMax = diff;
      });

      listaDeudas.innerHTML += `
        <div class="p-4 rounded-2xl bg-red-950/40 border border-red-500/60 space-y-2">
          <div class="flex justify-between items-center">
            <h5 class="font-bold text-white text-base">${cli ? cli.nombre : 'Cliente'}</h5>
            <span class="text-xs bg-red-500/20 text-red-400 border border-red-500/40 px-2.5 py-1 rounded-full font-bold">🔴 ${cuotasVencidas.length} Cuota(s) Vencida(s)</span>
          </div>
          <p class="text-xs text-slate-300">Deuda vencida base: <strong class="text-red-400">$${sumaBaseDeuda.toLocaleString('es-AR')}</strong> | Atraso máximo: <strong>${diasMax} días</strong></p>
          <button onclick="abrirModalPagoAtrasadoTotal('${p.clienteId}', ${sumaBaseDeuda}, ${diasMax})" class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-xs shadow-lg transition">
            💵 Regularizar Deuda Vencida (Con/Sin Recargo)
          </button>
        </div>
      `;
    }
  });

  if (cantidadDeudasPasadas > 0) {
    contenedorPadre.classList.remove('hidden');
    if (badgeTotal) badgeTotal.innerText = `${cantidadDeudasPasadas} Vencidas`;
  } else {
    contenedorPadre.classList.add('hidden');
  }
}

function cambiarSemanaPlanificador(offsetSemanas) {
  fechaSemanaSeleccionada.setDate(fechaSemanaSeleccionada.getDate() + (offsetSemanas * 7));
  renderizarPlanificadorSemanal();
}

function renderizarPlanificadorSemanal() {
  const contenedor = document.getElementById('grid-dias-semana');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  const inicioSemana = obtenerLunesSemana(fechaSemanaSeleccionada);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(finSemana.getDate() + 6);

  const lunesSeleccionado = new Date(inicioSemana);
  lunesSeleccionado.setHours(0, 0, 0, 0);

  const lunesHoy = obtenerLunesSemana(new Date());
  lunesHoy.setHours(0, 0, 0, 0);

  const diffTiempo = lunesSeleccionado.getTime() - lunesHoy.getTime();
  const diffDias = Math.round(diffTiempo / (1000 * 60 * 60 * 24));

  let estadoSemanaTxt = "(Actual)";
  if (diffDias > 0) estadoSemanaTxt = "(Siguiente)";
  else if (diffDias < 0) estadoSemanaTxt = "(Anterior)";

  const elemTituloPlanificador = document.getElementById('titulo-planificador-semanal');
  if (elemTituloPlanificador) {
    elemTituloPlanificador.innerText = `Planificador & Cobros de la Semana ${estadoSemanaTxt}`;
  }

  const txtRango = document.getElementById('rango-semana-actual');
  if (txtRango) {
    txtRango.innerText = `${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1} al ${finSemana.getDate()}/${finSemana.getMonth() + 1}`;
  }

  const hoyISO = obtenerFechaLocalISO();

  for (let i = 0; i < 7; i++) {
    const diaActual = new Date(inicioSemana);
    diaActual.setDate(diaActual.getDate() + i);
    const isoDia = obtenerFechaLocalISO(diaActual);

    let htmlCuotasDia = '';
    let cobrosAgendadosCount = 0;

    (window.prestamos || []).forEach(p => {
      if (p.estado === 'finalizado') return;

      const cli = (window.clientes || []).find(c => c.id === p.clienteId);
      const nombreCliente = cli ? cli.nombre : 'Cliente Desconocido';
      const telefonoCliente = cli ? cli.telefono : '';

      const cuotasAtrasadasAnteriores = (p.cuotasDetalle || []).filter(c => {
        const pag = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
        return !pag && c.fecha < isoDia && c.fecha < hoyISO;
      });

      let totalMontoAtrasado = 0;
      let diasMaxAtraso = 0;

      if (cuotasAtrasadasAnteriores.length > 0) {
        cuotasAtrasadasAnteriores.forEach(ca => {
          const valPend = ca.montoPendiente !== undefined ? ca.montoPendiente : ca.montoCuota;
          totalMontoAtrasado += Math.round(parseFloat(valPend || 0));
          const diffDias = calcularDiasDeDiferencia(ca.fecha, isoDia);
          if (diffDias > diasMaxAtraso) diasMaxAtraso = diffDias;
        });
      }

      (p.cuotasDetalle || []).forEach(c => {
        if (c.fecha === isoDia) {
          cobrosAgendadosCount++;
          const estaPagado = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
          const esPasado = isoDia < hoyISO;

          let badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 Pendiente</span>';
          if (estaPagado) badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Cobrado</span>';
          else if (esPasado) badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">🔴 Atrasado</span>';

          let htmlAlertaAtraso = '';
          if (!estaPagado && totalMontoAtrasado > 0) {
            htmlAlertaAtraso = `
              <div class="mt-2 p-2.5 rounded-xl bg-red-950/40 border border-red-500/50 space-y-1.5">
                <div class="flex justify-between items-center text-xs text-red-300 font-bold">
                  <span>🚨 Atrasos Anteriores Pendientes:</span>
                  <span class="text-white font-black">$${totalMontoAtrasado.toLocaleString('es-AR')}</span>
                </div>
                <p class="text-[10px] text-slate-300">Demora acumulada: <strong>${diasMaxAtraso} días</strong></p>
                <button onclick="abrirModalPagoAtrasadoTotal('${p.clienteId}', ${totalMontoAtrasado}, ${diasMaxAtraso})" class="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] py-1.5 rounded-lg shadow transition">
                  💵 Cobrar Deuda con Recargo Opcional
                </button>
              </div>
            `;
          }

          htmlCuotasDia += `
            <div class="p-3 bg-[#0F172A] border border-slate-800 rounded-xl space-y-2">
              <div class="flex justify-between items-start">
                <div>
                  <h6 class="font-extrabold text-sm text-white">${nombreCliente}</h6>
                  <p class="text-xs text-slate-400">Cuota #${c.numero} - <strong class="text-fuchsia-400">$${Math.round(parseFloat(c.montoCuota)).toLocaleString('es-AR')}</strong></p>
                </div>
                ${badgeEstado}
              </div>

              ${!estaPagado ? `
                <div class="grid grid-cols-2 gap-2 pt-1">
                  <button onclick="abrirModalPago('${p.id}', '${c.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-lg text-xs transition flex items-center justify-center gap-1">
                    💵 Registrar
                  </button>
                  <button onclick="abrirModalSeleccionarCobro('${p.id}', '${c.id}', ${c.montoCuota}, '${nombreCliente.replace(/'/g, "\\'")}', ${c.numero}, '${telefonoCliente}')" class="bg-sky-600 hover:bg-sky-500 text-white font-bold py-1.5 rounded-lg text-xs transition flex items-center justify-center gap-1">
                    📲 Enviar Cobro
                  </button>
                </div>
              ` : ''}

              ${htmlAlertaAtraso}
            </div>
          `;
        }
      });
    });

    const diasNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const esHoy = isoDia === hoyISO;

    contenedor.innerHTML += `
      <div class="p-3 bg-[#1E293B]/60 border ${esHoy ? 'border-fuchsia-500/80 ring-1 ring-fuchsia-500/50' : 'border-slate-800'} rounded-2xl space-y-3">
        <div class="flex justify-between items-center border-b border-slate-800 pb-2">
          <span class="font-bold text-xs uppercase tracking-wider ${esHoy ? 'text-fuchsia-400' : 'text-slate-300'}">${diasNombres[i]} ${diaActual.getDate()}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-extrabold ${cobrosAgendadosCount > 0 ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30' : 'bg-slate-800 text-slate-500'}">${cobrosAgendadosCount}</span>
        </div>
        <div class="space-y-2">
          ${cobrosAgendadosCount === 0 ? '<p class="text-[11px] text-slate-500 italic p-2 text-center">Sin cobros agendados</p>' : htmlCuotasDia}
        </div>
      </div>
    `;
  }
}

function obtenerLunesSemana(fecha) {
  const d = new Date(fecha);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// ==========================================
// 6. RESUMEN: ACTIVOS VS FINALIZADOS EN CARPETAS
// ==========================================

function alternarPestanaResumen(pestana) {
  pestanaResumenActual = pestana;
  const btnActivos = document.getElementById('btn-tab-activos');
  const btnFinalizados = document.getElementById('btn-tab-finalizados');

  if (pestana === 'activos') {
    if (btnActivos) btnActivos.className = "px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow";
    if (btnFinalizados) btnFinalizados.className = "px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition";
  } else {
    if (btnFinalizados) btnFinalizados.className = "px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow";
    if (btnActivos) btnActivos.className = "px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition";
  }

  renderizarResumenYPrestamos();
}

function renderizarResumenYPrestamos() {
  const elemCap = document.getElementById('resumen-capital');
  const elemGan = document.getElementById('resumen-ganancia');
  const contResumen = document.getElementById('contenedor-vista-resumen-tabla');
  const tituloTabla = document.getElementById('titulo-tabla-resumen');
  if (!contResumen) return;

  let totalCapital = 0;
  let totalGanancia = 0;

  (window.prestamos || []).filter(p => p.estado !== 'finalizado').forEach(p => {
    totalCapital += Math.round(parseFloat(p.monto || 0));
    totalGanancia += Math.round(parseFloat(p.ganancia || 0));
  });

  if (elemCap) elemCap.innerText = '$' + totalCapital.toLocaleString('es-AR');
  if (elemGan) elemGan.innerText = '+$' + totalGanancia.toLocaleString('es-AR');

  if (pestanaResumenActual === 'activos') {
    if (tituloTabla) tituloTabla.innerText = "Préstamos Activos en Curso";
    const activos = (window.prestamos || []).filter(p => p.estado !== 'finalizado');

    if (activos.length === 0) {
      contResumen.innerHTML = '<p class="p-6 text-center text-slate-500 italic">No hay préstamos activos en curso.</p>';
      return;
    }

    let htmlTabla = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs text-slate-400 uppercase bg-[#1E293B]/60 border-b border-slate-800">
            <tr>
              <th class="p-3">Cliente</th>
              <th class="p-3">Inicio</th>
              <th class="p-3">Prestado</th>
              <th class="p-3">Total Devolución</th>
              <th class="p-3">Cuánto Falta</th>
              <th class="p-3">Plan</th>
              <th class="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
    `;

    activos.forEach(p => {
      const cli = (window.clientes || []).find(c => c.id === p.clienteId);
      let cobrado = 0;
      (p.cuotasDetalle || []).forEach(c => {
        const estaPagado = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
        if (estaPagado) cobrado += Math.round(parseFloat(c.montoCuota));
      });
      const restante = Math.max(0, Math.round(parseFloat(p.montoTotal) - cobrado));

      htmlTabla += `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/30">
          <td class="p-3 font-bold text-white">${cli ? cli.nombre : 'Cliente'}</td>
          <td class="p-3 text-slate-300">${p.fechaInicio}</td>
          <td class="p-3 font-bold text-slate-200">$${Math.round(parseFloat(p.monto)).toLocaleString('es-AR')}</td>
          <td class="p-3 font-extrabold text-fuchsia-400">$${Math.round(parseFloat(p.montoTotal)).toLocaleString('es-AR')}</td>
          <td class="p-3 font-bold text-amber-400">$${restante.toLocaleString('es-AR')}</td>
          <td class="p-3 text-slate-400">${p.cuotas} (${p.frecuencia})</td>
          <td class="p-3 flex gap-2">
            <button onclick="verDetallePrestamoActivo('${p.id}')" class="px-2 py-1 text-xs bg-slate-800 text-fuchsia-400 rounded-lg border border-slate-700 font-bold">📊 Detalle</button>
            <button onclick="solicitarFinalizarPrestamo('${p.id}')" class="px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30 font-bold">🏁 Finalizar</button>
            <button onclick="solicitarEliminarPrestamo('${p.id}')" class="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 font-bold">🗑️</button>
          </td>
        </tr>
      `;
    });

    htmlTabla += `</tbody></table></div>`;
    contResumen.innerHTML = htmlTabla;

  } else {
    if (tituloTabla) tituloTabla.innerText = "Carpetas de Préstamos Finalizados";
    const finalizados = (window.prestamos || []).filter(p => p.estado === 'finalizado');

    if (finalizados.length === 0) {
      contResumen.innerHTML = '<p class="p-6 text-center text-slate-500 italic">No tenés préstamos finalizados guardados en el historial.</p>';
      return;
    }

    const gruposCarpetas = {};
    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    finalizados.forEach(p => {
      const fechaBase = p.fechaFinalizacion || p.fechaInicio || '2026-01-01';
      const [y, m] = fechaBase.split('-');
      const keyCarpeta = `${y}-${m}`;
      const nombreCarpeta = `${nombresMeses[parseInt(m) - 1]} ${y}`;

      if (!gruposCarpetas[keyCarpeta]) {
        gruposCarpetas[keyCarpeta] = { titulo: nombreCarpeta, items: [] };
      }
      gruposCarpetas[keyCarpeta].items.push(p);
    });

    let htmlCarpetas = '<div class="space-y-4 p-2">';

    Object.keys(gruposCarpetas).sort().reverse().forEach(key => {
      const grupo = gruposCarpetas[key];
      htmlCarpetas += `
        <div class="border border-slate-800 rounded-2xl overflow-hidden bg-[#0F172A] shadow-lg">
          <button onclick="alternarCarpetaFinalizados('carpeta-${key}')" class="w-full bg-[#1E293B]/80 hover:bg-[#1E293B] p-4 font-bold text-left text-fuchsia-300 flex justify-between items-center transition">
            <span class="flex items-center gap-2.5 text-base">📁 ${grupo.titulo}</span>
            <span class="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-extrabold">${grupo.items.length} Préstamo(s) Finalizado(s)</span>
          </button>
          <div id="carpeta-${key}" class="hidden p-4 overflow-x-auto space-y-2 border-t border-slate-800 bg-[#090D16]/50">
            <table class="w-full text-left text-sm">
              <thead class="text-xs text-slate-400 uppercase bg-[#1E293B]/40">
                <tr>
                  <th class="p-2.5">Cliente</th>
                  <th class="p-2.5">Inicio</th>
                  <th class="p-2.5">Prestado</th>
                  <th class="p-2.5">Total Cobrado</th>
                  <th class="p-2.5">Plan</th>
                  <th class="p-2.5">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
      `;

      grupo.items.forEach(p => {
        const cli = (window.clientes || []).find(c => c.id === p.clienteId);
        htmlCarpetas += `
          <tr class="hover:bg-slate-800/30">
            <td class="p-2.5 font-bold text-white">${cli ? cli.nombre : 'Cliente'}</td>
            <td class="p-2.5 text-slate-300">${p.fechaInicio}</td>
            <td class="p-2.5 font-bold text-slate-200">$${Math.round(parseFloat(p.monto)).toLocaleString('es-AR')}</td>
            <td class="p-2.5 font-extrabold text-emerald-400">$${Math.round(parseFloat(p.montoTotal)).toLocaleString('es-AR')}</td>
            <td class="p-2.5 text-slate-400">${p.cuotas} (${p.frecuencia})</td>
            <td class="p-2.5 flex gap-2">
              <button onclick="verDetallePrestamoActivo('${p.id}')" class="px-2 py-1 text-xs bg-slate-800 text-fuchsia-400 rounded-lg border border-slate-700 font-bold">📊 Ficha</button>
              <button onclick="solicitarEliminarPrestamo('${p.id}')" class="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 font-bold">🗑️</button>
            </td>
          </tr>
        `;
      });

      htmlCarpetas += `</tbody></table></div></div>`;
    });

    htmlCarpetas += '</div>';
    contResumen.innerHTML = htmlCarpetas;
  }
}

function alternarCarpetaFinalizados(idCarpeta) {
  const elem = document.getElementById(idCarpeta);
  if (elem) elem.classList.toggle('hidden');
}

function verDetallePrestamoActivo(prestamoId) {
  const p = (window.prestamos || []).find(pr => pr.id === prestamoId);
  if (!p) return;

  const cli = (window.clientes || []).find(c => c.id === p.clienteId);
  document.getElementById('det-act-cliente').innerText = cli ? cli.nombre : 'Cliente';
  document.getElementById('det-act-fechainicio').innerText = p.fechaInicio;
  document.getElementById('det-act-monto').innerText = '$' + Math.round(parseFloat(p.monto)).toLocaleString('es-AR');
  document.getElementById('det-act-total').innerText = '$' + Math.round(parseFloat(p.montoTotal)).toLocaleString('es-AR');
  document.getElementById('det-act-ganancia').innerText = '+$' + Math.round(parseFloat(p.ganancia)).toLocaleString('es-AR');

  let cobrado = 0;
  (p.cuotasDetalle || []).forEach(c => {
    const estaPagado = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
    if (estaPagado) cobrado += Math.round(parseFloat(c.montoCuota));
  });
  const restante = Math.max(0, Math.round(parseFloat(p.montoTotal) - cobrado));

  document.getElementById('det-act-falta').innerText = '$' + restante.toLocaleString('es-AR');

  const listaCuotas = document.getElementById('det-act-lista-cuotas');
  if (listaCuotas) {
    listaCuotas.innerHTML = '';
    const hoyISO = obtenerFechaLocalISO();

    (p.cuotasDetalle || []).forEach(c => {
      const estaPagado = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
      let estadoTxt = '<span class="text-amber-400 font-bold">🟡 Pendiente</span>';
      if (estaPagado) estadoTxt = '<span class="text-emerald-400 font-bold">🟢 Cobrado</span>';
      else if (c.fecha < hoyISO) estadoTxt = '<span class="text-red-400 font-bold">🔴 Atrasado</span>';

      listaCuotas.innerHTML += `
        <div class="flex justify-between items-center p-2 bg-slate-900/80 rounded-lg text-xs border border-slate-800">
          <span>Cuota #${c.numero} (${c.fecha})</span>
          <strong>$${Math.round(parseFloat(c.montoCuota)).toLocaleString('es-AR')}</strong>
          ${estadoTxt}
        </div>
      `;
    });
  }

  document.getElementById('modal-detalle-prestamo-activo').classList.remove('hidden');
}

function cerrarModalDetalleActivo() {
  document.getElementById('modal-detalle-prestamo-activo').classList.add('hidden');
}

function solicitarFinalizarPrestamo(id) {
  idPrestamoAFinalizar = id;
  const p = (window.prestamos || []).find(pr => pr.id === id);
  const cli = (window.clientes || []).find(c => c.id === (p ? p.clienteId : ''));

  document.getElementById('fin-prestamo-cliente').innerText = cli ? cli.nombre : 'Cliente';
  document.getElementById('fin-prestamo-monto').innerText = '$' + (p ? Math.round(parseFloat(p.montoTotal)).toLocaleString('es-AR') : '0');
  document.getElementById('modal-confirmar-finalizar-prestamo').classList.remove('hidden');
}

function cerrarModalFinalizarPrestamo() {
  document.getElementById('modal-confirmar-finalizar-prestamo').classList.add('hidden');
  idPrestamoAFinalizar = null;
}

async function confirmarFinalizacionPrestamo() {
  if (!idPrestamoAFinalizar) return;
  try {
    await db.collection('prestamos').doc(idPrestamoAFinalizar).update({
      estado: 'finalizado',
      fechaFinalizacion: obtenerFechaLocalISO()
    });
    mostrarToast("🏁 Préstamo archivado en Finalizados");
    cerrarModalFinalizarPrestamo();
  } catch (error) {
    mostrarToast("Error al finalizar préstamo", "error");
  }
}

function solicitarEliminarPrestamo(id) {
  const rol = window.rolUsuarioActual || window.datosUsuarioActual?.rol;
  if (rol === 'cobrador') {
    return mostrarToast("⛔ Opción no permitida para perfil Cobrador", "error");
  }

  idPrestamoAEliminar = id;
  const p = (window.prestamos || []).find(pr => pr.id === id);
  const cli = (window.clientes || []).find(c => c.id === (p ? p.clienteId : ''));

  document.getElementById('del-prestamo-cliente').innerText = cli ? cli.nombre : 'Cliente';
  document.getElementById('del-prestamo-monto').innerText = '$' + (p ? Math.round(parseFloat(p.montoTotal)).toLocaleString('es-AR') : '0');
  document.getElementById('modal-confirmar-eliminar-prestamo').classList.remove('hidden');
}

function cerrarModalEliminarPrestamo() {
  document.getElementById('modal-confirmar-eliminar-prestamo').classList.add('hidden');
  idPrestamoAEliminar = null;
}

async function confirmarEliminacionPrestamo() {
  if (!idPrestamoAEliminar) return;
  try {
    await db.collection('prestamos').doc(idPrestamoAEliminar).delete();
    mostrarToast("🗑️ Préstamo eliminado del sistema");
    cerrarModalEliminarPrestamo();
  } catch (error) {
    mostrarToast("Error al eliminar préstamo", "error");
  }
}

// ==========================================
// 7. ESTADO DE CUENTAS GENERAL
// ==========================================

function renderizarEstadoCuentas() {
  const container = document.getElementById('lista-cobros-dia');
  const badgeAlertas = document.getElementById('badge-alertas-panel');
  const badgeMenu = document.getElementById('badge-alertas-menu');
  if (!container) return;

  container.innerHTML = '';
  const hoyISO = obtenerFechaLocalISO();
  let atrasosTotales = 0;

  (window.prestamos || []).forEach(p => {
    if (p.estado === 'finalizado') return;

    const cli = (window.clientes || []).find(c => c.id === p.clienteId);
    const cuotasAtrasadas = (p.cuotasDetalle || []).filter(c => {
      const pag = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
      return !pag && c.fecha < hoyISO;
    });

    if (cuotasAtrasadas.length > 0) {
      atrasosTotales += cuotasAtrasadas.length;
      let montoBaseAtraso = 0;
      cuotasAtrasadas.forEach(ca => {
        const valPend = ca.montoPendiente !== undefined ? ca.montoPendiente : ca.montoCuota;
        montoBaseAtraso += Math.round(parseFloat(valPend || 0));
      });

      container.innerHTML += `
        <div class="p-4 rounded-2xl bg-red-950/20 border border-red-500/40 space-y-2">
          <div class="flex justify-between items-center">
            <h5 class="font-bold text-white text-base">${cli ? cli.nombre : 'Cliente'}</h5>
            <span class="text-xs bg-red-500/20 text-red-400 border border-red-500/40 px-2.5 py-1 rounded-full font-bold">🚨 ${cuotasAtrasadas.length} Cuota(s) Atrasada(s)</span>
          </div>
          <p class="text-xs text-slate-300">Deuda vencida acumulada: <strong class="text-red-400">$${montoBaseAtraso.toLocaleString('es-AR')}</strong></p>
          <button onclick="abrirModalPagoAtrasadoTotal('${p.clienteId}', ${montoBaseAtraso}, 5)" class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-xs transition">
            💵 Regularizar Deuda con Recargo
          </button>
        </div>
      `;
    }
  });

  if (atrasosTotales === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic p-2">¡No tenés cuotas atrasadas registradas!</p>';
  }

  if (badgeAlertas) badgeAlertas.innerText = `${atrasosTotales} Atrasos`;
  if (badgeMenu) badgeMenu.innerText = atrasosTotales;
}

// ==========================================
// 8. PAGO AGRUPADO Y PASE AUTOMÁTICO A FINALIZADO
// ==========================================

function abrirModalPagoAtrasadoTotal(clienteId, montoBase, diasAtraso) {
  const cli = (window.clientes || []).find(c => c.id === clienteId);
  if (!cli) return;

  const prestamosCliente = (window.prestamos || []).filter(p => p.clienteId === clienteId && p.estado !== 'finalizado');
  let saldoTotalDeuda = 0;
  prestamosCliente.forEach(p => {
    (p.cuotasDetalle || []).forEach(c => {
      const pag = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
      if (!pag) saldoTotalDeuda += Math.round(c.montoPendiente !== undefined ? c.montoPendiente : c.montoCuota);
    });
  });

  const recargoPct = calcularPorcentajeRecargoEscalonado(diasAtraso);
  const montoRecargo = Math.round(montoBase * (recargoPct / 100));

  datosPagoAtrasadoAgrupadoActual = {
    clienteId,
    montoBase: Math.round(montoBase),
    montoRecargo,
    diasAtraso,
    saldoTotalDeuda: Math.round(saldoTotalDeuda)
  };

  document.getElementById('pago-atrasado-cliente-id').value = clienteId;
  document.getElementById('pago-atrasado-cli-nombre').innerText = cli.nombre;
  document.getElementById('pago-atrasado-monto-base').innerText = '$' + Math.round(montoBase).toLocaleString('es-AR');
  document.getElementById('pago-atrasado-tiempo-txt').innerText = diasAtraso + ' días';
  document.getElementById('pago-atrasado-monto-recargo').innerText = montoRecargo.toLocaleString('es-AR');
  
  const chkRecargo = document.getElementById('chk-aplicar-retraso-agrupado');
  if (chkRecargo) chkRecargo.checked = true;

  alternarRecargoAgrupado();
  document.getElementById('modal-pago-atrasado-agrupado').classList.remove('hidden');
}

function alternarRecargoAgrupado() {
  if (!datosPagoAtrasadoAgrupadoActual) return;

  const chk = document.getElementById('chk-aplicar-retraso-agrupado');
  const aplicaRecargo = chk ? chk.checked : true;

  const recargoFinal = aplicaRecargo ? datosPagoAtrasadoAgrupadoActual.montoRecargo : 0;
  const totalSugerido = Math.round(datosPagoAtrasadoAgrupadoActual.montoBase + recargoFinal);

  document.getElementById('pago-atrasado-monto-total').innerText = '$' + totalSugerido.toLocaleString('es-AR');
  const inputMonto = document.getElementById('pago-atrasado-monto-ingresado');
  if (inputMonto) {
    inputMonto.value = totalSugerido;
    validarMontoPagoAtrasado(totalSugerido);
  }
}

function validarMontoPagoAtrasado(val) {
  const montoNum = Math.round(parseFloat(val) || 0);
  const elemHint = document.getElementById('pago-atrasado-max-hint');
  const btnSubmit = document.getElementById('btn-confirmar-pago-atrasado');

  convertirMontoPagoAtrasadoEnLetras(montoNum);

  if (!datosPagoAtrasadoAgrupadoActual) return;

  const maxPermitido = Math.round(datosPagoAtrasadoAgrupadoActual.saldoTotalDeuda + datosPagoAtrasadoAgrupadoActual.montoRecargo);

  if (montoNum > maxPermitido && maxPermitido > 0) {
    if (elemHint) elemHint.innerText = `⚠️ El monto no puede superar la deuda total de $${maxPermitido.toLocaleString('es-AR')}`;
    if (btnSubmit) btnSubmit.disabled = true;
  } else {
    if (elemHint) elemHint.innerText = `Saldo total de deuda: $${datosPagoAtrasadoAgrupadoActual.saldoTotalDeuda.toLocaleString('es-AR')}`;
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

function cerrarModalPagoAtrasadoTotal() {
  document.getElementById('modal-pago-atrasado-agrupado').classList.add('hidden');
  datosPagoAtrasadoAgrupadoActual = null;
}

// PAGO AGRUPADO (SEPARA RECARGO DE CAPITAL)
async function confirmarPagoAtrasadoAgrupado(event) {
  if (event && event.preventDefault) event.preventDefault();
  const clienteId = document.getElementById('pago-atrasado-cliente-id').value;
  const montoPagado = Math.round(parseFloat(document.getElementById('pago-atrasado-monto-ingresado').value) || 0);

  if (montoPagado <= 0) return mostrarToast("Ingresá un monto válido", "error");

  try {
    const chkRecargo = document.getElementById('chk-aplicar-retraso-agrupado');
    const aplicaRecargo = chkRecargo ? chkRecargo.checked : false;

    let recargoAplicado = 0;
    if (aplicaRecargo && datosPagoAtrasadoAgrupadoActual && datosPagoAtrasadoAgrupadoActual.montoRecargo > 0) {
      recargoAplicado = datosPagoAtrasadoAgrupadoActual.montoRecargo;
    }

    let saldoIngresado = Math.max(0, montoPagado - recargoAplicado);

    const prestamosCliente = (window.prestamos || []).filter(p => String(p.clienteId) === String(clienteId) && p.estado !== 'finalizado');
    
    for (let p of prestamosCliente) {
      if (saldoIngresado <= 0) break;

      let cuotasActualizadas = p.cuotasDetalle.map(c => {
        const estaPagadoYa = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
        if (!estaPagadoYa && saldoIngresado > 0) {
          const pendiente = Math.round(c.montoPendiente !== undefined ? c.montoPendiente : c.montoCuota);
          if (saldoIngresado >= pendiente - 0.5) {
            saldoIngresado -= pendiente;
            return { ...c, pagado: true, montoPendiente: 0 };
          } else {
            const nuevoPendiente = Math.max(0, Math.round(pendiente - saldoIngresado));
            saldoIngresado = 0;
            return { ...c, pagado: nuevoPendiente <= 0.5, montoPendiente: nuevoPendiente };
          }
        }
        return c;
      });

      const todasPagadas = cuotasActualizadas.every(c => c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5));
      const dataUpdate = { cuotasDetalle: cuotasActualizadas };

      if (todasPagadas) {
        dataUpdate.estado = 'finalizado';
        dataUpdate.fechaFinalizacion = obtenerFechaLocalISO();
      }

      await db.collection('prestamos').doc(p.id).update(dataUpdate);
    }

    mostrarToast("💵 Deuda regularizada correctamente");
    cerrarModalPagoAtrasadoTotal();

    const cli = (window.clientes || []).find(c => String(c.id) === String(clienteId));
    
    abrirModalComprobante(
      cli ? cli.nombre : 'Cliente',
      montoPagado,
      new Date().toLocaleString('es-AR'),
      'Pago Agrupado de Deuda Atrasada',
      0,
      cli ? cli.telefono : ''
    );
  } catch (error) {
    console.error("Error en pago atrasado:", error);
    mostrarToast("Error al registrar pago", "error");
  }
}

// PAGO INDIVIDUAL DE CUOTA (SEPARA RECARGO DE CAPITAL)
async function confirmarRegistroPago(event) {
  if (event && event.preventDefault) event.preventDefault();
  const prestamoId = document.getElementById('pago-prestamo-id').value;
  const cuotaId = document.getElementById('pago-cuota-id').value;
  const montoIngresado = Math.round(parseFloat(document.getElementById('pago-monto-ingresado').value) || 0);

  const p = (window.prestamos || []).find(pr => pr.id === prestamoId);
  if (!p) return;

  const cuotaPagadaObj = p.cuotasDetalle ? p.cuotasDetalle.find(c => c.id === cuotaId) : null;
  const numeroCuotaPagada = cuotaPagadaObj ? cuotaPagadaObj.numero : '';
  const totalCuotasNum = p.cuotas || (p.cuotasDetalle ? p.cuotasDetalle.length : 1);

  try {
    const chkRecargo = document.getElementById('chk-aplicar-retraso-cuota');
    const aplicaRecargo = chkRecargo ? chkRecargo.checked : false;

    let recargoAplicado = 0;
    if (aplicaRecargo && datosPagoCuotaActual && datosPagoCuotaActual.montoRecargo > 0) {
      recargoAplicado = datosPagoCuotaActual.montoRecargo;
    }

    let cobroRestante = Math.max(0, montoIngresado - recargoAplicado);

    const nuevasCuotas = p.cuotasDetalle.map(c => {
      const estaPagadoYa = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
      if (c.id === cuotaId || (cobroRestante > 0 && !estaPagadoYa)) {
        const pendiente = Math.round(c.montoPendiente !== undefined ? c.montoPendiente : c.montoCuota);
        if (cobroRestante >= pendiente - 0.5) {
          cobroRestante -= pendiente;
          return { ...c, pagado: true, montoPendiente: 0 };
        } else if (cobroRestante > 0) {
          const nuevoPendiente = Math.max(0, Math.round(pendiente - cobroRestante));
          cobroRestante = 0;
          return { ...c, pagado: nuevoPendiente <= 0.5, montoPendiente: nuevoPendiente };
        }
      }
      return c;
    });

    const todasPagadas = nuevasCuotas.every(c => c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5));
    const dataUpdate = { cuotasDetalle: nuevasCuotas };

    if (todasPagadas) {
      dataUpdate.estado = 'finalizado';
      dataUpdate.fechaFinalizacion = obtenerFechaLocalISO();
    }

    await db.collection('prestamos').doc(prestamoId).update(dataUpdate);

    if (todasPagadas) {
      mostrarToast("🎉 ¡Préstamo pagado al 100% y enviado a Finalizados!");
    } else {
      mostrarToast("✅ Pago de cuota registrado");
    }

    cerrarModalPago();

    const cli = (window.clientes || []).find(c => c.id === p.clienteId);
    let saldoPendiente = 0;
    nuevasCuotas.forEach(c => {
      const estaPagado = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
      if (!estaPagado) {
        saldoPendiente += Math.round(c.montoPendiente !== undefined ? c.montoPendiente : c.montoCuota);
      }
    });

    const conceptoTexto = `Pago Cuota #${numeroCuotaPagada} de ${totalCuotasNum}`;

    abrirModalComprobante(
      cli ? cli.nombre : 'Cliente',
      montoIngresado,
      new Date().toLocaleString('es-AR'),
      conceptoTexto,
      saldoPendiente,
      cli ? cli.telefono : ''
    );
  } catch (error) {
    mostrarToast("Error al registrar pago", "error");
  }
}

// ==========================================
// 9. PAGO CUOTA INDIVIDUAL Y MODAL CONTROL
// ==========================================

function abrirModalPago(prestamoId, cuotaId) {
  const p = (window.prestamos || []).find(pr => pr.id === prestamoId);
  if (!p) return;

  const cuota = (p.cuotasDetalle || []).find(c => c.id === cuotaId);
  if (!cuota) return;

  const cli = (window.clientes || []).find(c => c.id === p.clienteId);

  let saldoTotalPrestamo = 0;
  (p.cuotasDetalle || []).forEach(c => {
    const pag = c.pagado === true || (c.montoPendiente !== undefined && c.montoPendiente <= 0.5);
    if (!pag) {
      saldoTotalPrestamo += Math.round(c.montoPendiente !== undefined ? c.montoPendiente : c.montoCuota);
    }
  });

  const hoyISO = obtenerFechaLocalISO();
  let diasAtraso = 0;
  const estaPagadaYa = cuota.pagado === true || (cuota.montoPendiente !== undefined && cuota.montoPendiente <= 0.5);

  if (cuota.fecha < hoyISO && !estaPagadaYa) {
    diasAtraso = Math.max(0, calcularDiasDeDiferencia(cuota.fecha, hoyISO));
  }

  const recargoPct = calcularPorcentajeRecargoEscalonado(diasAtraso);
  
  let montoBaseCuota = Math.round(cuota.montoPendiente !== undefined ? cuota.montoPendiente : cuota.montoCuota);
  if (estaPagadaYa || montoBaseCuota <= 0.5) {
    montoBaseCuota = Math.round(cuota.montoCuota || 0);
  }

  const montoRecargo = Math.round(montoBaseCuota * (recargoPct / 100));

  datosPagoCuotaActual = {
    prestamoId,
    cuotaId,
    montoBaseCuota,
    montoRecargo,
    diasAtraso,
    saldoTotalPrestamo: Math.round(saldoTotalPrestamo)
  };

  document.getElementById('pago-prestamo-id').value = prestamoId;
  document.getElementById('pago-cuota-id').value = cuotaId;
  document.getElementById('pago-cli-nombre').innerText = cli ? cli.nombre : 'Cliente';
  document.getElementById('pago-cuota-num').innerText = `${cuota.numero} de ${(p.cuotasDetalle ? p.cuotasDetalle.length : p.cuotas)}`;
  document.getElementById('pago-cuota-base').innerText = '$' + montoBaseCuota.toLocaleString('es-AR');
  document.getElementById('pago-saldo-total-prestamo').innerText = '$' + Math.round(saldoTotalPrestamo).toLocaleString('es-AR');

  const boxRecargo = document.getElementById('box-recargo-cuota-indiv');
  const chkContainer = document.getElementById('contenedor-chk-recargo-cuota');

  if (diasAtraso > 0 && !estaPagadaYa) {
    document.getElementById('pago-dias-atraso-txt').innerText = diasAtraso + ' días';
    document.getElementById('pago-monto-recargo-txt').innerText = montoRecargo.toLocaleString('es-AR');
    if (boxRecargo) boxRecargo.classList.remove('hidden');
    if (chkContainer) chkContainer.classList.remove('hidden');
    const chk = document.getElementById('chk-aplicar-retraso-cuota');
    if (chk) chk.checked = true;
  } else {
    if (boxRecargo) boxRecargo.classList.add('hidden');
    if (chkContainer) chkContainer.classList.add('hidden');
  }

  alternarRecargoCuota();
  document.getElementById('modal-pago-cuota').classList.remove('hidden');
}

function alternarRecargoCuota() {
  if (!datosPagoCuotaActual) return;

  const chk = document.getElementById('chk-aplicar-retraso-cuota');
  const aplicaRecargo = chk ? chk.checked : true;

  const recargoFinal = (datosPagoCuotaActual.diasAtraso > 0 && aplicaRecargo) ? datosPagoCuotaActual.montoRecargo : 0;
  const totalSugerido = Math.round(datosPagoCuotaActual.montoBaseCuota + recargoFinal);

  document.getElementById('pago-cuota-total-sugerido').innerText = '$' + totalSugerido.toLocaleString('es-AR');
  const inputMonto = document.getElementById('pago-monto-ingresado');
  if (inputMonto) {
    inputMonto.value = totalSugerido;
    validarMontoPagoCuota(totalSugerido);
  }
}

function validarMontoPagoCuota(val) {
  const montoNum = Math.round(parseFloat(val) || 0);
  const elemHint = document.getElementById('pago-monto-max-hint');
  const btnSubmit = document.getElementById('btn-confirmar-pago-cuota');

  convertirMontoPagoEnLetras(montoNum);

  if (!datosPagoCuotaActual) return;

  const maxPermitido = Math.round(datosPagoCuotaActual.saldoTotalPrestamo + datosPagoCuotaActual.montoRecargo);

  if (montoNum > maxPermitido && maxPermitido > 0) {
    if (elemHint) elemHint.innerText = `⚠️ El monto no puede superar la deuda total de $${maxPermitido.toLocaleString('es-AR')}`;
    if (btnSubmit) btnSubmit.disabled = true;
  } else {
    if (elemHint) elemHint.innerText = `Saldo restante préstamo: $${datosPagoCuotaActual.saldoTotalPrestamo.toLocaleString('es-AR')}`;
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

function cerrarModalPago() {
  document.getElementById('modal-pago-cuota').classList.add('hidden');
  datosPagoCuotaActual = null;
}

// ==========================================
// 10. COMPROBANTES Y WHATSAPP MODAL
// ==========================================

function abrirModalComprobante(clienteNombre, monto, fecha, concepto, saldo, clienteTelefono = '') {
  datosComprobantePagoReciente = {
    clienteNombre: clienteNombre || 'Cliente',
    monto: monto || 0,
    fecha: fecha || new Date().toLocaleString('es-AR'),
    concepto: concepto || 'Pago de Cuota',
    saldo: saldo || 0,
    clienteTelefono: clienteTelefono || ''
  };

  const setTexto = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  setTexto('recibo-card-cliente', clienteNombre);
  setTexto('recibo-card-monto', '$' + Math.round(monto).toLocaleString('es-AR'));
  setTexto('recibo-card-fecha', fecha);
  setTexto('recibo-card-concepto', concepto);
  setTexto('recibo-card-saldo', '$' + Math.round(saldo).toLocaleString('es-AR'));

  const modal = document.getElementById('modal-comprobante-whatsapp');
  if (modal) modal.classList.remove('hidden');
}

function cerrarModalComprobante() {
  const modal = document.getElementById('modal-comprobante-whatsapp');
  if (modal) modal.classList.add('hidden');
}

function enviarComprobantePagoWhatsApp() {
  if (!datosComprobantePagoReciente) {
    if (typeof mostrarToast === 'function') mostrarToast("Sin datos de comprobante", "error");
    return;
  }

  const { clienteNombre, monto, fecha, concepto, saldo, clienteTelefono } = datosComprobantePagoReciente;

  let telRaw = clienteTelefono || '';
  let telLimpio = telRaw.toString().replace(/\D/g, '');

  if (telLimpio) {
    if (telLimpio.length === 10) {
      telLimpio = '549' + telLimpio;
    } else if (telLimpio.startsWith('54') && !telLimpio.startsWith('549')) {
      telLimpio = '549' + telLimpio.slice(2);
    }
  }

  let mensaje = `Hola ${clienteNombre}! 👋 Te adjuntamos el *Comprobante Oficial de Pago*:\n\n`;
  mensaje += `💵 *Monto Abonado:* $${Math.round(monto).toLocaleString('es-AR')}\n`;
  mensaje += `📅 *Fecha:* ${fecha}\n`;
  mensaje += `📝 *Concepto:* ${concepto}\n`;
  mensaje += `💰 *Saldo Restante:* $${Math.round(saldo).toLocaleString('es-AR')}\n\n`;
  mensaje += `¡Muchas gracias! 🙌`;

  const urlWhatsApp = telLimpio 
    ? `https://api.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

  window.open(urlWhatsApp, '_blank');
  if (typeof mostrarToast === 'function') mostrarToast("📲 Abriendo WhatsApp...");
}

async function compartirComprobanteImagen() {
  const card = document.getElementById('ticket-recibo-card');
  if (!card) return typeof mostrarToast === 'function' ? mostrarToast("No se encontró el recibo visual", "error") : null;

  try {
    if (typeof mostrarToast === 'function') mostrarToast("⏳ Generando imagen...");

    const canvas = await html2canvas(card, {
      backgroundColor: '#0F172A',
      scale: 2,
      useCORS: true
    });

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const nombreArchivo = `Recibo_Pago_${Date.now()}.png`;
      const file = new File([blob], nombreArchivo, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Recibo de Pago' });
          return;
        } catch (e) {}
      }

      const link = document.createElement('a');
      link.download = nombreArchivo;
      link.href = canvas.toDataURL('image/png');
      link.click();
      if (typeof mostrarToast === 'function') mostrarToast("📸 Recibo descargado correctamente");
    }, 'image/png');
  } catch (e) {
    if (typeof mostrarToast === 'function') mostrarToast("Error al generar imagen", "error");
  }
}

function enviarComprobantePrestamoWhatsApp() {
  if (!comprobantePrestamoReciente) {
    if (typeof mostrarToast === 'function') mostrarToast("Sin datos de préstamo", "error");
    return;
  }

  const { prestamo, cliente } = comprobantePrestamoReciente;
  const nombreCli = cliente ? cliente.nombre : (prestamo.nombreCliente || 'Cliente');

  let mensaje = `Hola ${nombreCli}! 👋 Te adjuntamos la *Ficha Oficial de tu Préstamo*:\n\n`;
  mensaje += `💵 *Capital Entregado:* $${Math.round(parseFloat(prestamo.monto)).toLocaleString('es-AR')}\n`;
  mensaje += `📈 *Total a Devolver:* $${Math.round(parseFloat(prestamo.montoTotal)).toLocaleString('es-AR')}\n`;
  mensaje += `📅 *Plan:* ${prestamo.cuotas} cuota(s) ${prestamo.frecuencia}s\n`;
  mensaje += `💰 *Valor de Cuota:* $${Math.round(parseFloat(prestamo.valorCuota)).toLocaleString('es-AR')}\n\n`;
  mensaje += `📋 *CRONOGRAMA DE PAGOS:*\n`;

  (prestamo.cuotasDetalle || []).forEach(c => {
    const fPartes = (c.fecha || '').split('-');
    const fechaFormateada = fPartes.length === 3 ? `${fPartes[2]}/${fPartes[1]}/${fPartes[0]}` : c.fecha;
    mensaje += `- Cuota #${c.numero} (${fechaFormateada}): $${Math.round(parseFloat(c.montoCuota)).toLocaleString('es-AR')}\n`;
  });

  mensaje += `\n¡Cualquier duda estamos a tu disposición!`;

  let telLimpio = (cliente ? cliente.telefono : '').toString().replace(/\D/g, '');
  if (telLimpio) {
    if (telLimpio.length === 10) telLimpio = '549' + telLimpio;
    else if (telLimpio.startsWith('54') && !telLimpio.startsWith('549')) telLimpio = '549' + telLimpio.slice(2);
  }

  const urlWhatsApp = telLimpio 
    ? `https://api.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

  window.open(urlWhatsApp, '_blank');
  if (typeof mostrarToast === 'function') mostrarToast("📲 Abriendo WhatsApp...");
}

// ==========================================
// 11. CONFIGURACIÓN DE MERCADO PAGO AUTOMÁTICO
// ==========================================

function actualizarEstadoToggleMP() {
  const chkAuto = document.getElementById('chk-mp-auto-activo');
  const lblEstado = document.getElementById('lbl-mp-auto-estado');
  if (chkAuto && lblEstado) {
    lblEstado.innerText = chkAuto.checked ? 'Activado 🟢' : 'Desactivado 🔴';
  }
}

async function guardarConfigMercadoPago() {
  const usuario = window.usuarioActual || (typeof firebase !== 'undefined' && firebase.auth().currentUser);
  if (!usuario) {
    if (typeof mostrarToast === 'function') mostrarToast("Espera un segundo mientras carga tu usuario...", "error");
    return;
  }

  const tokenInput = document.getElementById('cfg-mp-access-token');
  const chkAuto = document.getElementById('chk-mp-auto-activo');

  const mpAccessToken = tokenInput ? tokenInput.value.trim() : '';
  const cobroAutomativoActivo = chkAuto ? chkAuto.checked : false;

  actualizarEstadoToggleMP();

  try {
    const userRef = db.collection('usuarios').doc(usuario.uid);
    const userDoc = await userRef.get();
    const datosActuales = userDoc.exists ? (userDoc.data().configMercadoPago || {}) : {};

    const configMP = {
      accessToken: mpAccessToken || datosActuales.accessToken || '',
      activo: cobroAutomativoActivo,
      fechaActualizacion: new Date().toISOString()
    };

    await userRef.set({ configMercadoPago: configMP }, { merge: true });

    if (!window.datosUsuarioActual) window.datosUsuarioActual = {};
    window.datosUsuarioActual.configMercadoPago = configMP;

    if (typeof mostrarToast === 'function') {
      mostrarToast("🤖 Configuración de Mercado Pago guardada");
    }

    if (typeof renderizarPlanificadorSemanal === 'function') {
      renderizarPlanificadorSemanal();
    }
  } catch (error) {
    console.error("Error al guardar token MP:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al guardar configuración", "error");
  }
}

async function cargarConfigMercadoPagoUI() {
  const usuario = window.usuarioActual || (typeof firebase !== 'undefined' && firebase.auth().currentUser);
  
  if (!usuario) {
    setTimeout(cargarConfigMercadoPagoUI, 400);
    return;
  }

  try {
    const doc = await db.collection('usuarios').doc(usuario.uid).get();
    if (doc.exists) {
      const data = doc.data();
      const cfgMP = data.configMercadoPago || {};

      if (!window.datosUsuarioActual) window.datosUsuarioActual = {};
      window.datosUsuarioActual.configMercadoPago = cfgMP;

      const inputToken = document.getElementById('cfg-mp-access-token');
      const chkAuto = document.getElementById('chk-mp-auto-activo');
      const lblEstado = document.getElementById('lbl-mp-auto-estado');

      if (inputToken && cfgMP.accessToken) {
        inputToken.value = cfgMP.accessToken;
      }

      const estaActivo = cfgMP.activo === true || cfgMP.activo === 'true';

      if (chkAuto) {
        chkAuto.checked = estaActivo;
      }

      if (lblEstado) {
        lblEstado.innerText = estaActivo ? 'Activado 🟢' : 'Desactivado 🔴';
      }

      if (typeof renderizarPlanificadorSemanal === 'function') {
        renderizarPlanificadorSemanal();
      }
    }
  } catch (e) {
    console.error("Error al cargar config MP:", e);
  }
}

if (typeof firebase !== 'undefined' && firebase.auth) {
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      window.usuarioActual = user;
      cargarConfigMercadoPagoUI();
    }
  });
}

// ==========================================
// FUNCIONES AUXILIARES DE COPIADO COMPATIBLE (PC Y MÓVIL)
// ==========================================
function copiarTextoAlPortapapeles(texto, mensajeExito) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto)
      .then(() => mostrarToast(mensajeExito || "📋 Copiado al portapapeles"))
      .catch(() => fallbackCopiarTexto(texto, mensajeExito));
  } else {
    fallbackCopiarTexto(texto, mensajeExito);
  }
}

function fallbackCopiarTexto(texto, mensajeExito) {
  const inputTemp = document.createElement('input');
  inputTemp.value = texto;
  document.body.appendChild(inputTemp);
  inputTemp.select();
  try {
    document.execCommand('copy');
    mostrarToast(mensajeExito || "📋 Copiado al portapapeles");
  } catch (err) {
    prompt("Copiá este enlace manualmente:", texto);
  }
  document.body.removeChild(inputTemp);
}

// ==========================================
// 12. INTEGRACIÓN MERCADO PAGO + WHATSAPP AUTOMÁTICO
// ==========================================

const RENDER_BACKEND_URL = "https://cobroapp-backend.onrender.com";

async function generarLinkPagoCuotaMercadoPago(prestamoId, cuotaId, monto, clienteNombre, numeroCuota) {
  const usuario = window.usuarioActual || (typeof firebase !== 'undefined' && firebase.auth()?.currentUser);
  
  try {
    if (typeof mostrarToast === 'function') mostrarToast("⏳ Generando enlace de Mercado Pago...");

    const response = await fetch(`${RENDER_BACKEND_URL}/crear-preferencia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prestamoId,
        cuotaId,
        usuarioId: usuario ? usuario.uid : (window.usuarioPrestamistaDueno || ''),
        monto,
        clienteNombre,
        numeroCuota
      })
    });

    const data = await response.json();

    if (data.init_point) {
      return data.init_point;
    } else {
      mostrarToast(data.error || "No se pudo generar el enlace. Verifica tu Token de MP.", "error");
      return null;
    }
  } catch (e) {
    console.error("Error al generar link MP:", e);
    mostrarToast("Error de conexión con el servidor de pagos", "error");
    return null;
  }
}

async function enviarLinkPagoWhatsApp(prestamoId, cuotaId, monto, clienteNombre, numeroCuota, clienteTelefono) {
  const ventanaWS = window.open('', '_blank');
  if (ventanaWS) {
    ventanaWS.document.write(`
      <html lang="es">
        <body style="background:#090D16; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
          <div style="text-align:center;">
            <h3 style="color:#e879f9;">CobroApp</h3>
            <p style="color:#94a3b8; font-size:14px;">⏳ Generando enlace de Mercado Pago y abriendo WhatsApp...</p>
          </div>
        </body>
      </html>
    `);
  }

  try {
    if (typeof mostrarToast === 'function') mostrarToast("⏳ Generando enlace de pago...");

    const linkMP = await generarLinkPagoCuotaMercadoPago(prestamoId, cuotaId, monto, clienteNombre, numeroCuota);
    if (!linkMP) {
      if (ventanaWS) ventanaWS.close();
      if (typeof mostrarToast === 'function') mostrarToast("No se pudo generar el enlace", "error");
      return;
    }

    let telLimpio = (clienteTelefono || '').toString().replace(/\D/g, '');
    if (telLimpio) {
      if (telLimpio.length === 10) {
        telLimpio = '549' + telLimpio;
      } else if (telLimpio.startsWith('54') && !telLimpio.startsWith('549')) {
        telLimpio = '549' + telLimpio.slice(2);
      }
    }

    const mensaje = `Hola ${clienteNombre}! 👋 Le envío el enlace de pago seguro para la *Cuota #${numeroCuota}* por un monto de *$${Math.round(monto).toLocaleString('es-AR')}*:\n\n👉 ${linkMP}\n\nUna vez realizado el pago, su cuota se acreditará automáticamente en el sistema. ¡Muchas gracias!`;

    const urlWhatsApp = telLimpio 
      ? `https://api.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    if (ventanaWS && !ventanaWS.closed) {
      ventanaWS.location.href = urlWhatsApp;
    } else {
      window.open(urlWhatsApp, '_blank');
    }

    if (typeof mostrarToast === 'function') mostrarToast("📲 Enlace enviado a WhatsApp");

  } catch (error) {
    if (ventanaWS) ventanaWS.close();
    if (typeof mostrarToast === 'function') mostrarToast("Error al generar el enlace de pago", "error");
  }
}

async function copiarLinkPagoMP(prestamoId, cuotaId, monto, clienteNombre, numeroCuota) {
  const linkMP = await generarLinkPagoCuotaMercadoPago(prestamoId, cuotaId, monto, clienteNombre, numeroCuota);
  if (!linkMP) return;

  copiarTextoAlPortapapeles(linkMP, "📋 Link de Mercado Pago copiado al portapapeles");
}

// ==========================================
// 13. PAGO DE ALQUILER / SUSCRIPCIÓN DE PRESTAMISTA AL ADMIN
// ==========================================

async function pagarSuscripcionMercadoPago() {
  try {
    if (typeof mostrarToast === 'function') mostrarToast("⏳ Cargando link de pago...");

    let docAdmin = await db.collection('configuracion').doc('admin_mp').get();
    
    if (!docAdmin.exists) {
      docAdmin = await db.collection('configuracion').doc('general').get();
    }

    if (docAdmin.exists) {
      const data = docAdmin.data();
      const linkCobro = data.linkCobro || data.linkMercadoPago || data.link || '';

      if (linkCobro && linkCobro.startsWith('http')) {
        window.open(linkCobro, '_blank');
      } else if (linkCobro) {
        copiarTextoAlPortapapeles(linkCobro, `📋 Datos de cobro copiados: ${linkCobro}`);
      } else {
        mostrarToast("El Administrador no ha configurado un link de cobro aún.", "error");
      }
    } else {
      mostrarToast("No se encontraron los datos de cobro del Administrador.", "error");
    }
  } catch (error) {
    console.error("Error al obtener datos de suscripción:", error);
    mostrarToast("Error al conectar con la base de datos", "error");
  }
}

// ==========================================
// 14. GESTIÓN DE MÚLTIPLES CUENTAS BANCARIAS Y ALIAS
// ==========================================

async function guardarNuevaCuentaBancaria(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (!window.usuarioActual) return;

  const banco = document.getElementById('cfg-cuenta-banco')?.value.trim();
  const titular = document.getElementById('cfg-cuenta-titular')?.value.trim();
  const alias = document.getElementById('cfg-cuenta-alias')?.value.trim().toUpperCase();
  const cbu = document.getElementById('cfg-cuenta-cbu')?.value.trim();

  if (!banco || !titular || !alias) {
    return mostrarToast("Completá los campos obligatorios", "error");
  }

  const nuevaCuenta = {
    id: 'cuenta_' + Date.now(),
    banco,
    titular,
    alias,
    cbu: cbu || ''
  };

  try {
    const userRef = db.collection('usuarios').doc(window.usuarioActual.uid);
    const userDoc = await userRef.get();
    const cuentasActuales = userDoc.exists ? (userDoc.data().cuentasCobro || []) : [];

    cuentasActuales.push(nuevaCuenta);

    await userRef.set({ cuentasCobro: cuentasActuales }, { merge: true });

    if (!window.datosUsuarioActual) window.datosUsuarioActual = {};
    window.datosUsuarioActual.cuentasCobro = cuentasActuales;

    document.getElementById('cfg-cuenta-banco').value = '';
    document.getElementById('cfg-cuenta-titular').value = '';
    document.getElementById('cfg-cuenta-alias').value = '';
    document.getElementById('cfg-cuenta-cbu').value = '';

    renderizarCuentasBancariasConfig();
    mostrarToast("🏦 Cuenta de cobro agregada con éxito");
  } catch (error) {
    console.error("Error al guardar cuenta:", error);
    mostrarToast("Error al guardar cuenta bancaria", "error");
  }
}

async function eliminarCuentaBancaria(cuentaId) {
  if (!confirm("¿Querés eliminar esta cuenta de cobro?")) return;
  if (!window.usuarioActual) return;

  try {
    const userRef = db.collection('usuarios').doc(window.usuarioActual.uid);
    const userDoc = await userRef.get();
    let cuentasActuales = userDoc.exists ? (userDoc.data().cuentasCobro || []) : [];

    cuentasActuales = cuentasActuales.filter(c => c.id !== cuentaId);

    await userRef.set({ cuentasCobro: cuentasActuales }, { merge: true });

    if (!window.datosUsuarioActual) window.datosUsuarioActual = {};
    window.datosUsuarioActual.cuentasCobro = cuentasActuales;

    renderizarCuentasBancariasConfig();
    mostrarToast("🗑️ Cuenta eliminada correctamente");
  } catch (error) {
    console.error("Error al eliminar cuenta:", error);
    mostrarToast("Error al eliminar cuenta", "error");
  }
}

function renderizarCuentasBancariasConfig() {
  const container = document.getElementById('lista-cuentas-bancarias');
  if (!container) return;

  const cuentas = window.datosUsuarioActual?.cuentasCobro || [];

  if (cuentas.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded-xl border border-slate-800">No tenés cuentas bancarias o alias registrados. Agregá uno arriba.</p>';
    return;
  }

  let html = '';
  cuentas.forEach(c => {
    html += `
      <div class="p-3 bg-[#1E293B] border border-slate-700/80 rounded-xl flex justify-between items-center text-xs my-1">
        <div>
          <h5 class="font-bold text-white text-sm">${c.banco}</h5>
          <p class="text-slate-300">👤 Titular: <strong>${c.titular}</strong></p>
          <p class="text-fuchsia-400 font-bold font-mono">📌 Alias: ${c.alias}</p>
          ${c.cbu ? `<p class="text-slate-400 font-mono text-[11px]">🔢 CBU/CVU: ${c.cbu}</p>` : ''}
        </div>
        <button onclick="eliminarCuentaBancaria('${c.id}')" class="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition">
          🗑️
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ==========================================
// 15. MODAL SELECTOR DE COBRO
// ==========================================

function abrirModalSeleccionarCobro(prestamoId, cuotaId, monto, clienteNombre, numeroCuota, clienteTelefono) {
  datosCuotaSeleccionadaWhatsApp = {
    prestamoId,
    cuotaId,
    monto,
    clienteNombre,
    numeroCuota,
    clienteTelefono
  };

  document.getElementById('sel-cobro-cliente').innerText = clienteNombre;
  document.getElementById('sel-cobro-cuota').innerText = `#${numeroCuota}`;
  document.getElementById('sel-cobro-monto').innerText = '$' + Math.round(monto).toLocaleString('es-AR');

  const containerOps = document.getElementById('opciones-metodos-cobro-lista');
  if (!containerOps) return;

  let htmlOps = '';

  const esMPActivo = !!(window.datosUsuarioActual?.configMercadoPago?.activo);
  if (esMPActivo) {
    htmlOps += `
      <button onclick="enviarLinkMPDesdeModal()" class="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white p-3 rounded-xl shadow font-bold text-xs flex justify-between items-center transition my-1.5">
        <span class="flex items-center gap-2">🤖 Mercado Pago (Automático)</span>
        <span class="text-[10px] bg-sky-950 px-2 py-0.5 rounded-full border border-sky-400/30">Se acredita solo</span>
      </button>
    `;
  }

  const cuentas = window.datosUsuarioActual?.cuentasCobro || [];
  if (cuentas.length > 0) {
    cuentas.forEach(c => {
      htmlOps += `
        <button onclick="enviarDatosBancoWhatsApp('${c.id}')" class="w-full bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-xl border border-slate-700 font-bold text-xs flex justify-between items-center transition text-left my-1.5">
          <div>
            <p class="text-fuchsia-300 font-extrabold">🏦 ${c.banco}</p>
            <p class="text-[11px] text-slate-300 font-mono">Alias: ${c.alias}</p>
          </div>
          <span class="text-emerald-400 text-xs">📲 Enviar</span>
        </button>
      `;
    });
  }

  if (!esMPActivo && cuentas.length === 0) {
    htmlOps = `
      <div class="p-4 text-center space-y-2 bg-amber-950/20 border border-amber-500/30 rounded-xl">
        <p class="text-xs text-amber-300 font-bold">⚠️ No tenés métodos de cobro configurados.</p>
        <p class="text-[11px] text-slate-400">Andá a ⚙️ Tasas & Intereses para agregar tus cuentas bancarias o Mercado Pago.</p>
      </div>
    `;
  }

  containerOps.innerHTML = htmlOps;

  document.getElementById('modal-seleccionar-metodo-cobro').classList.remove('hidden');
}

function cerrarModalSeleccionarCobro() {
  document.getElementById('modal-seleccionar-metodo-cobro').classList.add('hidden');
  datosCuotaSeleccionadaWhatsApp = null;
}

function enviarLinkMPDesdeModal() {
  if (!datosCuotaSeleccionadaWhatsApp) return;
  const { prestamoId, cuotaId, monto, clienteNombre, numeroCuota, clienteTelefono } = datosCuotaSeleccionadaWhatsApp;
  cerrarModalSeleccionarCobro();
  enviarLinkPagoWhatsApp(prestamoId, cuotaId, monto, clienteNombre, numeroCuota, clienteTelefono);
}

function enviarDatosBancoWhatsApp(cuentaId) {
  if (!datosCuotaSeleccionadaWhatsApp) return;

  const cuentas = window.datosUsuarioActual?.cuentasCobro || [];
  const cuenta = cuentas.find(c => c.id === cuentaId);

  if (!cuenta) return mostrarToast("Cuenta bancaria no encontrada", "error");

  const { monto, clienteNombre, numeroCuota, clienteTelefono } = datosCuotaSeleccionadaWhatsApp;

  let telLimpio = (clienteTelefono || '').toString().replace(/\D/g, '');
  if (telLimpio) {
    if (telLimpio.length === 10) telLimpio = '549' + telLimpio;
    else if (telLimpio.startsWith('54') && !telLimpio.startsWith('549')) telLimpio = '549' + telLimpio.slice(2);
  }

  let mensaje = `Hola ${clienteNombre}! 👋 Te paso los datos de transferencia para la *Cuota #${numeroCuota}* ($${Math.round(monto).toLocaleString('es-AR')}):\n\n`;
  mensaje += `🏦 *Banco:* ${cuenta.banco}\n`;
  mensaje += `👤 *Titular:* ${cuenta.titular}\n\n`;
  
  mensaje += `👇 *ALIAS PARA COPIAR* (doble toque para seleccionar):\n`;
  mensaje += `${cuenta.alias}\n\n`;

  if (cuenta.cbu) {
    mensaje += `👇 *CBU/CVU PARA COPIAR*:\n`;
    mensaje += `${cuenta.cbu}\n\n`;
  }

  mensaje += `Una vez realizada la transferencia, enviame el comprobante por acá. ¡Muchas gracias! 🙌`;

  const urlWhatsApp = telLimpio 
    ? `https://api.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

  window.open(urlWhatsApp, '_blank');
  cerrarModalSeleccionarCobro();
  if (typeof mostrarToast === 'function') mostrarToast("📲 Abriendo WhatsApp con datos de cobro...");
}

// ==========================================
// 16. GESTIÓN DE LINK ÚNICO Y MODO COBRADOR (SISTEMA AUTÓNOMO)
// ==========================================

function iniciarModoCobradorDirecto(cobradorRef) {
  if (window.modoCobradorIniciado) return;
  window.modoCobradorIniciado = true;

  window.usuarioPrestamistaDueno = cobradorRef;
  window.rolUsuarioActual = 'cobrador';

  // Asignamos sesión ficticia para las consultas de Firestore
  window.usuarioActual = {
    uid: cobradorRef,
    email: 'cobrador@modo.app'
  };

  // 1. Ocultar COMPLETAMENTE la pantalla/tarjeta de Login
  const selectoresOcultar = [
    '#sec-login', '#vista-login', '#login-card', '#contenedor-login',
    '#pantalla-login', '#modal-login'
  ];
  
  selectoresOcultar.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.classList.add('hidden');
    });
  });

  // Ocultar cualquier contenedor residual con textos de Login
  document.querySelectorAll('div, section, main').forEach(el => {
    if (el.innerText && el.innerText.includes('SISTEMA DE GESTIÓN PARA PRESTAMISTAS') && !el.id.includes('app')) {
      el.style.setProperty('display', 'none', 'important');
    }
  });

  // 2. Mostrar la App reseteando el display (para NO romper el flexbox horizontal del menú)
  const selectoresMostrar = ['#app-principal', '#sec-por-cobrar', '#main-content', '#contenedor-app', 'header', 'nav', '#menu-inferior-mobile'];
  selectoresMostrar.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.classList.remove('hidden');
      el.style.display = ''; // <-- Elimina el 'block' forzado para que el menú vuelva a ser horizontal
    });
  });

  // 3. Activar la vista de cobros
  if (typeof mostrarSeccion === 'function') {
    mostrarSeccion('sec-por-cobrar');
  }

  // 4. Adaptar menú e interfaz según rol (oculta pestañas privadas de abajo)
  if (typeof adaptarInterfazSegunRol === 'function') {
    adaptarInterfazSegunRol();
  }

  // 5. Cargar lista de cobros desde Firestore
  cargarDatosCobradorDesdeFirestore(cobradorRef);
}

async function cargarDatosCobradorDesdeFirestore(prestamistaUid) {
  if (typeof db === 'undefined') return;

  try {
    if (typeof mostrarToast === 'function') mostrarToast("⏳ Cargando lista de cobros...");

    // 1. Verificación de Suspensión del Prestamista Dueño
    const docUser = await db.collection('usuarios').doc(prestamistaUid).get();
    if (docUser.exists) {
      const uData = docUser.data();
      window.datosUsuarioActual = uData;

      if (uData.estadoCuenta === 'suspendido' || uData.suspendido === true) {
        const modalSuspendido = document.getElementById('modal-cuenta-suspendida');
        if (modalSuspendido) modalSuspendido.classList.remove('hidden');
        if (typeof mostrarToast === 'function') mostrarToast("⛔ La cuenta del prestamista se encuentra suspendida", "error");
        return; // Detiene la carga de datos inmediatamente
      }
    }

    // 2. Cargar Clientes
    const snapClientes = await db.collection('clientes').where('usuarioId', '==', prestamistaUid).get();
    window.clientes = snapClientes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Cargar Préstamos
    const snapPrestamos = await db.collection('prestamos').where('usuarioId', '==', prestamistaUid).get();
    window.prestamos = snapPrestamos.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 4. Actualizar vistas en pantalla
    if (typeof renderizarPlanificadorSemanal === 'function') renderizarPlanificadorSemanal();
    if (typeof renderizarEstadoCuentas === 'function') renderizarEstadoCuentas();
    if (typeof renderizarGridCalendarioVisual === 'function') renderizarGridCalendarioVisual();

    if (typeof mostrarToast === 'function') mostrarToast("🟢 Hoja de ruta cargada con éxito");
  } catch (error) {
    console.error("Error al cargar datos en Modo Cobrador:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al cargar los datos del prestamista", "error");
  }
}

function generarLinkCobrador() {
  const usuario = window.usuarioActual || (typeof firebase !== 'undefined' && firebase.auth()?.currentUser);
  if (!usuario) return mostrarToast("Iniciá sesión para generar el link", "error");

  const baseUrl = window.location.origin + window.location.pathname;
  const linkCobrador = `${baseUrl}?cobradorRef=${usuario.uid}`;

  const inputLink = document.getElementById('input-link-cobrador');
  const boxLink = document.getElementById('box-link-cobrador');

  if (inputLink) inputLink.value = linkCobrador;
  if (boxLink) boxLink.classList.remove('hidden');

  copiarTextoAlPortapapeles(linkCobrador, "🔗 Link de cobrador generado y copiado");
}

function copiarLinkCobrador() {
  const inputLink = document.getElementById('input-link-cobrador');
  if (!inputLink || !inputLink.value) {
    return mostrarToast("⚠️ Primero debés generar el link", "error");
  }

  copiarTextoAlPortapapeles(inputLink.value, "📋 Link copiado al portapapeles");
}

function enviarLinkCobradorWhatsApp() {
  const inputLink = document.getElementById('input-link-cobrador');
  if (!inputLink || !inputLink.value) return;

  const mensaje = `Hola! 👋 Te comparto el enlace de acceso directo para la ruta de cobros del día:\n\n👉 ${inputLink.value}\n\nIngresando ahí vas a poder ver el planificador y registrar los pagos de los clientes.`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  
  window.open(url, '_blank');
}

function detectarModoCobradorPorUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const cobradorRef = urlParams.get('cobradorRef');

  if (cobradorRef) {
    iniciarModoCobradorDirecto(cobradorRef);
  }
}

// Escuchador de Firebase Auth modificado para no bloquear al Cobrador
if (typeof firebase !== 'undefined' && firebase.auth) {
  firebase.auth().onAuthStateChanged((user) => {
    const urlParams = new URLSearchParams(window.location.search);
    const cobradorRef = urlParams.get('cobradorRef');

    if (cobradorRef) {
      iniciarModoCobradorDirecto(cobradorRef);
      return;
    }

    if (user) {
      window.usuarioActual = user;
      cargarConfigMercadoPagoUI();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  detectarModoCobradorPorUrl();
});
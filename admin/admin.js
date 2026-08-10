// LÓGICA DE ADMINISTRADOR Y CONTROL DE INTERFAZ Y SUSCRIPCIONES

async function cargarPanelAdmin() {
  if (!window.usuarioActual) return;

  try {
    const emailAdmin = window.usuarioActual.email ? window.usuarioActual.email.toLowerCase() : '';
    const esAdminByEmail = emailAdmin === 'sistemas.cobroapp@gmail.com';

    const docUser = await db.collection('usuarios').doc(window.usuarioActual.uid).get();
    const esAdminByDoc = docUser.exists && (docUser.data().rol === 'admin' || docUser.data().email?.includes('admin'));

    window.esAdmin = esAdminByEmail || esAdminByDoc || window.rolUsuarioActual === 'admin';

    if (window.esAdmin) {
      adaptarInterfazAdmin();
      await cargarListaPrestamistasAdmin();
    }
  } catch (error) {
    console.error("Error al cargar panel de admin:", error);
  }
}

// ADAPTA LA INTERFAZ A "REGISTRO DE PAGO" PARA LA CUENTA DE ADMIN
function adaptarInterfazAdmin() {
  const emailAdmin = window.usuarioActual?.email ? window.usuarioActual.email.toLowerCase() : '';
  const esAdmin = window.esAdmin || window.rolUsuarioActual === 'admin' || emailAdmin === 'sistemas.cobroapp@gmail.com' || (window.datosUsuarioActual && window.datosUsuarioActual.rol === 'admin');

  if (!esAdmin) return;

  // 1. Menú lateral (Sidebar y Móvil)
  const btnMenuRegistrar = document.getElementById('btn-sec-registrar');
  const mBtnRegistrar = document.getElementById('m-btn-registrar');
  if (btnMenuRegistrar) btnMenuRegistrar.innerHTML = '<span>💳</span> Registro de Pago';
  if (mBtnRegistrar) {
    const spanTxt = mBtnRegistrar.querySelector('span:last-child');
    if (spanTxt) spanTxt.innerText = 'Registro Pago';
  }

  // 2. Títulos y Etiquetas del Formulario
  const tituloSec = document.getElementById('titulo-sec-registrar');
  const lblMonto = document.getElementById('lbl-monto-prestamo');
  const lblInteres = document.getElementById('lbl-interes-prestamo');
  const inputInteres = document.getElementById('interes-prestamo');

  if (tituloSec) tituloSec.innerText = 'Registro de Pago';
  if (lblMonto) lblMonto.innerText = 'Monto a Pagar ($) *';
  if (lblInteres) lblInteres.innerText = 'Fecha en la que se registra *';

  // 3. Transformar campo de Interés en Selector de Fecha
  if (inputInteres) {
    inputInteres.type = 'date';
    if (!inputInteres.value || inputInteres.value.includes('%')) {
      inputInteres.value = typeof obtenerFechaLocalISO === 'function' ? obtenerFechaLocalISO() : new Date().toISOString().split('T')[0];
    }
    inputInteres.removeAttribute('min');
    inputInteres.removeAttribute('step');
  }
}

// CARGA Y MUESTRA TODAS LAS CUENTAS DE PRESTAMISTAS CON FECHAS DE PAGO Y ACCIONES
async function cargarListaPrestamistasAdmin() {
  const container = document.getElementById('lista-prestamistas-admin');
  if (!container) return;

  try {
    const snapshot = await db.collection('usuarios').get();
    container.innerHTML = '';

    const prestamistas = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Mostramos todas las cuentas creadas excepto la cuenta Admin principal logueada
      if (doc.id !== window.usuarioActual.uid) {
        prestamistas.push({ id: doc.id, ...data });
      }
    });

    if (prestamistas.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-500 italic p-2">No hay cuentas de prestamistas registradas aún.</p>';
      return;
    }

    container.innerHTML = '<h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cuentas Registradas & Control de Suscripción:</h4>';

    prestamistas.forEach(u => {
      const estado = u.estadoSuscripcion || u.estadoCuenta || 'activo';
      const esActiva = estado === 'activo' || estado === 'activa';
      const ultimoPago = u.fechaUltimoPago ? u.fechaUltimoPago : 'Sin pagos registrados';
      const vencimiento = u.vencimientoSuscripcion ? u.vencimientoSuscripcion : 'Sin fecha';

      container.innerHTML += `
        <div class="p-4 bg-[#1E293B] border border-slate-700/80 rounded-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 text-xs my-2 shadow-lg">
          <div>
            <div class="flex items-center gap-2">
              <h5 class="font-extrabold text-white text-sm">${u.nombre || u.email || 'Prestamista'}</h5>
              <span class="px-2 py-0.5 rounded-full font-extrabold text-[10px] ${esActiva ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
                ${esActiva ? '🟢 Activa' : '🔴 Suspendida'}
              </span>
            </div>
            <p class="text-slate-300 mt-1">${u.email || 'Sin correo'} | Clave: <strong class="text-fuchsia-400">${u.passwordVisual || '••••••'}</strong></p>
            <p class="text-[11px] text-slate-400 mt-1">🗓️ Último Pago: <strong class="text-emerald-400">${ultimoPago}</strong> | ⏳ Vence: <strong class="text-amber-400">${vencimiento}</strong></p>
          </div>

          <div class="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap border-t lg:border-t-0 border-slate-700/60 pt-2 lg:pt-0">
            <button onclick="registrarPagoMensualPrestamista('${u.id}', '${u.nombre || u.email}')" class="px-3 py-1.5 rounded-lg font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow transition flex items-center gap-1">
              💳 Marcar Pago Mes
            </button>
            <button onclick="toggleEstadoPrestamista('${u.id}', '${estado}')" class="px-2.5 py-1.5 rounded-lg font-bold text-xs ${esActiva ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30'} transition">
              ${esActiva ? '⏸️ Suspender' : '▶️ Activar'}
            </button>
            <button onclick="eliminarUsuarioPrestamista('${u.id}', '${u.nombre || u.email}')" class="px-2.5 py-1.5 rounded-lg font-bold text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition">
              🗑️ Borrar
            </button>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error al obtener lista de prestamistas:", error);
  }
}

// ACREDITAR Y REGISTRAR EL PAGO DE SUSCRIPCIÓN MENSUAL
async function registrarPagoMensualPrestamista(id, nombre) {
  if (!confirm(`¿Confirmás que "${nombre}" abonó la mensualidad de este mes?`)) return;

  try {
    const hoyStr = typeof obtenerFechaLocalISO === 'function' ? obtenerFechaLocalISO() : new Date().toISOString().split('T')[0];
    
    // Calcular fecha de vencimiento a 30 días
    const fechaVenc = new Date();
    fechaVenc.setDate(fechaVenc.getDate() + 30);
    const vencStr = typeof obtenerFechaLocalISO === 'function' ? obtenerFechaLocalISO(fechaVenc) : fechaVenc.toISOString().split('T')[0];

    await db.collection('usuarios').doc(id).update({
      estadoSuscripcion: 'activo',
      estadoCuenta: 'activa',
      fechaUltimoPago: hoyStr,
      vencimientoSuscripcion: vencStr
    });

    if (typeof mostrarToast === 'function') {
      mostrarToast(`🎉 Pago acreditado. Cuenta de ${nombre} activa por 30 días.`);
    }
    await cargarListaPrestamistasAdmin();
  } catch (error) {
    console.error("Error al registrar pago mensual:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al acreditar pago", "error");
  }
}

// SUSPENDER O ACTIVAR UNA CUENTA DE PRESTAMISTA
async function toggleEstadoPrestamista(id, estadoActual) {
  const esActivo = estadoActual === 'activo' || estadoActual === 'activa';
  const nuevoEstado = esActivo ? 'suspendido' : 'activo';

  try {
    await db.collection('usuarios').doc(id).update({
      estadoSuscripcion: nuevoEstado,
      estadoCuenta: nuevoEstado
    });

    if (typeof mostrarToast === 'function') {
      mostrarToast(nuevoEstado === 'suspendido' ? "🔴 Cuenta suspendida" : "🟢 Cuenta activada correctamente");
    }
    await cargarListaPrestamistasAdmin();
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al cambiar estado de la cuenta", "error");
  }
}

// ELIMINAR UNA CUENTA DE PRESTAMISTA PERMANENTEMENTE
async function eliminarUsuarioPrestamista(id, nombre) {
  if (!confirm(`¿Estás seguro de eliminar permanentemente la cuenta de "${nombre}"?`)) return;

  try {
    await db.collection('usuarios').doc(id).delete();
    if (typeof mostrarToast === 'function') mostrarToast("🗑️ Cuenta eliminada correctamente");
    await cargarListaPrestamistasAdmin();
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al eliminar la cuenta", "error");
  }
}

// CREAR NUEVA CUENTA DE PRESTAMISTA
async function crearUsuarioPrestamista(event) {
  if (event && event.preventDefault) event.preventDefault();

  const emailAdmin = window.usuarioActual?.email ? window.usuarioActual.email.toLowerCase() : '';
  const esAdmin = window.esAdmin || window.rolUsuarioActual === 'admin' || emailAdmin === 'sistemas.cobroapp@gmail.com';

  if (!esAdmin) return typeof mostrarToast === 'function' ? mostrarToast("No tenés permisos de administrador", "error") : alert("No tenés permisos");

  const nombre = document.getElementById('usr-nombre-prestamista')?.value.trim();
  const email = document.getElementById('usr-email')?.value.trim();
  const pass = document.getElementById('usr-pass')?.value.trim();

  if (!nombre || !email || !pass) {
    return typeof mostrarToast === 'function' ? mostrarToast("Completá todos los campos requeridos", "error");
  }

  try {
    const hoyStr = typeof obtenerFechaLocalISO === 'function' ? obtenerFechaLocalISO() : new Date().toISOString().split('T')[0];
    const fechaVenc = new Date();
    fechaVenc.setDate(fechaVenc.getDate() + 30);
    const vencStr = typeof obtenerFechaLocalISO === 'function' ? obtenerFechaLocalISO(fechaVenc) : fechaVenc.toISOString().split('T')[0];

    const nuevoUserRef = db.collection('usuarios').doc();
    await nuevoUserRef.set({
      nombre,
      email,
      passwordVisual: pass,
      rol: 'prestamista',
      estadoSuscripcion: 'activo',
      estadoCuenta: 'activa',
      fechaUltimoPago: hoyStr,
      vencimientoSuscripcion: vencStr,
      fechaCreacion: new Date().toISOString()
    });

    if (typeof mostrarToast === 'function') mostrarToast("🎉 Cuenta de Prestamista creada con 30 días activos");

    if (document.getElementById('usr-nombre-prestamista')) document.getElementById('usr-nombre-prestamista').value = '';
    if (document.getElementById('usr-email')) document.getElementById('usr-email').value = '';
    if (document.getElementById('usr-pass')) document.getElementById('usr-pass').value = '';

    await cargarListaPrestamistasAdmin();
  } catch (error) {
    console.error("Error al crear la cuenta:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al crear la cuenta", "error");
  }
}
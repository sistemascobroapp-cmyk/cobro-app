// LÓGICA DE ADMINISTRADOR, CONTROL DE CUENTAS, CONTRASEÑAS Y SUSCRIPCIONES MENSUALES

let desuscribirListenerAdmin = null;

// OBTENER MES ACTUAL EN FORMATO ISO (EJ: "2026-08")
function obtenerMesActualISO() {
  const d = new Date();
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${anio}-${mes}`;
}

// OBTENER NOMBRE DEL MES Y AÑO PARA MOSTRAR
function obtenerNombreMesActual() {
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const d = new Date();
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// ALIAS PARA COMPATIBILIDAD CON MAIN.JS
function cargarListaPrestamistasAdmin() {
  escucharPrestamistasEnTiempoReal();
}

// CARGA INICIAL DEL PANEL ADMIN
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
      escucharPrestamistasEnTiempoReal();
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

  const btnMenuRegistrar = document.getElementById('btn-sec-registrar');
  const mBtnRegistrar = document.getElementById('m-btn-registrar');
  if (btnMenuRegistrar) btnMenuRegistrar.innerHTML = '<span>💳</span> Registro de Pago';
  if (mBtnRegistrar) {
    const spanTxt = mBtnRegistrar.querySelector('span:last-child');
    if (spanTxt) spanTxt.innerText = 'Registro Pago';
  }

  const tituloSec = document.getElementById('titulo-sec-registrar');
  const lblMonto = document.getElementById('lbl-monto-prestamo');
  const lblInteres = document.getElementById('lbl-interes-prestamo');
  const inputInteres = document.getElementById('interes-prestamo');

  if (tituloSec) tituloSec.innerText = 'Registro de Pago';
  if (lblMonto) lblMonto.innerText = 'Monto a Pagar ($) *';
  if (lblInteres) lblInteres.innerText = 'Fecha en la que se registra *';

  if (inputInteres) {
    inputInteres.type = 'date';
    if (!inputInteres.value || inputInteres.value.includes('%')) {
      inputInteres.value = typeof obtenerFechaLocalISO === 'function' ? obtenerFechaLocalISO() : new Date().toISOString().split('T')[0];
    }
    inputInteres.removeAttribute('min');
    inputInteres.removeAttribute('step');
  }
}

// ESCUCHA EN TIEMPO REAL Y RENDERIZA LA LISTA DE PRESTAMISTAS ABAJO DEL FORMULARIO
function escucharPrestamistasEnTiempoReal() {
  if (desuscribirListenerAdmin) desuscribirListenerAdmin();

  desuscribirListenerAdmin = db.collection('usuarios').onSnapshot(snapshot => {
    let container = document.getElementById('lista-prestamistas-admin');
    
    // Si el contenedor no existe en el HTML, lo busca o genera automáticamente
    if (!container) {
      const secHabilitar = document.getElementById('sec-usuarios') || document.querySelector('#sec-usuarios .tarjeta-ui');
      if (secHabilitar) {
        container = document.createElement('div');
        container.id = 'lista-prestamistas-admin';
        container.className = 'mt-6 space-y-3 pt-4 border-t border-slate-800';
        secHabilitar.appendChild(container);
      } else {
        return;
      }
    }

    container.innerHTML = '';
    const prestamistas = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (doc.id !== window.usuarioActual?.uid) {
        prestamistas.push({ id: doc.id, ...data });
      }
    });

    if (prestamistas.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-500 italic p-4 text-center bg-[#1E293B]/40 rounded-xl border border-slate-800">No hay cuentas de prestamistas registradas aún.</p>';
      return;
    }

    const mesActualISO = obtenerMesActualISO();
    const nombreMes = obtenerNombreMesActual();

    let html = `
      <div class="pt-2">
        <h4 class="text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-3 flex justify-between items-center flex-wrap gap-2">
          <span>👥 Cuentas de Prestamistas Habilitadas (${prestamistas.length})</span>
          <span class="text-[10px] text-fuchsia-400 bg-fuchsia-500/10 px-2.5 py-1 rounded-full border border-fuchsia-500/20">Suscripción Mes: ${nombreMes}</span>
        </h4>
        <div class="space-y-3">
    `;

    prestamistas.forEach(u => {
      const estadoManual = u.estadoCuenta || u.estadoSuscripcion || 'activo';
      const estaSuspendidoManual = estadoManual === 'suspendido' || estadoManual === 'inactivo' || estadoManual === 'suspendida';

      // VERIFICACIÓN DE PAGO DE SUSCRIPCIÓN DEL MES EN CURSO
      const pagadoEsteMes = u.ultimoMesPagado === mesActualISO || (u.pagosMes && u.pagosMes[mesActualISO] === true);

      let badgeSuscripcion = '';
      if (estaSuspendidoManual) {
        badgeSuscripcion = '<span class="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">🔴 Suspendida</span>';
      } else if (pagadoEsteMes) {
        badgeSuscripcion = '<span class="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Al Día (' + nombreMes + ')</span>';
      } else {
        badgeSuscripcion = '<span class="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 Pendiente de Pago</span>';
      }

      const passMostrable = u.passwordVisual || u.password || '••••••';

      html += `
        <div class="p-4 bg-[#1E293B] border border-slate-700/80 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs shadow-lg">
          <div class="space-y-1.5 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h5 class="font-extrabold text-white text-sm">${u.nombre || 'Prestamista'}</h5>
              ${badgeSuscripcion}
            </div>
            <p class="text-slate-300 font-medium">📧 Correo: <strong class="text-white">${u.email || 'Sin correo'}</strong></p>
            <p class="text-slate-400">🔑 Clave actual: <strong class="text-fuchsia-400 font-mono text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">${passMostrable}</strong></p>
            <p class="text-[10px] text-slate-500">Último período abonado: <strong class="text-slate-300">${u.ultimoMesPagado || 'Sin registros'}</strong></p>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <button onclick="marcarPagoMesPrestamista('${u.id}', '${u.nombre || u.email}')" class="px-3 py-2 rounded-xl font-extrabold text-xs ${pagadoEsteMes ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'} transition flex items-center gap-1.5">
              💳 ${pagadoEsteMes ? 'Re-Acreditar Pago' : 'Marcar Cuota Pagada'}
            </button>

            <button onclick="toggleEstadoPrestamista('${u.id}', '${estadoManual}')" class="px-3 py-2 rounded-xl font-bold text-xs ${estaSuspendidoManual ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'} transition flex items-center gap-1">
              ${estaSuspendidoManual ? '▶️ Activar' : '⏸️ Suspender'}
            </button>

            <button onclick="eliminarUsuarioPrestamista('${u.id}', '${u.nombre || u.email}')" class="px-3 py-2 rounded-xl font-bold text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition flex items-center gap-1">
              🗑️ Eliminar
            </button>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
  }, error => {
    console.error("Error al escuchar cuentas en Firestore:", error);
  });
}

// MARCAR O REGISTRAR EL PAGO DEL MES ACTUAL
async function marcarPagoMesPrestamista(id, nombre) {
  const mesActualISO = obtenerMesActualISO();
  const nombreMes = obtenerNombreMesActual();

  if (!confirm(`¿Confirmás registrar el pago de cuota mensual de ${nombreMes} para "${nombre}"?`)) return;

  try {
    await db.collection('usuarios').doc(id).update({
      ultimoMesPagado: mesActualISO,
      [`pagosMes.${mesActualISO}`]: true,
      estadoCuenta: 'activo',
      estadoSuscripcion: 'activo',
      fechaUltimoPago: new Date().toISOString()
    });

    if (typeof mostrarToast === 'function') {
      mostrarToast(`🎉 Pago de cuota (${nombreMes}) acreditado para ${nombre}`);
    }
  } catch (error) {
    console.error("Error al acreditar pago:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al registrar pago", "error");
  }
}

// SUSPENDER O ACTIVAR LA CUENTA MANUALMENTE
async function toggleEstadoPrestamista(id, estadoActual) {
  const estaSuspendido = estadoActual === 'suspendido' || estadoActual === 'inactivo' || estadoActual === 'suspendida';
  const nuevoEstado = estaSuspendido ? 'activo' : 'suspendido';

  try {
    await db.collection('usuarios').doc(id).update({
      estadoCuenta: nuevoEstado,
      estadoSuscripcion: nuevoEstado
    });

    if (typeof mostrarToast === 'function') {
      mostrarToast(nuevoEstado === 'suspendido' ? "🔴 Cuenta suspendida correctamente" : "🟢 Cuenta activada correctamente");
    }
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al cambiar estado", "error");
  }
}

// ELIMINAR CUENTA DE PRESTAMISTA PERMANENTEMENTE (JUNTO CON SUS CLIENTES Y PRÉSTAMOS)
async function eliminarUsuarioPrestamista(id, nombre) {
  if (!confirm(`⚠️ ATENCIÓN: ¿Estás seguro de eliminar permanentemente la cuenta de "${nombre}"?\n\nEsta acción eliminará el usuario, TODOS sus clientes y TODOS sus préstamos registrados.`)) return;

  try {
    // 1. Eliminar préstamos asociados al prestamista
    const snapPrestamos = await db.collection('prestamos').where('usuarioId', '==', id).get();
    const batch1 = db.batch();
    snapPrestamos.forEach(doc => batch1.delete(doc.ref));
    await batch1.commit();

    // 2. Eliminar clientes asociados al prestamista
    const snapClientes = await db.collection('clientes').where('usuarioId', '==', id).get();
    const batch2 = db.batch();
    snapClientes.forEach(doc => batch2.delete(doc.ref));
    await batch2.commit();

    // 3. Eliminar el documento de usuario
    await db.collection('usuarios').doc(id).delete();

    if (typeof mostrarToast === 'function') mostrarToast("🗑️ Cuenta y todos sus datos eliminados correctamente");
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

  if (!esAdmin) return typeof mostrarToast === 'function' ? mostrarToast("No tenés permisos de administrador", "error") : alert("Sin permisos");

  const nombre = document.getElementById('usr-nombre-prestamista')?.value.trim();
  const email = document.getElementById('usr-email')?.value.trim();
  const pass = document.getElementById('usr-pass')?.value.trim();

  if (!nombre || !email || !pass) {
    return typeof mostrarToast === 'function' ? mostrarToast("Completá todos los campos requeridos", "error");
  }

  try {
    const mesActualISO = obtenerMesActualISO();
    const nuevoUserRef = db.collection('usuarios').doc();

    await nuevoUserRef.set({
      nombre,
      email,
      passwordVisual: pass,
      rol: 'prestamista',
      estadoCuenta: 'activo',
      estadoSuscripcion: 'activo',
      ultimoMesPagado: mesActualISO,
      [`pagosMes.${mesActualISO}`]: true,
      fechaCreacion: new Date().toISOString()
    });

    if (typeof mostrarToast === 'function') mostrarToast("🎉 Cuenta creada con éxito para " + nombre);

    if (document.getElementById('usr-nombre-prestamista')) document.getElementById('usr-nombre-prestamista').value = '';
    if (document.getElementById('usr-email')) document.getElementById('usr-email').value = '';
    if (document.getElementById('usr-pass')) document.getElementById('usr-pass').value = '';

  } catch (error) {
    console.error("Error al crear la cuenta:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al crear la cuenta", "error");
  }
}

// CAMBIO DE CONTRASEÑA PARA CUALQUIER USUARIO (MANTIENE LA CLAVE VISIBLE PARA EL ADMIN)
async function cambiarMiContrasena(event) {
  if (event && event.preventDefault) event.preventDefault();

  const pass1 = document.getElementById('cli-nueva-pass')?.value;
  const pass2 = document.getElementById('cli-confirm-pass')?.value;

  if (!pass1 || !pass2) return mostrarToast("Completá los campos de contraseña", "error");
  if (pass1 !== pass2) return mostrarToast("Las contraseñas no coinciden", "error");

  try {
    // 1. Cambia en Firebase Authentication
    await window.usuarioActual.updatePassword(pass1);

    // 2. Guarda la clave legible en Firestore para que el Admin la siga viendo
    await db.collection('usuarios').doc(window.usuarioActual.uid).update({
      passwordVisual: pass1
    });

    mostrarToast("🔑 Contraseña actualizada correctamente");
    if (document.getElementById('cli-nueva-pass')) document.getElementById('cli-nueva-pass').value = '';
    if (document.getElementById('cli-confirm-pass')) document.getElementById('cli-confirm-pass').value = '';
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    mostrarToast("Error al cambiar contraseña: " + error.message, "error");
  }
}
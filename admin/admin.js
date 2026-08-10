// LÓGICA DE ADMINISTRADOR Y CONTROL DE INTERFAZ

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

// CARGA Y MUESTRA TODAS LAS CUENTAS CREADAS DE PRESTAMISTAS
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

    container.innerHTML = '<h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cuentas Registradas:</h4>';

    prestamistas.forEach(u => {
      const estado = u.estadoSuscripcion || u.estadoCuenta || 'activo';
      const esActiva = estado === 'activo' || estado === 'activa';

      container.innerHTML += `
        <div class="p-3 bg-[#1E293B] border border-slate-700/80 rounded-xl flex justify-between items-center text-xs my-2">
          <div>
            <h5 class="font-extrabold text-white text-sm">${u.nombre || u.email || 'Prestamista'}</h5>
            <p class="text-slate-300">${u.email || 'Sin correo'} | Clave: <strong class="text-fuchsia-400">${u.passwordVisual || '••••••'}</strong></p>
          </div>
          <span class="px-2.5 py-1 rounded-full font-extrabold ${esActiva ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
            ${esActiva ? '🟢 Activa' : '🔴 Suspendida'}
          </span>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error al obtener lista de prestamistas:", error);
  }
}

async function crearUsuarioPrestamista(event) {
  if (event && event.preventDefault) event.preventDefault();

  const emailAdmin = window.usuarioActual?.email ? window.usuarioActual.email.toLowerCase() : '';
  const esAdmin = window.esAdmin || window.rolUsuarioActual === 'admin' || emailAdmin === 'sistemas.cobroapp@gmail.com';

  if (!esAdmin) return typeof mostrarToast === 'function' ? mostrarToast("No tenés permisos de administrador", "error") : alert("No tenés permisos");

  const nombre = document.getElementById('usr-nombre-prestamista')?.value.trim();
  const email = document.getElementById('usr-email')?.value.trim();
  const pass = document.getElementById('usr-pass')?.value.trim();

  if (!nombre || !email || !pass) {
    return typeof mostrarToast === 'function' ? mostrarToast("Completá todos los campos requeridos", "error") : alert("Completá todos los campos");
  }

  try {
    const nuevoUserRef = db.collection('usuarios').doc();
    await nuevoUserRef.set({
      nombre,
      email,
      passwordVisual: pass,
      rol: 'prestamista',
      estadoSuscripcion: 'activo',
      estadoCuenta: 'activa',
      fechaCreacion: new Date().toISOString()
    });

    if (typeof mostrarToast === 'function') mostrarToast("🎉 Cuenta de Prestamista creada con éxito");

    if (document.getElementById('usr-nombre-prestamista')) document.getElementById('usr-nombre-prestamista').value = '';
    if (document.getElementById('usr-email')) document.getElementById('usr-email').value = '';
    if (document.getElementById('usr-pass')) document.getElementById('usr-pass').value = '';

    await cargarListaPrestamistasAdmin();
  } catch (error) {
    console.error("Error al crear la cuenta:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Error al crear la cuenta", "error");
  }
}
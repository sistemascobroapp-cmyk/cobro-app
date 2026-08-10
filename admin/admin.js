// LÓGICA EXCLUSIVA PARA EL PERFIL ADMINISTRADOR (REGISTRO DE PAGOS Y GESTIÓN)

async function cargarPanelAdmin() {
  if (!window.usuarioActual) return;

  try {
    const docUser = await db.collection('usuarios').doc(window.usuarioActual.uid).get();
    const esAdmin = docUser.exists && docUser.data().rol === 'admin';
    window.esAdmin = esAdmin;

    const btnSecUsuarios = document.getElementById('btn-sec-usuarios');
    if (btnSecUsuarios) {
      if (esAdmin) btnSecUsuarios.classList.remove('hidden');
      else btnSecUsuarios.classList.add('hidden');
    }

    if (esAdmin) {
      cargarListaPrestamistasAdmin();
      adaptarInterfazAdmin();
    }
  } catch (error) {
    console.error("Error al cargar panel de admin:", error);
  }
}

// ADAPTA LA INTERFAZ PARA MOSTRAR "REGISTRO DE PAGO" SOLO AL ADMIN
function adaptarInterfazAdmin() {
  const esAdmin = window.esAdmin || (window.datosUsuarioActual && window.datosUsuarioActual.rol === 'admin');
  if (!esAdmin) return;

  const btnMenuRegistrar = document.getElementById('btn-sec-registrar');
  const mBtnRegistrar = document.getElementById('m-btn-registrar');
  const tituloSec = document.getElementById('titulo-sec-registrar');
  const lblMonto = document.getElementById('lbl-monto-prestamo');
  const lblInteres = document.getElementById('lbl-interes-prestamo');
  const inputInteres = document.getElementById('interes-prestamo');

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
    inputInteres.value = obtenerFechaLocalISO();
    inputInteres.removeAttribute('min');
    inputInteres.removeAttribute('step');
  }
}

async function crearUsuarioPrestamista(event) {
  event.preventDefault();
  if (!window.esAdmin) return mostrarToast("No tenés permisos de administrador", "error");

  const nombre = document.getElementById('usr-nombre-prestamista').value.trim();
  const email = document.getElementById('usr-email').value.trim();
  const pass = document.getElementById('usr-pass').value.trim();

  if (!nombre || !email || !pass) {
    return mostrarToast("Completá todos los campos requeridos", "error");
  }

  try {
    // Se guarda la cuenta en la colección de usuarios para acceso
    const nuevoUserRef = db.collection('usuarios').doc();
    await nuevoUserRef.set({
      nombre,
      email,
      passwordVisual: pass,
      rol: 'prestamista',
      estadoSuscripcion: 'activo',
      fechaCreacion: new Date().toISOString()
    });

    mostrarToast("🎉 Cuenta de Prestamista creada con éxito");
    document.getElementById('usr-nombre-prestamista').value = '';
    document.getElementById('usr-email').value = '';
    document.getElementById('usr-pass').value = '';
    cargarListaPrestamistasAdmin();
  } catch (error) {
    mostrarToast("Error al crear la cuenta de prestamista", "error");
  }
}

async function cargarListaPrestamistasAdmin() {
  const container = document.getElementById('lista-prestamistas-admin');
  if (!container) return;

  try {
    const snapshot = await db.collection('usuarios').where('rol', '==', 'prestamista').get();
    container.innerHTML = '';

    if (snapshot.empty) {
      container.innerHTML = '<p class="text-xs text-slate-500 italic">No hay cuentas de prestamistas registradas.</p>';
      return;
    }

    snapshot.forEach(doc => {
      const u = doc.data();
      container.innerHTML += `
        <div class="p-3 bg-[#1E293B] border border-slate-700/80 rounded-xl flex justify-between items-center text-xs">
          <div>
            <h5 class="font-bold text-white">${u.nombre}</h5>
            <p class="text-slate-400">${u.email} | Clave: <strong class="text-fuchsia-400">${u.passwordVisual || '••••••'}</strong></p>
          </div>
          <span class="px-2.5 py-1 rounded-full font-extrabold ${u.estadoSuscripcion === 'activo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">
            ${u.estadoSuscripcion === 'activo' ? '🟢 Activa' : '🔴 Suspendida'}
          </span>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error al obtener prestamistas:", error);
  }
}
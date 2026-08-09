// PUNTO DE ENTRADA PRINCIPAL, AUTENTICACIÓN, CONTROL DE SUSPENSIÓN Y ENRUTAMIENTO

let usuarioActual = null;
let rolUsuarioActual = 'prestamista';

window.onload = function() {
  aplicarTema(temaActual);
  cargarCamposConfigIntereses();

  document.getElementById('frecuencia-prestamo').value = 'mensual';
  alCambiarFrecuencia();
  renderizarGridCalendarioVisual();

  auth.onAuthStateChanged(async user => {
    if (user) {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      
      if (userDoc.exists) {
        const data = userDoc.data();
        rolUsuarioActual = data.rol || 'prestamista';

        // Verificación de suspensión de cuenta
        if (data.estadoCuenta === 'suspendida' && rolUsuarioActual !== 'admin') {
          mostrarToast("🚫 Tu cuenta se encuentra suspendida por falta de pago. Contactá al administrador.", "error");
          auth.signOut();
          return;
        }
      } else {
        rolUsuarioActual = 'admin';
      }

      usuarioActual = user;

      // OCULTAR LOGIN Y MOSTRAR NAVEGACIÓN
      document.getElementById('pantalla-login').classList.add('hidden');
      
      // MOSTRAR BARRA INFERIOR EN CELULARES
      const navMobile = document.getElementById('nav-mobile-app');
      if (navMobile) navMobile.classList.remove('hidden');

      // SIDEBAR LATERAL: OCULTO EN CELULAR (hidden), VISIBLE SOLO EN COMPUTADORA (md:flex)
      const sidebar = document.getElementById('sidebar-app');
      if (sidebar) {
        sidebar.classList.add('hidden', 'md:flex');
        sidebar.classList.remove('md:hidden');
      }

      configurarInterfazPorRol();
      iniciarListenersFirestore();
      escucharConfigSuscripcion();
    } else {
      // SI NO HAY USUARIO, OCULTAR NAVEGACIÓN Y MOSTRAR ÚNICAMENTE LOGIN
      usuarioActual = null;
      document.getElementById('pantalla-login').classList.remove('hidden');

      const navMobile = document.getElementById('nav-mobile-app');
      if (navMobile) navMobile.classList.add('hidden');

      const sidebar = document.getElementById('sidebar-app');
      if (sidebar) {
        sidebar.classList.add('hidden', 'md:hidden');
        sidebar.classList.remove('md:flex');
      }
    }
  });
};

function configurarInterfazPorRol() {
  const btnUsrs = document.getElementById('btn-sec-usuarios');
  const btnSub = document.getElementById('btn-sec-suscripcion');
  const mBtnUsrs = document.getElementById('m-btn-usuarios');
  const mBtnSub = document.getElementById('m-btn-suscripcion');
  const panelSubAdmin = document.getElementById('panel-cfg-suscripcion-admin');
  const lblRol = document.getElementById('lbl-rol-usuario');

  if (rolUsuarioActual === 'admin') {
    lblRol.innerText = "Panel Administrador Master";
    if (btnUsrs) { btnUsrs.classList.remove('hidden'); btnUsrs.classList.add('flex'); }
    if (btnSub) { btnSub.classList.add('hidden'); btnSub.classList.remove('flex'); }
    if (mBtnUsrs) { mBtnUsrs.classList.remove('hidden'); mBtnUsrs.classList.add('flex'); }
    if (mBtnSub) { mBtnSub.classList.add('hidden'); mBtnSub.classList.remove('flex'); }
    if (panelSubAdmin) panelSubAdmin.classList.remove('hidden');
  } else {
    lblRol.innerText = "Panel de Prestamista";
    if (btnUsrs) { btnUsrs.classList.add('hidden'); btnUsrs.classList.remove('flex'); }
    if (btnSub) { btnSub.classList.remove('hidden'); btnSub.classList.add('flex'); }
    if (mBtnUsrs) { mBtnUsrs.classList.add('hidden'); mBtnUsrs.classList.remove('flex'); }
    if (mBtnSub) { mBtnSub.classList.remove('hidden'); mBtnSub.classList.add('flex'); }
    if (panelSubAdmin) panelSubAdmin.classList.add('hidden');
  }
}

function iniciarListenersFirestore() {
  if (!db || !usuarioActual) return;

  let consultaClientes = db.collection('clientes');
  let consultaPrestamos = db.collection('prestamos');

  if (rolUsuarioActual !== 'admin') {
    consultaClientes = consultaClientes.where('usuarioId', '==', usuarioActual.uid);
    consultaPrestamos = consultaPrestamos.where('usuarioId', '==', usuarioActual.uid);
  }

  consultaClientes.onSnapshot(snapshot => {
    clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarClientesSelect();
    renderizarDirectorioClientes();
    renderizarEstadoCuentas();
  });

  consultaPrestamos.onSnapshot(snapshot => {
    prestamos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarResumenYPrestamos();
    renderizarGridCalendarioVisual();
    renderizarPlanificadorSemanal();
    renderizarEstadoCuentas();
  });

  // Listener exclusivo para la lista de prestamistas en el panel de Administrador
  if (rolUsuarioActual === 'admin') {
    db.collection('usuarios').onSnapshot(snapshot => {
      const listaUsuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderizarListaPrestamistasAdmin(listaUsuarios);
    });
  }
}

async function iniciarSesionUsuario(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    mostrarToast("Bienvenido al sistema");
  } catch (error) {
    mostrarToast("Correo o contraseña incorrectos", "error");
  }
}

function cerrarSesionApp() {
  auth.signOut();
}

function mostrarSeccion(idSeccion) {
  // BLOQUEO DE SEGURIDAD: SI NO HAY SESIÓN INICIADA, SE CANCELA LA NAVEGACIÓN
  if (!usuarioActual) return;

  document.querySelectorAll('.seccion-app').forEach(sec => sec.classList.add('hidden'));
  document.getElementById(idSeccion).classList.remove('hidden');

  const btns = ['registrar', 'por-cobrar', 'resumen', 'estado', 'intereses', 'clientes', 'usuarios', 'suscripcion'];
  
  btns.forEach(b => {
    const btnElem = document.getElementById('btn-sec-' + b);
    if (btnElem) {
      if ('sec-' + b === idSeccion) {
        btnElem.className = "w-full text-left px-4 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-lg shadow-fuchsia-600/20 flex items-center justify-between transition";
      } else {
        btnElem.className = "w-full text-left px-4 py-3 rounded-xl font-semibold text-sm text-gray-400 hover:bg-slate-800/60 transition flex items-center justify-between";
      }
    }

    const mBtnElem = document.getElementById('m-btn-' + b);
    if (mBtnElem) {
      if ('sec-' + b === idSeccion) {
        mBtnElem.className = "flex flex-col items-center gap-1 text-fuchsia-400 font-bold py-1 px-2";
      } else {
        mBtnElem.className = "flex flex-col items-center gap-1 text-slate-400 py-1 px-2";
      }
    }
  });

  const titulos = {
    'sec-registrar': '💳 Registrar Préstamo',
    'sec-por-cobrar': '📅 Préstamos a Cobrar & Calendario',
    'sec-resumen': '📊 Resumen de Préstamos & Ganancias',
    'sec-estado': '⚠️ Estado de Cuentas & Recargos',
    'sec-intereses': '⚙️ Configuración de Intereses & Alquiler',
    'sec-clientes': '👥 Registro de Clientes / Deudores',
    'sec-usuarios': '🔐 Habilitar Accesos Prestamistas',
    'sec-suscripcion': '💳 Mi Suscripción & Clave'
  };
  
  if (document.getElementById('titulo-pantalla')) {
    document.getElementById('titulo-pantalla').innerText = titulos[idSeccion] || 'CobroApp';
  }

  window.scrollTo(0, 0);
}
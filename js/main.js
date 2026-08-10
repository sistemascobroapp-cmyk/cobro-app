// PUNTO DE ENTRADA PRINCIPAL, AUTENTICACIÓN, CONTROL DE SUSPENSIÓN Y ENRUTAMIENTO

// VARIABLES GLOBALES DE ESTADO
window.usuarioActual = null;
window.rolUsuarioActual = 'prestamista';
window.unsubListenerUsuario = null;
window.datosUsuarioActual = null;
window.clientes = window.clientes || [];
window.prestamos = window.prestamos || [];
window.configSuscripcion = window.configSuscripcion || { monto: 0, link: '', whatsapp: '' };
window.temaActual = localStorage.getItem('tema_app') || 'oscuro';

window.onload = function() {
  try {
    if (typeof aplicarTema === 'function') aplicarTema(window.temaActual);
    if (typeof cargarCamposConfigIntereses === 'function') cargarCamposConfigIntereses();

    const elemFrecuencia = document.getElementById('frecuencia-prestamo');
    if (elemFrecuencia) elemFrecuencia.value = 'mensual';

    if (typeof alCambiarFrecuencia === 'function') alCambiarFrecuencia();
    if (typeof renderizarGridCalendarioVisual === 'function') renderizarGridCalendarioVisual();
  } catch (e) {
    console.error("Error durante el onload:", e);
  }

  // LISTENER DE ESTADO DE AUTENTICACIÓN
  if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged(async user => {
      const btnSubmit = document.getElementById('btn-login-submit');

      if (window.unsubListenerUsuario) {
        window.unsubListenerUsuario();
        window.unsubListenerUsuario = null;
      }

      if (user) {
        window.usuarioActual = user;

        // 1. OCULTAR PANTALLA DE LOGIN DE INMEDIATO PARA EVITAR TILDES
        const pantallaLogin = document.getElementById('pantalla-login');
        if (pantallaLogin) pantallaLogin.classList.add('hidden');

        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerText = "Ingresar al Sistema";
        }

        const navMobile = document.getElementById('nav-mobile-app');
        if (navMobile) navMobile.classList.remove('hidden');

        const sidebar = document.getElementById('sidebar-app');
        if (sidebar) {
          sidebar.classList.add('hidden', 'md:flex');
          sidebar.classList.remove('md:hidden');
        }

        // 2. DETERMINAR ROL DEL USUARIO
        if (user.email && user.email.toLowerCase() === 'sistemas.cobroapp@gmail.com') {
          window.rolUsuarioActual = 'admin';
          ocultarPantallaBloqueo();
        } else {
          window.rolUsuarioActual = 'prestamista';

          // LISTENER EN TIEMPO REAL SOBRE EL DOCUMENTO DEL PRESTAMISTA
          try {
            window.unsubListenerUsuario = db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
              if (!doc.exists) {
                if (typeof mostrarToast === 'function') mostrarToast("🚫 Tu cuenta ha sido dada de baja.", "error");
                auth.signOut();
                return;
              }

              window.datosUsuarioActual = doc.data();
              const estado = window.datosUsuarioActual.estadoCuenta || 'activa';

              actualizarVistaSuscripcionUsuario(window.datosUsuarioActual);

              if (estado === 'suspendida') {
                mostrarPantallaBloqueo(window.datosUsuarioActual);
              } else {
                ocultarPantallaBloqueo();
                evaluarNotificacionSuscripcionDiaria(window.datosUsuarioActual);
              }
            }, err => {
              console.error("Error en listener de usuario:", err);
            });
          } catch (errUser) {
            console.error("Error suscribiendo a usuario:", errUser);
          }
        }

        // 3. CARGAR INTERFAZ Y LISTENERS DE FIRESTORE
        try { if (typeof configurarInterfazPorRol === 'function') configurarInterfazPorRol(); } catch (e) { console.error(e); }
        try { if (typeof iniciarListenersFirestore === 'function') iniciarListenersFirestore(); } catch (e) { console.error(e); }
        try { if (typeof escucharConfigSuscripcion === 'function') escucharConfigSuscripcion(); } catch (e) { console.error(e); }
        try { if (typeof verificarRetornoAutomaticoMercadoPago === 'function') verificarRetornoAutomaticoMercadoPago(); } catch (e) { console.error(e); }

      } else {
        // USUARIO NO AUTENTICADO
        window.usuarioActual = null;
        window.datosUsuarioActual = null;
        window.rolUsuarioActual = 'prestamista';
        ocultarPantallaBloqueo();

        const pantallaLogin = document.getElementById('pantalla-login');
        if (pantallaLogin) pantallaLogin.classList.remove('hidden');

        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerText = "Ingresar al Sistema";
        }

        const navMobile = document.getElementById('nav-mobile-app');
        if (navMobile) navMobile.classList.add('hidden');

        const sidebar = document.getElementById('sidebar-app');
        if (sidebar) {
          sidebar.classList.add('hidden', 'md:hidden');
          sidebar.classList.remove('md:flex');
        }
      }
    });
  } else {
    console.error("Firebase Auth no está disponible.");
  }
};

async function iniciarSesionUsuario(event) {
  if (event && event.preventDefault) event.preventDefault();

  const btn = document.getElementById('btn-login-submit');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Ingresando...";
  }

  const emailElem = document.getElementById('login-email');
  const passElem = document.getElementById('login-pass');

  if (!emailElem || !passElem) {
    if (btn) { btn.disabled = false; btn.innerText = "Ingresar al Sistema"; }
    return;
  }

  const email = emailElem.value.trim();
  const pass = passElem.value.trim();

  if (!email || !pass) {
    if (typeof mostrarToast === 'function') mostrarToast("Completá tu correo y contraseña.", "error");
    if (btn) { btn.disabled = false; btn.innerText = "Ingresar al Sistema"; }
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    if (typeof mostrarToast === 'function') mostrarToast("¡Bienvenido al sistema!");
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    let msg = "Correo o contraseña incorrectos";
    if (error.code === 'auth/invalid-email') msg = "El correo no tiene un formato válido";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = "Usuario o contraseña incorrectos";
    if (error.code === 'auth/too-many-requests') msg = "Demasiados intentos. Aguardá unos momentos";
    
    if (typeof mostrarToast === 'function') mostrarToast(msg, "error");
    
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Ingresar al Sistema";
    }
  }
}

function actualizarVistaSuscripcionUsuario(dataUsuario) {
  const txtMonto = document.getElementById('cli-sub-monto-txt');
  const btnPagarMp = document.getElementById('btn-pagar-sub-mp');
  if (!txtMonto) return;

  const fechaHoy = new Date();
  const mesAnioKey = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, '0')}`;
  const estaPagoMes = dataUsuario && dataUsuario.pagosMes && dataUsuario.pagosMes[mesAnioKey] === true;

  if (estaPagoMes) {
    txtMonto.innerHTML = `<span class="text-emerald-400">$0</span> <span class="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">🟢 Alquiler Saldado</span>`;
    if (btnPagarMp) {
      btnPagarMp.innerText = "✓ Alquiler Abonado este Mes";
      btnPagarMp.className = "w-full bg-emerald-600/30 text-emerald-300 font-extrabold py-3.5 rounded-xl border border-emerald-500/30 cursor-default";
      btnPagarMp.onclick = null;
    }
  } else {
    const monto = (window.configSuscripcion && window.configSuscripcion.monto) ? window.configSuscripcion.monto : 0;
    txtMonto.innerHTML = `<span class="text-indigo-400">$${monto.toLocaleString('es-AR')} / mes</span> <span class="text-xs font-bold text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30">⚠️ Pendiente</span>`;
    if (btnPagarMp) {
      btnPagarMp.innerText = "💳 Pagar Alquiler por Mercado Pago";
      btnPagarMp.className = "w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold py-3.5 rounded-xl shadow-lg flex justify-center items-center gap-2 cursor-pointer";
      btnPagarMp.onclick = typeof pagarSuscripcionMercadoPago === 'function' ? pagarSuscripcionMercadoPago : null;
    }
  }
}

function mostrarPantallaBloqueo(datosUsuario) {
  const modalBloqueo = document.getElementById('pantalla-bloqueo-suspension');
  if (!modalBloqueo) return;

  const elemMonto = document.getElementById('bloqueo-monto');
  const elemAlias = document.getElementById('bloqueo-alias-cbu');

  const monto = (window.configSuscripcion && window.configSuscripcion.monto) ? window.configSuscripcion.monto : 0;
  const link = (window.configSuscripcion && window.configSuscripcion.link) ? window.configSuscripcion.link : '';

  if (elemMonto) elemMonto.innerText = '$' + monto.toLocaleString('es-AR') + ' / mes';
  if (elemAlias) elemAlias.innerText = link || 'Sin CBU/Alias configurado';

  modalBloqueo.classList.remove('hidden');
}

function ocultarPantallaBloqueo() {
  const modalBloqueo = document.getElementById('pantalla-bloqueo-suspension');
  if (modalBloqueo) modalBloqueo.classList.add('hidden');
}

function copiarAliasBloqueo() {
  const alias = (window.configSuscripcion && window.configSuscripcion.link) ? window.configSuscripcion.link : '';
  if (!alias) return typeof mostrarToast === 'function' ? mostrarToast("Sin datos para copiar", "error") : null;

  navigator.clipboard.writeText(alias);
  if (typeof mostrarToast === 'function') mostrarToast(`📋 Copiado: ${alias}`);
}

function configurarInterfazPorRol() {
  const btnUsrs = document.getElementById('btn-sec-usuarios');
  const btnSub = document.getElementById('btn-sec-suscripcion');
  const mBtnUsrs = document.getElementById('m-btn-usuarios');
  const mBtnSub = document.getElementById('m-btn-suscripcion');
  const panelSubAdmin = document.getElementById('panel-cfg-suscripcion-admin');
  const lblRol = document.getElementById('lbl-rol-usuario');

  if (window.rolUsuarioActual === 'admin') {
    if (lblRol) lblRol.innerText = "Panel Administrador Master";
    
    if (btnUsrs) { btnUsrs.classList.remove('hidden'); btnUsrs.classList.add('flex'); }
    if (mBtnUsrs) { mBtnUsrs.classList.remove('hidden'); mBtnUsrs.classList.add('flex'); }
    
    if (btnSub) { btnSub.classList.add('hidden'); btnSub.classList.remove('flex'); }
    if (mBtnSub) { mBtnSub.classList.add('hidden'); mBtnSub.classList.remove('flex'); }
    
    if (panelSubAdmin) panelSubAdmin.classList.remove('hidden');
  } else {
    if (lblRol) lblRol.innerText = "Panel de Prestamista";
    
    if (btnUsrs) { btnUsrs.classList.add('hidden'); btnUsrs.classList.remove('flex'); }
    if (mBtnUsrs) { mBtnUsrs.classList.add('hidden'); mBtnUsrs.classList.remove('flex'); }

    if (btnSub) { btnSub.classList.remove('hidden'); btnSub.classList.add('flex'); }
    if (mBtnSub) { mBtnSub.classList.remove('hidden'); mBtnSub.classList.add('flex'); }
    
    if (panelSubAdmin) panelSubAdmin.classList.add('hidden');

    const secUsrs = document.getElementById('sec-usuarios');
    if (secUsrs && !secUsrs.classList.contains('hidden')) {
      mostrarSeccion('sec-registrar');
    }
  }
}

async function verificarRetornoAutomaticoMercadoPago() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status') || urlParams.get('collection_status');

  if (status === 'approved' && window.usuarioActual && window.rolUsuarioActual !== 'admin') {
    const fechaHoy = new Date();
    const mesAnioKey = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, '0')}`;

    try {
      await db.collection('usuarios').doc(window.usuarioActual.uid).update({
        [`pagosMes.${mesAnioKey}`]: true,
        estadoCuenta: 'activa'
      });

      if (typeof mostrarToast === 'function') mostrarToast("🎉 ¡Pago de suscripción acreditado automáticamente!");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error("Error al acreditar pago automático:", error);
    }
  }
}

function evaluarNotificacionSuscripcionDiaria(dataUsuario) {
  if (!dataUsuario) return;

  const fechaHoy = new Date();
  const diaActual = fechaHoy.getDate(); 
  const isoHoy = fechaHoy.toISOString().split('T')[0];

  if (diaActual >= 5 && diaActual <= 10) {
    const mesAnioKey = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, '0')}`;
    const estaPagoMes = dataUsuario.pagosMes && dataUsuario.pagosMes[mesAnioKey] === true;

    if (estaPagoMes) return;

    const yaVistoHoy = localStorage.getItem(`notif_sub_visto_${isoHoy}`);
    if (yaVistoHoy) return;

    const diasFaltantes = 10 - diaActual;
    const elemTitulo = document.getElementById('notif-sub-titulo');
    const elemMensaje = document.getElementById('notif-sub-mensaje');

    if (diaActual === 10) {
      if (elemTitulo) elemTitulo.innerText = "🚨 ÚLTIMO DÍA DE PAGO";
      if (elemMensaje) elemMensaje.innerHTML = "¡Hoy <strong>día 10</strong> es el último día para abonar tu suscripción mensual de la aplicación! Evitá la suspensión del servicio.";
    } else {
      if (elemTitulo) elemTitulo.innerText = "💳 Pago de Suscripción Próximo";
      if (elemMensaje) elemMensaje.innerHTML = `El día 10 vence la suscripción de tu app. En <strong>${diasFaltantes} días</strong> es la fecha límite.<br><br>Ya podés realizar el <strong>pago adelantado</strong> hoy mismo.`;
    }

    const modal = document.getElementById('modal-notificacion-suscripcion');
    if (modal) modal.classList.remove('hidden');
  }
}

function cerrarNotificacionSuscripcionVisual() {
  const fechaHoy = new Date().toISOString().split('T')[0];
  localStorage.setItem(`notif_sub_visto_${fechaHoy}`, 'true');
  
  const modal = document.getElementById('modal-notificacion-suscripcion');
  if (modal) modal.classList.add('hidden');
}

function irAPagarSuscripcionDesdeNotif() {
  cerrarNotificacionSuscripcionVisual();
  mostrarSeccion('sec-suscripcion');
}

function iniciarListenersFirestore() {
  if (!db || !window.usuarioActual) return;

  try {
    let consultaClientes = db.collection('clientes').where('usuarioId', '==', window.usuarioActual.uid);
    let consultaPrestamos = db.collection('prestamos').where('usuarioId', '==', window.usuarioActual.uid);

    consultaClientes.onSnapshot(snapshot => {
      window.clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (typeof renderizarClientesSelect === 'function') renderizarClientesSelect();
      if (typeof renderizarDirectorioClientes === 'function') renderizarDirectorioClientes();
      if (typeof renderizarEstadoCuentas === 'function') renderizarEstadoCuentas();
    }, err => console.error("Error en snapshot clientes:", err));

    consultaPrestamos.onSnapshot(snapshot => {
      window.prestamos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (typeof renderizarResumenYPrestamos === 'function') renderizarResumenYPrestamos();
      if (typeof renderizarGridCalendarioVisual === 'function') renderizarGridCalendarioVisual();
      if (typeof renderizarPlanificadorSemanal === 'function') renderizarPlanificadorSemanal();
      if (typeof renderizarEstadoCuentas === 'function') renderizarEstadoCuentas();
    }, err => console.error("Error en snapshot préstamos:", err));

    if (window.rolUsuarioActual === 'admin') {
      db.collection('usuarios').onSnapshot(snapshot => {
        const listaUsuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (typeof renderizarListaPrestamistasAdmin === 'function') renderizarListaPrestamistasAdmin(listaUsuarios);
      }, err => console.error("Error en snapshot usuarios:", err));
    }
  } catch (error) {
    console.error("Error al iniciar listeners:", error);
  }
}

function cerrarSesionApp() {
  if (typeof auth !== 'undefined' && auth) auth.signOut();
}

function mostrarSeccion(idSeccion) {
  if (!window.usuarioActual) return;

  if (idSeccion === 'sec-usuarios' && window.rolUsuarioActual !== 'admin') {
    idSeccion = 'sec-registrar';
  }

  document.querySelectorAll('.seccion-app').forEach(sec => sec.classList.add('hidden'));
  const target = document.getElementById(idSeccion);
  if (target) target.classList.remove('hidden');

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
      if (b === 'usuarios' && window.rolUsuarioActual !== 'admin') {
        mBtnElem.className = "hidden";
      }
      else if (b === 'suscripcion' && window.rolUsuarioActual === 'admin') {
        mBtnElem.className = "hidden";
      }
      else if ('sec-' + b === idSeccion) {
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
// PUNTO DE ENTRADA PRINCIPAL, AUTENTICACIÓN, CONTROL DE SUSPENSIÓN Y ENRUTAMIENTO

let usuarioActual = null;
let rolUsuarioActual = 'prestamista';
let unsubListenerUsuario = null;

window.onload = function() {
  aplicarTema(temaActual);
  cargarCamposConfigIntereses();

  document.getElementById('frecuencia-prestamo').value = 'mensual';
  alCambiarFrecuencia();
  renderizarGridCalendarioVisual();

  auth.onAuthStateChanged(async user => {
    if (unsubListenerUsuario) {
      unsubListenerUsuario();
      unsubListenerUsuario = null;
    }

    if (user) {
      usuarioActual = user;

      // RECONOCIMIENTO AUTOMÁTICO DE ADMINISTRADOR MASTER POR CORREO
      if (user.email && user.email.toLowerCase() === 'sistemas.cobroapp@gmail.com') {
        rolUsuarioActual = 'admin';
        ocultarPantallaBloqueo();
      } else {
        rolUsuarioActual = 'prestamista';

        // LISTENER EN TIEMPO REAL SOBRE EL DOCUMENTO DEL PRESTAMISTA
        unsubListenerUsuario = db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
          if (!doc.exists) {
            mostrarToast("🚫 Tu cuenta ha sido dada de baja del sistema.", "error");
            auth.signOut();
            return;
          }

          const data = doc.data();
          const estado = data.estadoCuenta || 'activa';

          if (estado === 'suspendida') {
            mostrarPantallaBloqueo(data);
          } else {
            ocultarPantallaBloqueo();
            evaluarNotificacionSuscripcionDiaria(data);
          }
        });
      }

      // OCULTAR PANTALLA DE LOGIN
      document.getElementById('pantalla-login').classList.add('hidden');
      
      const navMobile = document.getElementById('nav-mobile-app');
      if (navMobile) navMobile.classList.remove('hidden');

      const sidebar = document.getElementById('sidebar-app');
      if (sidebar) {
        sidebar.classList.add('hidden', 'md:flex');
        sidebar.classList.remove('md:hidden');
      }

      configurarInterfazPorRol();
      iniciarListenersFirestore();
      escucharConfigSuscripcion();

      // VERIFICACIÓN AUTOMÁTICA DE PAGO DESDE MERCADO PAGO
      verificarRetornoAutomaticoMercadoPago();

    } else {
      usuarioActual = null;
      rolUsuarioActual = 'prestamista';
      ocultarPantallaBloqueo();

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

function mostrarPantallaBloqueo(datosUsuario) {
  const modalBloqueo = document.getElementById('pantalla-bloqueo-suspension');
  if (!modalBloqueo) return;

  const elemMonto = document.getElementById('bloqueo-monto');
  const elemAlias = document.getElementById('bloqueo-alias-cbu');

  if (elemMonto) elemMonto.innerText = '$' + (configSuscripcion.monto || 0).toLocaleString('es-AR') + ' / mes';
  if (elemAlias) elemAlias.innerText = configSuscripcion.link || 'Sin CBU/Alias configurado';

  modalBloqueo.classList.remove('hidden');
}

function ocultarPantallaBloqueo() {
  const modalBloqueo = document.getElementById('pantalla-bloqueo-suspension');
  if (modalBloqueo) modalBloqueo.classList.add('hidden');
}

function copiarAliasBloqueo() {
  const alias = configSuscripcion.link || '';
  if (!alias) return mostrarToast("Sin datos para copiar", "error");

  navigator.clipboard.writeText(alias);
  mostrarToast(`📋 Copiado: ${alias}`);
}

function configurarInterfazPorRol() {
  const btnUsrs = document.getElementById('btn-sec-usuarios');
  const btnSub = document.getElementById('btn-sec-suscripcion');
  const mBtnUsrs = document.getElementById('m-btn-usuarios');
  const mBtnSub = document.getElementById('m-btn-suscripcion');
  const panelSubAdmin = document.getElementById('panel-cfg-suscripcion-admin');
  const lblRol = document.getElementById('lbl-rol-usuario');

  if (rolUsuarioActual === 'admin') {
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

  if (status === 'approved' && usuarioActual && rolUsuarioActual !== 'admin') {
    const fechaHoy = new Date();
    const mesAnioKey = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, '0')}`;

    try {
      await db.collection('usuarios').doc(usuarioActual.uid).update({
        [`pagosMes.${mesAnioKey}`]: true,
        estadoCuenta: 'activa'
      });

      mostrarToast("🎉 ¡Pago de alquiler acreditado automáticamente!");
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
      if (elemMensaje) elemMensaje.innerHTML = "¡Hoy <strong>día 10</strong> es el último día para abonar tu alquiler mensual de la aplicación! Evitá la suspensión del servicio.";
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
  if (!usuarioActual) return;

  if (idSeccion === 'sec-usuarios' && rolUsuarioActual !== 'admin') {
    idSeccion = 'sec-registrar';
  }

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
      if (b === 'usuarios' && rolUsuarioActual !== 'admin') {
        mBtnElem.className = "hidden";
      }
      else if (b === 'suscripcion' && rolUsuarioActual === 'admin') {
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
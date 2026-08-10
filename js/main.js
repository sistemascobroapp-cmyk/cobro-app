// PUNTO DE ENTRADA PRINCIPAL, AUTENTICACIÓN, CONTROL DE SUSPENSIÓN Y ENRUTAMIENTO

// VARIABLES DE ESTADO GLOBAL
let usuarioActual = null;
let rolUsuarioActual = 'prestamista';
let unsubListenerUsuario = null;
let datosUsuarioActual = null;
let clientes = [];
let prestamos = [];
let configSuscripcion = { monto: 0, link: '', whatsapp: '' };
let temaActual = localStorage.getItem('tema_app') || 'oscuro';

window.onload = function() {
  if (typeof aplicarTema === 'function') aplicarTema(temaActual);
  if (typeof cargarCamposConfigIntereses === 'function') cargarCamposConfigIntereses();

  const elemFrecuencia = document.getElementById('frecuencia-prestamo');
  if (elemFrecuencia) elemFrecuencia.value = 'mensual';

  if (typeof alCambiarFrecuencia === 'function') alCambiarFrecuencia();
  if (typeof renderizarGridCalendarioVisual === 'function') renderizarGridCalendarioVisual();

  auth.onAuthStateChanged(async user => {
    const btnSubmit = document.getElementById('btn-login-submit');

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
            if (typeof mostrarToast === 'function') mostrarToast("🚫 Tu cuenta ha sido dada de baja del sistema.", "error");
            auth.signOut();
            return;
          }

          datosUsuarioActual = doc.data();
          const estado = datosUsuarioActual.estadoCuenta || 'activa';

          // ACTUALIZAR ESTADO DE ALQUILER EN LA PESTAÑA DEL PRESTAMISTA
          actualizarVistaSuscripcionUsuario(datosUsuarioActual);

          if (estado === 'suspendida') {
            mostrarPantallaBloqueo(datosUsuarioActual);
          } else {
            ocultarPantallaBloqueo();
            evaluarNotificacionSuscripcionDiaria(datosUsuarioActual);
          }
        }, err => {
          console.error("Error en listener usuario:", err);
        });
      }

      // OCULTAR PANTALLA DE LOGIN Y ACTIVAR INTERFAZ
      const pantallaLogin = document.getElementById('pantalla-login');
      if (pantallaLogin) pantallaLogin.classList.add('hidden');
      
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
      datosUsuarioActual = null;
      rolUsuarioActual = 'prestamista';
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
};

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
    const monto = (configSuscripcion && configSuscripcion.monto) ? configSuscripcion.monto : 0;
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

  const monto = (configSuscripcion && configSuscripcion.monto) ? configSuscripcion.monto : 0;
  const link = (configSuscripcion && configSuscripcion.link) ? configSuscripcion.link : '';

  if (elemMonto) elemMonto.innerText = '$' + monto.toLocaleString('es-AR') + ' / mes';
  if (elemAlias) elemAlias.innerText = link || 'Sin CBU/Alias configurado';

  modalBloqueo.classList.remove('hidden');
}

function ocultarPantallaBloqueo() {
  const modalBloqueo = document.getElementById('pantalla-bloqueo-suspension');
  if (modalBloqueo) modalBloqueo.classList.add('hidden');
}

function copiarAliasBloqueo() {
  const alias = (configSuscripcion && configSuscripcion.link) ? configSuscripcion.link : '';
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
  if (!db || !usuarioActual) return;

  // CADA USUARIO ÚNICAMENTE VE SUS PROPIOS CLIENTES Y PRÉSTAMOS
  let consultaClientes = db.collection('clientes').where('usuarioId', '==', usuarioActual.uid);
  let consultaPrestamos = db.collection('prestamos').where('usuarioId', '==', usuarioActual.uid);

  consultaClientes.onSnapshot(snapshot => {
    clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (typeof renderizarClientesSelect === 'function') renderizarClientesSelect();
    if (typeof renderizarDirectorioClientes === 'function') renderizarDirectorioClientes();
    if (typeof renderizarEstadoCuentas === 'function') renderizarEstadoCuentas();
  }, err => console.error("Error clientes snapshot:", err));

  consultaPrestamos.onSnapshot(snapshot => {
    prestamos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (typeof renderizarResumenYPrestamos === 'function') renderizarResumenYPrestamos();
    if (typeof renderizarGridCalendarioVisual === 'function') renderizarGridCalendarioVisual();
    if (typeof renderizarPlanificadorSemanal === 'function') renderizarPlanificadorSemanal();
    if (typeof renderizarEstadoCuentas === 'function') renderizarEstadoCuentas();
  }, err => console.error("Error prestamos snapshot:", err));

  if (rolUsuarioActual === 'admin') {
    db.collection('usuarios').onSnapshot(snapshot => {
      const listaUsuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (typeof renderizarListaPrestamistasAdmin === 'function') renderizarListaPrestamistasAdmin(listaUsuarios);
    }, err => console.error("Error usuarios snapshot:", err));
  }
}

async function iniciarSesionUsuario(event) {
  event.preventDefault();
  const btn = document.getElementById('btn-login-submit');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Ingresando...";
  }

  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    if (typeof mostrarToast === 'function') mostrarToast("¡Bienvenido al sistema!");
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    if (typeof mostrarToast === 'function') mostrarToast("Correo o contraseña incorrectos", "error");
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Ingresar al Sistema";
    }
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
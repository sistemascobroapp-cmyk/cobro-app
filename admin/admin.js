// LÓGICA EXCLUSIVA DEL ADMINISTRADOR MASTER (CREAR PRESTAMISTAS, GESTIÓN Y SUSCRIPCIÓN)

async function crearUsuarioPrestamista(event) {
  event.preventDefault();
  const nombre = document.getElementById('usr-nombre-prestamista').value.trim();
  const email = document.getElementById('usr-email').value.trim();
  const pass = document.getElementById('usr-pass').value.trim();

  try {
    const appSecundaria = firebase.initializeApp(firebaseConfig, "secundario");
    const res = await appSecundaria.auth().createUserWithEmailAndPassword(email, pass);
    
    await db.collection('usuarios').doc(res.user.uid).set({
      nombre: nombre,
      email: email,
      passwordVisual: pass,
      rol: 'prestamista',
      estadoCuenta: 'activa',
      pagosMes: {},
      fechaCreacion: new Date().toISOString()
    });

    await appSecundaria.delete();

    mostrarToast("✨ ¡Cuenta de prestamista habilitada correctamente!");
    document.getElementById('usr-nombre-prestamista').value = '';
    document.getElementById('usr-email').value = '';
    document.getElementById('usr-pass').value = '';
  } catch (error) {
    console.error(error);
    mostrarToast("Error al crear cuenta: " + error.message, "error");
  }
}

function renderizarListaPrestamistasAdmin(listaUsuarios) {
  const container = document.getElementById('lista-prestamistas-admin');
  if (!container) return;

  container.innerHTML = '';
  const prestamistas = listaUsuarios.filter(u => u.rol === 'prestamista');

  if (prestamistas.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic">No hay prestamistas registrados todavía.</p>';
    return;
  }

  const fechaHoy = new Date();
  const mesAnioActualKey = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, '0')}`;
  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const nombreMesActual = `${nombresMeses[fechaHoy.getMonth()]} ${fechaHoy.getFullYear()}`;

  prestamistas.forEach(p => {
    const estaPagoMes = p.pagosMes && p.pagosMes[mesAnioActualKey] === true;
    const estaSuspendida = p.estadoCuenta === 'suspendida';

    container.innerHTML += `
      <div class="p-4 rounded-2xl border ${estaSuspendida ? 'bg-red-950/20 border-red-500/50' : 'bg-[#1E293B]/60 border-slate-700/80'} space-y-3">
        <div class="flex justify-between items-start flex-wrap gap-2">
          <div>
            <h5 class="font-extrabold text-white text-base flex items-center gap-2">
              <span>👤</span> ${p.nombre || 'Prestamista'}
              <span class="text-[10px] px-2 py-0.5 rounded font-extrabold ${estaSuspendida ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}">
                ${estaSuspendida ? '⛔ SUSPENDIDA' : '🟢 ACTIVA'}
              </span>
            </h5>
            <p class="text-xs text-slate-300 mt-1">📧 <strong>Correo:</strong> ${p.email}</p>
            <p class="text-xs text-fuchsia-400 font-semibold">🔑 <strong>Contraseña actual:</strong> <span class="bg-slate-900 px-2 py-0.5 rounded text-white font-mono">${p.passwordVisual || '••••••••'}</span></p>
          </div>

          <div class="text-right">
            <span class="text-[10px] uppercase font-bold text-slate-400 block mb-1">SUSCRIPCIÓN VENCE DÍA 10 (${nombreMesActual.toUpperCase()})</span>
            <button onclick="alternarPagoMesPrestamista('${p.id}', '${mesAnioActualKey}', ${estaPagoMes})" class="px-3 py-1.5 rounded-xl text-xs font-bold transition shadow ${estaPagoMes ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}">
              ${estaPagoMes ? '✓ PAGADO ESTE MES' : '⚠️ PENDIENTE DE PAGO'}
            </button>
          </div>
        </div>

        <div class="border-t border-slate-800/80 pt-3 flex justify-end items-center gap-2">
          <button onclick="alternarSuspensionPrestamista('${p.id}', '${p.estadoCuenta || 'activa'}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition border ${estaSuspendida ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'}">
            ${estaSuspendida ? '✅ Reactivar Acceso' : '🚫 Suspender Acceso'}
          </button>
          <button onclick="eliminarPrestamistaEHistorial('${p.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition">
            🗑️ Eliminar Cuenta e Historial
          </button>
        </div>
      </div>
    `;
  });
}

async function alternarPagoMesPrestamista(uid, mesKey, estadoActual) {
  try {
    await db.collection('usuarios').doc(uid).update({
      [`pagosMes.${mesKey}`]: !estadoActual
    });
    mostrarToast(!estadoActual ? "Pago de suscripción registrado" : "Estado de pago cambiado a pendiente");
  } catch (error) {
    mostrarToast("Error al actualizar pago", "error");
  }
}

async function alternarSuspensionPrestamista(uid, estadoActual) {
  const nuevoEstado = (estadoActual === 'suspendida') ? 'activa' : 'suspendida';
  try {
    await db.collection('usuarios').doc(uid).update({
      estadoCuenta: nuevoEstado
    });
    mostrarToast(nuevoEstado === 'suspendida' ? "Cuenta suspendida" : "Cuenta reactivada");
  } catch (error) {
    mostrarToast("Error al cambiar estado", "error");
  }
}

async function eliminarPrestamistaEHistorial(uid) {
  if (confirm("⚠️ ¿Estás seguro de eliminar este prestamista? Se borrará su cuenta y todo su historial de préstamos y clientes.")) {
    try {
      const snapshotClientes = await db.collection('clientes').where('usuarioId', '==', uid).get();
      snapshotClientes.docs.forEach(doc => doc.ref.delete());

      const snapshotPrestamos = await db.collection('prestamos').where('usuarioId', '==', uid).get();
      snapshotPrestamos.docs.forEach(doc => doc.ref.delete());

      await db.collection('usuarios').doc(uid).delete();

      mostrarToast("Prestamista y todo su historial borrados con éxito");
    } catch (error) {
      console.error(error);
      mostrarToast("Error al eliminar cuenta", "error");
    }
  }
}

function escucharConfigSuscripcion() {
  db.collection('configuracion').doc('suscripcion').onSnapshot(doc => {
    if (doc.exists) {
      configSuscripcion = doc.data();

      const inMonto = document.getElementById('cfg-sub-monto');
      const inLink = document.getElementById('cfg-sub-link');
      const inWsp = document.getElementById('cfg-sub-whatsapp');
      
      if (inMonto) inMonto.value = configSuscripcion.monto || 0;
      if (inLink) inLink.value = configSuscripcion.link || '';
      if (inWsp) inWsp.value = configSuscripcion.whatsapp || '';

      const txtLinkInfo = document.getElementById('cli-sub-link-info');
      if (txtLinkInfo) txtLinkInfo.innerText = configSuscripcion.link ? `Destino de Pago: ${configSuscripcion.link}` : 'Sin método configurado aún.';

      const elemMontoBloqueo = document.getElementById('bloqueo-monto');
      const elemAliasBloqueo = document.getElementById('bloqueo-alias-cbu');
      if (elemMontoBloqueo) elemMontoBloqueo.innerText = '$' + (configSuscripcion.monto || 0).toLocaleString('es-AR') + ' / mes';
      if (elemAliasBloqueo) elemAliasBloqueo.innerText = configSuscripcion.link || 'Sin CBU/Alias configurado';

      if (datosUsuarioActual) {
        actualizarVistaSuscripcionUsuario(datosUsuarioActual);
      }
    }
  });
}

async function guardarConfigSuscripcion(event) {
  event.preventDefault();
  const monto = parseFloat(document.getElementById('cfg-sub-monto').value) || 0;
  const link = document.getElementById('cfg-sub-link').value.trim();
  const whatsapp = document.getElementById('cfg-sub-whatsapp').value.trim();

  await db.collection('configuracion').doc('suscripcion').set({ monto, link, whatsapp });
  mostrarToast("Ajustes de suscripción de la app guardados con éxito");
}
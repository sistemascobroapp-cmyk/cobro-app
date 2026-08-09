// LÓGICA EXCLUSIVA DEL ADMINISTRADOR MASTER (CREAR PRESTAMISTAS Y FIJAR ALQUILER)

function renderizarSelectUsuariosClientes() {
  const select = document.getElementById('usr-select-cliente');
  if (!select) return;
  select.innerHTML = '<option value="">-- Seleccionar Prestamista --</option>';
  clientes.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nombre} (${c.dir})</option>`;
  });
}

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
      rol: 'prestamista',
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

function escucharConfigSuscripcion() {
  db.collection('configuracion').doc('suscripcion').onSnapshot(doc => {
    if (doc.exists) {
      configSuscripcion = doc.data();

      const inMonto = document.getElementById('cfg-sub-monto');
      const inLink = document.getElementById('cfg-sub-link');
      if (inMonto) inMonto.value = configSuscripcion.monto || 0;
      if (inLink) inLink.value = configSuscripcion.link || '';

      const txtMonto = document.getElementById('cli-sub-monto-txt');
      const txtLinkInfo = document.getElementById('cli-sub-link-info');
      if (txtMonto) txtMonto.innerText = '$' + (configSuscripcion.monto || 0).toLocaleString('es-AR') + ' / mes';
      if (txtLinkInfo) txtLinkInfo.innerText = configSuscripcion.link ? `Destino de Pago: ${configSuscripcion.link}` : 'Sin método configurado aún.';
    }
  });
}

async function guardarConfigSuscripcion(event) {
  event.preventDefault();
  const monto = parseFloat(document.getElementById('cfg-sub-monto').value) || 0;
  const link = document.getElementById('cfg-sub-link').value.trim();

  await db.collection('configuracion').doc('suscripcion').set({ monto, link });
  mostrarToast("Ajustes de alquiler de app guardados");
}
// LÓGICA COMPLETA DE PRESTAMISTAS, DÍAS, SIMULACIONES, DÍAS EN CALENDARIO Y COBROS

let fechaSemanaSeleccionada = new Date();
let fechaMesCalendarioVisual = new Date();
let simulacionActual = null;
let clienteSeleccionadoPrestamoDuplicado = null;
let pestanaResumenActual = 'activos';

// ==========================================
// 1. CONFIGURACIÓN DE INTERESES Y MODAL (ROSQUITA)
// ==========================================

async function cargarCamposConfigIntereses() {
  if (!window.usuarioActual) return;
  try {
    const doc = await db.collection('usuarios').doc(window.usuarioActual.uid).get();
    if (doc.exists && doc.data().configIntereses) {
      const cfg = doc.data().configIntereses;
      ['cfg-int-diario', 'modal-cfg-int-diario'].forEach(id => { const el = document.getElementById(id); if (el) el.value = cfg.intDiario ?? 0; });
      ['cfg-int-semanal', 'modal-cfg-int-semanal'].forEach(id => { const el = document.getElementById(id); if (el) el.value = cfg.intSemanal ?? 0; });
      ['cfg-int-mensual', 'modal-cfg-int-mensual'].forEach(id => { const el = document.getElementById(id); if (el) el.value = cfg.intMensual ?? 0; });
      ['cfg-retraso-diario', 'modal-cfg-retraso-diario'].forEach(id => { const el = document.getElementById(id); if (el) el.value = cfg.retrasoDiario ?? 0; });
      ['cfg-retraso-semanal', 'modal-cfg-retraso-semanal'].forEach(id => { const el = document.getElementById(id); if (el) el.value = cfg.retrasoSemanal ?? 0; });
      ['cfg-retraso-mensual', 'modal-cfg-retraso-mensual'].forEach(id => { const el = document.getElementById(id); if (el) el.value = cfg.retrasoMensual ?? 0; });
    }
  } catch (error) {
    console.error(error);
  }
}

async function guardarInteresesConfig(event) {
  if (event) event.preventDefault();
  if (!window.usuarioActual) return;

  const configIntereses = {
    intDiario: parseFloat(document.getElementById('cfg-int-diario')?.value) || 0,
    intSemanal: parseFloat(document.getElementById('cfg-int-semanal')?.value) || 0,
    intMensual: parseFloat(document.getElementById('cfg-int-mensual')?.value) || 0,
    retrasoDiario: parseFloat(document.getElementById('cfg-retraso-diario')?.value) || 0,
    retrasoSemanal: parseFloat(document.getElementById('cfg-retraso-semanal')?.value) || 0,
    retrasoMensual: parseFloat(document.getElementById('cfg-retraso-mensual')?.value) || 0
  };

  try {
    await db.collection('usuarios').doc(window.usuarioActual.uid).set({ configIntereses }, { merge: true });
    mostrarToast("⚙️ Porcentajes de interés guardados correctamente");
    cargarCamposConfigIntereses();
  } catch (error) {
    mostrarToast("Error al guardar la configuración de intereses", "error");
  }
}

function abrirModalConfigIntereses() {
  cargarCamposConfigIntereses();
  const modal = document.getElementById('modal-config-intereses');
  if (modal) modal.classList.remove('hidden');
}

function cerrarModalConfigIntereses() {
  const modal = document.getElementById('modal-config-intereses');
  if (modal) modal.classList.add('hidden');
}

async function guardarInteresesConfigDesdeModal(event) {
  event.preventDefault();
  if (!window.usuarioActual) return;

  const configIntereses = {
    intDiario: parseFloat(document.getElementById('modal-cfg-int-diario')?.value) || 0,
    intSemanal: parseFloat(document.getElementById('modal-cfg-int-semanal')?.value) || 0,
    intMensual: parseFloat(document.getElementById('modal-cfg-int-mensual')?.value) || 0,
    retrasoDiario: parseFloat(document.getElementById('modal-cfg-retraso-diario')?.value) || 0,
    retrasoSemanal: parseFloat(document.getElementById('modal-cfg-retraso-semanal')?.value) || 0,
    retrasoMensual: parseFloat(document.getElementById('modal-cfg-retraso-mensual')?.value) || 0
  };

  try {
    await db.collection('usuarios').doc(window.usuarioActual.uid).set({ configIntereses }, { merge: true });
    mostrarToast("⚙️ Tasas e intereses guardados con éxito");
    cerrarModalConfigIntereses();
    cargarCamposConfigIntereses();
    alCambiarFrecuencia();
  } catch (error) {
    mostrarToast("Error al guardar configuración", "error");
  }
}

// ==========================================
// 2. CLIENTES Y SELECTS
// ==========================================

function renderizarClientesSelect() {
  const select = document.getElementById('input-cliente');
  if (!select) return;

  const valActual = select.value;
  select.innerHTML = '<option value="">-- Sin cliente seleccionado (Solo Simular) --</option>';

  window.clientes.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nombre} (${c.telefono})</option>`;
  });

  select.value = valActual;
}

function renderizarDirectorioClientes() {
  const container = document.getElementById('grid-clientes-directorio');
  if (!container) return;

  container.innerHTML = '';
  if (window.clientes.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic">No tenés clientes registrados aún.</p>';
    return;
  }

  window.clientes.forEach(c => {
    const prestamosCliente = window.prestamos.filter(p => p.clienteId === c.id && p.estado !== 'finalizado');
    const tieneActivo = prestamosCliente.length > 0;

    container.innerHTML += `
      <div class="p-4 rounded-2xl border bg-[#1E293B]/60 border-slate-700/80 space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <h5 class="font-extrabold text-white text-base">${c.nombre}</h5>
            <p class="text-xs text-slate-300">📞 ${c.telefono} | 🚨 ${c.emergencia || 'S/E'}</p>
            <p class="text-xs text-slate-400">📍 ${c.direccion}</p>
          </div>
          <span class="text-[10px] px-2.5 py-1 rounded-full font-extrabold ${tieneActivo ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}">
            ${tieneActivo ? '💳 Con Préstamo' : '🟢 Al Día'}
          </span>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-800 pt-2">
          <button onclick="abrirModalInfoCliente('${c.id}')" class="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-fuchsia-400 rounded-lg border border-slate-700 font-bold">📜 Ficha</button>
          <button onclick="editarCliente('${c.id}')" class="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 font-bold">✏️ Editar</button>
          <button onclick="eliminarCliente('${c.id}')" class="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 font-bold">🗑️</button>
        </div>
      </div>
    `;
  });
}

function abrirModalNuevoCliente() {
  document.getElementById('cli-edit-id').value = '';
  document.getElementById('cli-nombre').value = '';
  document.getElementById('cli-tel').value = '';
  document.getElementById('cli-emergencia').value = '';
  document.getElementById('cli-direccion').value = '';
  document.getElementById('cli-redes').value = '';
  document.getElementById('modal-cliente-titulo').innerText = '👤 Registrar Nuevo Cliente';
  document.getElementById('modal-nuevo-cliente').classList.remove('hidden');
}

function cerrarModalCliente() {
  document.getElementById('modal-nuevo-cliente').classList.add('hidden');
}

async function guardarYVincularCliente(event) {
  event.preventDefault();
  if (!window.usuarioActual) return;

  const editId = document.getElementById('cli-edit-id').value;
  const nombre = document.getElementById('cli-nombre').value.trim();
  const telefono = document.getElementById('cli-tel').value.trim();
  const emergencia = document.getElementById('cli-emergencia').value.trim();
  const direccion = document.getElementById('cli-direccion').value.trim();
  const redes = document.getElementById('cli-redes').value.trim();

  const dataCliente = {
    nombre, telefono, emergencia, direccion, redes,
    usuarioId: window.usuarioActual.uid
  };

  try {
    if (editId) {
      await db.collection('clientes').doc(editId).update(dataCliente);
      mostrarToast("Cliente actualizado correctamente");
    } else {
      await db.collection('clientes').add(dataCliente);
      mostrarToast("¡Cliente registrado con éxito!");
    }
    cerrarModalCliente();
  } catch (error) {
    mostrarToast("Error al guardar cliente", "error");
  }
}

function editarCliente(id) {
  const cli = window.clientes.find(c => c.id === id);
  if (!cli) return;

  document.getElementById('cli-edit-id').value = cli.id;
  document.getElementById('cli-nombre').value = cli.nombre;
  document.getElementById('cli-tel').value = cli.telefono;
  document.getElementById('cli-emergencia').value = cli.emergencia || '';
  document.getElementById('cli-direccion').value = cli.direccion;
  document.getElementById('cli-redes').value = cli.redes || '';
  document.getElementById('modal-cliente-titulo').innerText = '✏️ Editar Cliente';
  document.getElementById('modal-nuevo-cliente').classList.remove('hidden');
}

async function eliminarCliente(id) {
  if (confirm("¿Estás seguro de eliminar este cliente?")) {
    try {
      await db.collection('clientes').doc(id).delete();
      mostrarToast("Cliente eliminado");
    } catch (error) {
      mostrarToast("Error al eliminar cliente", "error");
    }
  }
}

function abrirModalInfoCliente(id) {
  const cli = window.clientes.find(c => c.id === id);
  if (!cli) return;

  document.getElementById('info-cli-nombre').innerText = cli.nombre;
  document.getElementById('info-cli-tel').innerText = cli.telefono;
  document.getElementById('info-cli-emer').innerText = cli.emergencia || 'No registrado';
  document.getElementById('info-cli-dir').innerText = cli.direccion;
  document.getElementById('info-cli-redes').innerText = cli.redes || 'Sin notas adicionales';

  const contHistorial = document.getElementById('contenedor-historial-prestamos-cliente');
  if (contHistorial) {
    contHistorial.innerHTML = '';
    const prestamosCli = window.prestamos.filter(p => p.clienteId === id);

    if (prestamosCli.length === 0) {
      contHistorial.innerHTML = '<p class="text-xs text-slate-500 italic">Este cliente no tiene historial de préstamos.</p>';
    } else {
      prestamosCli.forEach(p => {
        contHistorial.innerHTML += `
          <div class="bg-[#1E293B] p-3 rounded-xl text-xs space-y-1 border border-slate-700/80">
            <div class="flex justify-between items-center font-bold">
              <span class="text-white">Monto: $${parseFloat(p.monto).toLocaleString('es-AR')}</span>
              <span class="${p.estado === 'finalizado' ? 'text-emerald-400' : 'text-amber-400'}">${p.estado === 'finalizado' ? '🏁 Finalizado' : '🟢 Activo'}</span>
            </div>
            <p class="text-slate-400">Total a Devolver: <strong>$${parseFloat(p.montoTotal).toLocaleString('es-AR')}</strong> | Cuotas: <strong>${p.cuotas} (${p.frecuencia})</strong></p>
          </div>
        `;
      });
    }
  }

  document.getElementById('modal-info-cliente').classList.remove('hidden');
}

function cerrarModalInfoCliente() {
  document.getElementById('modal-info-cliente').classList.add('hidden');
}

// ==========================================
// 3. SIMULADOR Y CREACIÓN DE PRÉSTAMOS
// ==========================================

function alCambiarFrecuencia() {
  const frec = document.getElementById('frecuencia-prestamo')?.value;
  const inputInt = document.getElementById('interes-prestamo');
  if (!inputInt) return;

  if (frec === 'diario') inputInt.value = document.getElementById('cfg-int-diario')?.value || 10;
  if (frec === 'semanal') inputInt.value = document.getElementById('cfg-int-semanal')?.value || 20;
  if (frec === 'mensual') inputInt.value = document.getElementById('cfg-int-mensual')?.value || 30;
}

function convertirMontoEnLetras(val) {
  const elem = document.getElementById('monto-en-letras');
  if (elem) elem.innerText = numeroALetras(parseFloat(val) || 0);
}

function generarSimulacion(event) {
  if (event) event.preventDefault();

  const clienteId = document.getElementById('input-cliente').value;
  const monto = parseFloat(document.getElementById('monto-prestamo').value) || 0;
  const interes = parseFloat(document.getElementById('interes-prestamo').value) || 0;
  const cuotas = parseInt(document.getElementById('cuotas-prestamo').value) || 1;
  const frecuencia = document.getElementById('frecuencia-prestamo').value;
  const fechaInicioStr = document.getElementById('fecha-inicio').value;

  if (monto <= 0 || cuotas <= 0 || !fechaInicioStr) {
    return mostrarToast("Completá todos los campos requeridos para simular", "error");
  }

  const ganancia = (monto * (interes / 100));
  const montoTotal = monto + ganancia;
  const valorCuota = montoTotal / cuotas;

  let clienteObj = window.clientes.find(c => c.id === clienteId);
  const nombreCliente = clienteObj ? clienteObj.nombre : 'Sin Cliente Seleccionado';

  const fechasCuotas = [];
  let fechaCursor = new Date(fechaInicioStr + 'T00:00:00');

  for (let i = 1; i <= cuotas; i++) {
    const isoFecha = fechaCursor.toISOString().split('T')[0];
    fechasCuotas.push({
      id: 'cuota_' + i + '_' + Date.now(),
      numero: i,
      fecha: isoFecha,
      montoCuota: valorCuota,
      montoPendiente: valorCuota,
      pagado: false
    });

    if (frecuencia === 'diario') fechaCursor.setDate(fechaCursor.getDate() + 1);
    else if (frecuencia === 'semanal') fechaCursor.setDate(fechaCursor.getDate() + 7);
    else if (frecuencia === 'mensual') fechaCursor.setMonth(fechaCursor.getMonth() + 1);
  }

  simulacionActual = {
    clienteId,
    nombreCliente,
    monto,
    interes,
    cuotas,
    frecuencia,
    montoTotal,
    ganancia,
    valorCuota,
    fechaInicio: fechaInicioStr,
    cuotasDetalle: fechasCuotas
  };

  document.getElementById('sim-total').innerText = '$' + montoTotal.toLocaleString('es-AR');
  document.getElementById('sim-ganancia').innerText = '+$' + ganancia.toLocaleString('es-AR');
  document.getElementById('sim-cuota').innerText = '$' + valorCuota.toLocaleString('es-AR');
  document.getElementById('sim-plan').innerText = `${cuotas} cuota(s) ${frecuencia}s`;

  const badgeCli = document.getElementById('badge-cliente');
  if (badgeCli) {
    badgeCli.innerText = nombreCliente;
    badgeCli.className = clienteObj ? "text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30";
  }

  const tablaFechas = document.getElementById('sim-tabla-fechas');
  if (tablaFechas) {
    tablaFechas.innerHTML = '';
    fechasCuotas.forEach(c => {
      const fPartes = c.fecha.split('-');
      tablaFechas.innerHTML += `
        <div class="flex justify-between p-2.5 px-4 items-center">
          <span>Cuota #${c.numero} (${fPartes[2]}/${fPartes[1]}/${fPartes[0]})</span>
          <strong class="text-fuchsia-400">$${valorCuota.toLocaleString('es-AR')}</strong>
        </div>
      `;
    });
  }

  const contAcciones = document.getElementById('contenedor-acciones-prestamo');
  if (contAcciones) {
    contAcciones.innerHTML = `
      <button type="button" onclick="guardarPrestamoOficial()" class="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-extrabold py-3.5 rounded-xl shadow-lg flex justify-center items-center gap-2">
        <span>✨</span> Otorgar Préstamo Oficialmente
      </button>
    `;
  }

  document.getElementById('vista-simulacion').classList.remove('hidden');
  mostrarToast("Simulación realizada con éxito");
}

function guardarPrestamoOficial() {
  if (!simulacionActual) return;

  if (!simulacionActual.clienteId) {
    return mostrarToast("Seleccioná un cliente para guardar el préstamo oficial", "error");
  }

  const prestamoDuplicado = window.prestamos.find(p => p.clienteId === simulacionActual.clienteId && p.estado !== 'finalizado');

  if (prestamoDuplicado) {
    document.getElementById('adv-cli-nombre').innerText = simulacionActual.nombreCliente;
    document.getElementById('modal-advertencia-prestamo-activo').classList.remove('hidden');
  } else {
    guardarPrestamoFirestore();
  }
}

function cancelarPrestamoDuplicado() {
  document.getElementById('modal-advertencia-prestamo-activo').classList.add('hidden');
}

function aceptarPrestamoDuplicado() {
  document.getElementById('modal-advertencia-prestamo-activo').classList.add('hidden');
  guardarPrestamoFirestore();
}

async function guardarPrestamoFirestore() {
  if (!simulacionActual || !window.usuarioActual) return;

  try {
    const dataGuardar = {
      ...simulacionActual,
      estado: 'activo',
      usuarioId: window.usuarioActual.uid,
      fechaCreacion: new Date().toISOString()
    };

    await db.collection('prestamos').add(dataGuardar);
    mostrarToast("🎉 ¡Préstamo guardado con éxito!");

    document.getElementById('form-prestamo').reset();
    document.getElementById('vista-simulacion').classList.add('hidden');
    simulacionActual = null;
    mostrarSeccion('sec-por-cobrar');
  } catch (error) {
    mostrarToast("Error al guardar el préstamo", "error");
  }
}

// ==========================================
// 4. CALENDARIO VISUAL
// ==========================================

function cambiarMesCalendarioVisual(offset) {
  fechaMesCalendarioVisual.setMonth(fechaMesCalendarioVisual.getMonth() + offset);
  renderizarGridCalendarioVisual();
}

function renderizarGridCalendarioVisual() {
  const container = document.getElementById('cal-vis-grid-dias');
  const txtTitulo = document.getElementById('cal-vis-titulo-mes');
  if (!container) return;

  container.innerHTML = '';
  const anio = fechaMesCalendarioVisual.getFullYear();
  const mes = fechaMesCalendarioVisual.getMonth();

  const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  if (txtTitulo) txtTitulo.innerText = `${mesesNombres[mes]} ${anio}`;

  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);

  let primerDiaSemana = primerDia.getDay() - 1;
  if (primerDiaSemana === -1) primerDiaSemana = 6;

  for (let i = 0; i < primerDiaSemana; i++) {
    container.innerHTML += `<div class="p-2 opacity-20"></div>`;
  }

  const hoyISO = new Date().toISOString().split('T')[0];

  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    const fechaIter = new Date(anio, mes, d);
    const isoDia = fechaIter.toISOString().split('T')[0];

    let tieneCuotas = false;
    let tieneAtraso = false;
    let tienePendiente = false;
    let todoCobrado = true;

    window.prestamos.forEach(p => {
      if (p.estado === 'finalizado') return;
      (p.cuotasDetalle || []).forEach(c => {
        if (c.fecha === isoDia) {
          tieneCuotas = true;
          if (!c.pagado) {
            todoCobrado = false;
            if (isoDia <= hoyISO) tieneAtraso = true;
            else tienePendiente = true;
          }
        }
      });
    });

    let claseBg = "bg-slate-800/40 text-slate-300 border-slate-800";
    if (tieneCuotas) {
      if (todoCobrado) claseBg = "bg-emerald-950/60 text-emerald-300 border-emerald-500/50 font-bold";
      else if (tieneAtraso) claseBg = "bg-red-950/60 text-red-300 border-red-500/50 font-bold";
      else if (tienePendiente) claseBg = "bg-amber-950/60 text-amber-300 border-amber-500/50 font-bold";
    }

    if (isoDia === hoyISO) claseBg += " ring-2 ring-fuchsia-500";

    container.innerHTML += `
      <div onclick="seleccionarDiaCalendarioVisual('${isoDia}')" class="p-2 rounded-xl border ${claseBg} cursor-pointer transition hover:scale-105 flex flex-col items-center justify-between min-h-[42px]">
        <span>${d}</span>
        ${tieneCuotas ? `<span class="w-2 h-2 rounded-full ${todoCobrado ? 'bg-emerald-400' : (tieneAtraso ? 'bg-red-400' : 'bg-amber-400')}"></span>` : ''}
      </div>
    `;
  }
}

function seleccionarDiaCalendarioVisual(isoFecha) {
  fechaSemanaSeleccionada = new Date(isoFecha + 'T00:00:00');
  renderizarPlanificadorSemanal();
  mostrarToast(`📅 Mostrando cobros para el ${isoFecha}`);
}

// ==========================================
// 5. PLANIFICADOR SEMANAL
// ==========================================

function cambiarSemanaPlanificador(offsetSemanas) {
  fechaSemanaSeleccionada.setDate(fechaSemanaSeleccionada.getDate() + (offsetSemanas * 7));
  renderizarPlanificadorSemanal();
}

function renderizarPlanificadorSemanal() {
  const contenedor = document.getElementById('grid-dias-semana');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  const inicioSemana = obtenerLunesSemana(fechaSemanaSeleccionada);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(finSemana.getDate() + 6);

  const txtRango = document.getElementById('rango-semana-actual');
  if (txtRango) {
    txtRango.innerText = `${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1} al ${finSemana.getDate()}/${finSemana.getMonth() + 1}`;
  }

  const diasNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const hoyISO = new Date().toISOString().split('T')[0];

  for (let i = 0; i < 7; i++) {
    const diaActual = new Date(inicioSemana);
    diaActual.setDate(diaActual.getDate() + i);
    const isoDia = diaActual.toISOString().split('T')[0];

    let htmlCuotasDia = '';
    let cobrosAgendadosCount = 0;

    window.prestamos.forEach(p => {
      if (p.estado === 'finalizado') return;

      const cli = window.clientes.find(c => c.id === p.clienteId);
      const nombreCliente = cli ? cli.nombre : 'Cliente Desconocido';

      const cuotasAtrasadasAnteriores = (p.cuotasDetalle || []).filter(c => !c.pagado && c.fecha < isoDia);
      let totalMontoAtrasado = 0;
      let diasMaxAtraso = 0;

      if (cuotasAtrasadasAnteriores.length > 0) {
        cuotasAtrasadasAnteriores.forEach(ca => {
          totalMontoAtrasado += parseFloat(ca.montoPendiente || ca.montoCuota || 0);
          const diffDias = Math.floor((new Date(isoDia) - new Date(ca.fecha)) / (1000 * 60 * 60 * 24));
          if (diffDias > diasMaxAtraso) diasMaxAtraso = diffDias;
        });
      }

      (p.cuotasDetalle || []).forEach(c => {
        if (c.fecha === isoDia) {
          cobrosAgendadosCount++;

          const estaPagado = c.pagado === true;
          const esPasado = isoDia < hoyISO;

          let badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 Pendiente</span>';
          if (estaPagado) {
            badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Cobrado</span>';
          } else if (esPasado) {
            badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">🔴 Atrasado</span>';
          }

          let htmlAlertaAtraso = '';
          if (!estaPagado && totalMontoAtrasado > 0) {
            htmlAlertaAtraso = `
              <div class="mt-2 p-2.5 rounded-xl bg-red-950/40 border border-red-500/50 space-y-1.5">
                <div class="flex justify-between items-center text-xs text-red-300 font-bold">
                  <span>🚨 Cobros Atrasados Anteriores:</span>
                  <span class="text-white font-black">$${totalMontoAtrasado.toLocaleString('es-AR')}</span>
                </div>
                <p class="text-[10px] text-slate-300">Demora acumulada: <strong>${diasMaxAtraso} días</strong></p>
                <button onclick="abrirModalPagoAtrasadoTotal('${p.clienteId}', ${totalMontoAtrasado}, ${diasMaxAtraso})" class="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] py-1.5 rounded-lg shadow transition">
                  💵 Cobrar Deuda con Recargo por Atraso
                </button>
              </div>
            `;
          }

          htmlCuotasDia += `
            <div class="p-3 bg-[#0F172A] border border-slate-800 rounded-xl space-y-2">
              <div class="flex justify-between items-start">
                <div>
                  <h6 class="font-extrabold text-sm text-white">${nombreCliente}</h6>
                  <p class="text-xs text-slate-400">Cuota #${c.numero} - <strong class="text-fuchsia-400">$${parseFloat(c.montoCuota).toLocaleString('es-AR')}</strong></p>
                </div>
                ${badgeEstado}
              </div>

              ${!estaPagado ? `
                <div class="flex gap-2 pt-1">
                  <button onclick="abrirModalPago('${p.id}', '${c.id}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-lg text-xs transition">
                    💵 Registrar Pago
                  </button>
                </div>
              ` : ''}

              ${htmlAlertaAtraso}
            </div>
          `;
        }
      });
    });

    if (cobrosAgendadosCount === 0) {
      htmlCuotasDia = '<p class="text-xs text-slate-500 italic p-2">Sin cobros programados para este día.</p>';
    }

    contenedor.innerHTML += `
      <div class="p-4 rounded-2xl border ${isoDia === hoyISO ? 'bg-fuchsia-950/10 border-fuchsia-500/50' : 'bg-[#1E293B]/40 border-slate-800'} space-y-3">
        <div class="flex justify-between items-center border-b border-slate-800 pb-2">
          <h5 class="font-bold text-sm text-slate-200 flex items-center gap-2">
            <span>📅</span> ${diasNombres[i]} <span class="text-xs text-slate-400 font-normal">(${diaActual.getDate()}/${diaActual.getMonth() + 1})</span>
          </h5>
          ${isoDia === hoyISO ? '<span class="text-[10px] bg-fuchsia-500/20 text-fuchsia-300 font-extrabold px-2 py-0.5 rounded-full border border-fuchsia-500/40">HOY</span>' : ''}
        </div>
        <div class="space-y-2">
          ${htmlCuotasDia}
        </div>
      </div>
    `;
  }
}

function obtenerLunesSemana(fecha) {
  const d = new Date(fecha);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// ==========================================
// 6. RESUMEN Y ESTADO DE CUENTAS
// ==========================================

function renderizarResumenYPrestamos() {
  const elemCap = document.getElementById('resumen-capital');
  const elemGan = document.getElementById('resumen-ganancia');
  const bodyTabla = document.getElementById('tabla-prestamos-body');
  if (!bodyTabla) return;

  let totalCapital = 0;
  let totalGanancia = 0;

  const activos = window.prestamos.filter(p => p.estado !== 'finalizado');
  activos.forEach(p => {
    totalCapital += parseFloat(p.monto || 0);
    totalGanancia += parseFloat(p.ganancia || 0);
  });

  if (elemCap) elemCap.innerText = '$' + totalCapital.toLocaleString('es-AR');
  if (elemGan) elemGan.innerText = '+$' + totalGanancia.toLocaleString('es-AR');

  bodyTabla.innerHTML = '';
  if (activos.length === 0) {
    bodyTabla.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No hay préstamos activos.</td></tr>';
    return;
  }

  activos.forEach(p => {
    const cli = window.clientes.find(c => c.id === p.clienteId);
    bodyTabla.innerHTML += `
      <tr class="border-b border-slate-800/60 hover:bg-slate-800/30">
        <td class="p-3 font-bold text-white">${cli ? cli.nombre : 'Cliente'}</td>
        <td class="p-3 text-slate-300">${p.fechaInicio}</td>
        <td class="p-3 font-bold text-slate-200">$${parseFloat(p.monto).toLocaleString('es-AR')}</td>
        <td class="p-3 font-extrabold text-fuchsia-400">$${parseFloat(p.montoTotal).toLocaleString('es-AR')}</td>
        <td class="p-3 text-slate-400">${p.cuotas} (${p.frecuencia})</td>
        <td class="p-3 flex gap-2">
          <button onclick="verDetallePrestamoActivo('${p.id}')" class="px-2 py-1 text-xs bg-slate-800 text-fuchsia-400 rounded-lg border border-slate-700 font-bold">📊 Detalle</button>
          <button onclick="solicitarFinalizarPrestamo('${p.id}')" class="px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30 font-bold">🏁 Finalizar</button>
          <button onclick="solicitarEliminarPrestamo('${p.id}')" class="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 font-bold">🗑️</button>
        </td>
      </tr>
    `;
  });
}

function renderizarEstadoCuentas() {
  const container = document.getElementById('lista-cobros-dia');
  const badgeAlertas = document.getElementById('badge-alertas-panel');
  const badgeMenu = document.getElementById('badge-alertas-menu');
  if (!container) return;

  container.innerHTML = '';
  const hoyISO = new Date().toISOString().split('T')[0];
  let atrasosTotales = 0;

  window.prestamos.forEach(p => {
    if (p.estado === 'finalizado') return;

    const cli = window.clientes.find(c => c.id === p.clienteId);
    const cuotasAtrasadas = (p.cuotasDetalle || []).filter(c => !c.pagado && c.fecha < hoyISO);

    if (cuotasAtrasadas.length > 0) {
      atrasosTotales += cuotasAtrasadas.length;
      let montoBaseAtraso = 0;
      cuotasAtrasadas.forEach(ca => montoBaseAtraso += parseFloat(ca.montoPendiente || ca.montoCuota || 0));

      container.innerHTML += `
        <div class="p-4 rounded-2xl bg-red-950/20 border border-red-500/40 space-y-2">
          <div class="flex justify-between items-center">
            <h5 class="font-bold text-white text-base">${cli ? cli.nombre : 'Cliente'}</h5>
            <span class="text-xs bg-red-500/20 text-red-400 border border-red-500/40 px-2.5 py-1 rounded-full font-bold">🚨 ${cuotasAtrasadas.length} Cuota(s) Atrasada(s)</span>
          </div>
          <p class="text-xs text-slate-300">Deuda vencida acumulada: <strong class="text-red-400">$${montoBaseAtraso.toLocaleString('es-AR')}</strong></p>
          <button onclick="abrirModalPagoAtrasadoTotal('${p.clienteId}', ${montoBaseAtraso}, 5)" class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-xs transition">
            💵 Regularizar Deuda con Recargo
          </button>
        </div>
      `;
    }
  });

  if (atrasosTotales === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic p-2">¡Felicitaciones! No tenés cobros ni cuotas atrasadas registradas.</p>';
  }

  if (badgeAlertas) badgeAlertas.innerText = `${atrasosTotales} Atrasos`;
  if (badgeMenu) badgeMenu.innerText = atrasosTotales;
}

// ==========================================
// 7. PAGO ATRASADO AGRUPADO Y RECARGOS
// ==========================================

function abrirModalPagoAtrasadoTotal(clienteId, montoBase, diasAtraso) {
  const cli = window.clientes.find(c => c.id === clienteId);
  if (!cli) return;

  document.getElementById('pago-atrasado-cliente-id').value = clienteId;
  document.getElementById('pago-atrasado-cli-nombre').innerText = cli.nombre;
  document.getElementById('pago-atrasado-monto-base').innerText = '$' + montoBase.toLocaleString('es-AR');
  document.getElementById('pago-atrasado-tiempo-txt').innerText = diasAtraso + ' días';

  const recargoPct = (window.datosUsuarioActual?.configIntereses?.retrasoDiario || 2) * diasAtraso;
  const montoRecargo = Math.round(montoBase * (recargoPct / 100));
  const totalConRecargo = montoBase + montoRecargo;

  document.getElementById('pago-atrasado-monto-recargo').innerText = montoRecargo.toLocaleString('es-AR');
  document.getElementById('pago-atrasado-monto-total').innerText = '$' + totalConRecargo.toLocaleString('es-AR');
  document.getElementById('pago-atrasado-monto-ingresado').value = totalConRecargo;

  convertirMontoPagoAtrasadoEnLetras(totalConRecargo);
  document.getElementById('modal-pago-atrasado-agrupado').classList.remove('hidden');
}

function cerrarModalPagoAtrasadoTotal() {
  document.getElementById('modal-pago-atrasado-agrupado').classList.add('hidden');
}

function convertirMontoPagoAtrasadoEnLetras(val) {
  const elem = document.getElementById('pago-atrasado-monto-en-letras');
  if (elem) elem.innerText = numeroALetras(parseFloat(val) || 0);
}

async function confirmarPagoAtrasadoAgrupado(event) {
  event.preventDefault();
  const clienteId = document.getElementById('pago-atrasado-cliente-id').value;
  const montoPagado = parseFloat(document.getElementById('pago-atrasado-monto-ingresado').value) || 0;

  if (montoPagado <= 0) return mostrarToast("Ingresá un monto válido", "error");

  try {
    const prestamosCliente = window.prestamos.filter(p => p.clienteId === clienteId && p.estado !== 'finalizado');
    
    for (let p of prestamosCliente) {
      let saldoIngresado = montoPagado;
      let cuotasActualizadas = p.cuotasDetalle.map(c => {
        if (!c.pagado && saldoIngresado > 0) {
          const pendiente = c.montoPendiente || c.montoCuota;
          if (saldoIngresado >= pendiente) {
            saldoIngresado -= pendiente;
            return { ...c, pagado: true, montoPendiente: 0 };
          } else {
            const nuevoPendiente = pendiente - saldoIngresado;
            saldoIngresado = 0;
            return { ...c, montoPendiente: nuevoPendiente };
          }
        }
        return c;
      });

      await db.collection('prestamos').doc(p.id).update({ cuotasDetalle: cuotasActualizadas });
    }

    mostrarToast("💵 Deuda regularizada correctamente");
    cerrarModalPagoAtrasadoTotal();
  } catch (error) {
    mostrarToast("Error al registrar pago", "error");
  }
}

// ==========================================
// 8. PAGO CUOTA INDIVIDUAL Y COMPROBANTES
// ==========================================

function abrirModalPago(prestamoId, cuotaId) {
  const p = window.prestamos.find(pr => pr.id === prestamoId);
  if (!p) return;

  const cuota = p.cuotasDetalle.find(c => c.id === cuotaId);
  if (!cuota) return;

  const cli = window.clientes.find(c => c.id === p.clienteId);

  document.getElementById('pago-prestamo-id').value = prestamoId;
  document.getElementById('pago-cuota-id').value = cuotaId;
  document.getElementById('pago-cli-nombre').innerText = cli ? cli.nombre : 'Cliente';
  document.getElementById('pago-cuota-num').innerText = cuota.numero;
  document.getElementById('pago-cuota-base').innerText = '$' + parseFloat(cuota.montoCuota).toLocaleString('es-AR');
  document.getElementById('pago-monto-ingresado').value = cuota.montoPendiente || cuota.montoCuota;

  convertirMontoPagoEnLetras(cuota.montoPendiente || cuota.montoCuota);
  document.getElementById('modal-pago-cuota').classList.remove('hidden');
}

function cerrarModalPago() {
  document.getElementById('modal-pago-cuota').classList.add('hidden');
}

function convertirMontoPagoEnLetras(val) {
  const elem = document.getElementById('pago-monto-en-letras');
  if (elem) elem.innerText = numeroALetras(parseFloat(val) || 0);
}

async function confirmarRegistroPago(event) {
  event.preventDefault();
  const prestamoId = document.getElementById('pago-prestamo-id').value;
  const cuotaId = document.getElementById('pago-cuota-id').value;
  const montoIngresado = parseFloat(document.getElementById('pago-monto-ingresado').value) || 0;

  const p = window.prestamos.find(pr => pr.id === prestamoId);
  if (!p) return;

  try {
    const nuevasCuotas = p.cuotasDetalle.map(c => {
      if (c.id === cuotaId) {
        return { ...c, pagado: true, montoPendiente: 0 };
      }
      return c;
    });

    await db.collection('prestamos').doc(prestamoId).update({ cuotasDetalle: nuevasCuotas });

    mostrarToast("✅ Pago de cuota registrado");
    cerrarModalPago();

    const cli = window.clientes.find(c => c.id === p.clienteId);
    abrirModalComprobante(cli ? cli.nombre : 'Cliente', montoIngresado, new Date().toLocaleString(), 'Pago de Cuota', 0);
  } catch (error) {
    mostrarToast("Error al registrar pago", "error");
  }
}

function abrirModalComprobante(clienteNombre, monto, fecha, concepto, saldo) {
  document.getElementById('recibo-card-cliente').innerText = clienteNombre;
  document.getElementById('recibo-card-monto').innerText = '$' + monto.toLocaleString('es-AR');
  document.getElementById('recibo-card-fecha').innerText = fecha;
  document.getElementById('recibo-card-concepto').innerText = concepto;
  document.getElementById('recibo-card-saldo').innerText = '$' + saldo.toLocaleString('es-AR');

  document.getElementById('modal-comprobante-whatsapp').classList.remove('hidden');
}

function cerrarModalComprobante() {
  document.getElementById('modal-comprobante-whatsapp').classList.add('hidden');
}

function compartirComprobanteImagen() {
  const card = document.getElementById('ticket-recibo-card');
  if (!card) return;

  html2canvas(card).then(canvas => {
    canvas.toBlob(blob => {
      const file = new File([blob], 'comprobante.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          title: 'Comprobante de Pago',
          text: 'Comprobante Oficial de Pago - CobroApp',
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comprobante-pago.png';
        a.click();
        mostrarToast("📸 Comprobante descargado en tu dispositivo");
      }
    });
  });
}

// ==========================================
// 9. SUSCRIPCIÓN Y CLAVES
// ==========================================

async function cambiarMiContrasena(event) {
  event.preventDefault();
  const pass1 = document.getElementById('cli-nueva-pass').value;
  const pass2 = document.getElementById('cli-confirm-pass').value;

  if (pass1 !== pass2) return mostrarToast("Las contraseñas no coinciden", "error");

  try {
    await window.usuarioActual.updatePassword(pass1);
    await db.collection('usuarios').doc(window.usuarioActual.uid).update({ passwordVisual: pass1 });
    mostrarToast("🔑 Contraseña actualizada correctamente");
    document.getElementById('cli-nueva-pass').value = '';
    document.getElementById('cli-confirm-pass').value = '';
  } catch (error) {
    mostrarToast("Error al cambiar contraseña", "error");
  }
}

function pagarSuscripcionMercadoPago() {
  if (!window.configSuscripcion || !window.configSuscripcion.link) {
    return mostrarToast("Link de Mercado Pago no disponible.", "error");
  }
  let link = window.configSuscripcion.link.trim();
  if (!link.startsWith('http')) link = 'https://' + link;
  window.open(link, '_blank');
}

function enviarComprobanteAlquilerWhatsApp() {
  if (!window.configSuscripcion || !window.configSuscripcion.whatsapp) {
    return mostrarToast("Número de WhatsApp no configurado.", "error");
  }
  const numWsp = window.configSuscripcion.whatsapp.replace(/[^0-9]/g, '');
  const mensaje = encodeURIComponent(`Hola! Aboné la suscripción mensual de CobroApp (${window.usuarioActual.email}). Adjunto comprobante.`);
  window.open(`https://wa.me/${numWsp}?text=${mensaje}`, '_blank');
}
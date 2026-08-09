// LÓGICA DE NEGOCIO DEL PRESTAMISTA: SIMULADOR, COBROS, DEUDORES Y PLANIFICADOR

let clientes = [];
let prestamos = [];
let configSuscripcion = { monto: 0, link: '' };

let configIntereses = JSON.parse(localStorage.getItem('cobro_cfg_int')) || { diario: 5, semanal: 15, mensual: 30 };
let configInteresesRetraso = JSON.parse(localStorage.getItem('cobro_cfg_int_retraso')) || { diario: 1, semanal: 3, mensual: 10 };

let pestanaResumenActual = 'activos';
let fechaPlanificadorSeleccionADA = new Date();
let idPrestamoAEliminar = null;
let idPrestamoAFinalizar = null;
let datosPrestamoSimuladoPendiente = null;
let datosPrestamoSimulado = null;

let datosRecargoModalCuota = { base: 0, montoRecargo: 0, saldoTotalPrestamo: 0, maxPermitido: 0 };
let datosRecargoModalAgrupado = { base: 0, montoRecargo: 0, diasAtraso: 0, maxPermitido: 0 };

let mesCalVisual = new Date().getMonth();
let anioCalVisual = new Date().getFullYear();

function cargarCamposConfigIntereses() {
  document.getElementById('cfg-int-diario').value = configIntereses.diario;
  document.getElementById('cfg-int-semanal').value = configIntereses.semanal;
  document.getElementById('cfg-int-mensual').value = configIntereses.mensual;

  document.getElementById('cfg-retraso-diario').value = configInteresesRetraso.diario;
  document.getElementById('cfg-retraso-semanal').value = configInteresesRetraso.semanal;
  document.getElementById('cfg-retraso-mensual').value = configInteresesRetraso.mensual;
}

function guardarInteresesConfig(event) {
  event.preventDefault();
  configIntereses = {
    diario: parseFloat(document.getElementById('cfg-int-diario').value) || 0,
    semanal: parseFloat(document.getElementById('cfg-int-semanal').value) || 0,
    mensual: parseFloat(document.getElementById('cfg-int-mensual').value) || 0
  };
  configInteresesRetraso = {
    diario: parseFloat(document.getElementById('cfg-retraso-diario').value) || 0,
    semanal: parseFloat(document.getElementById('cfg-retraso-semanal').value) || 0,
    mensual: parseFloat(document.getElementById('cfg-retraso-mensual').value) || 0
  };
  
  localStorage.setItem('cobro_cfg_int', JSON.stringify(configIntereses));
  localStorage.setItem('cobro_cfg_int_retraso', JSON.stringify(configInteresesRetraso));
  alCambiarFrecuencia();
  mostrarToast("Todos los ajustes de interés guardados correctamente");
}

function alCambiarFrecuencia() {
  const freq = document.getElementById('frecuencia-prestamo').value;
  if (configIntereses[freq] !== undefined) {
    document.getElementById('interes-prestamo').value = configIntereses[freq];
  }
}

function calcularRecargoDeCuota(cuota, frecuencia = 'mensual') {
  const hoyISO = new Date().toISOString().split('T')[0];
  if (cuota.pagado || cuota.fechaISO >= hoyISO) return { diasAtraso: 0, montoRecargo: 0 };

  const fVenc = new Date(cuota.fechaISO + 'T00:00:00');
  const fHoy = new Date(hoyISO + 'T00:00:00');
  const diffMs = fHoy.getTime() - fVenc.getTime();
  const diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diasAtraso <= 0) return { diasAtraso: 0, montoRecargo: 0 };

  const debia = cuota.monto - (cuota.montoPagado || 0);

  let tasaDiaria = configInteresesRetraso.diario;
  if (frecuencia === 'semanal') tasaDiaria = configInteresesRetraso.semanal / 7;
  if (frecuencia === 'mensual') tasaDiaria = configInteresesRetraso.mensual / 30;

  const pctRecargoAcumulado = tasaDiaria * diasAtraso;
  const montoRecargo = Math.round(debia * (pctRecargoAcumulado / 100));

  return { diasAtraso, montoRecargo };
}

function calcularSaldoPendienteTotalCliente(clienteId) {
  let saldo = 0;
  prestamos.forEach(p => {
    if (p.clienteId === clienteId && p.estado !== 'finalizado' && p.calendario) {
      p.calendario.forEach(cq => {
        if (!cq.pagado) saldo += (cq.monto - (cq.montoPagado || 0));
      });
    }
  });
  return saldo;
}

function renderizarClientesSelect() {
  const datalist = document.getElementById('lista-clientes-datalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  clientes.forEach(c => { datalist.innerHTML += `<option value="${c.nombre} (${c.dir})"></option>`; });
}

function renderizarDirectorioClientes() {
  const grid = document.getElementById('grid-clientes-directorio');
  if (!grid) return;
  grid.innerHTML = '';
  clientes.forEach(c => {
    grid.innerHTML += `
      <div class="bg-[#1E293B]/40 border border-slate-700/60 p-4 rounded-xl space-y-2 relative">
        <div class="flex justify-between items-start">
          <h4 class="font-bold text-base text-white">${c.nombre}</h4>
          <div class="flex gap-1">
            <button onclick="abrirModalEditarCliente('${c.id}')" class="p-1 text-xs text-blue-400 hover:text-blue-300">✏️</button>
            <button onclick="eliminarCliente('${c.id}')" class="p-1 text-xs text-red-400 hover:text-red-300">🗑️</button>
          </div>
        </div>
        <p class="text-xs">📞 <strong>Personal:</strong> ${c.tel}</p>
        <p class="text-xs">🚨 <strong>Emergencia:</strong> ${c.emer || 'No asignado'}</p>
        <p class="text-xs">📍 <strong>Dirección:</strong> ${c.dir}</p>
        <p class="text-xs text-fuchsia-400">📸 <strong>Notas:</strong> ${c.redes || 'Sin notas'}</p>
      </div>
    `;
  });
}

function abrirModalNuevoCliente() {
  document.getElementById('cli-edit-id').value = '';
  document.getElementById('modal-cliente-titulo').innerText = '👤 Registrar Nuevo Cliente / Deudor';
  document.getElementById('cli-nombre').value = '';
  document.getElementById('cli-tel').value = '';
  document.getElementById('cli-emergencia').value = '';
  document.getElementById('cli-direccion').value = '';
  document.getElementById('cli-redes').value = '';
  document.getElementById('modal-nuevo-cliente').classList.remove('hidden');
}

function abrirModalEditarCliente(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cli-edit-id').value = c.id;
  document.getElementById('modal-cliente-titulo').innerText = '✏️ Editar Cliente';
  document.getElementById('cli-nombre').value = c.nombre;
  document.getElementById('cli-tel').value = c.tel;
  document.getElementById('cli-emergencia').value = c.emer || '';
  document.getElementById('cli-direccion').value = c.dir;
  document.getElementById('cli-redes').value = c.redes || '';
  document.getElementById('modal-nuevo-cliente').classList.remove('hidden');
}

function cerrarModalCliente() { document.getElementById('modal-nuevo-cliente').classList.add('hidden'); }

async function guardarYVincularCliente(event) {
  event.preventDefault();
  const editId = document.getElementById('cli-edit-id').value;
  const tel = document.getElementById('cli-tel').value.trim();
  const emer = document.getElementById('cli-emergencia').value.trim();

  if (!/^\d{10}$/.test(tel) || !/^\d{10}$/.test(emer)) {
    mostrarToast("Los celulares deben tener exactamente 10 números", "error");
    return;
  }

  const datosCliente = {
    usuarioId: usuarioActual ? usuarioActual.uid : 'sin_usuario',
    nombre: document.getElementById('cli-nombre').value,
    tel: tel,
    emer: emer,
    dir: document.getElementById('cli-direccion').value,
    redes: document.getElementById('cli-redes').value
  };

  if (editId) {
    if (db) await db.collection('clientes').doc(editId).update(datosCliente);
    mostrarToast("Cliente actualizado correctamente");
  } else {
    if (db) await db.collection('clientes').add(datosCliente);
    mostrarToast("Cliente registrado e ingresado al directorio");
  }

  cerrarModalCliente();
}

async function eliminarCliente(id) {
  if (confirm("¿Estás seguro de que querés eliminar a este cliente?")) {
    if (db) await db.collection('clientes').doc(id).delete();
    mostrarToast("Cliente eliminado del sistema");
  }
}

function generarSimulacion(event) {
  event.preventDefault();
  const clienteInputVal = document.getElementById('input-cliente').value.trim();
  const clienteObj = clientes.find(c => `${c.nombre} (${c.dir})` === clienteInputVal || c.nombre.toLowerCase() === clienteInputVal.toLowerCase());
  
  const clienteId = clienteObj ? clienteObj.id : null;
  const clienteNombre = clienteObj ? `${clienteObj.nombre} (${clienteObj.dir})` : clienteInputVal;
  
  const monto = parseFloat(document.getElementById('monto-prestamo').value);
  const interesPct = parseFloat(document.getElementById('interes-prestamo').value);
  const numCuotas = parseInt(document.getElementById('cuotas-prestamo').value);
  const frecuencia = document.getElementById('frecuencia-prestamo').value;
  const fechaInicioStr = document.getElementById('fecha-inicio').value;

  const ganancia = monto * (interesPct / 100);
  const totalADevolver = monto + ganancia;
  const valorCuota = totalADevolver / numCuotas;

  const calendario = [];
  let fechaActual = new Date(fechaInicioStr + 'T00:00:00');

  for (let i = 1; i <= numCuotas; i++) {
    calendario.push({
      idCuota: 'cuota_' + i,
      numero: i,
      monto: valorCuota,
      montoPagado: 0,
      fechaISO: fechaActual.toISOString().split('T')[0],
      fechaTexto: fechaActual.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      pagado: false
    });

    if (frecuencia === 'diario') fechaActual.setDate(fechaActual.getDate() + 1);
    if (frecuencia === 'semanal') fechaActual.setDate(fechaActual.getDate() + 7);
    if (frecuencia === 'mensual') fechaActual.setMonth(fechaActual.getMonth() + 1);
  }

  const datosCalculados = {
    usuarioId: usuarioActual ? usuarioActual.uid : 'sin_usuario',
    clienteId, clienteNombre, monto, ganancia, totalADevolver, valorCuota, numCuotas, frecuencia, calendario,
    fechaInicio: fechaInicioStr, estado: 'activo', fechaCreacion: new Date().toISOString()
  };

  const tieneCuentaActiva = clienteId && prestamos.some(p => p.clienteId === clienteId && p.estado !== 'finalizado');

  if (tieneCuentaActiva) {
    datosPrestamoSimuladoPendiente = datosCalculados;
    document.getElementById('adv-cli-nombre').innerText = clienteNombre;
    document.getElementById('modal-advertencia-prestamo-activo').classList.remove('hidden');
  } else {
    datosPrestamoSimulado = datosCalculados;
    renderizarSimulacion();
  }
}

function aceptarPrestamoDuplicado() {
  datosPrestamoSimulado = datosPrestamoSimuladoPendiente;
  datosPrestamoSimuladoPendiente = null;
  document.getElementById('modal-advertencia-prestamo-activo').classList.add('hidden');
  renderizarSimulacion();
}

function cancelarPrestamoDuplicado() {
  datosPrestamoSimuladoPendiente = null;
  document.getElementById('modal-advertencia-prestamo-activo').classList.add('hidden');
  document.getElementById('vista-simulacion').classList.add('hidden');
}

function renderizarSimulacion() {
  if (!datosPrestamoSimulado) return;

  document.getElementById('sim-total').innerText = '$' + datosPrestamoSimulado.totalADevolver.toLocaleString('es-AR');
  document.getElementById('sim-ganancia').innerText = '+$' + datosPrestamoSimulado.ganancia.toLocaleString('es-AR');
  document.getElementById('sim-cuota').innerText = '$' + datosPrestamoSimulado.valorCuota.toLocaleString('es-AR');
  
  let textoFrec = datosPrestamoSimulado.frecuencia + 'es';
  document.getElementById('sim-plan').innerText = `${datosPrestamoSimulado.numCuotas} cuotas ${textoFrec}`;

  const badge = document.getElementById('badge-cliente');
  const contenedorAcciones = document.getElementById('contenedor-acciones-prestamo');

  if (datosPrestamoSimulado.clienteId) {
    badge.className = "text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    badge.innerText = "✓ Cliente: " + datosPrestamoSimulado.clienteNombre.split('(')[0];

    contenedorAcciones.innerHTML = `
      <button onclick="confirmarPrestamo()" class="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-extrabold py-3.5 rounded-xl shadow-lg">
        ✅ Confirmar y Otorgar Préstamo
      </button>
    `;
  } else {
    badge.className = "text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30";
    badge.innerText = "⚠️ Cliente No Registrado";

    contenedorAcciones.innerHTML = `
      <button onclick="abrirModalNuevoCliente()" class="w-full bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-300 font-bold py-3 rounded-xl border border-fuchsia-500/40">
        👤 Registrar Este Cliente para Otorgar
      </button>
    `;
  }

  const tabla = document.getElementById('sim-tabla-fechas');
  tabla.innerHTML = '';
  datosPrestamoSimulado.calendario.forEach(c => {
    tabla.innerHTML += `<div class="p-3 flex justify-between items-center"><span>Cuota ${c.numero} (${c.fechaTexto})</span><span class="font-bold">$${c.monto.toLocaleString('es-AR')}</span></div>`;
  });

  document.getElementById('vista-simulacion').classList.remove('hidden');
}

async function confirmarPrestamo() {
  if (!datosPrestamoSimulado || !datosPrestamoSimulado.clienteId) return;
  if (db) await db.collection('prestamos').add(datosPrestamoSimulado);

  mostrarToast(`Préstamo de $${datosPrestamoSimulado.monto.toLocaleString('es-AR')} registrado con éxito`);
  document.getElementById('form-prestamo').reset();
  document.getElementById('input-cliente').value = '';
  document.getElementById('monto-en-letras').innerText = '';
  document.getElementById('vista-simulacion').classList.add('hidden');
  
  document.getElementById('frecuencia-prestamo').value = 'mensual';
  alCambiarFrecuencia();

  datosPrestamoSimulado = null;
}

function cambiarMesCalendarioVisual(delta) {
  mesCalVisual += delta;
  if (mesCalVisual > 11) { mesCalVisual = 0; anioCalVisual++; }
  else if (mesCalVisual < 0) { mesCalVisual = 11; anioCalVisual--; }
  renderizarGridCalendarioVisual();
}

function renderizarGridCalendarioVisual() {
  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const elemTitulo = document.getElementById('cal-vis-titulo-mes');
  if (elemTitulo) elemTitulo.innerText = `${nombresMeses[mesCalVisual]} ${anioCalVisual}`;

  const grid = document.getElementById('cal-vis-grid-dias');
  if (!grid) return;
  grid.innerHTML = '';

  const primerDiaMes = new Date(anioCalVisual, mesCalVisual, 1);
  const ultimoDiaMes = new Date(anioCalVisual, mesCalVisual + 1, 0);
  
  let diaInicioSemana = primerDiaMes.getDay(); 
  diaInicioSemana = (diaInicioSemana === 0) ? 6 : diaInicioSemana - 1; 

  const hoyISO = new Date().toISOString().split('T')[0];

  for (let e = 0; e < diaInicioSemana; e++) { grid.innerHTML += `<div></div>`; }

  for (let d = 1; d <= ultimoDiaMes.getDate(); d++) {
    const fechaDiaObj = new Date(anioCalVisual, mesCalVisual, d);
    const isoDia = fechaDiaObj.toISOString().split('T')[0];

    let cobrosDia = [];
    prestamos.forEach(p => {
      if (p.estado !== 'finalizado' && p.calendario) {
        p.calendario.forEach(c => { if (c.fechaISO === isoDia) cobrosDia.push(c); });
      }
    });

    let claseEstiloDia = "bg-slate-800/40 text-slate-400 border border-slate-700/40 hover:bg-slate-700/60";

    if (cobrosDia.length > 0) {
      const todosSaldados = cobrosDia.every(x => x.pagado);
      const tieneVencidos = cobrosDia.some(x => !x.pagado && x.fechaISO < hoyISO);

      if (todosSaldados) claseEstiloDia = "bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500 font-bold hover:bg-emerald-500/40";
      else if (tieneVencidos) claseEstiloDia = "bg-red-500/20 text-red-300 border-2 border-red-500 font-bold hover:bg-red-500/40 animate-pulse";
      else claseEstiloDia = "bg-amber-500/20 text-amber-300 border-2 border-amber-400 font-bold hover:bg-amber-500/40";
    }

    grid.innerHTML += `
      <button onclick="seleccionarDiaDesdeCalendarioVisual('${isoDia}')" class="p-3 rounded-xl transition cursor-pointer flex flex-col items-center justify-center ${claseEstiloDia}">
        <span class="text-sm">${d}</span>
      </button>
    `;
  }
}

function seleccionarDiaDesdeCalendarioVisual(isoDiaStr) {
  fechaPlanificadorSeleccionADA = new Date(isoDiaStr + 'T00:00:00');
  renderizarPlanificadorSemanal();
  mostrarToast(`Semana seleccionada para el ${isoDiaStr}`);
}

function renderizarPlanificadorSemanal() {
  const container = document.getElementById('grid-dias-semana');
  if (!container) return;
  container.innerHTML = '';

  const hoy = new Date();
  const hoyISO = hoy.toISOString().split('T')[0];

  const tempHoy = new Date();
  const diaSemanaHoy = tempHoy.getDay(); 
  const diffLunesHoy = tempHoy.getDate() - (diaSemanaHoy === 0 ? 6 : diaSemanaHoy - 1);
  const lunesHoyISO = new Date(tempHoy.setDate(diffLunesHoy)).toISOString().split('T')[0];

  const refFecha = new Date(fechaPlanificadorSeleccionADA);
  const diaSemana = refFecha.getDay(); 
  const diffLunes = refFecha.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1);
  
  const lunesActual = new Date(refFecha.setDate(diffLunes));
  const lunesISO = lunesActual.toISOString().split('T')[0];

  const domingoActual = new Date(lunesActual);
  domingoActual.setDate(domingoActual.getDate() + 6);

  const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const badgeRango = document.getElementById('rango-semana-actual');
  const rangoTexto = `${lunesActual.getDate()}/${lunesActual.getMonth()+1} al ${domingoActual.getDate()}/${domingoActual.getMonth()+1}`;

  if (badgeRango) {
    if (lunesISO === lunesHoyISO) {
      badgeRango.className = "text-xs font-bold px-3 py-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/40";
      badgeRango.innerText = `Semana Actual (${rangoTexto})`;
    } else {
      badgeRango.className = "text-xs font-bold px-3 py-2 bg-slate-800 text-slate-300 rounded-xl border border-slate-700";
      badgeRango.innerText = `Semana (${rangoTexto})`;
    }
  }

  let mapaAtrasadosPorCliente = {};

  prestamos.forEach(p => {
    if (p.estado !== 'finalizado' && p.calendario) {
      p.calendario.forEach(c => {
        if (!c.pagado && c.fechaISO < lunesHoyISO) {
          if (!mapaAtrasadosPorCliente[p.clienteId]) {
            mapaAtrasadosPorCliente[p.clienteId] = { clienteId: p.clienteId, clienteNombre: p.clienteNombre, prestamoId: p.id, frecuencia: p.frecuencia, cuotas: [] };
          }
          mapaAtrasadosPorCliente[p.clienteId].cuotas.push({ ...c, prestamoId: p.id });
        }
      });
    }
  });

  const listaClientesAtrasados = Object.values(mapaAtrasadosPorCliente);

  if (listaClientesAtrasados.length > 0) {
    let HTMLAtrasadosGroup = '';

    listaClientesAtrasados.forEach(item => {
      let totalDeudaBase = 0;
      let totalRecargo = 0;

      item.cuotas.forEach(cq => {
        totalDeudaBase += (cq.monto - (cq.montoPagado || 0));
        const r = calcularRecargoDeCuota(cq, item.frecuencia);
        totalRecargo += r.montoRecargo;
      });

      HTMLAtrasadosGroup += `
        <div class="p-3.5 rounded-xl border border-red-500/50 bg-red-950/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <button onclick="verFichaCliente('${item.clienteId}')" class="font-bold text-white hover:text-red-300 text-sm flex items-center gap-1.5 underline">
                <span>👤</span> ${item.clienteNombre ? item.clienteNombre.split('(')[0] : 'Cliente'}
              </button>
              <button onclick="abrirModalAtrasadosCliente('${item.clienteId}')" class="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-bold">
                ⚠️ ${item.cuotas.length} Cuota(s) Atrasada(s)
              </button>
            </div>
            <p class="text-xs text-slate-300">Base Vencida: <strong class="text-slate-200">$${totalDeudaBase.toLocaleString('es-AR')}</strong> | Recargo: <strong class="text-red-400">+$${totalRecargo.toLocaleString('es-AR')}</strong></p>
          </div>

          <button onclick="abrirModalPagoAtrasadoTotal('${item.clienteId}')" class="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow">
            <span>💵</span> Pagar Deuda
          </button>
        </div>
      `;
    });

    container.innerHTML += `
      <div class="bg-red-950/20 border-2 border-red-500/40 p-4 rounded-2xl space-y-3 shadow-lg mb-2">
        <span class="text-sm font-black text-red-400 uppercase tracking-wider flex items-center gap-2">
          <span>🚨</span> Cobros Atrasados de Semanas Anteriores (${listaClientesAtrasados.length} Clientes)
        </span>
        <div class="space-y-2">${HTMLAtrasadosGroup}</div>
      </div>
    `;
  }

  for (let i = 0; i < 7; i++) {
    const diaFecha = new Date(lunesActual);
    diaFecha.setDate(lunesActual.getDate() + i);
    const fechaIsoDia = diaFecha.toISOString().split('T')[0];

    let cobrosDelDia = [];
    prestamos.forEach(p => {
      if (p.estado !== 'finalizado' && p.calendario) {
        p.calendario.forEach(c => {
          if (c.fechaISO === fechaIsoDia) cobrosDelDia.push({ prestamoId: p.id, clienteId: p.clienteId, cliente: p.clienteNombre, cuota: c, frecuencia: p.frecuencia });
        });
      }
    });

    let HTMLCobros = (cobrosDelDia.length === 0) ? `<p class="text-xs text-slate-500 italic py-1">No hay cobros agendados para este día.</p>` : '';

    cobrosDelDia.forEach(item => {
      const esPagado = item.cuota.pagado;
      const esVencido = !esPagado && (item.cuota.fechaISO < hoyISO);
      const restoPendiente = item.cuota.monto - (item.cuota.montoPagado || 0);

      HTMLCobros += `
        <div class="p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${esPagado ? 'bg-emerald-500/10 border-emerald-500/30' : (esVencido ? 'bg-red-950/30 border-red-500/50' : 'bg-slate-800/80 border-slate-700')}">
          <div>
            <button onclick="verFichaCliente('${item.clienteId}')" class="font-bold text-white text-sm underline">👤 ${item.cliente ? item.cliente.split('(')[0] : 'Cliente'}</button>
            <p class="text-xs text-slate-400">Cuota ${item.cuota.numero}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-black text-base ${esPagado ? 'text-emerald-400' : 'text-fuchsia-400'}">$${restoPendiente.toLocaleString('es-AR')}</span>
            ${esPagado ? `<span class="text-xs font-bold text-emerald-400">✓ Pagado</span>` : `<button onclick="abrirModalPagoCuota('${item.prestamoId}', '${item.cuota.idCuota}')" class="bg-emerald-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl">Cobrar</button>`}
          </div>
        </div>
      `;
    });

    container.innerHTML += `
      <div class="bg-[#1E293B]/40 border border-slate-700/60 p-4 rounded-2xl space-y-3">
        <div class="flex justify-between items-center border-b border-slate-800/80 pb-2">
          <span class="text-sm font-black text-fuchsia-400 uppercase">${nombresDias[i]}</span>
          <span class="text-xs text-slate-400">${diaFecha.getDate()}/${diaFecha.getMonth()+1}/${diaFecha.getFullYear()}</span>
        </div>
        <div class="space-y-2">${HTMLCobros}</div>
      </div>
    `;
  }
}

function verFichaCliente(clienteId) {
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return mostrarToast("No se encontraron los datos", "error");
  
  document.getElementById('info-cli-nombre').innerText = c.nombre;
  document.getElementById('info-cli-tel').innerText = c.tel;
  document.getElementById('info-cli-emer').innerText = c.emer || 'No asignado';
  document.getElementById('info-cli-dir').innerText = c.dir;
  document.getElementById('info-cli-redes').innerText = c.redes || 'Sin notas';

  const contenedorHistorial = document.getElementById('contenedor-historial-prestamos-cliente');
  contenedorHistorial.innerHTML = '';

  const prestamosCliente = prestamos.filter(p => p.clienteId === clienteId);

  if (prestamosCliente.length === 0) {
    contenedorHistorial.innerHTML = '<p class="text-xs text-slate-500 italic">Sin préstamos registrados.</p>';
  } else {
    prestamosCliente.forEach(p => {
      contenedorHistorial.innerHTML += `
        <div class="bg-slate-900 border border-slate-700 p-3 rounded-xl text-xs space-y-1">
          <p class="font-bold text-white">Monto: $${p.monto.toLocaleString('es-AR')} | Devuelve: $${p.totalADevolver.toLocaleString('es-AR')}</p>
          <p class="text-slate-400">Estado: <strong class="${p.estado === 'finalizado' ? 'text-slate-400' : 'text-emerald-400'}">${p.estado}</strong></p>
        </div>
      `;
    });
  }

  document.getElementById('modal-info-cliente').classList.remove('hidden');
}

function cerrarModalInfoCliente() { document.getElementById('modal-info-cliente').classList.add('hidden'); }

function abrirModalPagoAtrasadoTotal(clienteId) {
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;

  const tempHoy = new Date();
  const diaSemana = tempHoy.getDay();
  const diffLunes = tempHoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1);
  const lunesActualISO = new Date(tempHoy.setDate(diffLunes)).toISOString().split('T')[0];

  let baseSum = 0;
  let recargoSum = 0;
  let maxDiasAtraso = 0;

  prestamos.forEach(p => {
    if (p.clienteId === clienteId && p.estado !== 'finalizado' && p.calendario) {
      p.calendario.forEach(cq => {
        if (!cq.pagado && cq.fechaISO < lunesActualISO) {
          const pend = cq.monto - (cq.montoPagado || 0);
          baseSum += pend;
          const recargoInfo = calcularRecargoDeCuota(cq, p.frecuencia);
          recargoSum += recargoInfo.montoRecargo;
          if (recargoInfo.diasAtraso > maxDiasAtraso) maxDiasAtraso = recargoInfo.diasAtraso;
        }
      });
    }
  });

  datosRecargoModalAgrupado = { base: baseSum, montoRecargo: recargoSum, diasAtraso: maxDiasAtraso, maxPermitido: baseSum + recargoSum };

  document.getElementById('pago-atrasado-cliente-id').value = clienteId;
  document.getElementById('pago-atrasado-cli-nombre').innerText = c.nombre;
  document.getElementById('pago-atrasado-monto-base').innerText = '$' + baseSum.toLocaleString('es-AR');
  document.getElementById('pago-atrasado-monto-recargo').innerText = recargoSum.toLocaleString('es-AR');
  document.getElementById('pago-atrasado-tiempo-txt').innerText = obtenerTextoTiempoAtraso(maxDiasAtraso);

  document.getElementById('chk-aplicar-retraso-agrupado').checked = true;
  alternarRecargoAgrupado();

  document.getElementById('modal-pago-atrasado-agrupado').classList.remove('hidden');
}

function alternarRecargoAgrupado() {
  const chkRecargo = document.getElementById('chk-aplicar-retraso-agrupado');
  const inputMonto = document.getElementById('pago-atrasado-monto-ingresado');
  const totalTxt = document.getElementById('pago-atrasado-monto-total');

  let total = chkRecargo.checked ? (datosRecargoModalAgrupado.base + datosRecargoModalAgrupado.montoRecargo) : datosRecargoModalAgrupado.base;
  datosRecargoModalAgrupado.maxPermitido = total;
  totalTxt.innerText = '$' + total.toLocaleString('es-AR');
  inputMonto.value = total;
  inputMonto.max = total;

  convertirMontoPagoAtrasadoEnLetras(inputMonto.value);
}

function cerrarModalPagoAtrasadoTotal() { document.getElementById('modal-pago-atrasado-agrupado').classList.add('hidden'); }

async function confirmarPagoAtrasadoAgrupado(event) {
  event.preventDefault();
  const clienteId = document.getElementById('pago-atrasado-cliente-id').value;
  let montoRestanteCobrado = parseFloat(document.getElementById('pago-atrasado-monto-ingresado').value) || 0;

  if (montoRestanteCobrado <= 0) return;

  const tempHoy = new Date();
  const diaSemana = tempHoy.getDay();
  const diffLunes = tempHoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1);
  const lunesActualISO = new Date(tempHoy.setDate(diffLunes)).toISOString().split('T')[0];

  const prestamosCliente = prestamos.filter(p => p.clienteId === clienteId && p.estado !== 'finalizado');

  for (let p of prestamosCliente) {
    if (montoRestanteCobrado <= 0) break;
    if (!p.calendario) continue;

    let calModificado = JSON.parse(JSON.stringify(p.calendario));
    let huboCambios = false;

    calModificado.sort((a,b) => a.fechaISO.localeCompare(b.fechaISO));

    for (let cq of calModificado) {
      if (!cq.pagado && cq.fechaISO < lunesActualISO) {
        let debia = cq.monto - (cq.montoPagado || 0);
        if (montoRestanteCobrado >= debia) {
          cq.montoPagado = cq.monto;
          cq.pagado = true;
          montoRestanteCobrado -= debia;
          huboCambios = true;
        } else {
          cq.montoPagado = (cq.montoPagado || 0) + montoRestanteCobrado;
          montoRestanteCobrado = 0;
          huboCambios = true;
          break;
        }
      }
    }

    if (huboCambios) {
      const todasPagadas = calModificado.every(c => c.pagado);
      if (db) await db.collection('prestamos').doc(p.id).update({ calendario: calModificado, estado: todasPagadas ? 'finalizado' : 'activo' });
    }
  }

  cerrarModalPagoAtrasadoTotal();
  cerrarModalAtrasados();
  mostrarToast("Cobro registrado con éxito");
}

function abrirModalAtrasadosCliente(clienteId) {
  const c = clientes.find(x => x.id === clienteId);
  document.getElementById('atrasados-cli-nombre').innerText = c ? c.nombre : 'Cliente';
  document.getElementById('atrasados-cli-dir').innerText = c ? c.dir : '';

  const listaModal = document.getElementById('lista-cuotas-atrasadas-modal');
  listaModal.innerHTML = '';

  const tempHoy = new Date();
  const diaSemana = tempHoy.getDay();
  const diffLunes = tempHoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1);
  const lunesActualISO = new Date(tempHoy.setDate(diffLunes)).toISOString().split('T')[0];

  prestamos.forEach(p => {
    if (p.clienteId === clienteId && p.estado !== 'finalizado' && p.calendario) {
      p.calendario.forEach(cq => {
        if (!cq.pagado && cq.fechaISO < lunesActualISO) {
          const restoPendiente = cq.monto - (cq.montoPagado || 0);
          listaModal.innerHTML += `
            <div class="p-3 bg-slate-900 border border-slate-700 rounded-xl flex justify-between items-center text-xs">
              <div><p class="font-bold text-white">Cuota ${cq.numero} (${cq.fechaTexto || cq.fechaISO})</p><p class="text-slate-300">Base: $${restoPendiente.toLocaleString('es-AR')}</p></div>
              <button onclick="abrirModalPagoCuota('${p.id}', '${cq.idCuota}')" class="bg-red-600 text-white font-bold px-3 py-1.5 rounded-lg">Cobrar Cuota</button>
            </div>
          `;
        }
      });
    }
  });

  document.getElementById('modal-atrasados-cliente').classList.remove('hidden');
}

function cerrarModalAtrasados() { document.getElementById('modal-atrasados-cliente').classList.add('hidden'); }

function abrirModalPagoCuota(prestamoId, idCuota) {
  const p = prestamos.find(x => x.id === prestamoId);
  if (!p) return;
  const c = p.calendario.find(x => x.idCuota === idCuota);
  if (!c) return;

  const restoPendienteCuota = c.monto - (c.montoPagado || 0);
  const recargoInfo = calcularRecargoDeCuota(c, p.frecuencia);

  let saldoTotalRestante = 0;
  p.calendario.forEach(cq => { if (!cq.pagado) saldoTotalRestante += (cq.monto - (cq.montoPagado || 0)); });

  datosRecargoModalCuota = { base: restoPendienteCuota, montoRecargo: recargoInfo.montoRecargo, saldoTotalPrestamo: saldoTotalRestante, maxPermitido: saldoTotalRestante + recargoInfo.montoRecargo };

  document.getElementById('pago-prestamo-id').value = prestamoId;
  document.getElementById('pago-cuota-id').value = idCuota;
  document.getElementById('pago-cli-nombre').innerText = p.clienteNombre ? p.clienteNombre.split('(')[0] : 'Cliente';
  document.getElementById('pago-cuota-num').innerText = c.numero;
  document.getElementById('pago-cuota-base').innerText = '$' + restoPendienteCuota.toLocaleString('es-AR');
  document.getElementById('pago-saldo-total-prestamo').innerText = '$' + saldoTotalRestante.toLocaleString('es-AR');

  alternarRecargoCuota();
  document.getElementById('modal-pago-cuota').classList.remove('hidden');
}

function alternarRecargoCuota() {
  const chkRecargo = document.getElementById('chk-aplicar-retraso-cuota');
  const totalSugerido = document.getElementById('pago-cuota-total-sugerido');
  const inputMonto = document.getElementById('pago-monto-ingresado');

  let recargo = (chkRecargo.checked && datosRecargoModalCuota.montoRecargo > 0) ? datosRecargoModalCuota.montoRecargo : 0;
  const sugeridoCuota = datosRecargoModalCuota.base + recargo;
  
  totalSugerido.innerText = '$' + sugeridoCuota.toLocaleString('es-AR');
  inputMonto.value = sugeridoCuota;

  convertirMontoPagoEnLetras(inputMonto.value);
}

function cerrarModalPago() { document.getElementById('modal-pago-cuota').classList.add('hidden'); }

async function confirmarRegistroPago(event) {
  event.preventDefault();
  const prestamoId = document.getElementById('pago-prestamo-id').value;
  const idCuota = document.getElementById('pago-cuota-id').value;
  let montoIngresado = parseFloat(document.getElementById('pago-monto-ingresado').value);

  const p = prestamos.find(x => x.id === prestamoId);
  if (!p || isNaN(montoIngresado) || montoIngresado <= 0) return;

  const montoEfectivoPagado = montoIngresado;
  let calModificado = JSON.parse(JSON.stringify(p.calendario || []));
  calModificado.sort((a,b) => a.numero - b.numero);

  const idx = calModificado.findIndex(c => c.idCuota === idCuota);

  if (idx !== -1) {
    for (let i = idx; i < calModificado.length; i++) {
      if (montoIngresado <= 0) break;
      let cq = calModificado[i];
      if (!cq.pagado) {
        let debia = cq.monto - (cq.montoPagado || 0);
        if (montoIngresado >= debia) {
          cq.montoPagado = cq.monto;
          cq.pagado = true;
          montoIngresado -= debia;
        } else {
          cq.montoPagado = (cq.montoPagado || 0) + montoIngresado;
          montoIngresado = 0;
          break;
        }
      }
    }
  }

  const todasPagadas = calModificado.every(c => c.pagado);

  if (db) {
    await db.collection('prestamos').doc(prestamoId).update({ calendario: calModificado, estado: todasPagadas ? 'finalizado' : 'activo' });
  }

  cerrarModalPago();
  cerrarModalAtrasados();

  mostrarToast("Cobro registrado con éxito");

  const cliObj = clientes.find(c => c.id === p.clienteId);
  const saldoRestanteCliente = calcularSaldoPendienteTotalCliente(p.clienteId) - montoEfectivoPagado;
  mostrarModalComprobanteWhatsApp(cliObj, montoEfectivoPagado, `Cuota N° ${p.calendario.find(c => c.idCuota === idCuota).numero}`, saldoRestanteCliente);
}

function verDetallePrestamoActivo(id) {
  const p = prestamos.find(x => x.id === id);
  if (!p) return;

  document.getElementById('det-act-cliente').innerText = p.clienteNombre ? p.clienteNombre.split('(')[0] : 'Cliente';
  document.getElementById('det-act-fechainicio').innerText = p.fechaInicio || 'S/D';
  document.getElementById('det-act-monto').innerText = '$' + p.monto.toLocaleString('es-AR');
  document.getElementById('det-act-total').innerText = '$' + p.totalADevolver.toLocaleString('es-AR');
  document.getElementById('det-act-ganancia').innerText = '+$' + p.ganancia.toLocaleString('es-AR');

  const lista = document.getElementById('det-act-lista-cuotas');
  lista.innerHTML = '';

  if (p.calendario) {
    p.calendario.forEach(c => {
      lista.innerHTML += `
        <div class="flex justify-between items-center text-xs p-2 rounded-xl border ${c.pagado ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800 border-slate-700'}">
          <span>Cuota ${c.numero} (${c.fechaTexto || c.fechaISO})</span>
          <span>${c.pagado ? '✓ Pagado' : '🟡 Pendiente'}</span>
        </div>
      `;
    });
  }

  document.getElementById('modal-detalle-prestamo-activo').classList.remove('hidden');
}

function cerrarModalDetalleActivo() { document.getElementById('modal-detalle-prestamo-activo').classList.add('hidden'); }

function alternarPestanaResumen(pestana) {
  pestanaResumenActual = pestana;
  const btnActivos = document.getElementById('btn-tab-activos');
  const btnFinalizados = document.getElementById('btn-tab-finalizados');
  const vistaActivos = document.getElementById('vista-prestamos-activos');
  const vistaFinalizados = document.getElementById('vista-prestamos-finalizados');

  if (pestana === 'activos') {
    btnActivos.className = "px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-white border border-slate-700 shadow";
    btnFinalizados.className = "px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition";
    vistaActivos.classList.remove('hidden');
    vistaFinalizados.classList.add('hidden');
  } else {
    btnFinalizados.className = "px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-white border border-slate-700 shadow";
    btnActivos.className = "px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition";
    vistaActivos.classList.add('hidden');
    vistaFinalizados.classList.remove('hidden');
  }

  renderizarResumenYPrestamos();
}

function renderizarResumenYPrestamos() {
  let totalCapitalActivos = 0;
  let totalGananciaActivos = 0;

  const tablaBody = document.getElementById('tabla-prestamos-body');
  if (!tablaBody) return;
  tablaBody.innerHTML = '';

  prestamos.forEach(p => {
    if (p.estado !== 'finalizado') {
      totalCapitalActivos += p.monto;
      totalGananciaActivos += p.ganancia;

      tablaBody.innerHTML += `
        <tr class="hover:bg-slate-800/40 cursor-pointer transition" onclick="verDetallePrestamoActivo('${p.id}')">
          <td class="p-3 font-semibold text-white">👤 ${p.clienteNombre ? p.clienteNombre.split('(')[0] : 'Cliente'}</td>
          <td class="p-3 text-slate-300">${p.fechaInicio || 'S/D'}</td>
          <td class="p-3">$${p.monto.toLocaleString('es-AR')}</td>
          <td class="p-3 font-bold text-fuchsia-400">$${p.totalADevolver.toLocaleString('es-AR')}</td>
          <td class="p-3 uppercase text-xs">${p.numCuotas} cuotas (${p.frecuencia})</td>
          <td class="p-3" onclick="event.stopPropagation()">
            <button onclick="solicitarFinalizarPrestamo('${p.id}')" class="bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2 py-1 rounded-lg">🏁 Finalizar</button>
            <button onclick="solicitarEliminarPrestamo('${p.id}')" class="bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-bold p-1 rounded-lg">🗑️</button>
          </td>
        </tr>
      `;
    }
  });

  document.getElementById('resumen-capital').innerText = '$' + totalCapitalActivos.toLocaleString('es-AR');
  document.getElementById('resumen-ganancia').innerText = '+$' + totalGananciaActivos.toLocaleString('es-AR');
}

function solicitarFinalizarPrestamo(id) {
  idPrestamoAFinalizar = id;
  document.getElementById('modal-confirmar-finalizar-prestamo').classList.remove('hidden');
}

function cerrarModalFinalizarPrestamo() { document.getElementById('modal-confirmar-finalizar-prestamo').classList.add('hidden'); }

async function confirmarFinalizacionPrestamo() {
  if (idPrestamoAFinalizar && db) {
    await db.collection('prestamos').doc(idPrestamoAFinalizar).update({ estado: 'finalizado' });
    cerrarModalFinalizarPrestamo();
    mostrarToast("Préstamo finalizado");
  }
}

function solicitarEliminarPrestamo(id) {
  idPrestamoAEliminar = id;
  document.getElementById('modal-confirmar-eliminar-prestamo').classList.remove('hidden');
}

function cerrarModalEliminarPrestamo() { document.getElementById('modal-confirmar-eliminar-prestamo').classList.add('hidden'); }

async function confirmarEliminacionPrestamo() {
  if (idPrestamoAEliminar && db) {
    await db.collection('prestamos').doc(idPrestamoAEliminar).delete();
    cerrarModalEliminarPrestamo();
    mostrarToast("Préstamo eliminado");
  }
}

function renderizarEstadoCuentas() {
  const lista = document.getElementById('lista-cobros-dia');
  if (!lista) return;
  lista.innerHTML = '';

  clientes.forEach(c => {
    lista.innerHTML += `
      <div class="p-4 rounded-2xl bg-[#1E293B]/40 border border-slate-700/60 flex justify-between items-center">
        <div>
          <h4 class="font-bold text-white">${c.nombre}</h4>
          <p class="text-xs text-slate-400">📍 ${c.dir} | 📞 ${c.tel}</p>
        </div>
        <button onclick="verFichaCliente('${c.id}')" class="bg-slate-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl border border-slate-700">📜 Historial</button>
      </div>
    `;
  });
}

function pagarSuscripcionMercadoPago() {
  if (!configSuscripcion.link) return mostrarToast("Sin link de pago configurado", "error");
  if (configSuscripcion.link.startsWith('http')) window.open(configSuscripcion.link, '_blank');
  else { navigator.clipboard.writeText(configSuscripcion.link); mostrarToast(`📋 Alias copiado: ${configSuscripcion.link}`); }
}

async function cambiarMiContrasena(event) {
  event.preventDefault();
  const p1 = document.getElementById('cli-nueva-pass').value;
  const p2 = document.getElementById('cli-confirm-pass').value;
  if (p1 !== p2) return mostrarToast("Las contraseñas no coinciden", "error");

  try {
    await auth.currentUser.updatePassword(p1);
    
    // Actualizar también la clave en Firestore para que la vea el Admin Master
    if (db && usuarioActual) {
      await db.collection('usuarios').doc(usuarioActual.uid).update({
        passwordVisual: p1
      });
    }

    mostrarToast("✅ Contraseña actualizada correctamente");
    document.getElementById('cli-nueva-pass').value = '';
    document.getElementById('cli-confirm-pass').value = '';
  } catch (error) {
    mostrarToast("Cerrá sesión y volvé a ingresar antes de cambiar clave", "error");
  }
}
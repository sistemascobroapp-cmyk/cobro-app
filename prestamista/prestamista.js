// LÓGICA DE PRESTAMISTAS, PLANIFICADOR DE COBROS, CÁLCULOS DE ATRASOS Y SUSCRIPCIÓN

let fechaSemanaSeleccionada = new Date();

// ==========================================
// 1. CONFIGURACIÓN DE INTERESES Y RECARGOS
// ==========================================

async function cargarCamposConfigIntereses() {
  if (!usuarioActual) return;
  try {
    const doc = await db.collection('usuarios').doc(usuarioActual.uid).get();
    if (doc.exists && doc.data().configIntereses) {
      const cfg = doc.data().configIntereses;
      if (document.getElementById('cfg-int-diario')) document.getElementById('cfg-int-diario').value = cfg.intDiario ?? 0;
      if (document.getElementById('cfg-int-semanal')) document.getElementById('cfg-int-semanal').value = cfg.intSemanal ?? 0;
      if (document.getElementById('cfg-int-mensual')) document.getElementById('cfg-int-mensual').value = cfg.intMensual ?? 0;
      if (document.getElementById('cfg-retraso-diario')) document.getElementById('cfg-retraso-diario').value = cfg.retrasoDiario ?? 0;
      if (document.getElementById('cfg-retraso-semanal')) document.getElementById('cfg-retraso-semanal').value = cfg.retrasoSemanal ?? 0;
      if (document.getElementById('cfg-retraso-mensual')) document.getElementById('cfg-retraso-mensual').value = cfg.retrasoMensual ?? 0;
    }
  } catch (error) {
    console.error("Error al cargar configuración de intereses:", error);
  }
}

async function guardarInteresesConfig(event) {
  event.preventDefault();
  if (!usuarioActual) return;

  const configIntereses = {
    intDiario: parseFloat(document.getElementById('cfg-int-diario').value) || 0,
    intSemanal: parseFloat(document.getElementById('cfg-int-semanal').value) || 0,
    intMensual: parseFloat(document.getElementById('cfg-int-mensual').value) || 0,
    retrasoDiario: parseFloat(document.getElementById('cfg-retraso-diario').value) || 0,
    retrasoSemanal: parseFloat(document.getElementById('cfg-retraso-semanal').value) || 0,
    retrasoMensual: parseFloat(document.getElementById('cfg-retraso-mensual').value) || 0
  };

  try {
    await db.collection('usuarios').doc(usuarioActual.uid).set({
      configIntereses: configIntereses
    }, { merge: true });

    mostrarToast("⚙️ Porcentajes de interés y recargos por mora guardados con éxito");
  } catch (error) {
    console.error("Error al guardar intereses:", error);
    mostrarToast("Error al guardar la configuración de intereses", "error");
  }
}

// ==========================================
// 2. PLANIFICADOR SEMANAL Y COBROS ATRASADOS
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

    prestamos.forEach(p => {
      if (p.estado === 'finalizado') return;

      const cli = clientes.find(c => c.id === p.clienteId);
      const nombreCliente = cli ? cli.nombre : 'Cliente Desconocido';

      // 1. REVISAR SI EL CLIENTE TIENE COBROS ATRASADOS DE FECHAS ANTERIORES
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

      // 2. REVISAR COBROS PROGRAMADOS PARA ESTE DÍA ESPECÍFICO
      (p.cuotasDetalle || []).forEach(c => {
        if (c.fecha === isoDia) {
          cobrosAgendadosCount++;

          const estaPagado = c.pagado === true;
          const esHoy = isoDia === hoyISO;
          const esPasado = isoDia < hoyISO;

          let badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 Pendiente</span>';
          if (estaPagado) {
            badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Cobrado</span>';
          } else if (esPasado) {
            badgeEstado = '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">🔴 Atrasado</span>';
          }

          // BLOQUE DE ALERTA SI TIENE COBROS ANTERIORES ATRASADOS
          let htmlAlertaAtraso = '';
          if (!estaPagado && totalMontoAtrasado > 0) {
            htmlAlertaAtraso = `
              <div class="mt-2 p-2.5 rounded-xl bg-red-950/40 border border-red-500/50 space-y-1.5">
                <div class="flex justify-between items-center text-xs text-red-300 font-bold">
                  <span>🚨 Atrasos Anteriores:</span>
                  <span class="text-white font-black">$${totalMontoAtrasado.toLocaleString('es-AR')}</span>
                </div>
                <p class="text-[10px] text-slate-300">Demora acumulada: <strong>${diasMaxAtraso} días</strong></p>
                <button onclick="abrirModalPagoAtrasadoTotal('${p.clienteId}', ${totalMontoAtrasado}, ${diasMaxAtraso})" class="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] py-1.5 rounded-lg shadow transition">
                  💵 Cobrar con Recargo por Atraso
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
// 3. CAMBIO DE CONTRASEÑA Y SUSCRIPCIÓN
// ==========================================

async function cambiarMiContrasena(event) {
  event.preventDefault();
  const pass1 = document.getElementById('cli-nueva-pass').value;
  const pass2 = document.getElementById('cli-confirm-pass').value;

  if (pass1 !== pass2) {
    return mostrarToast("Las contraseñas no coinciden", "error");
  }

  try {
    await usuarioActual.updatePassword(pass1);

    await db.collection('usuarios').doc(usuarioActual.uid).update({
      passwordVisual: pass1
    });

    mostrarToast("🔑 Contraseña actualizada correctamente");
    document.getElementById('cli-nueva-pass').value = '';
    document.getElementById('cli-confirm-pass').value = '';
  } catch (error) {
    console.error(error);
    mostrarToast("Error al cambiar contraseña: " + error.message, "error");
  }
}

function pagarSuscripcionMercadoPago() {
  if (!configSuscripcion || !configSuscripcion.link) {
    return mostrarToast("El Administrador aún no ha configurado el link de Mercado Pago.", "error");
  }

  let link = configSuscripcion.link.trim();
  if (!link.startsWith('http://') && !link.startsWith('https://')) {
    link = 'https://' + link;
  }

  window.open(link, '_blank');
}

function enviarComprobanteAlquilerWhatsApp() {
  if (!configSuscripcion || !configSuscripcion.whatsapp) {
    return mostrarToast("El Administrador no ha configurado número de WhatsApp.", "error");
  }

  const numWsp = configSuscripcion.whatsapp.replace(/[^0-9]/g, '');
  const mensaje = encodeURIComponent(`Hola! Ya aboné la suscripción mensual de mi cuenta de CobroApp (${usuarioActual.email}). Te adjunto el comprobante.`);
  window.open(`https://wa.me/${numWsp}?text=${mensaje}`, '_blank');
}
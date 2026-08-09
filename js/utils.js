// UTILIDADES GENERALES: NOTIFICACIONES, NÚMEROS A LETRAS, COMPROBANTES DE WHATSAPP Y TEMAS

let temaActual = localStorage.getItem('cobro_tema') || 'oscuro';
let telefonoClienteActualWA = '';

function mostrarToast(mensaje, tipo = 'exito') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  const colorBg = (tipo === 'exito') 
    ? 'bg-emerald-600/90 border-emerald-400 shadow-emerald-950/50' 
    : (tipo === 'error' ? 'bg-red-600/90 border-red-400 shadow-red-950/50' : 'bg-fuchsia-600/90 border-fuchsia-400 shadow-fuchsia-950/50');
  
  const icono = (tipo === 'exito') ? '✅' : (tipo === 'error' ? '⚠️' : 'ℹ️');

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-white text-xs font-bold shadow-2xl backdrop-blur-md transform transition-all duration-300 translate-x-full opacity-0 ${colorBg}`;
  toast.innerHTML = `<span class="text-base">${icono}</span> <span>${mensaje}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => { toast.classList.remove('translate-x-full', 'opacity-0'); }, 10);
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function alternarTema() {
  temaActual = (temaActual === 'oscuro') ? 'claro' : 'oscuro';
  localStorage.setItem('cobro_tema', temaActual);
  aplicarTema(temaActual);
}

function aplicarTema(tema) {
  const body = document.getElementById('cuerpo-app');
  const btnTema = document.getElementById('btn-tema');

  if (tema === 'claro') {
    body.classList.add('light-mode');
    btnTema.innerHTML = '🌙 Modo Oscuro';
    btnTema.className = "px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300 transition flex items-center gap-1.5 shadow";
  } else {
    body.classList.remove('light-mode');
    btnTema.innerHTML = '☀️ Modo Claro';
    btnTema.className = "px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 text-amber-400 border border-slate-700 hover:bg-slate-700 transition flex items-center gap-1.5 shadow";
  }
}

function obtenerTextoTiempoAtraso(dias) {
  if (!dias || dias <= 0) return "0 días";
  let texto = `${dias} día${dias > 1 ? 's' : ''}`;
  
  let partes = [];
  if (dias >= 7) {
    const sem = (dias / 7).toFixed(1).replace('.0', '');
    partes.push(`${sem} sem`);
  }
  if (dias >= 30) {
    const mes = (dias / 30).toFixed(1).replace('.0', '');
    partes.push(`${mes} mes${mes !== '1' ? 'es' : ''}`);
  }
  
  if (partes.length > 0) {
    texto += ` (${partes.join(' / ')})`;
  }
  return texto;
}

function formatearTelefonoWhatsApp(tel) {
  if (!tel) return '';
  let num = tel.toString().replace(/\D/g, ''); 
  if (num.length === 10) return '549' + num;
  return num;
}

function mostrarModalComprobanteWhatsApp(clienteObj, montoAbonado, detalleConcepto, saldoRestanteTotal) {
  const fechaHoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaHoy = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const nombreLimpio = clienteObj ? clienteObj.nombre : 'Cliente';
  telefonoClienteActualWA = clienteObj ? formatearTelefonoWhatsApp(clienteObj.tel) : '';

  document.getElementById('recibo-card-cliente').innerText = nombreLimpio;
  document.getElementById('recibo-card-monto').innerText = '$' + montoAbonado.toLocaleString('es-AR');
  document.getElementById('recibo-card-fecha').innerText = `${fechaHoy} ${horaHoy}`;
  document.getElementById('recibo-card-concepto').innerText = detalleConcepto;
  document.getElementById('recibo-card-saldo').innerText = '$' + Math.max(0, saldoRestanteTotal).toLocaleString('es-AR');

  document.getElementById('modal-comprobante-whatsapp').classList.remove('hidden');
}

async function compartirComprobanteImagen() {
  const card = document.getElementById('ticket-recibo-card');
  mostrarToast("⏳ Generando foto del comprobante...", "info");

  try {
    const canvas = await html2canvas(card, { scale: 3, backgroundColor: '#0F172A', useCORS: true });

    canvas.toBlob(async (blob) => {
      if (!blob) return mostrarToast("Error al procesar la imagen", "error");

      const file = new File([blob], `Comprobante_Pago_${Date.now()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Comprobante de Pago', text: 'Recibo Oficial de Pago' });
          mostrarToast("✅ Comprobante enviado correctamente");
          return;
        } catch (err) {}
      }

      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          mostrarToast("📷 ¡Foto copiada! Pégala en WhatsApp con Ctrl + V");
        } else {
          descargarBlob(blob, `Comprobante_Pago.png`);
          mostrarToast("📷 Foto descargada. Adjúntala en WhatsApp");
        }
      } catch (e) {
        descargarBlob(blob, `Comprobante_Pago.png`);
        mostrarToast("📷 Foto descargada. Adjúntala en WhatsApp");
      }

      const urlWa = telefonoClienteActualWA ? `https://wa.me/${telefonoClienteActualWA}` : `https://wa.me/`;
      window.open(urlWa, '_blank');
    }, 'image/png');

  } catch (e) {
    mostrarToast("Ocurrió un problema al crear la imagen", "error");
  }
}

function descargarBlob(blob, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

function cerrarModalComprobante() {
  document.getElementById('modal-comprobante-whatsapp').classList.add('hidden');
}

// CONVERSOR DE NÚMEROS A LETRAS
function convertirMontoEnLetras(valor) {
  const p = document.getElementById('monto-en-letras');
  const num = parseInt(valor);
  if (!num || isNaN(num) || num <= 0) { p.innerText = ''; return; }
  p.innerText = '🗣️ ' + numeroALetras(num);
}

function convertirMontoPagoEnLetras(valor) {
  const p = document.getElementById('pago-monto-en-letras');
  if (!p) return;
  const num = parseInt(valor);
  if (!num || isNaN(num) || num <= 0) { p.innerText = ''; return; }
  p.innerText = '🗣️ ' + numeroALetras(num);
}

function convertirMontoPagoAtrasadoEnLetras(valor) {
  const p = document.getElementById('pago-atrasado-monto-en-letras');
  if (!p) return;
  const num = parseInt(valor);
  if (!num || isNaN(num) || num <= 0) { p.innerText = ''; return; }
  p.innerText = '🗣️ ' + numeroALetras(num);
}

function Unidades(num){
  switch(num){
    case 1: return "UN"; case 2: return "DOS"; case 3: return "TRES"; case 4: return "CUATRO";
    case 5: return "CINCO"; case 6: return "SEIS"; case 7: return "SIETE"; case 8: return "OCHO"; case 9: return "NUEVE";
  }
  return "";
}
function Decenas(num){
  let decena = Math.floor(num/10); let unidad = num - (decena*10);
  switch(decena){
    case 1:
      switch(unidad){
        case 0: return "DIEZ"; case 1: return "ONCE"; case 2: return "DOCE"; case 3: return "TRECE"; case 4: return "CATORCE"; case 5: return "QUINCE";
        default: return "DIECI" + Unidades(unidad);
      }
    case 2: switch(unidad){ case 0: return "VEINTE"; default: return "VEINTI" + Unidades(unidad); }
    case 3: return (unidad>0)? "TREINTA Y " + Unidades(unidad): "TREINTA";
    case 4: return (unidad>0)? "CUARENTA Y " + Unidades(unidad): "CUARENTA";
    case 5: return (unidad>0)? "CINCUENTA Y " + Unidades(unidad): "CINCUENTA";
    case 6: return (unidad>0)? "SESENTA Y " + Unidades(unidad): "SESENTA";
    case 7: return (unidad>0)? "SETENTA Y " + Unidades(unidad): "SETENTA";
    case 8: return (unidad>0)? "OCHENTA Y " + Unidades(unidad): "OCHENTA";
    case 9: return (unidad>0)? "NOVENTA Y " + Unidades(unidad): "NOVENTA";
    case 0: return Unidades(unidad);
  }
}
function Centenas(num){
  let centenas = Math.floor(num/100); let decenas = num - (centenas*100);
  switch(centenas){
    case 1: return (decenas>0)? "CIENTO " + Decenas(decenas): "CIEN";
    case 2: return "DOSCIENTOS " + Decenas(decenas); case 3: return "TRESCIENTOS " + Decenas(decenas);
    case 4: return "CUATROCIENTOS " + Decenas(decenas); case 5: return "QUINIENTOS " + Decenas(decenas);
    case 6: return "SEISCIENTOS " + Decenas(decenas); case 7: return "SETIECIENTOS " + Decenas(decenas);
    case 8: return "OCHOCIENTOS " + Decenas(decenas); case 9: return "NOVECIENTOS " + Decenas(decenas);
  }
  return Decenas(decenas);
}
function numeroALetras(num){
  num = Math.floor(num);
  if (num === 0) return "CERO PESOS";

  let millones = Math.floor(num / 1000000);
  let miles = Math.floor((num % 1000000) / 1000);
  let cientos = num % 1000;

  let strMillones = "";
  if (millones > 0) {
    if (millones === 1) strMillones = (miles === 0 && cientos === 0) ? "UN MILLÓN DE" : "UN MILLÓN";
    else strMillones = (miles === 0 && cientos === 0) ? Centenas(millones) + " MILLONES DE" : Centenas(millones) + " MILLONES";
  }

  let strMiles = (miles > 0) ? ((miles === 1) ? "MIL" : Centenas(miles) + " MIL") : "";
  let strCientos = Centenas(cientos);

  return [strMillones, strMiles, strCientos].filter(Boolean).join(" ").trim() + " PESOS";
}
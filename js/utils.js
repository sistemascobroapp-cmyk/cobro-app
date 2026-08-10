// FUNCIONES DE UTILIDAD GENERAL, TOASTS, FECHAS Y ENLACES

function mostrarToast(mensaje, tipo = 'exito') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const esError = tipo === 'error';
  toast.className = `px-4 py-3 rounded-xl text-xs font-extrabold shadow-2xl flex items-center gap-2 border pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 ${
    esError 
      ? 'bg-red-950/90 text-red-200 border-red-500/50 shadow-red-950/50' 
      : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-950/50'
  }`;
  
  toast.innerHTML = `<span>${esError ? '🚨' : '✅'}</span><span>${mensaje}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function obtenerFechaLocalISO(fecha = new Date()) {
  const d = new Date(fecha);
  const offset = d.getTimezoneOffset();
  const fechaLocal = new Date(d.getTime() - (offset * 60 * 1000));
  return fechaLocal.toISOString().split('T')[0];
}

function formatearFechaEspanol(isoFechaStr) {
  if (!isoFechaStr) return '-';
  const partes = isoFechaStr.split('-');
  if (partes.length !== 3) return isoFechaStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function convertirMontoEnLetras(num) {
  const elem = document.getElementById('monto-en-letras');
  if (!elem) return;

  const valor = parseFloat(num);
  if (isNaN(valor) || valor <= 0) {
    elem.innerText = '';
    return;
  }

  function Unidades(num){
    switch(num){
      case 1: return 'UN';
      case 2: return 'DOS';
      case 3: return 'TRES';
      case 4: return 'CUATRO';
      case 5: return 'CINCO';
      case 6: return 'SEIS';
      case 7: return 'SIETE';
      case 8: return 'OCHO';
      case 9: return 'NUEVE';
    }
    return '';
  }

  function Decenas(num){
    const decena = Math.floor(num/10);
    const unidad = num - (decena * 10);
    switch(decena){
      case 1:
        switch(unidad){
          case 0: return 'DIEZ';
          case 1: return 'ONCE';
          case 2: return 'DOCE';
          case 3: return 'TRECE';
          case 4: return 'CATORCE';
          case 5: return 'QUINCE';
          default: return 'DIECI' + Unidades(unidad);
        }
      case 2:
        switch(unidad){
          case 0: return 'VEINTE';
          default: return 'VEINTI' + Unidades(unidad);
        }
      case 3: return DecenasY('TREINTA', unidad);
      case 4: return DecenasY('CUARENTA', unidad);
      case 5: return DecenasY('CINCUENTA', unidad);
      case 6: return DecenasY('SESENTA', unidad);
      case 7: return DecenasY('SETENTA', unidad);
      case 8: return DecenasY('OCHENTA', unidad);
      case 9: return DecenasY('NOVENTA', unidad);
      case 0: return Unidades(unidad);
    }
  }

  function DecenasY(strSin, numUnidades) {
    if (numUnidades > 0) return strSin + ' Y ' + Unidades(numUnidades);
    return strSin;
  }

  function Centenas(num) {
    const centenas = Math.floor(num / 100);
    const decenas = num - (centenas * 100);
    switch(centenas) {
      case 1:
        if (decenas > 0) return 'CIENTO ' + Decenas(decenas);
        return 'CIEN';
      case 2: return 'DOSCIENTOS ' + Decenas(decenas);
      case 3: return 'TRESCIENTOS ' + Decenas(decenas);
      case 4: return 'CUATROCIENTOS ' + Decenas(decenas);
      case 5: return 'QUINIENTOS ' + Decenas(decenas);
      case 6: return 'SEISCIENTOS ' + Decenas(decenas);
      case 7: return 'SETECIENTOS ' + Decenas(decenas);
      case 8: return 'OCHOIENTOS ' + Decenas(decenas);
      case 9: return 'NOVECIENTOS ' + Decenas(decenas);
    }
    return Decenas(decenas);
  }

  function Seccion(num, divisor, strSingular, strPlural) {
    const cientos = Math.floor(num / divisor);
    const resto = num - (cientos * divisor);
    let letras = '';
    if (cientos > 0) {
      if (cientos > 1) letras = Centenas(cientos) + ' ' + strPlural;
      else letras = strSingular;
    }
    if (resto > 0) letras += '';
    return letras;
  }

  function Miles(num) {
    const divisor = 1000;
    const cientos = Math.floor(num / divisor);
    const resto = num - (cientos * divisor);
    const strMiles = Seccion(num, divisor, 'UN MIL', 'MIL');
    const strCentenas = Centenas(resto);

    if(strMiles === '') return strCentenas;
    return strMiles + ' ' + strCentenas;
  }

  function Millones(num) {
    const divisor = 1000000;
    const cientos = Math.floor(num / divisor);
    const resto = num - (cientos * divisor);
    const strMillones = Seccion(num, divisor, 'UN MILLON DE', 'MILLONES DE');
    const strMiles = Miles(resto);

    if(strMillones === '') return strMiles;
    return strMillones + ' ' + strMiles;
  }

  const enteramente = Math.floor(valor);
  const texto = Millones(enteramente).trim();
  elem.innerText = `(${texto} PESOS)`;
}

function alternarTema() {
  const body = document.getElementById('cuerpo-app');
  const btn = document.getElementById('btn-tema');

  if (window.temaActual === 'oscuro') {
    window.temaActual = 'claro';
    body.classList.add('light-mode');
    if (btn) btn.innerHTML = '🌙 Modo Oscuro';
  } else {
    window.temaActual = 'oscuro';
    body.classList.remove('light-mode');
    if (btn) btn.innerHTML = '☀️ Modo Claro';
  }

  localStorage.setItem('tema_app', window.temaActual);
}

function aplicarTema(tema) {
  const body = document.getElementById('cuerpo-app');
  const btn = document.getElementById('btn-tema');

  if (tema === 'claro') {
    body.classList.add('light-mode');
    if (btn) btn.innerHTML = '🌙 Modo Oscuro';
  } else {
    body.classList.remove('light-mode');
    if (btn) btn.innerHTML = '☀️ Modo Claro';
  }
}

// PAGAR SUSCRIPCIÓN EN MERCADO PAGO (CON RESPALDO DIRECTO DE FIRESTORE)
async function pagarSuscripcionMercadoPago() {
  try {
    let link = window.configSuscripcion ? (window.configSuscripcion.link || window.configSuscripcion.linkPago || window.configSuscripcion.alias) : '';

    if ((!link || !link.trim()) && typeof db !== 'undefined' && db) {
      const doc = await db.collection('configuracion').doc('suscripcion').get();
      if (doc.exists) {
        window.configSuscripcion = doc.data();
        link = doc.data().link || doc.data().linkPago || doc.data().alias;
      }
    }

    if (!link || !link.trim()) {
      if (typeof mostrarToast === 'function') mostrarToast("El administrador aún no configuró el enlace de pago.", "error");
      else alert("El administrador aún no configuró el enlace de pago.");
      return;
    }

    let url = link.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    window.open(url, '_blank');
  } catch (e) {
    console.error("Error abrir MP:", e);
    if (typeof mostrarToast === 'function') mostrarToast("Error al abrir el enlace de Mercado Pago.", "error");
  }
}

// CONTACTAR ADMINISTRADOR POR WHATSAPP (CON RESPALDO DIRECTO DE FIRESTORE)
async function contactarAdministradorWhatsApp() {
  try {
    let wsp = window.configSuscripcion ? window.configSuscripcion.whatsapp : '';

    if ((!wsp || !wsp.trim()) && typeof db !== 'undefined' && db) {
      const doc = await db.collection('configuracion').doc('suscripcion').get();
      if (doc.exists) {
        window.configSuscripcion = doc.data();
        wsp = doc.data().whatsapp;
      }
    }

    if (!wsp || !wsp.trim()) {
      if (typeof mostrarToast === 'function') mostrarToast("El administrador aún no configuró el número de WhatsApp.", "error");
      else alert("El administrador aún no configuró el número de WhatsApp.");
      return;
    }

    const numClean = wsp.replace(/\D/g, '');
    const mensaje = encodeURIComponent("¡Hola! Te contacto desde CobroApp para realizar una consulta / enviar comprobante sobre mi alquiler de la aplicación.");
    window.open(`https://wa.me/${numClean}?text=${mensaje}`, '_blank');
  } catch (e) {
    console.error("Error abrir WhatsApp:", e);
  }
}

function enviarComprobanteAlquilerWhatsApp() {
  contactarAdministradorWhatsApp();
}
const CLIENT_ID = '872198938997-ojphno5r5pivksqtg5g6d4blqdat389g.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyBUXKG_Y22ryAyjagPwz-hhaltUxmtD5yc';     
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let misDatos = null; let tarjetaActiva = null; let indiceMetaActualVista = null; let indiceDeudaAbono = null; let graficoCircular = null;
let accionConfirmadaPendiente = null; let accionCancelarPendiente = null;
let tokenClient; let gapiInited = false; let gisInited = false; let driveFileId = null;

let syncTimeout = null; 
let ultimoRegistroGuardado = null; 

function gapiLoaded() { gapi.load('client', initializeGapiClient); }
async function initializeGapiClient() { await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] }); gapiInited = true; }
function gisLoaded() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '' }); gisInited = true; }

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
function updateOnlineStatus() { const dot = document.getElementById('network-status-dot'); if (navigator.onLine) { dot.style.background = 'var(--ingreso)'; dot.title = 'Conectado'; } else { dot.style.background = 'var(--egreso)'; dot.title = 'Modo Local'; } }

function toggleModoOscuro() {
    const html = document.documentElement;
    if (html.classList.contains('dark-mode')) { html.classList.remove('dark-mode'); localStorage.setItem('tohka_theme', 'light'); } 
    else { html.classList.add('dark-mode'); localStorage.setItem('tohka_theme', 'dark'); }
    actualizarToggleUI();
}

function actualizarToggleUI() {
    const tTema = document.getElementById('toggle-tema'); if(tTema) tTema.checked = document.documentElement.classList.contains('dark-mode');
    const tVibro = document.getElementById('toggle-vibro'); if(tVibro) tVibro.checked = (localStorage.getItem('core_vibro') === 'true');
}

function toggleVibracion() {
    const act = document.getElementById('toggle-vibro').checked;
    localStorage.setItem('core_vibro', act);
    if(act) vibrar(50);
}

function vibrar(ms) {
    if(localStorage.getItem('core_vibro') === 'true' && navigator.vibrate) { navigator.vibrate(ms); }
}

function toggleStealthMode() {
    const isActive = document.body.classList.toggle('stealth-active');
    localStorage.setItem('core_stealth', isActive);
    vibrar(20);
}

function gestionarSaludoCamaleonico() {
    const nombre = misDatos.seguridad.perfil.nombres || misDatos.seguridad.usuario || "Joel";
    const hora = new Date().getHours();
    let saludo = "";
    if (hora >= 5 && hora < 12) saludo = "Buenos días";
    else if (hora >= 12 && hora < 19) saludo = "Buenas tardes";
    else saludo = "Buenas noches";

    const fechaHoy = new Date().toISOString().split('T')[0];
    const ultimaFechaSaludo = localStorage.getItem('core_fecha_saludo');
    
    if (ultimaFechaSaludo !== fechaHoy && hora < 12) {
        document.getElementById('camaleon-greeting').innerText = `${saludo}, ${nombre}. Listo para el día.`;
        localStorage.setItem('core_fecha_saludo', fechaHoy);
    } else {
        document.getElementById('camaleon-greeting').innerText = `${saludo}, ${nombre}.`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateOnlineStatus(); actualizarToggleUI();
    if(localStorage.getItem('core_stealth') === 'true') document.body.classList.add('stealth-active');
    driveFileId = localStorage.getItem('core_drive_id');
    const dataGuardada = localStorage.getItem('tohka_boveda_data');
    if(dataGuardada) {
        misDatos = JSON.parse(dataGuardada);
        if(!misDatos.datos.deudas) misDatos.datos.deudas = []; if(!misDatos.datos.recurrentes) misDatos.datos.recurrentes = []; if(!misDatos.datos.activos) misDatos.datos.activos = [];
        document.getElementById('last-session-trigger').textContent = "Última sesión: " + formatearFechaElegante(misDatos.seguridad.historial_sesiones[0]);
        document.getElementById('login-modal').style.display = 'none'; document.getElementById('app-container').style.display = 'block';
        procesarGastosRecurrentes(); limpiarFiltrosAvanzados(); popularSelectsAvanzados(); actualizarTodo(); renderizarDatosPerfil();
        gestionarSaludoCamaleonico();
        const tab = localStorage.getItem('core_ultima_pestana') || 'vista-general'; const btn = document.querySelector(`.tab-btn[onclick*="${tab}"]`);
        if(btn) cambiarPestana(tab, btn); else cambiarPestana(tab, null);
    } else {
        document.getElementById('login-modal').style.display = 'flex'; document.getElementById('app-container').style.display = 'none';
    }
});

document.addEventListener('keydown', e => { if(e.key === "Escape") cerrarTodosModales(); });
document.getElementById('filtro-inicio').addEventListener('change', function() { document.getElementById('filtro-fin').min = this.value; });
function escaparHTML(texto) { return String(texto).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); }
function togglePassword() { const input = document.getElementById('login-pass'); const iconContainer = document.getElementById('eye-icon-container'); if(input.type === 'password') { input.type = 'text'; iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>'; } else { input.type = 'password'; iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>'; } }

async function hashSHA256(texto) {
    if (window.crypto && window.crypto.subtle) {
        try { const msgUint8 = new TextEncoder().encode(texto); const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); const hashArray = Array.from(new Uint8Array(hashBuffer)); return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); } 
        catch (e) { return fallbackHash(texto); }
    } else { return fallbackHash(texto); }
}
function fallbackHash(texto) { let hash = 0; for (let i = 0; i < texto.length; i++) { const char = texto.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash = hash & hash; } return "h_" + Math.abs(hash).toString(16); }

function guardarEnMemoriaSession() { 
    if(misDatos) {
        localStorage.setItem('tohka_boveda_data', JSON.stringify(misDatos)); 
        dispararAutoSync();
    }
}
function mostrarAlerta(titulo, mensaje) { document.getElementById('alert-title').innerText = titulo; document.getElementById('alert-message').innerText = mensaje; document.getElementById('custom-alert-modal').style.display = 'flex'; }
function mostrarToast() { const t = document.getElementById('toast-notification'); t.classList.add('show'); setTimeout(() => { t.classList.remove('show'); }, 1500); }

let undoTimeout;
function mostrarToastUndo() { 
    const t = document.getElementById('toast-undo'); t.classList.add('show'); 
    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => { ocultarToastUndo(); ultimoRegistroGuardado = null; }, 3000); 
}
function ocultarToastUndo() { document.getElementById('toast-undo').classList.remove('show'); }
function deshacerUltimoRegistro() {
    if(!ultimoRegistroGuardado) return;
    const tx = ultimoRegistroGuardado;
    if (tx.tipo === 'Ingreso') { misDatos.datos.saldo_disponible -= tx.monto; } 
    else if (tx.tipo === 'Egreso') { misDatos.datos.saldo_disponible += tx.monto; } 
    else if (tx.tipo === 'Ahorro') { 
        misDatos.datos.saldo_disponible += tx.monto; misDatos.datos.ahorros_totales -= tx.monto; 
        if(tx.metaId !== null) misDatos.datos.metas[tx.metaId].ahorrado -= tx.monto;
    } else if (tx.tipo === 'Deuda' && !tx.esDeudaPasada) { misDatos.datos.saldo_disponible -= tx.monto; }
    else if (tx.tipo === 'PagoDeuda') { misDatos.datos.saldo_disponible += tx.monto; misDatos.datos.deudas[indiceDeudaAbono].monto_pagado -= tx.monto; if(misDatos.datos.deudas[indiceDeudaAbono].estado === 'pagada') misDatos.datos.deudas[indiceDeudaAbono].estado = 'activa'; }
    
    misDatos.datos.transacciones.pop();
    ultimoRegistroGuardado = null; ocultarToastUndo();
    actualizarTodo(); vibrar(20);
}

function solicitarConfirmacion(mensaje, accionCallback, textoConfirmar = "Eliminar", textoCancelar = "Cancelar", esPeligro = true, accionCancelar = null) {
    document.getElementById('confirm-title').innerText = "Confirmación"; document.getElementById('confirm-title').style.color = esPeligro ? "var(--danger)" : "var(--primary)"; document.getElementById('confirm-message').innerText = mensaje;
    const btnConfirm = document.getElementById('btn-confirm-action'); btnConfirm.innerText = textoConfirmar; btnConfirm.style.background = esPeligro ? "var(--danger)" : "var(--primary)"; document.getElementById('btn-confirm-cancel').innerText = textoCancelar;
    accionConfirmadaPendiente = accionCallback; accionCancelarPendiente = accionCancelar;
    btnConfirm.onclick = function() { cerrarModal('confirm-modal'); if(accionConfirmadaPendiente) accionConfirmadaPendiente(); }; document.getElementById('confirm-modal').style.display = 'flex';
}
function ejecutarCancelarConfirmacion() { cerrarModal('confirm-modal'); if(accionCancelarPendiente) { accionCancelarPendiente(); } }
function toggleTohkaModal(mostrar) { const modal = document.getElementById('tohka-modal'); if (mostrar) { document.body.classList.add('no-scroll'); modal.style.display = 'flex'; } else { document.body.classList.remove('no-scroll'); modal.style.display = 'none'; } }
function toggleSessionHistory() { const cont = document.getElementById('session-history-container'); if(cont.classList.contains('hidden')) { cont.innerHTML = ''; const previousSessions = misDatos.seguridad.historial_sesiones.slice(1); if(previousSessions.length === 0) { cont.innerHTML = '<div class="session-history-item">No hay sesiones.</div>'; } else { previousSessions.forEach(dateIso => { cont.innerHTML += `<div class="session-history-item">Anterior: ${formatearFechaElegante(dateIso)}</div>`; }); } cont.classList.remove('hidden'); } else { cont.classList.add('hidden'); } }
function actualizarNombreArchivo(input, spanId) { document.getElementById(spanId).textContent = input.files[0] ? input.files[0].name : "Ningún archivo"; }
function cerrarTodosModales() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); cerrarDetalleInline(); document.body.classList.remove('no-scroll'); }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; if(id === 'tohka-modal') document.body.classList.remove('no-scroll'); }
function formatearFechaElegante(fechaIso) { if(!fechaIso) return "Primera sesión registrada"; const d = new Date(fechaIso); const dia = String(d.getDate()).padStart(2, '0'); const mes = String(d.getMonth() + 1).padStart(2, '0'); const anio = d.getFullYear(); const hora = String(d.getHours()).padStart(2, '0'); const min = String(d.getMinutes()).padStart(2, '0'); return `${dia}/${mes}/${anio} - ${hora}:${min}`; }
function fmtDinero(valor) { return `<span class="fin-align">$${valor.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`; }

function calcularSaldosHistoricos() { misDatos.datos.transacciones.sort((a, b) => { if (a.fechaIso === b.fechaIso) return (a.timestamp || 0) - (b.timestamp || 0); return a.fechaIso.localeCompare(b.fechaIso); }); let saldoAcumulado = 0; misDatos.datos.transacciones.forEach(tx => { if(tx.tipo === 'Ingreso' || tx.tipo === 'Reverso' || tx.tipo === 'Deuda') saldoAcumulado += tx.monto; else if(tx.tipo === 'Egreso' || tx.tipo === 'Ahorro' || tx.tipo === 'PagoDeuda') saldoAcumulado -= tx.monto; tx.saldo_historico = saldoAcumulado; }); }

function conectarGoogleDrive() {
    if (!gapiInited || !gisInited) { mostrarAlerta("Error", "Servicios no listos. Revisa tu conexión o llaves API."); return; }
    tokenClient.callback = async (resp) => { if (resp.error) throw resp; buscarArchivoEnDrive(); };
    if (gapi.client.getToken() === null) { tokenClient.requestAccessToken({prompt: 'consent'}); } else { tokenClient.requestAccessToken({prompt: ''}); }
}

async function buscarArchivoEnDrive() {
    try {
        const response = await gapi.client.drive.files.list({ q: "name='CORE_Vault.json' and trashed=false", spaces: 'drive', fields: 'files(id, name)' });
        const files = response.result.files;
        if (files && files.length > 0) { driveFileId = files[0].id; document.getElementById('login-drive-status').innerText = "Bóveda encontrada en la nube. Ingresa credenciales."; document.getElementById('login-drive-status').style.color = "var(--ingreso)"; } 
        else { document.getElementById('login-drive-status').innerText = "No se encontró bóveda. Genera una nueva."; document.getElementById('login-drive-status').style.color = "var(--deuda)"; }
    } catch (err) { mostrarAlerta("Error de Drive", "No se pudo buscar el archivo en la nube."); }
}

async function iniciarSesion() {
    const user = document.getElementById('login-user').value; const pass = document.getElementById('login-pass').value; const fileInput = document.getElementById('login-file').files[0];
    if (!user || !pass) { mostrarAlerta("Falta información", "Ingresa usuario y contraseña."); return; }
    if (driveFileId) { try { const response = await gapi.client.drive.files.get({ fileId: driveFileId, alt: 'media' }); validarYEntrar(response.body || response.result, user, pass); } catch (err) { mostrarAlerta("Error", "No se pudo leer la bóveda de la nube."); } } 
    else if (fileInput) { const lector = new FileReader(); lector.onload = function(e) { validarYEntrar(e.target.result, user, pass); }; lector.readAsText(fileInput); } 
    else { mostrarAlerta("Falta archivo", "Conecta con Google Drive o selecciona un archivo local."); }
}

async function validarYEntrar(jsonString, user, pass) {
    try {
        const datos = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString; const hashIntento = await hashSHA256(pass);
        if (datos.seguridad.usuario === user && (datos.seguridad.clave === pass || datos.seguridad.clave === hashIntento)) {
            misDatos = datos; if (misDatos.seguridad.clave === pass) { misDatos.seguridad.clave = hashIntento; }
            if (!misDatos.seguridad.perfil) misDatos.seguridad.perfil = { nombres: "" }; if (!misDatos.datos.metas) misDatos.datos.metas = []; if (!misDatos.datos.deudas) misDatos.datos.deudas = []; if (!misDatos.datos.recurrentes) misDatos.datos.recurrentes = []; if(!misDatos.datos.activos) misDatos.datos.activos = [];
            misDatos.datos.metas.forEach(m => { if(!m.estado) m.estado = 'activa'; if(!m.fechaCreacion) m.fechaCreacion = 'Desconocida'; if(!m.id) m.id = crypto.randomUUID(); });
            if (!misDatos.seguridad.historial_sesiones) { misDatos.seguridad.historial_sesiones = []; if(misDatos.seguridad.ultima_sesion) { misDatos.seguridad.historial_sesiones.push(misDatos.seguridad.ultima_sesion); } }
            const nowIso = new Date().toISOString(); misDatos.seguridad.historial_sesiones.unshift(nowIso); misDatos.seguridad.ultima_sesion = nowIso; 
            if(misDatos.seguridad.historial_sesiones.length > 5) { misDatos.seguridad.historial_sesiones = misDatos.seguridad.historial_sesiones.slice(0, 5); }
            if(driveFileId) localStorage.setItem('core_drive_id', driveFileId);
            guardarEnMemoriaSession();
            document.getElementById('last-session-trigger').textContent = "Última sesión: " + formatearFechaElegante(misDatos.seguridad.historial_sesiones[0]);
            document.getElementById('login-modal').style.display = 'none'; document.getElementById('app-container').style.display = 'block';
            procesarGastosRecurrentes(); limpiarFiltrosAvanzados(); popularSelectsAvanzados(); actualizarTodo(); renderizarDatosPerfil(); gestionarSaludoCamaleonico();
            const tab = localStorage.getItem('core_ultima_pestana') || 'vista-general'; const btn = document.querySelector(`.tab-btn[onclick*="${tab}"]`); if(btn) cambiarPestana(tab, btn); else cambiarPestana(tab, null);
        } else { mostrarAlerta("Acceso denegado", "Credenciales incorrectas."); }
    } catch (err) { mostrarAlerta("Error", "El archivo está dañado o no es válido."); }
}

function dispararAutoSync() {
    document.getElementById('sync-status').innerText = 'Guardando localmente...'; document.getElementById('sync-status').style.color = 'var(--deuda)';
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
        if (driveFileId && navigator.onLine) {
            document.getElementById('sync-status').innerText = 'Subiendo a la nube...';
            if (!gapi.client.getToken()) { document.getElementById('sync-status').innerText = 'Requiere Token API'; return; }
            const exito = await sincronizarNube();
            if(exito) { document.getElementById('sync-status').innerText = 'Sincronizado'; document.getElementById('sync-status').style.color = 'var(--text-muted)'; } 
            else { document.getElementById('sync-status').innerText = 'Error al subir'; document.getElementById('sync-status').style.color = 'var(--danger)'; }
        } else { document.getElementById('sync-status').innerText = 'Guardado local'; document.getElementById('sync-status').style.color = 'var(--text-muted)'; }
    }, 10000);
}

async function sincronizarNube() {
    if (!driveFileId) return false;
    const contenido = JSON.stringify(misDatos);
    try {
        const file = new Blob([contenido], {type: 'application/json'}); const metadata = { name: 'CORE_Vault.json', mimeType: 'application/json' }; const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' })); form.append('file', file);
        await fetch('https://www.googleapis.com/upload/drive/v3/files/' + driveFileId + '?uploadType=multipart', { method: 'PATCH', headers: { Authorization: 'Bearer ' + gapi.client.getToken().access_token }, body: form });
        return true;
    } catch (e) { return false; }
}

async function descargarRespaldo() {
    misDatos.seguridad.ultima_sesion = new Date().toISOString();
    if (driveFileId) {
        if (!gapi.client.getToken()) { tokenClient.callback = async (resp) => { if (resp.error) { mostrarAlerta("Error", "Conexión rechazada."); return; } await procederSincronizacion(); }; tokenClient.requestAccessToken({prompt: ''}); } 
        else { await procederSincronizacion(); }
    } else { descargarLocal(); }
}
async function procederSincronizacion() { const exito = await sincronizarNube(); if(exito) mostrarToast(); else mostrarAlerta("Error", "Fallo al sincronizar en la nube."); document.getElementById('last-session-trigger').textContent = "Última sesión: " + formatearFechaElegante(misDatos.seguridad.ultima_sesion); document.getElementById('sync-status').innerText = 'Sincronizado'; document.getElementById('sync-status').style.color = 'var(--text-muted)'; }
function descargarLocal() { const fecha = new Date().toISOString().split('T')[0]; const blob = new Blob([JSON.stringify(misDatos, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Boveda_${misDatos.seguridad.usuario}_${fecha}.json`; a.click(); mostrarToast(); document.getElementById('last-session-trigger').textContent = "Última sesión: " + formatearFechaElegante(misDatos.seguridad.ultima_sesion); }

function cerrarSesionApp() {
    solicitarConfirmacion("¿Deseas cerrar sesión?\n\nSe realizará un respaldo actualizado.", async function() {
        if (driveFileId && gapi.client.getToken()) await sincronizarNube(); else descargarLocal();
        localStorage.removeItem('tohka_boveda_data'); localStorage.removeItem('core_drive_id'); misDatos = null; driveFileId = null;
        document.getElementById('app-container').style.display = 'none'; document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('login-pass').value = ''; document.getElementById('login-file').value = ''; document.getElementById('login-file-name').innerText = 'Ningún archivo...'; document.getElementById('login-drive-status').innerText = 'Estado: Desconectado'; document.getElementById('login-drive-status').style.color = 'var(--text-muted)';
    }, "Sí, salir", "Cancelar", false);
}

function solicitarHardReset() {
    solicitarConfirmacion("ZONA DE PELIGRO\n\n¿Estás absolutamente seguro de querer borrar todo tu historial, metas y saldos? Esta acción es irreversible.", function() {
        misDatos.datos = { saldo_disponible: 0, ahorros_totales: 0, deudas_totales: 0, transacciones: [], metas: [], deudas: [], recurrentes: [], activos: [] };
        actualizarTodo(); mostrarToast();
    }, "Borrar TODO", "Cancelar", true);
}

function abrirModalCrearBoveda() { document.getElementById('new-boveda-user').value = ''; document.getElementById('new-boveda-pass').value = ''; document.getElementById('registro-boveda-modal').style.display = 'flex'; }
async function generarNuevaBoveda() {
    const user = document.getElementById('new-boveda-user').value.trim(); const pass = document.getElementById('new-boveda-pass').value.trim();
    if(!user || !pass) { mostrarAlerta("Atención", "Debes ingresar un usuario y contraseña."); return; }
    const hashPass = await hashSHA256(pass);
    const nuevaBoveda = { seguridad: { usuario: user, clave: hashPass, ultima_sesion: new Date().toISOString(), perfil: { nombres: "" } }, datos: { saldo_disponible: 0, ahorros_totales: 0, deudas_totales: 0, transacciones: [], metas: [], deudas: [], recurrentes: [], activos: [] } };
    const contenido = JSON.stringify(nuevaBoveda, null, 2);

    if (gapiInited && gisInited && gapi.client.getToken()) {
        try {
            const file = new Blob([contenido], {type: 'application/json'}); const metadata = { name: 'CORE_Vault.json', mimeType: 'application/json' }; const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' })); form.append('file', file);
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: 'Bearer ' + gapi.client.getToken().access_token }, body: form });
            const data = await response.json(); driveFileId = data.id; localStorage.setItem('core_drive_id', driveFileId);
            cerrarModal('registro-boveda-modal'); mostrarAlerta("¡Cuenta creada!", "Tu bóveda se guardó en Google Drive. Ingresa tus datos para acceder.");
        } catch (e) { mostrarAlerta("Error", "No se pudo crear en Google Drive."); }
    } else {
        const blob = new Blob([contenido], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Boveda_${user}_NUEVA.json`; a.click();
        cerrarModal('registro-boveda-modal'); mostrarAlerta("¡Cuenta creada!", "Se descargó el archivo. Utilízalo para iniciar carga manual.");
    }
}

function cambiarPestana(id, btn) { 
    ocultarToastUndo();
    localStorage.setItem('core_ultima_pestana', id);
    document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = null; }); 
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(btn && btn.classList.contains('tab-btn')) btn.classList.add('active'); 
    document.getElementById('botones-dashboard').style.display = (id === 'vista-general') ? 'flex' : 'none'; 
    cerrarDetalleInline(); 
}

function cambiarSubPestanaMovimientos(tipo, btn) {
    document.querySelectorAll('#movimientos .sub-tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    if(tipo === 'historial') { document.getElementById('contenedor-historial-tx').classList.remove('hidden'); document.getElementById('contenedor-pagos-recurrentes').classList.add('hidden'); } 
    else { document.getElementById('contenedor-historial-tx').classList.add('hidden'); document.getElementById('contenedor-pagos-recurrentes').classList.remove('hidden'); }
}

function clickBannerPatrimonio() { const btnMetas = document.querySelector('.tab-btn[onclick*="metas"]'); if(btnMetas) cambiarPestana('metas', btnMetas); }
function cambiarSubPestanaMetas(tipo, btn) { document.querySelectorAll('#metas .sub-tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); if(tipo === 'activas') { document.getElementById('contenedor-metas-activas').classList.remove('hidden'); document.getElementById('contenedor-metas-archivadas').classList.add('hidden'); } else { document.getElementById('contenedor-metas-activas').classList.add('hidden'); document.getElementById('contenedor-metas-archivadas').classList.remove('hidden'); } }
function cambiarSubPestanaDeudas(tipo, btn) { document.querySelectorAll('#pestana-deudas .sub-tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); if(tipo === 'activas') { document.getElementById('contenedor-deudas-activas').classList.remove('hidden'); document.getElementById('contenedor-deudas-pagadas').classList.add('hidden'); } else { document.getElementById('contenedor-deudas-activas').classList.add('hidden'); document.getElementById('contenedor-deudas-pagadas').classList.remove('hidden'); } }

function toggleDetalleInline(filtro, cardElement) {
    const container = document.getElementById('detalle-inline-container'); const tituloInline = document.getElementById('detalle-inline-titulo');
    if (tarjetaActiva === cardElement) { cerrarDetalleInline(); return; } if(tarjetaActiva) tarjetaActiva.classList.remove('active-detail'); cardElement.classList.add('active-detail'); tarjetaActiva = cardElement;
    const hoyIso = new Date().toISOString().split('T')[0]; let titulo = "", datos = [], colorTitulo = "var(--text-main)";
    if (filtro === 'saldo') { titulo = "Liquidez: Actividad de hoy"; colorTitulo = "var(--ingreso)"; datos = misDatos.datos.transacciones.filter(tx => tx.fechaIso === hoyIso && (tx.tipo === 'Ingreso' || tx.tipo === 'Egreso' || tx.tipo === 'Ahorro' || tx.tipo === 'Reverso' || tx.tipo === 'Deuda' || tx.tipo === 'PagoDeuda')); } 
    else if (filtro === 'egresos') { titulo = "Egresos: Actividad de hoy"; colorTitulo = "var(--egreso)"; datos = misDatos.datos.transacciones.filter(tx => tx.fechaIso === hoyIso && tx.tipo === 'Egreso'); } 
    else if (filtro === 'ahorros') { titulo = "Ahorros: Actividad de hoy"; colorTitulo = "var(--primary)"; datos = misDatos.datos.transacciones.filter(tx => tx.fechaIso === hoyIso && tx.tipo === 'Ahorro').map(tx => ({...tx, tipoVisual: 'Ahorro (+)'})); } 
    else if (filtro === 'deudas') { titulo = "Deudas: Actividad de hoy"; colorTitulo = "var(--deuda)"; datos = misDatos.datos.transacciones.filter(tx => tx.fechaIso === hoyIso && (tx.tipo === 'Deuda' || tx.tipo === 'PagoDeuda')); }
    tituloInline.innerText = titulo; tituloInline.style.color = colorTitulo; const tbody = document.getElementById('tabla-detalle-inline'); tbody.innerHTML = '';
    if(datos.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 20px;">No hay actividad registrada el día de hoy.</td></tr>'; } 
    else { datos.slice().reverse().forEach(tx => { let color = tx.tipo === 'Egreso' || tx.tipo === 'PagoDeuda' ? 'var(--egreso)' : (tx.tipo === 'Deuda' ? 'var(--deuda)' : 'var(--ingreso)'); if(tx.tipoVisual === 'Ahorro' || tx.esMeta || tx.tipo === 'Ahorro') color = 'var(--primary)'; if(tx.tipo === 'Reverso') color = 'var(--ingreso)'; let nTipo = tx.tipo; if(tx.tipo === 'Deuda') { nTipo = tx.esDeudaPasada ? 'Anterior' : 'Nueva'; } else if(tx.tipo === 'PagoDeuda') { nTipo = 'Pago deuda'; } else if(tx.tipo === 'Egreso' && tx.esGastoHormiga) { nTipo = 'Gasto H'; } tbody.innerHTML += `<tr><td>${tx.fecha}</td><td class="col-detalle">${escaparHTML(tx.detalle)}</td><td style="color: ${color}; font-weight: 600;">${tx.tipoVisual || nTipo}</td><td class="fin-align" style="font-weight: 600;">${fmtDinero(tx.monto)}</td><td class="fin-align" style="color: var(--text-muted); font-weight:600;">${fmtDinero(tx.saldo_historico || 0)}</td></tr>`; }); } container.classList.add('open');
}
function cerrarDetalleInline() { document.getElementById('detalle-inline-container').classList.remove('open'); if(tarjetaActiva) tarjetaActiva.classList.remove('active-detail'); tarjetaActiva = null; }

function analisisRitmoFinanciero() {
    if(!misDatos || !misDatos.datos.transacciones) return;
    const hoy = new Date(); const mesActual = hoy.getMonth() + 1; const anioActual = hoy.getFullYear(); const diaHoy = hoy.getDate();
    let ingActual = 0, egrActual = 0, egrAnterior = 0, diasBlancos = 0; let fechasConGasto = new Set();
    
    let mesAnt = mesActual - 1; let anioAnt = anioActual; if(mesAnt === 0) { mesAnt = 12; anioAnt--; }

    misDatos.datos.transacciones.forEach(tx => {
        if(tx.fechaIso) {
            const partes = tx.fechaIso.split('-'); const y = parseInt(partes[0]); const m = parseInt(partes[1]); const d = parseInt(partes[2]);
            if(y === anioActual && m === mesActual) {
                if(tx.tipo === 'Ingreso') ingActual += tx.monto;
                if(tx.tipo === 'Egreso' || tx.tipo === 'PagoDeuda') { egrActual += tx.monto; fechasConGasto.add(tx.fechaIso); }
            }
            if(y === anioAnt && m === mesAnt && d <= diaHoy) { if(tx.tipo === 'Egreso' || tx.tipo === 'PagoDeuda') egrAnterior += tx.monto; }
        }
    });

    for(let i=1; i<=diaHoy; i++) { const fechaCheck = `${anioActual}-${String(mesActual).padStart(2,'0')}-${String(i).padStart(2,'0')}`; if(!fechasConGasto.has(fechaCheck)) diasBlancos++; }
    
    const txtEl = document.getElementById('ritmo-financiero-txt'); let msg = "";
    if (diasBlancos > 0) msg += `Llevas ${diasBlancos} Día(s) Blanco(s) 🤍. `;
    if (egrActual === 0) { msg += "Aún no hay gastos este mes."; } 
    else if (egrAnterior > 0) { let dif = ((egrActual - egrAnterior) / egrAnterior) * 100; if(dif > 0) msg += `Ritmo acelerado: Gastaste ${dif.toFixed(1)}% más que el mes pasado a esta fecha ⚠️`; else msg += `Buen ritmo: Gastaste ${Math.abs(dif).toFixed(1)}% menos que el mes pasado a esta fecha 🟢`; } 
    else { msg += `Total salidas: $${egrActual.toFixed(2)}.`; }
    txtEl.innerText = msg;

    const categoriasGastos = {};
    misDatos.datos.transacciones.forEach(tx => { if(tx.tipo === 'Egreso' && tx.fechaIso) { const partes = tx.fechaIso.split('-'); if(parseInt(partes[0]) === anioActual && parseInt(partes[1]) === mesActual) { let cat = tx.categoria || 'Otros Gastos'; if(!categoriasGastos[cat]) categoriasGastos[cat] = 0; categoriasGastos[cat] += tx.monto; } } });
    document.getElementById('total-flujo').innerText = "$" + egrActual.toLocaleString('en-US', {maximumFractionDigits: 0});
    const leyendaContainer = document.getElementById('leyenda-gastos-container'); leyendaContainer.innerHTML = '';
    const colores = { 'Alimentación': '#f57c00', 'Transporte': '#0099a8', 'Servicios Básicos': '#ffd700', 'Vivienda': '#9b7bb3', 'Entretenimiento': '#e91e63', 'Salud': '#dc3545', 'Educación': '#36a420', 'Otros Gastos': '#b0b3b8' };
    const labels = []; const data = []; const bgColors = [];
    for (const cat in categoriasGastos) { labels.push(cat); data.push(categoriasGastos[cat]); bgColors.push(colores[cat] || '#b0b3b8'); const pct = egrActual > 0 ? (categoriasGastos[cat] / egrActual * 100).toFixed(1) : 0; leyendaContainer.innerHTML += `<div class="leyenda-item"><div class="leyenda-color-txt"><div class="color-dot" style="background: ${colores[cat] || '#b0b3b8'};"></div>${cat}</div><span>$${categoriasGastos[cat].toLocaleString('en-US', {minimumFractionDigits: 2})} (${pct}%)</span></div>`; }
    const ctx = document.getElementById('flujoChart').getContext('2d'); if (graficoCircular) graficoCircular.destroy();
    if(egrActual === 0) { leyendaContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size:12px;">No hay gastos.</div>'; graficoCircular = new Chart(ctx, { type: 'doughnut', data: { datasets: [{ data: [1], backgroundColor: ['#999999'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { tooltip: { enabled: false } }, animation: false } }); return; }
    graficoCircular = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 5 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { return ' $' + context.raw.toLocaleString('en-US', {minimumFractionDigits: 2}); } } } } } });
}

function procesarGastosRecurrentes() {
    const hoy = new Date(); const diaHoy = hoy.getDate(); const mesActual = hoy.getFullYear() + "-" + String(hoy.getMonth()+1).padStart(2,'0'); let procesados = 0;
    misDatos.datos.recurrentes.forEach(rec => {
        if (diaHoy >= rec.dia && rec.ultimo_mes_pagado !== mesActual) {
            if (misDatos.datos.saldo_disponible >= rec.monto) { misDatos.datos.saldo_disponible -= rec.monto; misDatos.datos.transacciones.push({ fecha: hoy.toLocaleDateString('es-ES'), fechaIso: hoy.toISOString().split('T')[0], timestamp: Date.now(), tipo: 'Egreso', detalle: `🔄 Automático: ${rec.nombre}`, monto: rec.monto, categoria: rec.categoria || 'Servicios Básicos', esGastoHormiga: false }); rec.ultimo_mes_pagado = mesActual; procesados++; } 
            else { mostrarAlerta("⚠️ Pago automático fallido", `Falta liquidez para: ${rec.nombre}.`); }
        }
    });
    if(procesados > 0) { mostrarToast(); guardarEnMemoriaSession(); }
}

function actualizarTodo() {
    calcularSaldosHistoricos(); let totalIngresos = 0; let totalEgresos = 0; let totalAhorros = 0; let totalDeudas = 0;
    misDatos.datos.deudas_totales = 0; if(misDatos.datos.deudas) { misDatos.datos.deudas.forEach(d => { if(d.estado === 'activa') misDatos.datos.deudas_totales += (d.monto_inicial - d.monto_pagado); }); }
    misDatos.datos.transacciones.forEach(tx => { if(tx.tipo === 'Ingreso' || (tx.tipo === 'Deuda' && !tx.esDeudaPasada)) totalIngresos += tx.monto; if(tx.tipo === 'Egreso' || tx.tipo === 'PagoDeuda') totalEgresos += tx.monto; if(tx.tipo === 'Ahorro') totalAhorros += tx.monto; if(tx.tipo === 'Reverso' || tx.tipo === 'UsoAhorro') totalAhorros -= tx.monto; });
    
    let patrimonioNeto = (misDatos.datos.saldo_disponible + misDatos.datos.ahorros_totales) - misDatos.datos.deudas_totales; 
    document.getElementById('dash-patrimonio-neto').innerText = "$" + patrimonioNeto.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    animarCifra('dash-saldo', misDatos.datos.saldo_disponible); animarCifra('dash-ahorros', misDatos.datos.ahorros_totales); animarCifra('dash-deudas', misDatos.datos.deudas_totales); animarCifra('dash-egresos', totalEgresos);
    let capTotal = misDatos.datos.saldo_disponible + misDatos.datos.ahorros_totales; let pctSaldo = capTotal > 0 ? (misDatos.datos.saldo_disponible / capTotal * 100) : 0; let pctAhorro = capTotal > 0 ? (misDatos.datos.ahorros_totales / capTotal * 100) : 0; let pctDeuda = capTotal > 0 ? (misDatos.datos.deudas_totales / capTotal * 100) : (misDatos.datos.deudas_totales > 0 ? '∞' : 0); let pctGasto = totalIngresos > 0 ? (totalEgresos / totalIngresos * 100) : (totalEgresos > 0 ? '∞' : 0);
    document.getElementById('dash-pct-saldo').innerText = pctSaldo !== '∞' ? `${pctSaldo.toFixed(1)}% de tu capital real` : '0% de tu capital real'; document.getElementById('dash-pct-ahorros').innerText = pctAhorro !== '∞' ? `${pctAhorro.toFixed(1)}% de tu capital real` : '0% de tu capital real';
    let deudaEl = document.getElementById('dash-pct-deudas'); if(pctDeuda === '∞' || pctDeuda > 100) { deudaEl.innerText = "¡Peligro! Deuda supera el capital"; deudaEl.style.color = "var(--egreso)"; } else { deudaEl.innerText = `Ratio de endeudamiento: ${pctDeuda.toFixed(1)}%`; if(pctDeuda > 40) deudaEl.style.color = "var(--egreso)"; else if(pctDeuda > 20) deudaEl.style.color = "var(--deuda)"; else deudaEl.style.color = "var(--ingreso)"; }
    let gastoEl = document.getElementById('dash-pct-egresos'); if(pctGasto === '∞') { gastoEl.innerText = "Gastos sin ingresos registrados"; gastoEl.style.color = "var(--egreso)"; } else { gastoEl.innerText = `Ratio de gasto: ${pctGasto.toFixed(1)}% de tus ingresos`; if(pctGasto > 80) gastoEl.style.color = "var(--egreso)"; else if(pctGasto > 50) gastoEl.style.color = "var(--deuda)"; else gastoEl.style.color = "var(--ingreso)"; }
    aplicarFiltrosAvanzados(); renderizarMetasUI(); renderizarDeudasUI(); analisisRitmoFinanciero(); renderizarListaRecurrentes();
    if(tarjetaActiva) { const tipoFiltro = tarjetaActiva.onclick.toString().match(/'(.*?)'/)[1]; toggleDetalleInline(tipoFiltro, tarjetaActiva); } guardarEnMemoriaSession();
}
function animarCifra(id, val) { document.getElementById(id).innerText = "$" + val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }

function abrirModalNuevaDeuda() { document.getElementById('nd-nombre').value = ''; document.getElementById('nd-monto').value = ''; document.getElementById('nd-es-pasada').checked = true; document.getElementById('modal-nueva-deuda').style.display = 'flex'; vibrar(15); }
function guardarNuevaDeuda() { const nombre = document.getElementById('nd-nombre').value.trim(); const monto = parseFloat(document.getElementById('nd-monto').value); const esPasada = document.getElementById('nd-es-pasada').checked; if(!nombre || isNaN(monto) || monto <= 0) { mostrarAlerta("Error", "Ingresa un nombre y un monto válido."); return; } const nuevaDeuda = { id: crypto.randomUUID(), nombre: nombre, monto_inicial: monto, monto_pagado: 0, estado: 'activa', fecha_registro: new Date().toLocaleDateString('es-ES') }; misDatos.datos.deudas.push(nuevaDeuda); const hoyIso = new Date().toISOString().split('T')[0]; if(!esPasada) { misDatos.datos.saldo_disponible += monto; } misDatos.datos.transacciones.push({ fecha: new Date().toLocaleDateString('es-ES'), fechaIso: hoyIso, timestamp: Date.now(), tipo: 'Deuda', detalle: `Adquisición Deuda: ${nombre}`, monto: monto, metaId: null, esDeudaPasada: esPasada }); actualizarTodo(); cerrarModal('modal-nueva-deuda'); mostrarToast(); vibrar(30); }
function renderizarDeudasUI() { const contActivas = document.getElementById('contenedor-deudas-activas'); const contPagadas = document.getElementById('contenedor-deudas-pagadas'); contActivas.innerHTML = ''; contPagadas.innerHTML = ''; let hayActivas = false, hayPagadas = false; misDatos.datos.deudas.forEach((d, i) => { const porcentaje = Math.min((d.monto_pagado / d.monto_inicial) * 100, 100); const esPagada = d.estado === 'pagada'; const badge = esPagada ? '<div class="badge-cumplida">¡LIQUIDADA!</div>' : ''; const cardClass = esPagada ? 'meta-card-compact archivada' : 'meta-card-compact'; const progresoColor = esPagada ? 'var(--ingreso)' : 'var(--deuda)'; const html = `<div class="${cardClass}" style="border-color: ${esPagada ? 'var(--border)' : 'transparent'};" onclick="abrirModalAbonoDeuda(${i})">${badge}<div class="meta-info" style="padding-top:5px;"><div style="color:var(--text-muted); font-size:10px; margin-bottom:5px;">${d.fecha_registro}</div><div class="meta-title" title="${escaparHTML(d.nombre)}">${escaparHTML(d.nombre)}</div><div style="font-size:18px; font-weight:bold; color:var(--text-main); margin-bottom:10px;">$${(d.monto_inicial - d.monto_pagado).toLocaleString('en-US', {minimumFractionDigits: 2})}</div><div class="barra-progreso-mini"><div class="progreso-fill-mini" style="width: ${porcentaje}%; background: ${progresoColor};"></div></div><div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between;"><span>Pagado: $${d.monto_pagado.toLocaleString('en-US')}</span><span style="font-weight:bold;">${porcentaje.toFixed(0)}%</span></div></div></div>`; if(esPagada) { contPagadas.innerHTML += html; hayPagadas = true; } else { contActivas.innerHTML += html; hayActivas = true; } }); if(!hayActivas) contActivas.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); margin-top:20px;">¡Felicidades! No tienes deudas pendientes.</p>'; if(!hayPagadas) contPagadas.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); margin-top:20px;">Aún no tienes deudas liquidadas.</p>'; }
function abrirModalAbonoDeuda(index) { indiceDeudaAbono = index; const deuda = misDatos.datos.deudas[index]; if(deuda.estado === 'pagada') { mostrarAlerta("Deuda Liquidada", "Esta obligación financiera ya fue pagada."); return; } document.getElementById('pd-titulo').innerText = `Abonar a ${deuda.nombre}`; document.getElementById('pd-saldo-pendiente').innerText = "$" + (deuda.monto_inicial - deuda.monto_pagado).toLocaleString('en-US', {minimumFractionDigits: 2}); document.getElementById('pd-monto').value = ''; document.getElementById('modal-pago-deuda').style.display = 'flex'; }
function procesarPagoDeuda() { const montoPago = parseFloat(document.getElementById('pd-monto').value); const deuda = misDatos.datos.deudas[indiceDeudaAbono]; const pendiente = deuda.monto_inicial - deuda.monto_pagado; if(isNaN(montoPago) || montoPago <= 0) { mostrarAlerta("Error", "Ingresa un monto válido mayor a cero."); return; } if(montoPago > pendiente) { mostrarAlerta("Error", `El monto máximo a pagar es de $${pendiente.toLocaleString('en-US', {minimumFractionDigits: 2})}`); return; } if(montoPago > misDatos.datos.saldo_disponible) { mostrarAlerta("Fondos insuficientes", "No tienes liquidez suficiente."); return; } misDatos.datos.saldo_disponible -= montoPago; deuda.monto_pagado += montoPago; if(deuda.monto_pagado >= deuda.monto_inicial) { deuda.estado = 'pagada'; vibrar([50, 100, 50]); } const hoyIso = new Date().toISOString().split('T')[0]; misDatos.datos.transacciones.push({ fecha: new Date().toLocaleDateString('es-ES'), fechaIso: hoyIso, timestamp: Date.now(), tipo: 'PagoDeuda', detalle: `Abono a deuda: ${deuda.nombre}`, monto: montoPago, metaId: null }); actualizarTodo(); cerrarModal('modal-pago-deuda'); mostrarToast(); if(deuda.estado === 'pagada') { cambiarSubPestanaDeudas('pagadas', document.querySelectorAll('#pestana-deudas .sub-tab-btn')[1]); } }

function abrirModalRecurrente() { document.getElementById('rec-nombre').value = ''; document.getElementById('rec-monto').value = ''; document.getElementById('rec-dia').value = ''; document.getElementById('modal-recurrente').style.display = 'flex'; vibrar(15); }
function guardarRecurrente() { const nom = document.getElementById('rec-nombre').value.trim(); const cat = document.getElementById('rec-categoria').value; const monto = parseFloat(document.getElementById('rec-monto').value); const dia = parseInt(document.getElementById('rec-dia').value); const proxMes = document.getElementById('rec-prox-mes').checked; if(!nom || isNaN(monto) || monto <= 0 || isNaN(dia) || dia < 1 || dia > 31) { mostrarAlerta("Error", "Completa todos los campos correctamente."); return; } const hoy = new Date(); const mesAct = hoy.getFullYear() + "-" + String(hoy.getMonth()+1).padStart(2,'0'); const uMes = proxMes ? mesAct : ""; misDatos.datos.recurrentes.push({ id: crypto.randomUUID(), nombre: nom, categoria: cat, monto: monto, dia: dia, ultimo_mes_pagado: uMes }); renderizarListaRecurrentes(); guardarEnMemoriaSession(); cerrarModal('modal-recurrente'); mostrarToast(); vibrar(30); }
function renderizarListaRecurrentes() { const lista = document.getElementById('lista-recurrentes'); lista.innerHTML = ''; if(!misDatos.datos.recurrentes || misDatos.datos.recurrentes.length === 0) { lista.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--text-muted); font-size:13px;">No hay pagos programados.</div>'; return; } misDatos.datos.recurrentes.forEach((r, i) => { lista.innerHTML += `<div class="rec-item"><div><div class="rec-titulo">${escaparHTML(r.nombre)} - $${r.monto.toLocaleString('en-US', {minimumFractionDigits: 2})}</div><div class="rec-detalle">${r.categoria} | Se cobra el día ${r.dia}</div></div><button class="btn-secondary btn-danger-text" style="padding: 5px 10px;" onclick="eliminarRecurrente(${i})">Borrar</button></div>`; }); }
function eliminarRecurrente(index) { misDatos.datos.recurrentes.splice(index, 1); renderizarListaRecurrentes(); guardarEnMemoriaSession(); }

function renderizarDatosPerfil() { const p = misDatos.seguridad.perfil; const nombreMostrar = p.nombres || misDatos.seguridad.usuario; document.getElementById('profile-name-display').textContent = nombreMostrar; }
function abrirModalPerfil() { const p = misDatos.seguridad.perfil; document.getElementById('perfil-usuario-readonly').value = misDatos.seguridad.usuario; document.getElementById('perfil-nombres').value = p.nombres; document.getElementById('perfil-modal').style.display = 'flex'; }
function guardarPerfil() { misDatos.seguridad.perfil = { nombres: document.getElementById('perfil-nombres').value }; renderizarDatosPerfil(); guardarEnMemoriaSession(); cerrarModal('perfil-modal'); mostrarToast(); gestionarSaludoCamaleonico(); }

function abrirModalRegistro() { document.getElementById('reg-tipo').value = 'Egreso'; document.getElementById('reg-subtipo').value = 'General'; document.getElementById('reg-detalle').value = ''; document.getElementById('reg-monto').value = ''; document.getElementById('reg-fecha').value = new Date().toISOString().split('T')[0]; verificarFormularioRegistro(); document.getElementById('registro-modal').style.display = 'flex'; vibrar(15); document.getElementById('reg-detalle').focus(); }

const ninjaDict = {
    'supermaxi': {tipo: 'Egreso', cat: 'Alimentación'}, 'tia': {tipo: 'Egreso', cat: 'Alimentación'}, 'almuerzo': {tipo: 'Egreso', cat: 'Alimentación'},
    'uber': {tipo: 'Egreso', cat: 'Transporte'}, 'bus': {tipo: 'Egreso', cat: 'Transporte'}, 'gasolina': {tipo: 'Egreso', cat: 'Transporte'},
    'luz': {tipo: 'Egreso', cat: 'Servicios Básicos'}, 'agua': {tipo: 'Egreso', cat: 'Servicios Básicos'}, 'internet': {tipo: 'Egreso', cat: 'Servicios Básicos'},
    'cine': {tipo: 'Egreso', cat: 'Entretenimiento'}, 'netflix': {tipo: 'Egreso', cat: 'Entretenimiento'}, 'spotify': {tipo: 'Egreso', cat: 'Entretenimiento'},
    'sueldo': {tipo: 'Ingreso', cat: null}, 'pago': {tipo: 'Ingreso', cat: null}, 'ahorro': {tipo: 'Ahorro', cat: null}
};
function ninjaInputListener() {
    const val = document.getElementById('reg-detalle').value.toLowerCase().trim();
    for (const key in ninjaDict) {
        if (val.includes(key)) {
            const data = ninjaDict[key];
            if(document.getElementById('reg-tipo').value !== data.tipo) {
                document.getElementById('reg-tipo').value = data.tipo; verificarFormularioRegistro();
            }
            if (data.tipo === 'Egreso' && data.cat) { document.getElementById('reg-categoria-gasto').value = data.cat; }
            break;
        }
    }
}

function verificarFormularioRegistro() { 
    const tipo = document.getElementById('reg-tipo').value; const isAhorro = tipo === 'Ahorro'; const hint = document.getElementById('label-detalle-hint'); 
    document.getElementById('detalle-container').classList.toggle('hidden', isAhorro); document.getElementById('subtipo-ahorro-container').classList.toggle('hidden', !isAhorro); 
    document.getElementById('caja-gasto-hormiga').classList.toggle('hidden', tipo !== 'Egreso'); document.getElementById('caja-categoria-egreso').classList.toggle('hidden', tipo !== 'Egreso');
    document.getElementById('reg-gasto-hormiga').checked = false; hint.innerText = '(Ej. Supermaxi, Uber, Sueldo)'; 
    if(isAhorro) verificarDestinoAhorro(); 
}

function verificarDestinoAhorro() { const subtipo = document.getElementById('reg-subtipo').value; const selectMetaContainer = document.getElementById('select-meta-container'); selectMetaContainer.classList.toggle('hidden', subtipo !== 'Meta'); if (subtipo === 'Meta') { const selectMeta = document.getElementById('reg-meta-id'); selectMeta.innerHTML = '<option value="">Selecciona una meta...</option>'; misDatos.datos.metas.forEach((m, index) => { if(m.estado === 'activa' && m.ahorrado < m.costo) { selectMeta.innerHTML += `<option value="${index}">${escaparHTML(m.nombre)} (Faltan $${(m.costo - m.ahorrado).toFixed(2)})</option>`; } }); } }

function guardarRegistroConUndo() {
    const tipo = document.getElementById('reg-tipo').value; const monto = parseFloat(document.getElementById('reg-monto').value); let detalle = document.getElementById('reg-detalle').value.trim(); const fechaInput = document.getElementById('reg-fecha').value; const esGastoHormiga = document.getElementById('reg-gasto-hormiga').checked; const categoriaGasto = document.getElementById('reg-categoria-gasto').value;
    if(isNaN(monto) || monto <= 0) { mostrarAlerta("Error", "Ingresa un monto numérico válido."); return; } if(!fechaInput) { mostrarAlerta("Error", "Selecciona la fecha."); return; } if(tipo !== 'Ahorro' && !detalle) { mostrarAlerta("Error", "Debes ingresar un detalle."); return; } if(['Egreso', 'Ahorro', 'PagoDeuda'].includes(tipo)) { if(monto > misDatos.datos.saldo_disponible) { mostrarAlerta("Fondos insuficientes", "No tienes suficiente liquidez."); return; } }
    
    const fechaObj = new Date(fechaInput + "T12:00:00"); let metaId = null;
    if (tipo === 'Ingreso') { misDatos.datos.saldo_disponible += monto; } 
    else if (tipo === 'Egreso') { misDatos.datos.saldo_disponible -= monto; } 
    else if (tipo === 'Ahorro') { const subtipo = document.getElementById('reg-subtipo').value; if(subtipo === 'Meta') { metaId = document.getElementById('reg-meta-id').value; if(metaId === "") { mostrarAlerta("Error", "Selecciona la meta."); return; } let metaSeleccionada = misDatos.datos.metas[metaId]; let faltante = metaSeleccionada.costo - metaSeleccionada.ahorrado; if (monto > faltante) { mostrarAlerta("Límite excedido", `Solo te faltan $${faltante.toLocaleString('en-US', {minimumFractionDigits: 2})}`); return; } misDatos.datos.saldo_disponible -= monto; misDatos.datos.ahorros_totales += monto; misDatos.datos.metas[metaId].ahorrado += monto; detalle = `Ahorro a meta: ${misDatos.datos.metas[metaId].nombre}`; } else { misDatos.datos.saldo_disponible -= monto; misDatos.datos.ahorros_totales += monto; detalle = "Ahorro general"; } }
    
    const nuevoTx = { fecha: fechaObj.toLocaleDateString('es-ES'), fechaIso: fechaInput, timestamp: Date.now(), tipo: tipo, detalle: detalle, monto: monto, metaId: metaId, esGastoHormiga: (tipo === 'Egreso' ? esGastoHormiga : false), categoria: (tipo === 'Egreso' ? categoriaGasto : null) };
    misDatos.datos.transacciones.push(nuevoTx); ultimoRegistroGuardado = nuevoTx;
    
    popularSelectsAvanzados(); actualizarTodo(); cerrarModal('registro-modal'); 
    mostrarToastUndo(); vibrar(30);
}

function abrirModalMeta() { document.getElementById('meta-nombre').value = ''; document.getElementById('meta-costo').value = ''; document.getElementById('meta-ahorrado').value = ''; document.getElementById('meta-descripcion').value = ''; document.getElementById('meta-modal').style.display = 'flex'; vibrar(15); }
function guardarMeta() { const nom = document.getElementById('meta-nombre').value; const cos = parseFloat(document.getElementById('meta-costo').value); const aho = parseFloat(document.getElementById('meta-ahorrado').value) || 0; const desc = document.getElementById('meta-descripcion').value; if(!nom || isNaN(cos) || cos<=0) { mostrarAlerta("Error", "Ingresa un detalle y costo."); return; } if(aho > cos) { mostrarAlerta("Error", "Ahorro inicial mayor al costo."); return; } if(aho > 0 && aho > misDatos.datos.saldo_disponible) { mostrarAlerta("Fondos insuficientes", "No tienes liquidez."); return; } misDatos.datos.metas.push({ nombre: nom, costo: cos, ahorrado: aho, descripcion: desc, estado: 'activa', id: crypto.randomUUID(), fechaCreacion: new Date().toLocaleDateString('es-ES') }); const metaId = misDatos.datos.metas.length - 1; if(aho > 0) { misDatos.datos.saldo_disponible -= aho; misDatos.datos.ahorros_totales += aho; const hoyIso = new Date().toISOString().split('T')[0]; misDatos.datos.transacciones.push({ fecha: new Date().toLocaleDateString('es-ES'), fechaIso: hoyIso, timestamp: Date.now(), tipo: 'Ahorro', detalle: `Ahorro inicial a meta: ${nom}`, monto: aho, metaId: metaId }); } popularSelectsAvanzados(); actualizarTodo(); cerrarModal('meta-modal'); mostrarToast(); vibrar(30); }
function renderizarMetasUI() { const contActivas = document.getElementById('contenedor-metas-activas'); const contArchivadas = document.getElementById('contenedor-metas-archivadas'); contActivas.innerHTML = ''; contArchivadas.innerHTML = ''; let hayActivas = false, hayArchivadas = false; misDatos.datos.metas.forEach((m, i) => { if(m.estado === 'eliminada') return; const porcentaje = Math.min((m.ahorrado / m.costo) * 100, 100); const esCumplida = porcentaje >= 100; const esArchivada = m.estado === 'archivada'; const badge = esArchivada ? '<div class="badge-archivada">ARCHIVADA</div>' : (esCumplida ? '<div class="badge-cumplida">¡META CUMPLIDA!</div>' : ''); const html = `<div class="meta-card-compact ${esCumplida ? 'cumplida' : ''} ${esArchivada ? 'archivada' : ''}" onclick="abrirDetalleMeta(${i})">${badge}<div class="meta-img-box"><img src="icon-192.png" alt="Meta"></div><div class="meta-info"><div class="meta-title" title="${escaparHTML(m.nombre)}">${escaparHTML(m.nombre)}</div><div class="barra-progreso-mini"><div class="progreso-fill-mini" style="width: ${porcentaje}%;"></div></div><div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between;"><span>$${m.ahorrado.toLocaleString('en-US')}</span><span style="font-weight:bold;">${porcentaje.toFixed(0)}%</span></div></div></div>`; if(esArchivada) { contArchivadas.innerHTML += html; hayArchivadas = true; } else { contActivas.innerHTML += html; hayActivas = true; } }); if(!hayActivas) contActivas.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); margin-top:20px;">No tienes objetivos activos.</p>'; if(!hayArchivadas) contArchivadas.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); margin-top:20px;">Aún no tienes objetivos archivados.</p>'; }
function abrirDetalleMeta(index) { indiceMetaActualVista = index; const m = misDatos.datos.metas[index]; const porcentaje = Math.min((m.ahorrado / m.costo) * 100, 100); document.getElementById('md-info-principal').classList.remove('hidden'); document.getElementById('md-historial-seccion').classList.add('hidden'); document.getElementById('md-titulo').innerText = m.nombre; document.getElementById('md-fecha-creacion').innerText = "Creado el: " + (m.fechaCreacion || 'Desconocida'); document.getElementById('md-desc').innerText = m.descripcion || "Sin descripción."; document.getElementById('md-ahorrado').innerText = "$" + m.ahorrado.toLocaleString('en-US', {minimumFractionDigits: 2}); document.getElementById('md-costo').innerText = "$" + m.costo.toLocaleString('en-US', {minimumFractionDigits: 2}); document.getElementById('md-barra').style.width = porcentaje + "%"; const badge = document.getElementById('md-badge'); const btnArchivar = document.getElementById('btn-archivar-meta'); badge.classList.add('hidden'); btnArchivar.classList.add('hidden'); if (m.estado === 'archivada') { document.getElementById('md-porcentaje').innerText = "META ARCHIVADA EN HISTORIAL"; document.getElementById('md-porcentaje').style.color = "var(--text-muted)"; document.getElementById('md-barra').style.background = "var(--text-muted)"; } else if (porcentaje >= 100) { document.getElementById('md-porcentaje').innerText = "100% - ¡OBJETIVO CUMPLIDO!"; document.getElementById('md-porcentaje').style.color = "var(--ingreso)"; document.getElementById('md-barra').style.background = "var(--ingreso)"; badge.classList.remove('hidden'); btnArchivar.classList.remove('hidden'); vibrar([50, 100, 50]); } else { document.getElementById('md-porcentaje').innerText = porcentaje.toFixed(1) + "% COMPLETADO"; document.getElementById('md-porcentaje').style.color = "var(--text-muted)"; document.getElementById('md-barra').style.background = "var(--primary)"; } document.getElementById('meta-detalle-modal').style.display = 'flex'; }
function archivarMetaActual() { const m = misDatos.datos.metas[indiceMetaActualVista]; solicitarConfirmacion(`¡Felicidades por alcanzar "${m.nombre}"!\n\nSe registrará la compra y los $${m.ahorrado.toLocaleString('en-US')} se descontarán de tus ahorros.`, function() { m.estado = 'archivada'; misDatos.datos.ahorros_totales -= m.ahorrado; misDatos.datos.transacciones.push({ fecha: new Date().toLocaleDateString('es-ES'), fechaIso: new Date().toISOString().split('T')[0], timestamp: Date.now(), tipo: 'Egreso', detalle: `Liquidación de meta: ${m.nombre}`, monto: m.ahorrado, metaId: null, categoria: 'Otros Gastos' }); actualizarTodo(); cerrarModal('meta-detalle-modal'); cambiarSubPestanaMetas('archivadas', document.querySelectorAll('#metas .sub-tab-btn')[1]); mostrarToast(); }, "Registrar compra", "Cancelar", false); }
function eliminarMetaActual() { const m = misDatos.datos.metas[indiceMetaActualVista]; solicitarConfirmacion(`¿Deseas eliminar definitivamente la meta "${m.nombre}"?\n\nEl dinero que tenías ahorrado ($${m.ahorrado.toLocaleString('en-US', {minimumFractionDigits: 2})}) regresará a tu liquidez total.`, function() { const montoReverso = m.ahorrado; misDatos.datos.saldo_disponible += montoReverso; misDatos.datos.ahorros_totales -= montoReverso; if (montoReverso > 0) { const hoy = new Date(); misDatos.datos.transacciones.push({ fecha: hoy.toLocaleDateString('es-ES'), fechaIso: hoy.toISOString().split('T')[0], timestamp: Date.now(), tipo: 'Reverso', detalle: `Reverso de fondos: meta eliminada (${m.nombre})`, monto: montoReverso, metaId: null }); } m.ahorrado = 0; m.estado = 'eliminada'; popularSelectsAvanzados(); actualizarTodo(); cerrarModal('meta-detalle-modal'); mostrarToast(); }); }
function toggleHistorialMeta() { const info = document.getElementById('md-info-principal'); const hist = document.getElementById('md-historial-seccion'); if(hist.classList.contains('hidden')) { info.classList.add('hidden'); hist.classList.remove('hidden'); const container = document.getElementById('md-historial-container'); container.innerHTML = ''; const txMeta = misDatos.datos.transacciones.filter(tx => tx.tipo === 'Ahorro' && tx.metaId == indiceMetaActualVista); if(txMeta.length === 0) { container.innerHTML = '<p style="color:gray; padding:10px 0; text-align:center; font-size:13px;">No hay depósitos registrados.</p>'; } else { txMeta.slice().reverse().forEach(tx => { container.innerHTML += `<div class="historial-item"><span class="historial-fecha">${tx.fecha}</span><div class="fin-align" style="color: var(--primary); font-weight: bold;">+${fmtDinero(tx.monto)}</div></div>`; }); } } else { hist.classList.add('hidden'); info.classList.remove('hidden'); } }

function popularSelectsAvanzados() { const selectAhorro = document.getElementById('filtro-ahorro-select'); selectAhorro.innerHTML = '<option value="Todos">Todos los ahorros</option><option value="General">Ahorro general</option>'; if(misDatos && misDatos.datos.metas) { misDatos.datos.metas.forEach((m, index) => { if(m.estado === 'activa' || m.estado === 'archivada') selectAhorro.innerHTML += `<option value="${index}">Meta: ${escaparHTML(m.nombre)}</option>`; else if(m.estado === 'eliminada') selectAhorro.innerHTML += `<option value="${index}">Meta: ${escaparHTML(m.nombre)} (Eliminada)</option>`; }); } const selectDeuda = document.getElementById('filtro-deuda-select'); selectDeuda.innerHTML = '<option value="Todas">Todas las deudas</option>'; if(misDatos && misDatos.datos.transacciones) { const deudas = misDatos.datos.transacciones.filter(tx => tx.tipo === 'Deuda'); const etiquetas = [...new Set(deudas.map(tx => tx.detalle.trim()))]; etiquetas.forEach(et => { selectDeuda.innerHTML += `<option value="${escaparHTML(et)}">${escaparHTML(et)}</option>`; }); } }
function verificarSubfiltrosMovimientos() { const tipo = document.getElementById('filtro-tipo').value; const fila = document.getElementById('fila-subfiltros'); const cajaAhorro = document.getElementById('caja-filtro-ahorro'); const cajaDeuda = document.getElementById('caja-filtro-deuda'); fila.classList.add('hidden'); cajaAhorro.classList.add('hidden'); cajaDeuda.classList.add('hidden'); if(tipo === 'Ahorro') { fila.classList.remove('hidden'); cajaAhorro.classList.remove('hidden'); } if(tipo === 'Deuda') { fila.classList.remove('hidden'); cajaDeuda.classList.remove('hidden'); } }
function aplicarFiltrosAvanzados() { let filtrados = misDatos.datos.transacciones.slice(); const inicio = document.getElementById('filtro-inicio').value; const fin = document.getElementById('filtro-fin').value; const tipo = document.getElementById('filtro-tipo').value; if(inicio) filtrados = filtrados.filter(tx => tx.fechaIso >= inicio); if(fin) filtrados = filtrados.filter(tx => tx.fechaIso <= fin); if(tipo !== 'Todos') { if(tipo === 'Reverso') { filtrados = filtrados.filter(tx => tx.tipo === 'Reverso'); } else if(tipo === 'UsoAhorro') { filtrados = filtrados.filter(tx => tx.tipo === 'UsoAhorro'); } else if(tipo === 'Deuda') { filtrados = filtrados.filter(tx => tx.tipo === 'Deuda' || tx.tipo === 'PagoDeuda'); const subDeuda = document.getElementById('filtro-deuda-select').value; if(subDeuda !== 'Todas') filtrados = filtrados.filter(tx => tx.detalle.trim() === subDeuda); } else { filtrados = filtrados.filter(tx => tx.tipo === tipo); if (tipo === 'Ahorro') { const subAho = document.getElementById('filtro-ahorro-select').value; if(subAho === 'General') { filtrados = filtrados.filter(tx => tx.metaId === null || tx.metaId === undefined); } else if (subAho !== 'Todos') { filtrados = filtrados.filter(tx => tx.metaId == subAho); } } } } const tbody = document.getElementById('tabla-movimientos'); tbody.innerHTML = ''; if(filtrados.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No se encontraron movimientos.</td></tr>'; return; } filtrados.slice().reverse().forEach(tx => { let color = tx.tipo === 'Egreso' || tx.tipo === 'PagoDeuda' ? 'var(--egreso)' : (tx.tipo === 'Deuda' ? 'var(--deuda)' : 'var(--ingreso)'); let nombreTipo = tx.tipo; if(tx.tipo === 'Ahorro' && tx.metaId != null) { nombreTipo = 'Ahorro a meta'; } else if(tx.tipo === 'Deuda') { nombreTipo = tx.esDeudaPasada ? 'Anterior' : 'Nueva'; } else if(tx.tipo === 'PagoDeuda') { nombreTipo = 'Pago deuda'; } else if(tx.tipo === 'Egreso') { nombreTipo = tx.esGastoHormiga ? 'Gasto H' : (tx.categoria || 'Egreso'); } if(tx.tipo === 'Ahorro') color = 'var(--primary)'; if(tx.tipo === 'Reverso') color = 'var(--ingreso)'; if(tx.tipo === 'UsoAhorro') { color = 'var(--text-muted)'; nombreTipo = 'Uso de ahorros'; } tbody.innerHTML += `<tr><td>${tx.fecha}</td><td style="color:${color}; font-weight:600;">${nombreTipo}</td><td class="col-detalle">${escaparHTML(tx.detalle)}</td><td class="fin-align" style="font-weight:600;">${fmtDinero(tx.monto)}</td><td class="fin-align" style="color: var(--text-muted); font-weight:600;">${fmtDinero(tx.saldo_historico || 0)}</td></tr>`; }); }
function limpiarFiltrosAvanzados() { document.getElementById('filtro-inicio').value = ''; document.getElementById('filtro-fin').value = ''; document.getElementById('filtro-tipo').value = 'Todos'; document.getElementById('filtro-ahorro-select').value = 'Todos'; document.getElementById('filtro-deuda-select').value = 'Todas'; verificarSubfiltrosMovimientos(); aplicarFiltrosAvanzados(); }

function exportarCSV() { const fechaHoy = new Date().toLocaleDateString('es-ES'); let csv = `"HISTORIAL FINANCIERO - Generado el ${fechaHoy}"\n`; csv += "Fecha,Tipo de movimiento,Detalle / Descripción,Monto ($), Saldo post-movimiento ($)\n"; misDatos.datos.transacciones.forEach(tx => { csv += `"${tx.fecha}","${tx.tipo}","${escaparHTML(tx.detalle).replace(/"/g, '""')}","${tx.monto.toFixed(2)}","${(tx.saldo_historico || 0).toFixed(2)}"\n`; }); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Historial_Financiero_${new Date().toISOString().split('T')[0]}.csv`; a.click(); }

function exportarPDFEjecutivo() {
    const isDark = document.documentElement.classList.contains('dark-mode');
    if(isDark) document.documentElement.classList.remove('dark-mode');
    const stealthBefore = document.body.classList.contains('stealth-active');
    document.body.classList.remove('stealth-active');
    
    const element = document.querySelector('.tab-content.active');
    const opt = {
        margin:       10,
        filename:     `Reporte_CORE_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save().then(() => {
        if(isDark) document.documentElement.classList.add('dark-mode');
        if(stealthBefore) document.body.classList.add('stealth-active');
    });
}

if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').then(reg => console.log('SW registrado')).catch(err => console.log('Error SW')); }); }

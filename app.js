const GAS_URL = 'TU_URL_DE_WEB_APP_AQUI'; 

let db = JSON.parse(localStorage.getItem('tohka_db')) || { schedule: {}, vault: [] };
let currentDate = new Date();
let showHours = false;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.hidden = true);
        
        const target = e.currentTarget;
        target.classList.add('active');
        document.getElementById(target.dataset.target).hidden = false;
        document.getElementById('app-title').textContent = target.dataset.target === 'tab-schedule' ? 'Tohka Schedule' : 'Tohka Bóveda';
    });
});

const syncStatus = document.getElementById('sync-status');

async function syncWithDrive() {
    if (GAS_URL === 'TU_URL_DE_WEB_APP_AQUI') return;
    try {
        syncStatus.textContent = '🔄 Sincronizando...';
        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(db),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        syncStatus.textContent = '🟢 Online (Sincronizado)';
    } catch (e) {
        syncStatus.textContent = '🟡 Offline (Guardado local)';
    }
}

function saveData() {
    localStorage.setItem('tohka_db', JSON.stringify(db));
    renderAll();
    syncWithDrive();
}

function getMonthTarget(year, month) {
    let daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        let dayOfWeek = new Date(year, month, i).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
    }
    return workingDays * 8;
}

function updateDashboard() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('month-name').textContent = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    
    const targetHours = getMonthTarget(year, month);
    let actualHours = 0;

    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    for (const [date, record] of Object.entries(db.schedule)) {
        if (date.startsWith(monthPrefix) && record.type === 'shift') {
            actualHours += parseFloat(record.totalHours);
        }
    }

    document.getElementById('month-target').textContent = `${targetHours}h`;
    document.getElementById('month-actual').textContent = `${actualHours.toFixed(1)}h`;
    
    const MAX_BONUS = 123.48;
    const progressPercent = Math.min((actualHours / targetHours), 1);
    const estimatedBonus = progressPercent * MAX_BONUS;
    
    document.getElementById('month-bonus').textContent = `$${estimatedBonus.toFixed(2)}`;
    document.getElementById('month-progress').value = progressPercent * 100;
}

function renderWeek() {
    const grid = document.getElementById('week-grid');
    grid.innerHTML = '';
    const date = new Date(currentDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    document.getElementById('current-week-label').textContent = `${monday.getDate()}/${monday.getMonth()+1} - ${sunday.getDate()}/${sunday.getMonth()+1}`;

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateKey = d.toISOString().split('T')[0];
        const record = db.schedule[dateKey];

        const div = document.createElement('div');
        div.className = 'card-item';
        div.onclick = () => openModal(dateKey, days[i]);
        
        let contentHtml = '<small style="opacity:0.5">Sin registro</small>';
        if (record) {
            if (record.type === 'note') contentHtml = '📝 Nota';
            else contentHtml = showHours ? `⏱ ${record.totalHours}h` : `${record.start} - ${record.end} ${record.hasBreak ? '☕' : ''}`;
        }

        div.innerHTML = `<div><strong>${days[i]}</strong> <small>${d.getDate()}</small></div><div>${contentHtml}</div>`;
        grid.appendChild(div);
    }
}

document.getElementById('prev-week').onclick = () => { currentDate.setDate(currentDate.getDate() - 7); renderAll(); };
document.getElementById('next-week').onclick = () => { currentDate.setDate(currentDate.getDate() + 7); renderAll(); };
document.getElementById('toggle-view').onclick = (e) => { 
    showHours = !showHours; 
    e.target.textContent = showHours ? 'Ver: Horario' : 'Ver: Horas';
    renderWeek(); 
};

const modal = document.getElementById('entry-modal');
const typeSelect = document.getElementById('entry-type');

function openModal(dateKey, dayName) {
    document.getElementById('modal-date-title').textContent = `${dayName} (${dateKey})`;
    document.getElementById('entry-date').value = dateKey;
    const rec = db.schedule[dateKey];
    
    if (rec) {
        typeSelect.value = rec.type;
        if (rec.type === 'shift') {
            document.getElementById('time-start').value = rec.start;
            document.getElementById('time-end').value = rec.end;
            document.getElementById('has-break').checked = rec.hasBreak;
        } else {
            document.getElementById('note-text').value = rec.noteText;
        }
        document.getElementById('btn-delete').hidden = false;
    } else {
        document.getElementById('entry-form').reset();
        typeSelect.value = 'shift';
        document.getElementById('btn-delete').hidden = true;
    }
    typeSelect.dispatchEvent(new Event('change'));
    modal.hidden = false;
}

typeSelect.onchange = (e) => {
    const isShift = e.target.value === 'shift';
    document.getElementById('shift-fields').hidden = !isShift;
    document.getElementById('note-fields').hidden = isShift;
};

document.getElementById('btn-cancel').onclick = () => modal.hidden = true;
document.getElementById('btn-delete').onclick = () => {
    delete db.schedule[document.getElementById('entry-date').value];
    modal.hidden = true; saveData();
};

document.getElementById('entry-form').onsubmit = (e) => {
    e.preventDefault();
    const dateKey = document.getElementById('entry-date').value;
    const type = typeSelect.value;
    if (type === 'shift') {
        const start = document.getElementById('time-start').value;
        const end = document.getElementById('time-end').value;
        const hasBreak = document.getElementById('has-break').checked;
        const [hS, mS] = start.split(':').map(Number);
        const [hE, mE] = end.split(':').map(Number);
        let diff = (hE + mE/60) - (hS + mS/60);
        if (diff < 0) diff += 24;
        if (hasBreak) diff = Math.max(0, diff - 1);
        db.schedule[dateKey] = { type, start, end, hasBreak, totalHours: diff.toFixed(2) };
    } else {
        db.schedule[dateKey] = { type, noteText: document.getElementById('note-text').value };
    }
    modal.hidden = true; saveData();
};

document.getElementById('vault-form').onsubmit = (e) => {
    e.preventDefault();
    db.vault.push({
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: document.getElementById('v-type').value,
        amount: parseFloat(document.getElementById('v-amount').value),
        concept: document.getElementById('v-concept').value
    });
    document.getElementById('vault-form').reset();
    saveData();
};

function renderVault() {
    const list = document.getElementById('vault-list');
    list.innerHTML = '';
    let total = 0;
    
    [...db.vault].reverse().forEach(tx => {
        const isIngreso = tx.type === 'ingreso';
        total += isIngreso ? tx.amount : -tx.amount;
        
        const div = document.createElement('div');
        div.className = 'card-item vault-item';
        div.innerHTML = `
            <div><strong>${tx.concept}</strong> <br><small>${tx.date}</small></div>
            <strong class="${isIngreso ? 'text-success' : 'text-danger'}">
                ${isIngreso ? '+' : '-'}$${tx.amount.toFixed(2)}
            </strong>
        `;
        div.ondblclick = () => {
            if(confirm('¿Borrar este registro?')) {
                db.vault = db.vault.filter(v => v.id !== tx.id);
                saveData();
            }
        };
        list.appendChild(div);
    });
    
    document.getElementById('vault-balance').textContent = `$${total.toFixed(2)}`;
}

function renderAll() {
    updateDashboard();
    renderWeek();
    renderVault();
}

renderAll();

if(GAS_URL !== 'TU_URL_DE_WEB_APP_AQUI') {
    fetch(GAS_URL)
        .then(res => res.json())
        .then(remoteData => {
            if(remoteData && (remoteData.schedule || remoteData.vault)) {
                db = remoteData;
                saveData();
            }
        }).catch(err => console.log('Sin red para carga inicial'));
}

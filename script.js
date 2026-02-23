let rawData = [];
let displayedData = [];
let allStations = [];
const datePicker = document.getElementById('datePicker');
const dateDisplay = document.getElementById('dateDisplay');
const listDiv = document.getElementById('rainList');
const searchInput = document.getElementById('citySearch');
const btnNext = document.getElementById('nextBtn');

// Como deve ficar:
let today = new Date();
// Ajuste para pegar a data local no formato YYYY-MM-DD sem erro de fuso
let localDate = today.toLocaleDateString('sv-SE'); 

datePicker.value = localDate;
datePicker.max = localDate;
datePicker.max = datePicker.value;

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function removeAccents(str) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, "") : "";
}

function formatDisplay(isoDate) {
    const parts = isoDate.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

async function ensureAllStations() {
    if (allStations.length > 0) return;
    try {
        const d = new Date();
        const fim = d.toISOString().split('T')[0];
        d.setDate(d.getDate() - 45);
        const inicio = d.toISOString().split('T')[0];
        const r = await fetch(`https://seira.aesa.pb.gov.br/api/dados-precipitacao?dataInicio=${inicio}&dataFim=${fim}`);
        const data = await r.json();

        const unique = {};
        data.forEach(i => {
            const key = `${i.municipio}-${i.posto}`;
            if (!unique[key]) unique[key] = { municipio: i.municipio, posto: i.posto, cod_estacao: i.cod_estacao };
        });
        allStations = Object.values(unique);
    } catch (e) { console.error("Erro ao carregar lista mestra", e); }
}

async function loadMeteorology() {
    listDiv.innerHTML = '<div class="empty-view"><i class="fas fa-circle-notch fa-spin"></i></div>';
    await ensureAllStations();

    const dateValue = datePicker.value;

    try {
        const r = await fetch(`https://seira.aesa.pb.gov.br/api/dados-precipitacao?dataInicio=${dateValue}&dataFim=${dateValue}`);
        const data = await r.json();

        const dataMap = {};
        data.forEach(item => {
            const key = `${item.municipio}-${item.posto}`;
            dataMap[key] = item.data[dateValue];
        });

        const dayData = allStations.map(station => {
            const key = `${station.municipio}-${station.posto}`;
            const val = dataMap[key];
            const numericVal = (val === undefined || val === null || val === "") ? null : parseFloat(val);
            return { ...station, total: numericVal };
        }).sort((a, b) => {
            if (a.total === null && b.total !== null) return 1;
            if (a.total !== null && b.total === null) return -1;
            if (a.total === null && b.total === null) return 0;
            if (a.total > 0 || b.total > 0) {
                if (b.total !== a.total) return b.total - a.total;
            }
            return a.municipio.localeCompare(b.municipio);
        });

        let rank = 1;
        dayData.forEach(item => {
            if (item.total !== null) {
                item.rank = rank++;
            } else {
                item.rank = "-";
            }
        });

        const informed = dayData.filter(x => x.total !== null);
        updateStats(informed.length, informed.filter(x => x.total > 0).length);

        displayedData = [...dayData];
        applySearchFilter();
        dateDisplay.innerText = formatDisplay(datePicker.value);
        btnNext.disabled = (datePicker.value === datePicker.max);

    } catch (e) {
        listDiv.innerHTML = '<div class="empty-view">Erro de conexão.</div>';
    }
}

function updateStats(obs, rain) {
    document.getElementById('countObs').innerText = obs;
    document.getElementById('countRain').innerText = rain;
}

function render(list) {
    if (list.length === 0) {
        listDiv.innerHTML = '<div class="empty-view">Nada encontrado.</div>';
        return;
    }
    listDiv.innerHTML = list.map((item, index) => {
        const isWaiting = item.total === null;
        const valText = isWaiting ? "AGUARDANDO" : item.total.toFixed(1);
        const unitText = isWaiting ? "" : '<span class="rain-unit">mm</span>';

        return `
        <div class="rain-card" data-index="${index}" style="${isWaiting ? 'border-left-color:#cbd5e1; opacity:0.8;' : ''}">
            <div class="rank-badge">${item.rank}</div>
            <div class="city-meta">
                <h3>${item.municipio.toUpperCase()}</h3>
                <span>${item.posto}</span>
            </div>
            <div class="rain-data">
                <div class="rain-value" style="${isWaiting ? 'font-size:0.65rem; color:#64748b;' : ''}">${valText}${unitText}</div>
                <i class="fas ${isWaiting ? 'fa-clock' : (item.total > 0 ? 'fa-droplet' : 'fa-droplet-slash')} icon-drop" 
                   style="opacity:${(item.total > 0 && !isWaiting) ? '1' : '0.2'}"></i>
            </div>
        </div>
    `}).join('');

    document.querySelectorAll('.rain-card').forEach(card => {
        card.onclick = () => {
            const idx = parseInt(card.getAttribute('data-index'));
            openMonthlyCalendar(displayedData.indexOf(list[idx]));
        };
    });
}

function applySearchFilter() {
    const t = removeAccents(searchInput.value.toLowerCase());
    const filtered = displayedData.filter(i => {
        const muni = removeAccents(i.municipio.toLowerCase());
        const posto = removeAccents(i.posto.toLowerCase());
        return muni.startsWith(t) || posto.startsWith(t);
    });
    render(filtered);
}

searchInput.oninput = applySearchFilter;

// --- Lógica do Modal e Calendário Corrigida ---

let selectedStation = null;
let selectedMonth = new Date();

function openMonthlyCalendar(index) {
    selectedStation = displayedData[index];
    // Sempre abre no mês da data que está selecionada no datePicker do topo
    selectedMonth = new Date(datePicker.value + 'T12:00:00');
    document.getElementById('chartModal').style.display = 'flex';
    loadMonthlyCalendar();
}

async function loadMonthlyCalendar() {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const now = new Date();

    // Bloqueia botão de próximo se estivermos no mês atual ou futuro
    const nextMonthBtn = document.getElementById('nextMonth');
    if (year >= now.getFullYear() && month >= now.getMonth()) {
        nextMonthBtn.disabled = true;
        nextMonthBtn.style.opacity = "0.3";
        nextMonthBtn.style.cursor = "not-allowed";
    } else {
        nextMonthBtn.disabled = false;
        nextMonthBtn.style.opacity = "1";
        nextMonthBtn.style.cursor = "pointer";
    }

    const first = new Date(year, month, 1).toISOString().split('T')[0];
    const last = new Date(year, month + 1, 0).toISOString().split('T')[0];

    // Limpa calendário antes de carregar
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '<div style="grid-column: span 7; text-align:center; padding:20px; color:#0f172a;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const r = await fetch(`https://seira.aesa.pb.gov.br/api/dados-precipitacao?dataInicio=${first}&dataFim=${last}`);
        const data = await r.json();

        const stationData = data.filter(x => x.municipio === selectedStation.municipio && x.posto === selectedStation.posto);
        const dailyData = {};

        stationData.forEach(s => {
            Object.entries(s.data).forEach(([date, val]) => {
                if (val !== "" && val !== null) dailyData[date] = parseFloat(val);
            });
        });

        const dailyValues = Object.values(dailyData);
        const total = dailyValues.reduce((a, b) => a + b, 0);
        const days = dailyValues.filter(x => x > 0).length;
        const max = Math.max(...dailyValues, 0);

        document.getElementById('monthTotal').innerText = total.toFixed(1) + 'mm';
        document.getElementById('monthDays').innerText = days;
        document.getElementById('monthMax').innerText = max.toFixed(1) + 'mm';

        const titleText = (selectedStation.municipio === selectedStation.posto) ?
            `${selectedStation.municipio}\n${monthNames[month]} - ${year}` :
            `${selectedStation.municipio} / ${selectedStation.posto}\n${monthNames[month]} - ${year}`;
        document.getElementById('chartTitle').innerText = titleText;

        grid.innerHTML = "";
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            const div = document.createElement('div');
            div.className = "calendar-day rain-empty";
            grid.appendChild(div);
        }

        for (let d = 1; d <= lastDate; d++) {
            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const val = dailyData[iso];
            const div = document.createElement('div');
            div.className = "calendar-day";
            
            // Opacidade reduzida para dias futuros dentro do mês atual
            if (year === now.getFullYear() && month === now.getMonth() && d > now.getDate()) {
                div.style.opacity = "0.3";
            }

            div.innerHTML = `<span class="day-number">${d}</span>`;
            const valSpan = document.createElement('span');
            valSpan.className = "rain-value-day";

            if (val === undefined) {
                div.classList.add('rain-empty');
            } else if (val === 0) {
                div.classList.add('rain-gray');
                valSpan.innerText = "0";
            } else {
                div.classList.add('rain-green');
                valSpan.innerText = val.toFixed(1);
            }
            div.appendChild(valSpan);
            grid.appendChild(div);
        }
    } catch (e) {
        grid.innerHTML = '<div style="grid-column: span 7; text-align:center; color:red; font-size:0.7rem;">Erro ao carregar dados.</div>';
    }
}

document.getElementById('prevMonth').onclick = () => {
    selectedMonth.setMonth(selectedMonth.getMonth() - 1);
    loadMonthlyCalendar();
};

document.getElementById('nextMonth').onclick = () => {
    const now = new Date();
    // Só avança se o mês selecionado for anterior ao mês atual
    if (selectedMonth.getFullYear() < now.getFullYear() || selectedMonth.getMonth() < now.getMonth()) {
        selectedMonth.setMonth(selectedMonth.getMonth() + 1);
        loadMonthlyCalendar();
    }
};

function closeModal() { document.getElementById('chartModal').style.display = 'none'; }
document.getElementById('dateClicker').onclick = () => { if (datePicker.showPicker) datePicker.showPicker(); };
datePicker.onchange = loadMeteorology;

document.getElementById('prevBtn').onclick = e => {
    let d = new Date(datePicker.value + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    datePicker.value = d.toISOString().split('T')[0];
    loadMeteorology();
};

document.getElementById('nextBtn').onclick = e => {
    let d = new Date(datePicker.value + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    datePicker.value = d.toISOString().split('T')[0];
    loadMeteorology();
};


loadMeteorology();

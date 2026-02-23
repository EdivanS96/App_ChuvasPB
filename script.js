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

// MELHORIA: Data com "Hoje", "Ontem" ou "Dia da Semana"
function formatDisplay(isoDate) {
    const parts = isoDate.split('-');
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    
    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);

    const dateCompare = new Date(dateObj);
    dateCompare.setHours(0, 0, 0, 0);

    let label = "";
    if (dateCompare.getTime() === todayObj.getTime()) {
        label = "Hoje\n";
    } else if (dateCompare.getTime() === yesterdayObj.getTime()) {
        const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        label = dias[dateCompare.getDay()] + "\n";
    } else {
        const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        label = dias[dateCompare.getDay()] + "\n";
    }

    return `${label}${parts[2]}/${parts[1]}/${parts[0]}`;
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
    const noRain = obs - rain;

    document.getElementById('countObs').innerText = obs;
    document.getElementById('countRain').innerText = rain;
    document.getElementById('countNoRain').innerText = noRain;
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

// MELHORIA: Controle do botão "X" de apagar busca
// Localize a parte da busca e garanta que está assim:
const clearBtn = document.getElementById('clearSearch');
searchInput.oninput = () => {
    // Se tiver texto, mostra o X, senão esconde
    if (clearBtn) clearBtn.style.display = searchInput.value.length > 0 ? 'block' : 'none';
    applySearchFilter();
};

if (clearBtn) {
    clearBtn.onclick = () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        applySearchFilter();
        searchInput.focus();
    };
}

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

// Abrir Sobre
document.getElementById('aboutBtn').onclick = () => {
    document.getElementById('aboutModal').style.display = 'flex';
};

// MELHORIA: Gerar Boletim e Compartilhar com API Nativa
document.getElementById('shareBtn').onclick = async () => {
    const informed = displayedData.filter(x => x.total !== null);
    const withRain = informed.filter(x => x.total > 0).sort((a, b) => b.total - a.total);
    const topList = withRain.slice(0, 10);

    if (informed.length === 0) return alert("Sem dados para compartilhar.");

    // Data formatada (Ex: SEGUNDA - 23/02/2026)
    const dateParts = datePicker.value.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const diasSemana = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    document.getElementById('share-date').innerText = `${diasSemana[dateObj.getDay()]} - ${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    // Atualiza Stats (Tudo em cor escura)
    document.getElementById('share-stat-obs').innerText = informed.length;
    document.getElementById('share-stat-rain').innerText = withRain.length;
    document.getElementById('share-stat-no-rain').innerText = informed.length - withRain.length;
    
    const shareList = document.getElementById('share-list');
    const titleElem = document.getElementById('share-list-title');

    if (withRain.length > 0) {
        titleElem.innerText = topList.length >= 10 ? "TOP 10 MAIORES CHUVAS" : "TOP MAIORES CHUVAS";
        shareList.style.justifyContent = "flex-start";
        
        // Cards Individuais com borda lateral azul e valor em PRETO
        shareList.innerHTML = topList.map((item, i) => `
            <div style="background: white; border-radius: 12px; padding: 10px 15px; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid #0ea5e9; box-shadow: 0 3px 8px rgba(0,0,0,0.05); margin-bottom: 2px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="min-width: 28px; height: 28px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: #1e3a8a;">
                        ${i + 1}
                    </div>
                    <div style="line-height: 1.2;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: #0f172a;">${item.municipio.toUpperCase()}</div>
                        <div style="font-size: 0.65rem; color: #64748b; font-weight: 500;">${item.posto}</div>
                    </div>
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem; font-weight: 800; color: #0f172a;">${item.total.toFixed(1)}<small style="font-size: 0.6rem; color: #94a3b8; margin-left: 2px;">mm</small></span>
                    <i class="fas fa-droplet" style="color: #0ea5e9; font-size: 0.9rem;"></i>
                </div>
            </div>
        `).join('');
    } else {
        // Esquema do Sol e Mensagem de Sem Chuva
        titleElem.innerText = "MONITORAMENTO DIÁRIO";
        shareList.style.justifyContent = "center";
        shareList.innerHTML = `
            <div style="text-align: center; padding: 40px 10px; background: rgba(255,255,255,0.2); border-radius: 20px; border: 1.5px dashed rgba(30, 58, 138, 0.2);">
                <i class="fas fa-cloud-sun" style="font-size: 4.5rem; color: #1e3a8a; margin-bottom: 15px; opacity: 0.8;"></i>
                <div style="font-size: 1.2rem; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Sem registros de chuva</div>
                <p style="font-size: 0.85rem; color: #0f172a; margin-top: 5px; font-weight: 500;">Não houve precipitação nos postos monitorados nesta data.</p>
            </div>
        `;
    }

    // FRASE DE ELABORAÇÃO COM CONDIÇÃO DE MÊS ATUAL
    const now = new Date();
    const isThisMonth = (dateObj.getMonth() === now.getMonth() && dateObj.getFullYear() === now.getFullYear());
    const timeStr = now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const dateStr = now.toLocaleDateString('pt-BR');
    
    document.getElementById('share-meta').innerText = isThisMonth 
        ? `Dados Parciais | Elaboração: ${timeStr} - ${dateStr}`
        : `Elaboração: ${timeStr} - ${dateStr}`;

    // Captura com quinas transparentes para as bordas arredondadas funcionarem na foto
    const card = document.getElementById('share-card');
    const canvas = await html2canvas(card, { 
        scale: 3, 
        useCORS: true, 
        backgroundColor: null 
    });
    
    canvas.toBlob(async (blob) => {
        const file = new File([blob], 'boletim-chuvas-pb.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file] });
        } else {
            const link = document.createElement('a');
            link.download = `boletim-${datePicker.value}.png`;
            link.href = canvas.toDataURL();
            link.click();
        }
    }, 'image/png');
};



// Botão de atualizar/direita
document.getElementById('refreshBtn').onclick = () => {
    loadMeteorology(); 
};

// Botão de calendário/esquerda
document.getElementById('openCalendarBtn').onclick = (e) => {
    e.stopPropagation();
    const today = new Date();
    const localDate = today.toLocaleDateString('sv-SE');
    datePicker.value = localDate;
    loadMeteorology();
};


document.getElementById('shareMonthBtn').onclick = async () => {
    if (!selectedStation) return alert("Selecione uma estação primeiro.");

    const month = selectedMonth.getMonth();
    const year = selectedMonth.getFullYear();
    const monthName = monthNames[month];
    const now = new Date();
    const isThisMonth = (month === now.getMonth() && year === now.getFullYear());
    const timeStr = now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const dateStr = now.toLocaleDateString('pt-BR');

    // 1. CONTAINER PRINCIPAL
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.width = '460px';
    // GRADIENTE IDENTICO AO SITE: ESCURO EMBAIXO, CLARO EM CIMA
    container.style.background = 'linear-gradient(0deg, #e0f2fe 0%, #f0f9ff 100%)'; 
    container.style.padding = '20px';
    container.style.fontFamily = "'Poppins', sans-serif";
    container.style.borderRadius = '25px';

    // 2. CONTEÚDO HTML
    container.innerHTML = `
        <div style="text-align: center; margin-bottom: 12px;">
            <img src="https://lh3.googleusercontent.com/d/1Mjxa_GOQjMLlLCXZhu8YtoM4ZLq2fFQ8" style="width: 100px; margin-bottom: 5px;">
            <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; color: #0f172a; margin: 0;">INFORMAÇÕES MENSAIS DE CHUVA</p>
            <div style="font-size: 1.1rem; font-weight: 800; color: #1e3a8a; text-transform: uppercase; line-height: 1.2; margin-top: 5px;">
                ${selectedStation.municipio} <br>
                <span style="font-size: 0.8rem; font-weight: 600; color: #475569;">POSTO: ${selectedStation.posto}</span>
            </div>
            <div style="margin-top: 8px; font-size: 1.1rem; font-weight: 800; color: #000;">${monthName.toUpperCase()} - ${year}</div>
        </div>

        <div style="background: white; border-radius: 18px; padding: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: 800; font-size: 0.75rem; color: #000; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 5px;">
                <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
                ${document.getElementById('calendarGrid').innerHTML}
            </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 15px;">
            <div style="flex: 1; background: rgba(255,255,255,0.6); padding: 10px; border-radius: 14px; text-align: center; border: 1px solid rgba(255,255,255,0.8);">
                <span style="font-size: 0.55rem; display: block; font-weight: 700; text-transform: uppercase; color: #64748b;">Acumulado</span>
                <strong style="font-size: 1.1rem; color: #0f172a;">${document.getElementById('monthTotal').innerText}</strong>
            </div>
            <div style="flex: 1; background: rgba(255,255,255,0.6); padding: 10px; border-radius: 14px; text-align: center; border: 1px solid rgba(255,255,255,0.8);">
                <span style="font-size: 0.55rem; display: block; font-weight: 700; text-transform: uppercase; color: #64748b;">N° de Dias</span>
                <strong style="font-size: 1.1rem; color: #0f172a;">${document.getElementById('monthDays').innerText}</strong>
            </div>
            <div style="flex: 1; background: rgba(255,255,255,0.6); padding: 10px; border-radius: 14px; text-align: center; border: 1px solid rgba(255,255,255,0.8);">
                <span style="font-size: 0.55rem; display: block; font-weight: 700; text-transform: uppercase; color: #64748b;">Maior Dia</span>
                <strong style="font-size: 1.1rem; color: #0f172a;">${document.getElementById('monthMax').innerText}</strong>
            </div>
        </div>

        <div style="margin-top: 15px; text-align: center; font-size: 0.65rem; color: #0f172a; font-weight: 600;">
            <p style="margin: 0;">${isThisMonth ? `DADOS PARCIAIS | Elaboração: ${timeStr} - ${dateStr}` : `Elaboração: ${timeStr} - ${dateStr}`}</p>
            <p style="opacity: 0.7; font-size: 0.6rem; margin-top: 2px;">FONTE DOS DADOS: PORTAL SEIRA - AESA-PB</p>
        </div>
    `;

    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: 3,
            useCORS: true,
            backgroundColor: null
        });

        document.body.removeChild(container);

        canvas.toBlob(async (blob) => {
            const file = new File([blob], `chuvas-mensal-${selectedStation.municipio}.png`, { type: 'image/png' });
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
            } else {
                const link = document.createElement('a');
                link.download = `boletim-mensal-${monthName}.png`;
                link.href = canvas.toDataURL();
                link.click();
            }
        }, 'image/png');
    } catch (err) {
        alert("Erro ao gerar imagem.");
        if(container.parentNode) document.body.removeChild(container);
    }
};
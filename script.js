/* ═══════════════════════════════════════════════════════
   PAINEL — script.js
   SPA com navegação interna entre: Home → Pré-Atendimento / Atendimentos
═══════════════════════════════════════════════════════ */

// ── WEBHOOKS ────────────────────────────────────────
const WH = {
    preLoad: 'https://n8n.srv1352561.hstgr.cloud/webhook/carregaprotpre',
    preUpdate: 'https://n8n.srv1352561.hstgr.cloud/webhook/atualizapre',
    atendLoad: 'https://n8n.srv1352561.hstgr.cloud/webhook/carregaprotocolo',
    atendUpdate: 'https://n8n.srv1352561.hstgr.cloud/webhook/atualizaatendimento',
};

// ── FERIADOS / DIAS BLOQUEADOS ──────────────────────
const FERIADOS = [
    '2026-01-01', '2026-04-21', '2026-04-23', '2026-04-24',
    '2026-05-01', '2026-06-04', '2026-06-05', '2026-09-07',
    '2026-10-12', '2026-11-02', '2026-11-13', '2026-11-20', '2026-12-25',
];
const DIAS_BLOQUEADOS = [0, 3, 6]; // Dom, Qua, Sáb

// ── UTILITÁRIOS DE DATA ─────────────────────────────
function toISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isDiaUtil(d) {
    return !DIAS_BLOQUEADOS.includes(d.getDay()) && !FERIADOS.includes(toISO(d));
}

function proximoDiaUtil(base = new Date()) {
    const d = new Date(base);
    do { d.setDate(d.getDate() + 1); } while (!isDiaUtil(d));
    return d;
}

function addDiasUteis(base, n) {
    const d = new Date(base);
    let c = 0;
    while (c < n) { d.setDate(d.getDate() + 1); if (isDiaUtil(d)) c++; }
    return d;
}

// ── FEEDBACK ────────────────────────────────────────
function showFeedback(el, msg, type = 'success') {
    el.textContent = msg;
    el.className = `feedback ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

// ════════════════════════════════════════════════════
// SPA — NAVEGAÇÃO
// ════════════════════════════════════════════════════
const views = document.querySelectorAll('.view');
const btnBack = document.getElementById('btnBack');

function navigate(targetId) {
    views.forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
        v.style.opacity = '0';
    });

    const next = document.getElementById(targetId);
    if (!next) return;

    next.style.display = 'flex';
    // force reflow para a transição funcionar
    void next.offsetWidth;
    next.classList.add('active');
    next.style.opacity = '1';

    const isHome = targetId === 'viewHome';
    document.body.classList.toggle('sub-active', !isHome);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Carrega dados ao entrar na sub-view
    if (targetId === 'viewPre') initPre();
    if (targetId === 'viewAtend') initAtend();
}

// botões de card (apenas os que têm data-target)
document.querySelectorAll('.card-btn[data-target]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.target));
});

btnBack.addEventListener('click', () => navigate('viewHome'));

// ════════════════════════════════════════════════════
// PRÉ-ATENDIMENTO
// ════════════════════════════════════════════════════
const preForm = document.getElementById('formPre');
const preDataEl = document.getElementById('preData');
const preSelectEl = document.getElementById('preProtocolo');
const preRespEl = document.getElementById('preResposta');
const preStatusEl = document.getElementById('preStatus');
const preFeedback = document.getElementById('statusPre');

let preInited = false;

function configurarCalendarioPre() {
    let hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataInicial = isDiaUtil(hoje) ? hoje : proximoDiaUtil(hoje);
    const maxDate = addDiasUteis(hoje, 5);

    preDataEl.min = toISO(dataInicial);
    preDataEl.max = toISO(maxDate);
    preDataEl.value = toISO(dataInicial);
}

async function carregarListaPre() {
    const dataSel = preDataEl.value;
    if (!dataSel) return;

    preSelectEl.innerHTML = '<option value="">Carregando...</option>';

    try {
        const res = await fetch(WH.preLoad, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataSel }),
            cache: 'no-store',
        });
        if (!res.ok) throw new Error();
        const data = await res.json();

        preSelectEl.innerHTML = '<option value="">Selecione um atendimento</option>';
        (data.slots || []).forEach(item => {
            const o = document.createElement('option');
            o.value = item.value;
            o.textContent = item.label;
            preSelectEl.appendChild(o);
        });
    } catch {
        preSelectEl.innerHTML = '<option value="">Nenhum atendimento disponível</option>';
    }
}

function initPre() {
    if (preInited) return;
    preInited = true;

    configurarCalendarioPre();
    carregarListaPre();

    preDataEl.addEventListener('input', () => {
        let d = new Date(preDataEl.value + 'T00:00:00');
        if (!isDiaUtil(d)) {
            alert('Não há atendimento nesse dia. Escolha outro dia útil.');
            d = proximoDiaUtil(d);
            preDataEl.value = toISO(d);
        }
        carregarListaPre();
    });

    preForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const protocolo = preSelectEl.value;
        const status = preStatusEl.value;
        const resposta = preRespEl.value;

        if (!protocolo || !status) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        try {
            const res = await fetch(WH.preUpdate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocolo, status, resposta }),
            });
            if (!res.ok) throw new Error();

            showFeedback(preFeedback, '✅ Status atualizado com sucesso!', 'success');
            preForm.reset();
            configurarCalendarioPre();
            preInited = false; // permite recarregar na próxima entrada
            carregarListaPre();
            preInited = true;
        } catch {
            showFeedback(preFeedback, '❌ Erro ao atualizar. Tente novamente.', 'error');
        }
    });
}

// ════════════════════════════════════════════════════
// ATENDIMENTOS
// ════════════════════════════════════════════════════
const atendForm = document.getElementById('formAtend');
const atendSelectEl = document.getElementById('atendProtocolo');
const atendRespEl = document.getElementById('atendResposta');
const atendStatusEl = document.getElementById('atendStatus');
const atendFeedback = document.getElementById('statusAtend');

let atendInited = false;
let listaAtend = [];

async function carregarListaAtend() {
    try {
        const res = await fetch(WH.atendLoad);
        const data = await res.json();

        listaAtend = data.slots || [];

        atendSelectEl.innerHTML = '<option value="">Selecione um atendimento</option>';
        listaAtend.forEach(item => {
            const o = document.createElement('option');
            o.value = String(item.value);
            o.textContent = item.label;
            atendSelectEl.appendChild(o);
        });
    } catch {
        atendSelectEl.innerHTML = '<option value="">Não há atendimentos disponíveis</option>';
    }
}

function initAtend() {
    if (atendInited) return;
    atendInited = true;

    carregarListaAtend();

    atendSelectEl.addEventListener('change', () => {
        const found = listaAtend.find(i => String(i.value) === String(atendSelectEl.value));
        atendRespEl.value = found ? (found.resposta || '') : '';
    });

    atendForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const protocolo = atendSelectEl.value;
        const status = atendStatusEl.value;

        if (!protocolo || !status) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        try {
            const res = await fetch(WH.atendUpdate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocolo, status }),
            });
            if (!res.ok) throw new Error();

            showFeedback(atendFeedback, '✅ Atendimento atualizado com sucesso!', 'success');
            atendForm.reset();
            atendRespEl.value = '';
            atendInited = false;
            await carregarListaAtend();
            atendInited = true;
        } catch {
            showFeedback(atendFeedback, '❌ Erro ao atualizar. Tente novamente.', 'error');
        }
    });
}

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
navigate('viewHome');

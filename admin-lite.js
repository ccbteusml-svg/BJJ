// ==========================================
// 4L ACADEMY — ADMIN LITE v3.0 (Refatorado)
// - Namespace AppAdmin (isola variáveis globais)
// - Realtime parcial (atualiza só o array afetado)
// - btn-tactile nos botões dinâmicos
// NOTA: Remova do servidor: admin-core.js, admin-alunos.js, admin-financeiro.js
// ==========================================

const AppAdmin = {
    alunos: [],
    mensalidades: [],
    avisos: [],
    filtroAluno: 'todos',
    alunoSelecionado: null,
    abaDossie: 'perfil',
    dadosCarregados: false,
    manutencaoAtiva: false,
    secaoAtual: 'dashboard',
    adminId: null,
    adminNome: '',
    alunosSelecionados: new Set(),
    modoGerarIndividual: null,
    modoSelecao: false,
    rtTimeout: null
};
window.AppAdmin = AppAdmin;

const $ = (id) => document.getElementById(id);

// ===== Helpers de mês (formato "Setembro/2026") =====
const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function mesAtualStr() {
    const d = new Date();
    return MESES_NOMES[d.getMonth()] + '/' + d.getFullYear();
}
// Converte "Setembro/2026" em número comparável (ano*12 + mes)
function parseMesNum(mes) {
    if (!mes) return -1;
    const partes = String(mes).split('/');
    if (partes.length !== 2) return -1;
    const mi = MESES_NOMES.findIndex(n => n.toLowerCase() === partes[0].trim().toLowerCase());
    const ano = parseInt(partes[1], 10);
    if (mi < 0 || isNaN(ano)) return -1;
    return ano * 12 + mi;
}
// Mensalidade pendente e VENCIDA (mês anterior ao atual)
function isVencida(m) {
    if (m.status !== 'pendente') return false;
    const n = parseMesNum(m.mes);
    return n >= 0 && n < parseMesNum(mesAtualStr());
}

const toast = (msg, tipo = 'success') => {
    const el = $('adm-toast');
    const msgEl = $('adm-toast-msg');
    if (!el || !msgEl) return;
    msgEl.textContent = msg;
    el.className = `adm-toast ${tipo} show`;
    setTimeout(() => el.classList.remove('show'), 2800);
};

const loading = (msg) => {
    Swal.fire({ title: msg, background: '#0a0a0c', color: '#fff', showConfirmButton: false, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
};

// ✅ Trava anti double-submit para ações do admin (evita insert/update duplicado
// quando o professor toca duas vezes seguidas no botão)
const _acoesEmAndamento = new Set();
const travarAcao = (nome) => {
    if (_acoesEmAndamento.has(nome)) return false;
    _acoesEmAndamento.add(nome);
    return true;
};
const destravarAcao = (nome) => _acoesEmAndamento.delete(nome);

const corFaixa = (nome) => {
    const t = (nome || 'Branca').toLowerCase();
    if (t.includes('branca')) return '#f5f5f5';
    if (t.includes('cinza')) return '#9e9e9e';
    if (t.includes('amarela')) return '#ffeb3b';
    if (t.includes('laranja')) return '#ff9800';
    if (t.includes('verde')) return '#4caf50';
    if (t.includes('azul')) return '#2196f3';
    if (t.includes('roxa')) return '#9c27b0';
    if (t.includes('marrom')) return '#795548';
    if (t.includes('preta')) return '#424242';
    if (t.includes('coral')) return '#ef5350';
    if (t.includes('vermelha')) return '#f44336';
    return '#E53935';
};

const nomeFaixaLimpo = (nome) => {
    let f = (nome || 'Branca').toLowerCase().split('/')[0].split('-')[0].trim().replace(/faixa/i, '').trim();
    f = f.charAt(0).toUpperCase() + f.slice(1);
    return f || 'Branca';
};

const formatCurrency = (v) => 'R$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR');

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = (str) => {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
}

// ========== VALIDAÇÃO ==========
const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validarTelefone = (tel) => /^\(?(?:[1-9]{2})\)?(?:[2-8]|9[1-9])[0-9]{3}\-?[0-9]{4}$/.test(String(tel).replace(/\D/g,''));
const validarSenha = (senha) => typeof senha === 'string' && senha.length >= 6;
const validarNome = (nome) => typeof nome === 'string' && nome.trim().length >= 2;
const validarData = (data) => !!data && !isNaN(new Date(data).getTime());
const validarValor = (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0;

async function verificarAdmin() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) { window.location.replace('index.html'); return; }
        // ✅ maybeSingle: .single() lançava exceção não tratada se o perfil não existisse
        const { data: perfil, error: erroPerfil } = await supabase.from('perfis').select('cargo, nome').eq('id', session.user.id).maybeSingle();
        if (erroPerfil) {
            console.error('[ADMIN] Erro ao verificar cargo:', erroPerfil);
            toast('Erro ao verificar permissões', 'error');
            return;
        }
        if (!perfil || perfil.cargo !== 'professor') { window.location.replace('painel.html'); return; }
        AppAdmin.adminId = session.user.id;
        AppAdmin.adminNome = perfil.nome || 'Admin';
        if (!AppAdmin.dadosCarregados) await carregarTudo();
    } catch (e) {
        console.error('[ADMIN] Exceção em verificarAdmin:', e);
    }
}


// ========== AUDITORIA ==========
// Registra uma acao do admin no banco (fire-and-forget: nunca trava a UI)
function registrarLog(acao, detalhes, alvoId, alvoNome) {
    try {
        supabase.from('audit_log').insert([{
            admin_id: AppAdmin.adminId,
            admin_nome: AppAdmin.adminNome || 'Admin',
            acao: acao,
            detalhes: detalhes || '',
            alvo_id: alvoId || null,
            alvo_nome: alvoNome || null
        }]).then(({ error }) => { if (error) console.warn('[AUDIT] Falha ao registrar:', error.message); });
    } catch (e) { console.warn('[AUDIT]', e); }
}

const AUDIT_ROTULOS = {
    cadastrar_aluno:  { txt: 'Cadastro de aluno',  cor: '#22c55e' },
    editar_aluno:     { txt: 'Edicao de aluno',    cor: '#3b82f6' },
    inativar_aluno:   { txt: 'Aluno inativado',    cor: '#9e9e9e' },
    reativar_aluno:   { txt: 'Aluno reativado',    cor: '#22c55e' },
    remover_vip:      { txt: 'VIP removido',       cor: '#eab308' },
    excluir_aluno:    { txt: 'Aluno excluido',     cor: '#ef4444' },
    baixa_mensalidade:{ txt: 'Pagamento (baixa)',  cor: '#22c55e' },
    excluir_mensalidade: { txt: 'Cobranca excluida', cor: '#ef4444' },
    gerar_cobrancas:  { txt: 'Cobrancas geradas',  cor: '#8b5cf6' },
    publicar_aviso:   { txt: 'Aviso publicado',    cor: '#3b82f6' },
    excluir_aviso:    { txt: 'Aviso excluido',     cor: '#ef4444' },
    modo_manutencao:  { txt: 'Modo manutencao',    cor: '#f97316' }
};

async function renderAuditoria() {
    const lista = $('lista-auditoria');
    if (!lista) return;
    lista.innerHTML = '<div style="text-align:center;color:#71717a;padding:24px;">Carregando...</div>';
    const filtro = ($('aud-filtro') && $('aud-filtro').value) || 'todos';
    let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    if (filtro !== 'todos') q = q.eq('acao', filtro);
    const { data, error } = await q;
    if (error) {
        lista.innerHTML = '<div style="text-align:center;color:#ef4444;padding:24px;">Erro ao carregar: ' + escapeHtml(error.message) + '</div>';
        return;
    }
    if (!data || data.length === 0) {
        lista.innerHTML = '<div style="text-align:center;color:#71717a;padding:24px;">Nenhum registro ainda.<br>As acoes do admin passam a aparecer aqui.</div>';
        return;
    }
    lista.innerHTML = '';
    for (const log of data) {
        const r = AUDIT_ROTULOS[log.acao] || { txt: log.acao, cor: '#71717a' };
        const dt = new Date(log.created_at);
        const dtFmt = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const linha = document.createElement('div');
        linha.className = 'aud-linha';
        linha.innerHTML =
            '<div class="aud-topo">' +
                '<span class="aud-badge" style="background:' + r.cor + '22;color:' + r.cor + ';border:1px solid ' + r.cor + '55;">' + escapeHtml(r.txt) + '</span>' +
                '<span class="aud-data">' + dtFmt + '</span>' +
            '</div>' +
            (log.detalhes ? '<div class="aud-detalhe">' + escapeHtml(log.detalhes) + '</div>' : '') +
            '<div class="aud-admin">por ' + escapeHtml(log.admin_nome || 'Admin') + '</div>';
        lista.appendChild(linha);
    }
}
window.filtrarAuditoria = function() { renderAuditoria(); };

window.abrirSecao = function(sec) {
    window.AppAdmin.secaoAtual = sec;

    document.querySelectorAll('.adm-secao').forEach(s => s.classList.remove('ativa'));
    document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('ativo'));

    const secEl = $('sec-' + sec);
    if (secEl) secEl.classList.add('ativa');

    // ✅ CORREÇÃO: Config não tem ícone no nav inferior — não ativa nenhum
    const map = { dashboard: 0, alunos: 1, financeiro: 2, mural: 3, auditoria: 4 };
    const navIdx = map[sec];
    if (navIdx !== undefined) {
        const navs = document.querySelectorAll('.adm-nav-item');
        if (navs[navIdx]) navs[navIdx].classList.add('ativo');
    }

    window.scrollTo(0, 0);

    if (sec === 'dashboard') renderDashboard();
    if (sec === 'alunos') renderAlunos();
    if (sec === 'financeiro') renderFinanceiro();
    if (sec === 'mural') renderMural();
    if (sec === 'auditoria') renderAuditoria();
};


// Detecta qual aba está visível no momento — nunca erra
function getSecaoAtiva() {
    const secoes = ['dashboard', 'alunos', 'financeiro', 'mural', 'auditoria', 'config'];
    for (const sec of secoes) {
        const el = $('sec-' + sec);
        if (el && el.classList.contains('ativa')) return sec;
    }
    return 'dashboard';
}

async function carregarTudo() {
    loading('Sincronizando dados...');
    try {
        const [{ data: alunos, error: e1 }, { data: mens, error: e2 }] = await Promise.all([
            supabase.from('perfis').select('*').neq('cargo', 'professor').order('nome'),
            supabase.from('mensalidades').select('*').order('criado_em', { ascending: false }).limit(500)
        ]);
        // ✅ Antes: erros eram engolidos e a tela mostrava tudo zerado como se fosse "vazio"
        if (e1 || e2) {
            const erro = e1 || e2;
            console.error('[ADMIN] Falha ao carregar dados:', erro);
            Swal.close();
            toast(navigator.onLine ? 'Erro ao carregar dados' : '📡 Você está offline', 'error');
            return;
        }

        // ✅ Avisos: a coluna de data pode ser 'criado_em' OU 'created_at' conforme o banco.
        // Tenta 'criado_em'; se a coluna não existir (42703), faz fallback — sem derrubar o painel.
        let avisos = [];
        let resAvisos = await supabase.from('avisos').select('*').order('criado_em', { ascending: false });
        if (resAvisos.error && resAvisos.error.code === '42703') {
            console.warn('[ADMIN] Coluna criado_em ausente em avisos — tentando created_at...');
            resAvisos = await supabase.from('avisos').select('*').order('created_at', { ascending: false });
        }
        if (resAvisos.error && resAvisos.error.code === '42703') {
            console.warn('[ADMIN] Sem coluna de data em avisos — buscando sem ordenação...');
            resAvisos = await supabase.from('avisos').select('*');
        }
        if (resAvisos.error) {
            console.error('[ADMIN] Falha ao carregar avisos (não fatal):', resAvisos.error);
        } else {
            // Normaliza: garante que todo aviso tenha 'criado_em' preenchido
            avisos = (resAvisos.data || []).map(av => ({ ...av, criado_em: av.criado_em || av.created_at || null }));
        }

        AppAdmin.alunos = alunos || [];
        AppAdmin.mensalidades = mens || [];
        AppAdmin.avisos = avisos;
        AppAdmin.dadosCarregados = true;
        Swal.close();

        // ✅ CORREÇÃO DEFINITIVA: lê a aba ativa do DOM, não de variável
        const sec = getSecaoAtiva();
        if (sec === 'dashboard') renderDashboard();
        else if (sec === 'alunos') renderAlunos();
        else if (sec === 'financeiro') renderFinanceiro();
        else if (sec === 'mural') renderMural();
        else renderDashboard();

    } catch (e) {
        Swal.close();
        toast('Erro ao carregar dados', 'error');
        console.error(e);
    }
}


// ========== DASHBOARD (SEM innerHTML em dados dinâmicos) ==========
function renderDashboard() {
    const ativos = AppAdmin.alunos.filter(a => !a.plano_pausado);
    const inativos = AppAdmin.alunos.filter(a => a.plano_pausado);
    const vips = AppAdmin.alunos.filter(a => a.assinante && !a.plano_pausado);

    const recebido = AppAdmin.mensalidades.filter(m => m.status === 'pago').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const pendente = AppAdmin.mensalidades.filter(m => m.status === 'pendente').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);

    const elAtivos = $('kpi-ativos');
    const elRec = $('kpi-recebido');
    const elPen = $('kpi-pendente');
    const elVips = $('kpi-vips');

    if (elAtivos) elAtivos.textContent = ativos.length;
    if (elRec) elRec.textContent = formatCurrency(recebido);
    if (elPen) elPen.textContent = formatCurrency(pendente);
    if (elVips) elVips.textContent = vips.length;

    const elAtivosD = $('kpi-ativos-delta');
    const elRecD = $('kpi-recebido-delta');
    const elPenD = $('kpi-pendente-delta');
    const elVipsD = $('kpi-vips-delta');

    if (elAtivosD) elAtivosD.textContent = `${inativos.length} inativo${inativos.length !== 1 ? 's' : ''}`;
    if (elRecD) elRecD.textContent = `${AppAdmin.mensalidades.filter(m => m.status === 'pago').length} pagamentos`;
    const _pendentes = AppAdmin.mensalidades.filter(m => m.status === 'pendente');
    const _vencidas = _pendentes.filter(isVencida);
    const _aVencer = _pendentes.length - _vencidas.length;
    if (elPenD) elPenD.textContent = `🔴 ${_vencidas.length} vencida${_vencidas.length !== 1 ? 's' : ''} · 🟡 ${_aVencer} a vencer`;
    if (elVipsD) elVipsD.textContent = `${vips.length} recorrente${vips.length !== 1 ? 's' : ''}`;

    // KPI Inadimplentes (alunos com cobrança vencida)
    const idsVencidos = new Set(_vencidas.map(m => m.aluno_id));
    const elInad = $('kpi-inadimplentes');
    const elInadD = $('kpi-inadimplentes-delta');
    if (elInad) elInad.textContent = idsVencidos.size;
    if (elInadD) elInadD.textContent = `${_vencidas.length} cobrança${_vencidas.length !== 1 ? 's' : ''} vencida${_vencidas.length !== 1 ? 's' : ''}`;

    // Alertas de inconsistência
    const cardAlertas = $('card-alertas');
    const listaAlertas = $('lista-alertas');
    if (cardAlertas && listaAlertas) {
        const alertas = [];
        const mesAtual = mesAtualStr();
        const alunosCobraveis = ativos.filter(a => !a.assinante);
        const semValor = alunosCobraveis.filter(a => a.valor_mensalidade == null);
        if (semValor.length > 0) {
            alertas.push({ cor: '#f97316', txt: semValor.length + ' aluno(s) ativo(s) sem valor de mensalidade cadastrado: ' + semValor.map(a => a.nome).join(', ') + '. A cobrança automática do dia 10 não inclui esses alunos.' });
        }
        const idsComMensAtual = new Set(AppAdmin.mensalidades.filter(m => m.mes === mesAtual).map(m => m.aluno_id));
        const semMens = alunosCobraveis.filter(a => a.valor_mensalidade != null && !idsComMensAtual.has(a.id));
        if (semMens.length > 0) {
            alertas.push({ cor: '#eab308', txt: semMens.length + ' aluno(s) sem mensalidade de ' + mesAtual + ': ' + semMens.map(a => a.nome).join(', ') + '.' });
        }
        if (idsVencidos.size > 0) {
            const nomesVenc = [...idsVencidos].map(id => { const a = AppAdmin.alunos.find(x => x.id === id); return a ? a.nome : '?'; });
            alertas.push({ cor: '#ef4444', txt: idsVencidos.size + ' aluno(s) com cobrança vencida: ' + nomesVenc.join(', ') + '.' });
        }
        if (alertas.length > 0) {
            cardAlertas.style.display = 'block';
            listaAlertas.innerHTML = '';
            alertas.forEach(al => {
                const div = document.createElement('div');
                div.style.cssText = 'font-size:13px;line-height:1.5;padding:10px 12px;border-radius:10px;margin-bottom:8px;background:' + al.cor + '14;border:1px solid ' + al.cor + '44;color:var(--adm-text);';
                div.textContent = '⚠️ ' + al.txt;
                listaAlertas.appendChild(div);
            });
        } else {
            cardAlertas.style.display = 'none';
        }
    }

    // Gráfico de barras CSS — construído via DOM
    const mesesMap = {
        'Jan': ['Jan','Janeiro'], 'Fev': ['Fev','Fevereiro'], 'Mar': ['Mar','Março'],
        'Abr': ['Abr','Abril'], 'Mai': ['Mai','Maio'], 'Jun': ['Jun','Junho'],
        'Jul': ['Jul','Julho'], 'Ago': ['Ago','Agosto'], 'Set': ['Set','Setembro'],
        'Out': ['Out','Outubro'], 'Nov': ['Nov','Novembro'], 'Dez': ['Dez','Dezembro']
    };
    const hoje = new Date();
    const grafico = $('grafico-receita');
    if (grafico) {
        grafico.innerHTML = '';
        // Calcula receita máxima real para escalar o gráfico corretamente
        let maxReceita = 0;
        for (let i = 5; i >= 0; i--) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const mn = Object.keys(mesesMap)[d.getMonth()];
            const possiveis = mesesMap[mn];
            const val = AppAdmin.mensalidades
                .filter(m => m.status === 'pago' && possiveis.some(nm => (m.mes || '').toLowerCase().includes(nm.toLowerCase())))
                .reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
            if (val > maxReceita) maxReceita = val;
        }
        maxReceita = Math.max(maxReceita, 1);
        for (let i = 5; i >= 0; i--) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const mesNome = Object.keys(mesesMap)[d.getMonth()];
            const possiveisNomes = mesesMap[mesNome];
            const val = AppAdmin.mensalidades
                .filter(m => m.status === 'pago' && possiveisNomes.some(nm => (m.mes || '').toLowerCase().includes(nm.toLowerCase())))
                .reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
            const pct = Math.max(8, Math.min(100, val > 0 ? (val / maxReceita) * 100 : 8));

            const bar = document.createElement('div');
            bar.className = 'adm-chart-bar';
            bar.style.height = pct + '%';
            const label = document.createElement('span');
            label.className = 'adm-chart-label';
            label.textContent = mesNome;
            bar.appendChild(label);
            grafico.appendChild(bar);
        }
    }

    // Aniversariantes — construído via DOM
    const mesAtual = hoje.getMonth() + 1;
    const anivs = AppAdmin.alunos.filter(a => a.data_nascimento && parseInt(a.data_nascimento.split('-')[1]) === mesAtual);
    const cardAniv = $('card-aniversarios');
    const listaAniv = $('lista-aniversarios');
    if (cardAniv && listaAniv) {
        if (anivs.length > 0) {
            cardAniv.style.display = 'block';
            listaAniv.innerHTML = '';
            anivs.forEach(a => {
                const dia = a.data_nascimento.split('-')[2];
                const num = a.telefone ? a.telefone.replace(/\D/g, '') : '';
                const link = num ? `https://wa.me/55${num}?text=${encodeURIComponent('Parabéns, ' + a.nome + '! 🎉 Oss! 🥋')}` : '#';
                const foto = a.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.nome)}&background=161618&color=fff`;

                const card = document.createElement('div');
                card.className = 'adm-bday-card';

                const img = document.createElement('img');
                img.src = foto;
                img.alt = '';
                img.loading = 'lazy';
                card.appendChild(img);

                const h5 = document.createElement('h5');
                h5.textContent = a.nome.split(' ')[0];
                card.appendChild(h5);

                const p = document.createElement('p');
                p.textContent = 'Dia ' + dia;
                card.appendChild(p);

                const aLink = document.createElement('a');
                aLink.href = link;
                aLink.target = '_blank';
                aLink.style.cssText = 'font-size:10px; color:#25D366; text-decoration:none; font-weight:700;';
                aLink.textContent = '🎂 Zap';
                card.appendChild(aLink);

                listaAniv.appendChild(card);
            });
        } else {
            cardAniv.style.display = 'none';
        }
    }
}

    function renderAlunos() {
        const lista = $('lista-alunos');
        const inputBusca = $('busca-aluno');
        const termo = (inputBusca?.value || '').toLowerCase();
    
        let filtrados = [...AppAdmin.alunos];
        if (termo) filtrados = filtrados.filter(a =>
            (a.nome || '').toLowerCase().includes(termo) ||
            (a.faixa || '').toLowerCase().includes(termo) ||
            (a.telefone || '').includes(termo)
        );
    
        if (AppAdmin.filtroAluno === 'ativos') filtrados = filtrados.filter(a => !a.plano_pausado);
        else if (AppAdmin.filtroAluno === 'inativos') filtrados = filtrados.filter(a => a.plano_pausado);
        else if (AppAdmin.filtroAluno === 'vip') filtrados = filtrados.filter(a => a.assinante);
        else if (AppAdmin.filtroAluno === 'pendentes') {
            const idsPendentes = new Set(AppAdmin.mensalidades.filter(m => m.status === 'pendente').map(m => m.aluno_id));
            filtrados = filtrados.filter(a => idsPendentes.has(a.id));
        }
        else if (AppAdmin.filtroAluno === 'atrasados') {
            const idsAtrasados = new Set(AppAdmin.mensalidades.filter(isVencida).map(m => m.aluno_id));
            filtrados = filtrados.filter(a => idsAtrasados.has(a.id));
        }
    
        // Barra de ações em massa
        const barra = $('barra-massa');
        const countEl = $('mass-count');
        if (AppAdmin.modoSelecao && AppAdmin.alunosSelecionados.size > 0) {
            if (barra) barra.classList.add('ativo');
            if (countEl) countEl.textContent = `${AppAdmin.alunosSelecionados.size} selecionado${AppAdmin.alunosSelecionados.size > 1 ? 's' : ''}`;
        } else {
            if (barra) barra.classList.remove('ativo');
        }
    
        const ativos = AppAdmin.alunos.filter(a => !a.plano_pausado);
        const contagem = {};
        ativos.forEach(a => {
            const f = nomeFaixaLimpo(a.faixa);
            contagem[f] = (contagem[f] || 0) + 1;
        });
    
        const cardFaixas = $('card-faixas');
        const resumoFaixas = $('resumo-faixas-content');
        if (cardFaixas && resumoFaixas) {
            if (Object.keys(contagem).length > 0) {
                cardFaixas.style.display = 'block';
                resumoFaixas.innerHTML = '';
                Object.entries(contagem).forEach(([f, q]) => {
                    const span = document.createElement('span');
                    span.className = 'adm-tag';
                    const cor = corFaixa(f);
                    span.style.cssText = `background:${cor}22; color:${cor}; border:1px solid ${cor}44;`;
                    const dot = document.createElement('span');
                    dot.className = 'adm-tag faixa';
                    dot.style.background = cor;
                    span.appendChild(dot);
                    span.appendChild(document.createTextNode(` ${f}: ${q}`));
                    resumoFaixas.appendChild(span);
                });
            } else {
                cardFaixas.style.display = 'none';
            }
        }
    
        if (!lista) return;
        lista.innerHTML = '';
    
        if (filtrados.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'adm-empty';
            empty.innerHTML = '<i class="fa-solid fa-users-slash"></i><p>Nenhum aluno encontrado</p>';
            lista.appendChild(empty);
            return;
        }
    
        filtrados.forEach(a => {
            const cor = corFaixa(a.faixa);
            const foto = a.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.nome)}&background=161618&color=fff`;
            const mensPendente = AppAdmin.mensalidades.filter(m => m.aluno_id === a.id && m.status === 'pendente')[0];
            const isSel = AppAdmin.alunosSelecionados.has(a.id);
    
            const item = document.createElement('div');
            item.className = 'adm-list-item' + (isSel ? ' selecionado' : '');
            item.style.cssText = 'cursor:pointer;';
    
            // Checkbox
            const chkWrap = document.createElement('div');
            chkWrap.className = 'adm-select-wrap';
            chkWrap.onclick = (e) => { e.stopPropagation(); toggleSelecao(a.id); };
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = isSel;
            chkWrap.appendChild(chk);
            item.appendChild(chkWrap);
    
            // Foto
            const img = document.createElement('img');
            img.src = foto; img.className = 'adm-avatar'; img.loading = 'lazy'; img.alt = a.nome || '';
            item.appendChild(img);
    
            // Info
            const info = document.createElement('div');
            info.className = 'adm-list-info';
            info.style.flex = '1';
            info.onclick = () => abrirDossie(a.id);
    
            const h4 = document.createElement('h4');
            h4.textContent = a.nome || '';
            if (a.assinante) {
                const tagVip = document.createElement('span');
                tagVip.className = 'adm-tag vip'; tagVip.textContent = 'VIP';
                h4.appendChild(document.createTextNode(' '));
                h4.appendChild(tagVip);
            }
            if (a.plano_pausado) {
                const tagIna = document.createElement('span');
                tagIna.className = 'adm-tag inativo'; tagIna.textContent = 'INATIVO';
                h4.appendChild(document.createTextNode(' '));
                h4.appendChild(tagIna);
            }
            if (mensPendente) {
                const tagDeb = document.createElement('span');
                tagDeb.className = 'adm-tag pendente'; tagDeb.textContent = 'DÉBITO';
                h4.appendChild(document.createTextNode(' '));
                h4.appendChild(tagDeb);
            }
            info.appendChild(h4);
    
            const p = document.createElement('p');
            p.style.cssText = 'display:flex; align-items:center; gap:6px;';
            const dot = document.createElement('span');
            dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${cor};display:inline-block;`;
            p.appendChild(dot);
            p.appendChild(document.createTextNode(`${a.faixa || 'Branca'} · ${a.telefone || 'Sem telefone'}`));
            info.appendChild(p);
    
            item.appendChild(info);
    
            const chevron = document.createElement('span');
            chevron.style.cssText = 'color:var(--adm-text-3);font-size:18px;';
            chevron.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            chevron.onclick = () => abrirDossie(a.id);
            item.appendChild(chevron);
    
            lista.appendChild(item);
        });
    }



window.filtrarAlunos = function() { renderAlunos(); };

window.setFiltroAluno = function(f) {
    AppAdmin.filtroAluno = f;
    document.querySelectorAll('#filtros-alunos .adm-chip').forEach(c => {
        c.classList.toggle('ativo', c.dataset.filtro === f);
    });
    renderAlunos();
};

window.abrirDossie = async function(id) {
    const aluno = AppAdmin.alunos.find(a => a.id === id);
    if (!aluno) { toast('Aluno não encontrado', 'error'); return; }
    AppAdmin.alunoSelecionado = aluno;
    AppAdmin.abaDossie = 'perfil';
    // ✅ Reseta o destaque visual das abas (evita aba "acesa" errada ao reabrir)
    document.querySelectorAll('.adm-modal-tab').forEach((t, idx) => t.classList.toggle('ativo', idx === 0));

    const foto = aluno.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=161618&color=fff`;
    const imgFoto = $('dossie-foto');
    const nomeEl = $('dossie-nome');
    const faixaEl = $('dossie-faixa');

    if (imgFoto) imgFoto.src = foto;
    if (nomeEl) nomeEl.textContent = aluno.nome || '—';
    if (faixaEl) {
        faixaEl.textContent = '🥋 ' + (aluno.faixa || 'BRANCA');
        faixaEl.style.color = corFaixa(aluno.faixa);
    }

    const modal = $('modal-dossie');
    if (modal) {
        modal.classList.add('aberto');
        document.body.style.overflow = 'hidden';
    }
    renderDossieConteudo();
};

window.fecharModalDossie = function(e) {
    if (e && e.target !== $('modal-dossie')) return;
    const modal = $('modal-dossie');
    if (modal) modal.classList.remove('aberto');
    document.body.style.overflow = '';
    AppAdmin.alunoSelecionado = null;
};

window.setAbaDossie = function(aba, el) {
    AppAdmin.abaDossie = aba;
    document.querySelectorAll('.adm-modal-tab').forEach(t => t.classList.remove('ativo'));
    if (el) el.classList.add('ativo');
    renderDossieConteudo();
};

// ========== DOSSIÊ (SEM innerHTML em dados dinâmicos) ==========
function renderDossieConteudo() {
    const a = AppAdmin.alunoSelecionado;
    if (!a) return;
    const container = $('dossie-conteudo');
    if (!container) return;
    container.innerHTML = '';

    if (AppAdmin.abaDossie === 'perfil') {
        const status = a.plano_pausado ? '🔴 INATIVO' : (a.assinante ? '💳 VIP RECORRENTE' : '✅ ATIVO');
        const corStatus = a.plano_pausado ? '#ff5252' : (a.assinante ? '#3b82f6' : '#22c55e');

        const grid = document.createElement('div');
        grid.className = 'adm-info-grid';

        const rows = [
            { label: 'WhatsApp', value: a.telefone || '—' },
            { label: 'E-mail', value: a.email || '—', small: true },
            { label: 'Nascimento', value: a.data_nascimento ? new Date(a.data_nascimento).toLocaleDateString('pt-BR') : '—' },
            { label: 'Status', value: status, color: corStatus },
            { label: 'Mensalidade', value: `R$ ${a.valor_mensalidade || 25},00` }
        ];

        rows.forEach(r => {
            const row = document.createElement('div');
            row.className = 'adm-info-row';
            const lbl = document.createElement('span');
            lbl.className = 'adm-info-label';
            lbl.textContent = r.label;
            const val = document.createElement('span');
            val.className = 'adm-info-value';
            val.textContent = r.value;
            if (r.small) val.style.fontSize = '11px';
            if (r.color) val.style.color = r.color;
            row.appendChild(lbl);
            row.appendChild(val);
            grid.appendChild(row);
        });
        container.appendChild(grid);

        const zapLink = document.createElement('a');
        zapLink.href = `https://wa.me/55${(a.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Olá, *' + a.nome + '*! Oss! 🥋')}`;
        zapLink.target = '_blank';
        zapLink.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:white;text-decoration:none;padding:14px;border-radius:10px;font-weight:800;margin-top:16px;';
        zapLink.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Chamar no WhatsApp';
        container.appendChild(zapLink);

    } else if (AppAdmin.abaDossie === 'financeiro') {
        const mensAluno = AppAdmin.mensalidades.filter(m => m.aluno_id === a.id)
            .sort((x, y) => parseMesNum(y.mes) - parseMesNum(x.mes)).slice(0, 12);
        if (mensAluno.length === 0) {
            container.innerHTML = '<div class="adm-empty"><i class="fa-solid fa-receipt"></i><p>Sem histórico financeiro</p></div>';
            return;
        }
        mensAluno.forEach(m => {
            const isPago = m.status === 'pago';
            const item = document.createElement('div');
            item.className = 'adm-list-item';

            const info = document.createElement('div');
            info.className = 'adm-list-info';
            const h4 = document.createElement('h4');
            h4.textContent = m.mes || '';
            info.appendChild(h4);
            const p = document.createElement('p');
            p.className = 'adm-tag ' + (isPago ? 'pago' : 'pendente');
            p.textContent = isPago ? '✅ Pago' : (isVencida(m) ? '🔴 Atrasado' : '🟡 A vencer');
            info.appendChild(p);
            item.appendChild(info);

            const val = document.createElement('span');
            val.style.cssText = 'font-weight:800;color:var(--adm-text);';
            val.textContent = `R$ ${m.valor}`;
            item.appendChild(val);

            container.appendChild(item);
        });
    } else {
        const acao = a.plano_pausado ? 'reativar' : 'congelar';
        const corBtn = a.plano_pausado ? '#22c55e' : '#9e9e9e';
        const txtBtn = a.plano_pausado ? '▶️ Reativar Aluno' : '⏸️ Inativar Aluno';

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        // Botão de gerar mensalidade individual
        const btnGerar = document.createElement('button');
        btnGerar.className = 'adm-btn-full btn-tactile';
        btnGerar.style.cssText = 'background:var(--adm-red);border:none;color:white;';
        btnGerar.innerHTML = '<i class="fa-solid fa-file-invoice-dollar"></i> Gerar Mensalidade';
        btnGerar.onclick = () => {
            fecharModalDossie();
            setTimeout(() => abrirModalGerarIndividual(a.id, a.nome), 300);
        };
        wrap.appendChild(btnGerar);

        const btnEdit = document.createElement('button');
        btnEdit.className = 'adm-btn-full btn-tactile';
        btnEdit.style.cssText = 'background:var(--adm-surface-2);border:1px solid var(--adm-border);color:var(--adm-text);';
        btnEdit.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Perfil';
        btnEdit.onclick = editarAlunoDossie;
        wrap.appendChild(btnEdit);

        const btnPause = document.createElement('button');
        btnPause.className = 'adm-btn-full btn-tactile';
        btnPause.style.cssText = `background:transparent;border:1px solid ${corBtn};color:${corBtn};`;
        btnPause.textContent = txtBtn;
        btnPause.onclick = () => alternarPlano(a.id, a.nome, acao);
        wrap.appendChild(btnPause);

        if (a.assinante) {
            const btnCancel = document.createElement('button');
            btnCancel.className = 'adm-btn-full btn-tactile';
            btnCancel.style.cssText = 'background:transparent;border:1px solid #ff5252;color:#ff5252;';
            btnCancel.innerHTML = '<i class="fa-solid fa-crown"></i> Cancelar VIP';
            btnCancel.onclick = () => cancelarVIP(a.id, a.nome);
            wrap.appendChild(btnCancel);
        }

        const btnDel = document.createElement('button');
        btnDel.className = 'adm-btn-full btn-tactile';
        btnDel.style.cssText = 'background:transparent;border:1px solid #ff5252;color:#ff5252;margin-top:10px;';
        btnDel.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir Aluno';
        btnDel.onclick = () => excluirAluno(a.id, a.nome);
        wrap.appendChild(btnDel);

        container.appendChild(wrap);
    }
}

window.editarAlunoDossie = async function() {
    const a = AppAdmin.alunoSelecionado;
    if (!a) return;
    const { value: v } = await Swal.fire({
        title: 'Editar Atleta',
        html: `<div style="text-align:left;">
            <label style="color:#888;font-size:11px;text-transform:uppercase;">Nome</label>
            <input id="ed-nome" class="swal2-input" value="${escapeHtml(a.nome)}" style="background:#0a0a0c;color:white;border:1px solid #333;margin-bottom:10px;">
            <label style="color:#888;font-size:11px;text-transform:uppercase;">WhatsApp</label>
            <input id="ed-tel" class="swal2-input" value="${escapeHtml(a.telefone || '')}" style="background:#0a0a0c;color:white;border:1px solid #333;margin-bottom:10px;">
            <label style="color:#888;font-size:11px;text-transform:uppercase;">Faixa</label>
            <input id="ed-faixa" class="swal2-input" value="${escapeHtml(a.faixa || 'Branca')}" style="background:#0a0a0c;color:white;border:1px solid #333;margin-bottom:10px;">
            <label style="color:#888;font-size:11px;text-transform:uppercase;">Valor Mensalidade</label>
            <input id="ed-valor" type="number" class="swal2-input" value="${a.valor_mensalidade || ''}" style="background:#0a0a0c;color:white;border:1px solid #333;">
        </div>`,
        focusConfirm: false, showCancelButton: true,
        confirmButtonColor: '#E53935', cancelButtonColor: '#333',
        confirmButtonText: 'SALVAR', cancelButtonText: 'Cancelar',
        background: '#0a0a0c', color: '#fff',
        preConfirm: () => ({
            nome: $('ed-nome').value,
            telefone: $('ed-tel').value.replace(/\D/g, ''),
            faixa: $('ed-faixa').value,
            valor: $('ed-valor').value
        })
    });
    if (v) {
        // Validação
        if (!validarNome(v.nome)) { toast('Nome inválido (mín. 2 caracteres)', 'error'); return; }
        if (v.telefone && !validarTelefone(v.telefone)) { toast('Telefone inválido', 'error'); return; }
        if (v.valor && !validarValor(v.valor)) { toast('Valor inválido', 'error'); return; }

        loading('Salvando...');
        const { error: erroUpdate } = await supabase.from('perfis').update({
            nome: v.nome.trim(), telefone: v.telefone, faixa: v.faixa,
            valor_mensalidade: v.valor ? parseFloat(v.valor) : null
        }).eq('id', a.id);
        if (erroUpdate) { Swal.close(); toast('Erro ao salvar: ' + erroUpdate.message, 'error'); return; }
        registrarLog('editar_aluno', 'Editou dados de ' + v.nome.trim() + ' (faixa: ' + v.faixa + ', valor: ' + (v.valor || 'sem valor') + ')', a.id, v.nome.trim());
        await carregarTudo();
        fecharModalDossie();
        toast('Perfil atualizado!');
    }
};

window.alternarPlano = async function(id, nome, acao) {
    const cong = acao === 'congelar';
    const r = await Swal.fire({
        title: cong ? 'Inativar Aluno?' : 'Reativar Aluno?',
        text: `${escapeHtml(nome)} será ${cong ? 'inativado' : 'reativado'}.`,
        icon: 'question', showCancelButton: true,
        confirmButtonColor: cong ? '#9e9e9e' : '#22c55e',
        cancelButtonColor: '#333', confirmButtonText: 'Sim', cancelButtonText: 'Cancelar',
        background: '#0a0a0c', color: '#fff'
    });
    if (r.isConfirmed) {
        loading('Processando...');
        const { error: erroUpdate } = await supabase.from('perfis').update({ plano_pausado: cong }).eq('id', id);
        if (erroUpdate) { Swal.close(); toast('Erro: ' + erroUpdate.message, 'error'); return; }
        registrarLog(cong ? 'inativar_aluno' : 'reativar_aluno', (cong ? 'Inativou ' : 'Reativou ') + nome, id, nome);
        await carregarTudo();
        fecharModalDossie();
        toast(cong ? 'Aluno inativado' : 'Aluno reativado!');
    }
};

window.cancelarVIP = async function(id, nome) {
    const r = await Swal.fire({
        title: 'Remover VIP?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ff5252', cancelButtonColor: '#333',
        confirmButtonText: 'Sim', cancelButtonText: 'Manter',
        background: '#0a0a0c', color: '#fff'
    });
    if (r.isConfirmed) {
        loading('Removendo...');
        const { error: erroUpdate } = await supabase.from('perfis').update({ assinante: false, plano_pausado: false }).eq('id', id);
        if (erroUpdate) { Swal.close(); toast('Erro: ' + erroUpdate.message, 'error'); return; }
        registrarLog('remover_vip', 'Removeu VIP de ' + nome, id, nome);
        await carregarTudo();
        fecharModalDossie();
        toast('VIP removido');
    }
};

window.excluirAluno = async function(id, nome) {
    const r = await Swal.fire({
        title: 'Excluir permanentemente?',
        text: `Todos os dados de ${escapeHtml(nome)} serão apagados (inclusive fotos).`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ff5252', cancelButtonColor: '#333',
        confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar',
        background: '#0a0a0c', color: '#fff'
    });

    if (r.isConfirmed) {
        loading('Excluindo tudo...');
        try {
            const { data, error } = await supabase.functions.invoke('deletar-aluno', {
                body: { aluno_id: id }
            });
            if (error) throw error;
            registrarLog('excluir_aluno', 'Excluiu permanentemente o aluno ' + nome, null, nome);
            await carregarTudo();
            fecharModalDossie();
            toast('Aluno e fotos removidos!');
        } catch (err) {
            Swal.close();
            toast(err.message || 'Erro ao excluir', 'error');
        }
    }
};

// ========== FINANCEIRO (SEM innerHTML em dados dinâmicos) ==========
function renderFinanceiro() {
    const recebido = AppAdmin.mensalidades.filter(m => m.status === 'pago').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const pendente = AppAdmin.mensalidades.filter(m => m.status === 'pendente').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const elRec = $('fin-recebido');
    const elPen = $('fin-pendente');
    if (elRec) elRec.textContent = formatCurrency(recebido);
    if (elPen) elPen.textContent = formatCurrency(pendente);

    const inputBusca = $('busca-financeiro');
    const termo = (inputBusca?.value || '').toLowerCase();
    let pendentes = AppAdmin.mensalidades.filter(m => m.status === 'pendente');

    if (termo) {
        pendentes = pendentes.filter(m => {
            const al = AppAdmin.alunos.find(a => a.id === m.aluno_id);
            return al && (al.nome || '').toLowerCase().includes(termo);
        });
    }

    const lista = $('lista-financeiro');
    if (!lista) return;
    lista.innerHTML = '';

    if (pendentes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'adm-empty';
        empty.innerHTML = '<i class="fa-solid fa-check-circle"></i><p>Tudo em dia! Nenhuma cobrança pendente.</p>';
        lista.appendChild(empty);
        return;
    }

    pendentes.forEach(m => {
        const al = AppAdmin.alunos.find(a => a.id === m.aluno_id);
        if (al && al.plano_pausado) return;
        const nome = al ? al.nome : 'Desconhecido';
        const tel = al ? al.telefone : '';

        const card = document.createElement('div');
        card.className = 'adm-card';
        card.style.marginBottom = '10px';

        const body = document.createElement('div');
        body.className = 'adm-card-body';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';

        const info = document.createElement('div');
        const h4 = document.createElement('h4');
        h4.style.cssText = 'margin:0;font-size:15px;color:var(--adm-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100% - 40px);';

        h4.textContent = nome;
        info.appendChild(h4);

        const p = document.createElement('p');
        p.style.cssText = 'margin:4px 0 0;font-size:12px;color:var(--adm-text-2);text-transform:uppercase;';
        p.innerHTML = `${escapeHtml(m.mes)} · <strong style="color:var(--adm-red);font-size:13px;">R$ ${m.valor}</strong>`;
        info.appendChild(p);
        header.appendChild(info);

        const btnDel = document.createElement('button');
        btnDel.style.cssText = 'background:rgba(255,82,82,0.1);border:none;width:36px;height:36px;border-radius:50%;color:#ff5252;cursor:pointer;font-size:14px;';
        btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
        btnDel.onclick = () => apagarCobranca(m.id);
        header.appendChild(btnDel);

        body.appendChild(header);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;';

        const btnBaixa = document.createElement('button');
        btnBaixa.className = 'adm-btn-sm success adm-w-full btn-tactile';
        btnBaixa.innerHTML = '<i class="fa-solid fa-check"></i> Dar Baixa';
        btnBaixa.onclick = () => darBaixa(m.id);
        actions.appendChild(btnBaixa);

        const btnZap = document.createElement('button');
        btnZap.className = 'adm-btn-sm whatsapp btn-tactile';
        btnZap.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Zap';
        btnZap.onclick = () => cobrarZap(tel, nome, m.mes, m.valor);
        actions.appendChild(btnZap);

        body.appendChild(actions);
        card.appendChild(body);
        lista.appendChild(card);
    });
}

window.filtrarFinanceiro = function() { renderFinanceiro(); };

window.cobrarZap = function(tel, nome, mes, val) {
    if (!tel || tel.length < 10) { toast('Sem WhatsApp cadastrado', 'error'); return; }
    const num = tel.replace(/\D/g, '');
    const msg = `Olá, *${nome}*! Oss! 🥋

Lembrete da mensalidade de *${mes}*.
💰 *Valor:* R$ ${val},00

📱 *Pague no App*
_Ou Pix (Celular):_ *92985589868*

Nos vemos no tatame!`;
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.darBaixa = async function(id) {
    const r = await Swal.fire({
        title: 'Recebido?', icon: 'question', showCancelButton: true,
        confirmButtonColor: '#22c55e', cancelButtonColor: '#333',
        confirmButtonText: 'Sim', cancelButtonText: 'Não',
        background: '#0a0a0c', color: '#fff'
    });
    if (r.isConfirmed) {
        if (!travarAcao('baixa-' + id)) return;
        loading('Atualizando...');
        const { error: erroUpdate } = await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', id);
        destravarAcao('baixa-' + id);
        if (erroUpdate) { Swal.close(); toast('Erro: ' + erroUpdate.message, 'error'); return; }
        const _m = (AppAdmin.mensalidades || []).find(x => x.id === id);
        const _a = _m && (AppAdmin.alunos || []).find(x => x.id === _m.aluno_id);
        registrarLog('baixa_mensalidade', 'Baixa de ' + (_m ? _m.mes : 'mensalidade') + ' - ' + (_a ? _a.nome : 'aluno') + (_m ? ' (R$ ' + Number(_m.valor).toFixed(2).replace('.', ',') + ')' : ''), _m ? _m.aluno_id : null, _a ? _a.nome : null);
        await carregarTudo();
        toast('Baixa realizada!');
    }
};

window.apagarCobranca = async function(id) {
    const r = await Swal.fire({
        title: 'Apagar cobrança?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#E53935', cancelButtonColor: '#333',
        confirmButtonText: 'Sim', cancelButtonText: 'Não',
        background: '#0a0a0c', color: '#fff'
    });
    if (r.isConfirmed) {
        loading('Removendo...');
        const { error: erroDel } = await supabase.from('mensalidades').delete().eq('id', id);
        if (erroDel) { Swal.close(); toast('Erro: ' + erroDel.message, 'error'); return; }
        const _m = (AppAdmin.mensalidades || []).find(x => x.id === id);
        const _a = _m && (AppAdmin.alunos || []).find(x => x.id === _m.aluno_id);
        registrarLog('excluir_mensalidade', 'Excluiu cobranca de ' + (_m ? _m.mes : '?') + ' - ' + (_a ? _a.nome : 'aluno') + (_m ? ' (R$ ' + Number(_m.valor).toFixed(2).replace('.', ',') + ')' : ''), _m ? _m.aluno_id : null, _a ? _a.nome : null);
        await carregarTudo();
        toast('Cobrança removida');
    }
};

// ========== MURAL (SEM innerHTML em dados dinâmicos) ==========
function renderMural() {
    const lista = $('lista-avisos');
    if (!lista) return;
    lista.innerHTML = '';

    if (AppAdmin.avisos.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'adm-empty';
        empty.innerHTML = '<i class="fa-solid fa-bullhorn"></i><p>Nenhum aviso publicado</p>';
        lista.appendChild(empty);
        return;
    }

    AppAdmin.avisos.forEach(av => {
        const card = document.createElement('div');
        card.className = 'adm-card';
        card.style.cssText = 'margin-bottom:10px;position:relative;';

        const btnDel = document.createElement('button');
        btnDel.style.cssText = 'position:absolute;top:10px;right:10px;background:none;border:none;color:#ff5252;font-size:14px;cursor:pointer;z-index:2;';
        btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
        btnDel.onclick = () => apagarAviso(av.id);
        card.appendChild(btnDel);

        const body = document.createElement('div');
        body.className = 'adm-card-body';

        const h4 = document.createElement('h4');
        h4.style.cssText = 'margin:0 0 6px;font-size:15px;color:var(--adm-text);padding-right:24px;';
        h4.textContent = av.titulo || '';
        body.appendChild(h4);

        const p = document.createElement('p');
        p.style.cssText = 'margin:0;font-size:13px;color:var(--adm-text-2);line-height:1.5;overflow-wrap:break-word;word-break:break-word;';

        p.textContent = av.mensagem || '';
        body.appendChild(p);

        const date = document.createElement('p');
        date.style.cssText = 'margin:8px 0 0;font-size:10px;color:var(--adm-text-3);';
        date.textContent = av.criado_em ? new Date(av.criado_em).toLocaleDateString('pt-BR') : '';
        body.appendChild(date);

        card.appendChild(body);
        lista.appendChild(card);
    });
}

// ========== FORMULÁRIOS COM VALIDAÇÃO ==========
window.publicarAviso = async function() {
    const tit = $('aviso-titulo');
    const msg = $('aviso-mensagem');
    if (!tit || !msg) return;
    const titulo = tit.value.trim();
    const mensagem = msg.value.trim();

    if (!titulo || titulo.length < 2) { toast('Título muito curto', 'error'); return; }
    if (!mensagem || mensagem.length < 2) { toast('Mensagem muito curta', 'error'); return; }
    if (!travarAcao('publicar-aviso')) return; // ✅ anti double-tap (aviso duplicado)

    loading('Publicando...');
    const { error: erroInsert } = await supabase.from('avisos').insert([{ titulo: titulo, mensagem: mensagem }]);
    destravarAcao('publicar-aviso');
    if (erroInsert) { Swal.close(); toast('Erro ao publicar: ' + erroInsert.message, 'error'); return; }
    registrarLog('publicar_aviso', 'Publicou aviso: "' + titulo + '"');
    tit.value = '';
    msg.value = '';
    await carregarTudo();
    toast('Aviso publicado!');
};

window.apagarAviso = async function(id) {
    const r = await Swal.fire({
        title: 'Apagar aviso?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#E53935', cancelButtonColor: '#333',
        confirmButtonText: 'Sim', cancelButtonText: 'Não',
        background: '#0a0a0c', color: '#fff'
    });
    if (r.isConfirmed) {
        loading('Removendo...');
        const { error: erroDel } = await supabase.from('avisos').delete().eq('id', id);
        if (erroDel) { Swal.close(); toast('Erro: ' + erroDel.message, 'error'); return; }
        registrarLog('excluir_aviso', 'Excluiu um aviso do mural');
        await carregarTudo();
        toast('Aviso removido');
    }
};

window.abrirModalNovoAluno = function() {
    const modal = $('modal-novo-aluno');
    if (modal) {
        modal.classList.add('aberto');
        document.body.style.overflow = 'hidden';
    }
};

window.fecharModalNovoAluno = function(e) {
    if (e && e.target !== $('modal-novo-aluno')) return;
    const modal = $('modal-novo-aluno');
    if (modal) {
        modal.classList.remove('aberto');
        document.body.style.overflow = '';
    }
};

async function doCadastrar(dados) {
    // Validação completa
    if (!validarNome(dados.nome)) { toast('Nome inválido (mín. 2 caracteres)', 'error'); return false; }
    if (!validarEmail(dados.email)) { toast('E-mail inválido', 'error'); return false; }
    if (!validarSenha(dados.senha)) { toast('Senha deve ter no mínimo 6 caracteres', 'error'); return false; }
    if (dados.telefone && !validarTelefone(dados.telefone)) { toast('Telefone inválido', 'error'); return false; }
    if (dados.data_nascimento && !validarData(dados.data_nascimento)) { toast('Data de nascimento inválida', 'error'); return false; }
    if (dados.valor_mensalidade && !validarValor(dados.valor_mensalidade)) { toast('Valor da mensalidade inválido', 'error'); return false; }
    if (!travarAcao('cadastrar-aluno')) return false; // ✅ anti double-tap

    loading('Cadastrando...');
    try {
        const { data, error } = await supabase.functions.invoke('criar-aluno-admin', { body: dados });
        if (error || (data && data.error)) throw new Error(error?.message || data?.error);
        registrarLog('cadastrar_aluno', 'Cadastrou ' + dados.nome + ' (' + dados.email + ')' + (dados.valor_mensalidade ? ' - R$ ' + dados.valor_mensalidade : ''), null, dados.nome);
        await carregarTudo();
        toast('Aluno criado com sucesso!');
        return true;
    } catch (err) {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'Falha no Cadastro', text: err.message, background: '#0a0a0c', color: '#fff', confirmButtonColor: '#E53935' });
        return false;
    } finally {
        destravarAcao('cadastrar-aluno');
    }
}

window.cadastrarAluno = async function() {
    const dados = {
        nome: $('novo-nome').value,
        email: $('novo-email').value,
        senha: $('novo-senha').value,
        telefone: $('novo-telefone').value.replace(/\D/g, ''),
        faixa: $('novo-faixa').value,
        data_nascimento: $('novo-nascimento').value,
        valor_mensalidade: parseFloat($('novo-valor').value) || 25
    };
    if (await doCadastrar(dados)) {
        $('form-novo-aluno').reset();
    }
};

window.cadastrarAlunoModal = async function() {
    const dados = {
        nome: $('modal-nome').value,
        email: $('modal-email').value,
        senha: $('modal-senha').value,
        telefone: $('modal-telefone').value.replace(/\D/g, ''),
        faixa: $('modal-faixa').value,
        data_nascimento: $('modal-nascimento').value
    };
    if (await doCadastrar(dados)) {
        $('form-modal-aluno').reset();
        fecharModalNovoAluno();
    }
};

// ==========================================
// ✅ CORREÇÃO: Filtro de assinante null corrigido
// ==========================================
window.gerarMensalidades = async function() {
    let mes = $('mes-geral').value.trim();
    const val = $('valor-geral').value;

    if (!mes || mes.length < 3) { toast('Informe um mês válido', 'error'); return; }
    if (!val || !validarValor(val)) { toast('Informe um valor válido', 'error'); return; }
    if (!travarAcao('gerar-mensalidades')) return; // ✅ anti double-tap (cobrança duplicada)

    mes = mes.replace(/\s+/g, ' ');
    mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();

    loading('Verificando...');
    try {
        // ✅ CORRIGIDO: Busca TODOS os alunos (incluindo assinante=null) e filtra no JS
        const { data: alm, error: eAlm } = await supabase.from('perfis').select('id,valor_mensalidade,plano_pausado,assinante').neq('cargo', 'professor');
        if (eAlm) throw eAlm;
        const atv = (alm || []).filter(a => !a.plano_pausado && !a.assinante);

        if (atv.length === 0) { Swal.close(); toast('Nenhum aluno ativo sem VIP', 'error'); return; }

        const { data: ex, error: eEx } = await supabase.from('mensalidades').select('aluno_id').eq('mes', mes);
        if (eEx) throw eEx;
        const ja = new Set((ex || []).map(m => m.aluno_id));
        const cobrar = atv.filter(a => !ja.has(a.id));

        if (cobrar.length === 0) { Swal.close(); toast(`Todos já cobrados em ${mes}`); return; }

        const cob = cobrar.map(a => ({
            aluno_id: a.id, mes: mes, valor: a.valor_mensalidade || parseFloat(val), status: 'pendente'
        }));
        const { error: eIns } = await supabase.from('mensalidades').insert(cob);
        if (eIns) throw eIns;
        registrarLog('gerar_cobrancas', cobrar.length + ' cobranca(s) gerada(s) para ' + mes + ' (geral)');
        await carregarTudo();
        toast(`${cobrar.length} cobranças geradas!`);
        $('mes-geral').value = '';
    } catch (err) {
        Swal.close();
        toast(err.message, 'error');
    } finally {
        destravarAcao('gerar-mensalidades');
    }
};

window.atualizarMeusDados = async function() {
    const { value: em } = await Swal.fire({
        title: 'Novo E-mail', input: 'email', inputPlaceholder: 'E-mail',
        background: '#0a0a0c', color: '#fff', confirmButtonColor: '#E53935',
        showCancelButton: true, cancelButtonColor: '#333', cancelButtonText: 'Pular'
    });
    if (em) {
        if (!validarEmail(em)) { toast('E-mail inválido', 'error'); return; }
        const { error: e1 } = await supabase.auth.updateUser({ email: em });
        if (e1) Swal.fire({ icon: 'error', title: 'Erro', text: e1.message, background: '#0a0a0c', color: '#fff' });
        else toast('E-mail atualizado! Verifique sua caixa.');
    }
    const { value: se } = await Swal.fire({
        title: 'Nova Senha', input: 'password', inputPlaceholder: 'Mín. 6 caracteres',
        background: '#0a0a0c', color: '#fff', confirmButtonColor: '#E53935',
        showCancelButton: true, cancelButtonColor: '#333', cancelButtonText: 'Pular'
    });
    if (se) {
        if (!validarSenha(se)) { toast('Senha deve ter no mínimo 6 caracteres', 'error'); return; }
        const { error: e2 } = await supabase.auth.updateUser({ password: se });
        if (e2) Swal.fire({ icon: 'error', title: 'Erro', text: e2.message, background: '#0a0a0c', color: '#fff' });
        else toast('Senha atualizada!');
    }
};

window.toggleManutencao = async function() {
    if (!travarAcao('toggle-manutencao')) return;
    try {
        const { data, error } = await supabase.from('sistema_config').select('manutencao_ativa').eq('id', 1).maybeSingle();
        if (error) { toast('Erro ao ler configuração', 'error'); return; }
        if (data) {
            const novoEstado = !data.manutencao_ativa;
            const { error: erroUp } = await supabase.from('sistema_config').update({ manutencao_ativa: novoEstado }).eq('id', 1);
            if (erroUp) { toast('Erro ao salvar: ' + erroUp.message, 'error'); return; }
            AppAdmin.manutencaoAtiva = novoEstado;
            registrarLog('modo_manutencao', novoEstado ? 'Ativou o modo manutencao' : 'Desativou o modo manutencao');
            atualizarBtnManutencao();
            toast(AppAdmin.manutencaoAtiva ? 'Modo manutenção ATIVADO' : 'Modo manutenção DESATIVADO');
        }
    } finally {
        destravarAcao('toggle-manutencao');
    }
};

function atualizarBtnManutencao() {
    const btn = $('btn-manutencao');
    if (!btn) return;
    if (AppAdmin.manutencaoAtiva) {
        btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Desativar Modo Manutenção';
        btn.style.color = '#22c55e';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Ativar Modo Manutenção';
        btn.style.color = 'var(--adm-text)';
    }
}

async function checarManutencao() {
    try {
        const { data, error } = await supabase.from('sistema_config').select('manutencao_ativa').eq('id', 1).maybeSingle();
        if (!error && data) { AppAdmin.manutencaoAtiva = data.manutencao_ativa; atualizarBtnManutencao(); }
    } catch (e) { console.warn('[ADMIN] Falha ao checar manutenção:', e); }
}

window.sair = async function() {
    localStorage.removeItem('4l_fila_disparo');
    const r = await Swal.fire({
        title: 'Sair?', icon: 'question', showCancelButton: true,
        confirmButtonColor: '#E53935', cancelButtonColor: '#333',
        confirmButtonText: 'Sim', cancelButtonText: 'Cancelar',
        background: '#0a0a0c', color: '#fff'
    });
    if (r.isConfirmed) {
        localStorage.removeItem('4l_fila_disparo');
        try { await supabase.auth.signOut(); } catch (e) { console.warn('[ADMIN] Erro ao deslogar:', e); }
        window.location.replace('index.html');
    }
};

// ========== REALTIME: ATUALIZA AUTOMATICAMENTE ==========
function recarregarComDebounce(payload) {
    if (AppAdmin.rtTimeout) clearTimeout(AppAdmin.rtTimeout);
    AppAdmin.rtTimeout = setTimeout(() => {
        const modalAberto = document.querySelector('.adm-modal-overlay.aberto');
        if (modalAberto) return;
        // ✅ CORREÇÃO: se souber qual tabela mudou, recarrega só o necessário
        if (payload && payload.table) {
            if (payload.table === 'mensalidades') { AppAdmin.dadosCarregados = false; carregarTudo(); }
            else if (payload.table === 'perfis') { AppAdmin.dadosCarregados = false; carregarTudo(); }
            else if (payload.table === 'avisos') { AppAdmin.dadosCarregados = false; carregarTudo(); }
            else { carregarTudo(); }
        } else {
            carregarTudo();
        }
    }, 800);
}

function ligarRealtimeAdmin() {
    supabase.channel('admin-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensalidades' }, (p) => recarregarComDebounce({table:'mensalidades', ...p}))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'perfis' }, (p) => recarregarComDebounce({table:'perfis', ...p}))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, (p) => recarregarComDebounce({table:'avisos', ...p}))
        .subscribe((status) => {
            console.log('[ADMIN] Realtime status:', status);
        });
}

// ========== BAIXA EM LOTE ==========
window.darBaixaSelecionados = async function() {
    if (AppAdmin.alunosSelecionados.size === 0) { toast('Selecione ao menos 1 aluno', 'error'); return; }
    const ids = [...AppAdmin.alunosSelecionados];
    const pendentes = AppAdmin.mensalidades.filter(m => m.status === 'pendente' && ids.includes(m.aluno_id));
    if (pendentes.length === 0) {
        toast('Nenhum dos selecionados tem cobrança pendente', 'error');
        return;
    }
    const nomes = [...new Set(pendentes.map(m => {
        const a = AppAdmin.alunos.find(x => x.id === m.aluno_id);
        return a ? a.nome.split(' ')[0] : '?';
    }))];
    const total = pendentes.reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const r = await Swal.fire({
        title: 'Dar baixa em lote?',
        html: '<b>' + pendentes.length + '</b> cobrança(s) de <b>' + nomes.length + '</b> aluno(s) serão marcadas como pagas:<br><span style="color:#a1a1aa;font-size:13px;">' + nomes.join(', ') + '</span><br><b style="color:#22c55e;">Total: R$ ' + total.toFixed(2).replace('.', ',') + '</b>',
        icon: 'question', showCancelButton: true,
        confirmButtonColor: '#22c55e', cancelButtonColor: '#333',
        confirmButtonText: 'Sim, dar baixa', cancelButtonText: 'Cancelar',
        background: '#0a0a0c', color: '#fff'
    });
    if (!r.isConfirmed) return;
    if (!travarAcao('baixa-lote')) return;
    loading('Dando baixa...');
    try {
        const idsMens = pendentes.map(m => m.id);
        const { error } = await supabase.from('mensalidades').update({ status: 'pago' }).in('id', idsMens);
        if (error) throw error;
        for (const m of pendentes) {
            const a = AppAdmin.alunos.find(x => x.id === m.aluno_id);
            registrarLog('baixa_mensalidade', 'Baixa em lote de ' + m.mes + ' - ' + (a ? a.nome : 'aluno') + ' (R$ ' + Number(m.valor).toFixed(2).replace('.', ',') + ')', m.aluno_id, a ? a.nome : null);
        }
        await carregarTudo();
        limparSelecao();
        toast(pendentes.length + ' baixa(s) realizada(s)!');
    } catch (err) {
        Swal.close();
        toast(err.message || 'Erro na baixa em lote', 'error');
    } finally {
        destravarAcao('baixa-lote');
    }
};

// ========== SELEÇÃO MÚLTIPLA ==========
window.toggleSelecao = function(id) {
    if (AppAdmin.alunosSelecionados.has(id)) AppAdmin.alunosSelecionados.delete(id);
    else AppAdmin.alunosSelecionados.add(id);
    renderAlunos();
};

window.toggleModoSelecao = function() {
    AppAdmin.modoSelecao = !AppAdmin.modoSelecao;
    const sec = $('sec-alunos');
    const btn = $('btn-modo-selecao');

    if (AppAdmin.modoSelecao) {
        if (sec) sec.classList.add('adm-modo-selecao');
        if (btn) btn.classList.add('ativo');
    } else {
        if (sec) sec.classList.remove('adm-modo-selecao');
        if (btn) btn.classList.remove('ativo');
        AppAdmin.alunosSelecionados.clear();
        const barra = $('barra-massa');
        if (barra) barra.classList.remove('ativo');
    }
    renderAlunos();
};

window.limparSelecao = function() {
    AppAdmin.alunosSelecionados.clear();
    AppAdmin.modoSelecao = false;
    const barra = $('barra-massa');
    if (barra) barra.classList.remove('ativo');
    const sec = $('sec-alunos');
    if (sec) sec.classList.remove('adm-modo-selecao');
    const btn = $('btn-modo-selecao');
    if (btn) btn.classList.remove('ativo');
    renderAlunos();
};

// ========== MODAL GERAR MENSALIDADE (MASSA OU INDIVIDUAL) ==========
// Preenche o <select> de mês: mês atual (padrão) + próximos 2 meses.
// Evita erro de digitação do ADM e mantém o formato "Setembro/2026" do banco.
const MESES_GERAR = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

window.preencherMesesGerar = function() {
    const sel = $('mass-mes-geral');
    if (!sel) return;
    const hoje = new Date();
    const opcoes = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        opcoes.push(MESES_GERAR[d.getMonth()] + '/' + d.getFullYear());
    }
    const valorAnterior = sel.value;
    sel.innerHTML = opcoes.map(m => `<option value="${m}">${m}</option>`).join('');
    // Mantém o mês atual como padrão (primeira opção), a menos que já houvesse escolha válida
    sel.value = opcoes.includes(valorAnterior) ? valorAnterior : opcoes[0];
};

window.abrirModalGerarSelecionados = function() {
    AppAdmin.modoGerarIndividual = null;
    preencherMesesGerar();
    const titulo = $('titulo-gerar-mens');
    const sub = $('sub-gerar-mens');
    if (titulo) titulo.textContent = 'Gerar Cobrança em Massa';
    if (sub) sub.textContent = `${AppAdmin.alunosSelecionados.size} aluno(s) selecionado(s)`;
    
    const modal = $('modal-gerar-mens');
    if (modal) {
        modal.classList.add('aberto');
        document.body.style.overflow = 'hidden';
    }
};

window.abrirModalGerarIndividual = function(alunoId, nomeAluno) {
    AppAdmin.modoGerarIndividual = alunoId;
    preencherMesesGerar();
    const titulo = $('titulo-gerar-mens');
    const sub = $('sub-gerar-mens');
    if (titulo) titulo.textContent = 'Gerar Cobrança';
    if (sub) sub.textContent = `Para: ${nomeAluno}`;
    
    const modal = $('modal-gerar-mens');
    if (modal) {
        modal.classList.add('aberto');
        document.body.style.overflow = 'hidden';
    }
};

window.fecharModalGerar = function(e) {
    if (e && e.target !== $('modal-gerar-mens')) return;
    const modal = $('modal-gerar-mens');
    if (modal) modal.classList.remove('aberto');
    document.body.style.overflow = '';
    AppAdmin.modoGerarIndividual = null;
};

window.confirmarGerarMensalidade = async function() {
    let mes = $('mass-mes-geral').value.trim();
    const val = $('mass-valor-geral').value;

    if (!mes || mes.length < 3) { toast('Informe um mês válido', 'error'); return; }
    if (!val || !validarValor(val)) { toast('Informe um valor válido', 'error'); return; }

    mes = mes.replace(/\s+/g, ' ');
    mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();

    // Define quem vai receber
    let alvos = [];
    if (AppAdmin.modoGerarIndividual) {
        const al = AppAdmin.alunos.find(a => a.id === AppAdmin.modoGerarIndividual);
        if (al) alvos = [al];
    } else {
        alvos = AppAdmin.alunos.filter(a => AppAdmin.alunosSelecionados.has(a.id) && !a.plano_pausado && !a.assinante);
    }

    if (alvos.length === 0) {
        toast('Nenhum aluno válido selecionado (ativos sem VIP)', 'error');
        return;
    }
    if (!travarAcao('confirmar-gerar')) return; // ✅ anti double-tap

    loading('Verificando...');
    try {
        const { data: ex, error: eEx } = await supabase.from('mensalidades').select('aluno_id').eq('mes', mes);
        if (eEx) throw eEx;
        const ja = new Set((ex || []).map(m => m.aluno_id));

        const cobrar = alvos.filter(a => !ja.has(a.id));
        if (cobrar.length === 0) {
            Swal.close();
            toast(`Todos já cobrados em ${mes}`);
            return;
        }

        const cob = cobrar.map(a => ({
            aluno_id: a.id,
            mes: mes,
            valor: a.valor_mensalidade || parseFloat(val),
            status: 'pendente'
        }));

        const { error: eIns } = await supabase.from('mensalidades').insert(cob);
        if (eIns) throw eIns;
        registrarLog('gerar_cobrancas', cobrar.length + ' cobranca(s) gerada(s) para ' + mes + ' (' + (AppAdmin.modoGerarIndividual ? 'individual' : 'em lote') + ')');
        await carregarTudo();
        fecharModalGerar();
        toast(`${cobrar.length} cobrança(s) gerada(s)!`);
        if (!AppAdmin.modoGerarIndividual) limparSelecao();

    } catch (err) {
        Swal.close();
        toast(err.message, 'error');
    } finally {
        destravarAcao('confirmar-gerar');
    }
};

// ========== INICIALIZAÇÃO ÚNICA ==========
document.addEventListener('DOMContentLoaded', () => {
    verificarAdmin();
    checarManutencao();
    ligarRealtimeAdmin();
});


// ==========================================
// DISPARO WHATSAPP EM MASSA — MODO FILA COM PERSISTÊNCIA
// Substitua a seção antiga no admin-lite.js por esta
// ==========================================

const TEMPLATES_ZAP = {
  cobranca: `Olá, *{nome}*! Oss! 🥋\n\nPassando para lembrar da sua mensalidade de *{mes}* na 4L Academy.\n\n💰 *Valor:* R$ {valor},00\n\n📱 *Pague no App:* https://ccbteusml-svg.github.io/?modo=app\n\n_Ou Pix (Celular):_ *92985589868*\n\nNos vemos no tatame!`,

  aviso: `Olá, *{nome}*! Oss! 🥋\n\n📢 *Aviso da 4L Academy:*\n\n{custom}\n\nQualquer dúvida, chama no Zap!`,

  parabens: `Olá, *{nome}*! 🥋🎉\n\n{custom}\n\nDesejamos muitas felicidades, saúde e muitos treinos! Oss!`,

  lembrete: `E aí, *{nome}*! 👊🥋\n\nLembrando que hoje tem treino! Não falte!\n\n{custom}\n\nNos vemos no tatame!`,

  convite: `Olá, *{nome}*! 🥋\n\n{custom}\n\nConfirme sua presença pelo app ou responda aqui. Oss!`
};

const STORAGE_KEY = '4l_fila_disparo';

// ---------- SALVAR / CARREGAR FILA ----------
function salvarFila(estado) {
  // ✅ CORREÇÃO: salva apenas IDs e configurações. NUNCA salva nome/telefone.
  const seguro = {
    ids: estado.ids,
    index: estado.index,
    template: estado.template,
    mes: estado.mes,
    custom: estado.custom,
    nomeAtual: estado.nomeAtual || null,
    timestamp: Date.now()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seguro));
}

function carregarFila() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch { return null; }
}

function limparFila() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------- ABRIR MODAL ----------
window.abrirModalDisparoZap = function() {
  if (AppAdmin.alunosSelecionados.size === 0) {
    toast('Selecione pelo menos um aluno', 'error');
    return;
  }

  const modal = $('modal-disparo-zap');
  const lista = $('lista-disparo-zap');
  if (!modal || !lista) return;

  // Verifica se tem fila salva em andamento
  const filaSalva = carregarFila();
  if (filaSalva && filaSalva.ids.length > filaSalva.index) {
    Swal.fire({
      title: 'Fila em andamento!',
      text: `Você parou em ${filaSalva.nomeAtual || 'um aluno'}. Deseja continuar?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Continuar Fila',
      cancelButtonText: 'Começar Nova',
      confirmButtonColor: '#22c55e',
      cancelButtonColor: '#333',
      background: '#0a0a0c',
      color: '#fff'
    }).then(r => {
      if (r.isConfirmed) {
        // Recupera nomeAtual do aluno atual na fila
        const alunoAtual = AppAdmin.alunos.find(x => x.id === filaSalva.ids[filaSalva.index]);
        if (alunoAtual) filaSalva.nomeAtual = alunoAtual.nome;
        restaurarFilaUI(filaSalva);
      } else {
        limparFila();
        montarNovaFila();
      }
    });
  } else {
    limparFila();
    montarNovaFila();
  }

  modal.classList.add('aberto');
  document.body.style.overflow = 'hidden';
};

function montarNovaFila() {
  // Preenche mês atual
  const hoje = new Date();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const inputMes = $('zap-mes');
  if (inputMes && !inputMes.value) {
    inputMes.value = `${meses[hoje.getMonth()]}/${hoje.getFullYear()}`;
  }

  // Monta lista de preview
  const lista = $('lista-disparo-zap');
  lista.innerHTML = '';
  const ids = Array.from(AppAdmin.alunosSelecionados);
  
  ids.forEach((id, idx) => {
    const a = AppAdmin.alunos.find(x => x.id === id);
    if (!a) return;
    const foto = a.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.nome)}&background=161618&color=fff`;
    const item = document.createElement('div');
    item.className = 'adm-disparo-item';
    item.id = `fila-item-${id}`;
    item.innerHTML = `
      <img src="${foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <h5 style="margin:0;font-size:12px;color:var(--adm-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(a.nome)}</h5>
        <p style="margin:2px 0 0;font-size:10px;color:var(--adm-text-2);">${a.telefone || 'Sem telefone'}</p>
      </div>
      <span class="adm-tag" style="font-size:9px;background:rgba(255,255,255,0.05);color:var(--adm-text-3);" id="status-${id}">#${idx + 1}</span>
    `;
    lista.appendChild(item);
  });

  atualizarPreviewDisparo();
  resetarBotoesFila(ids, 0);
}

function restaurarFilaUI(fila) {
  // Re-monta a lista com o estado salvo
  const lista = $('lista-disparo-zap');
  lista.innerHTML = '';
  
  fila.ids.forEach((id, idx) => {
    const a = AppAdmin.alunos.find(x => x.id === id);
    if (!a) return;
    const foto = a.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.nome)}&background=161618&color=fff`;
    const item = document.createElement('div');
    item.className = 'adm-disparo-item';
    item.id = `fila-item-${id}`;
    const isEnviado = idx < fila.index;
    const isAtual = idx === fila.index;
    
    let statusHtml;
    if (isEnviado) {
      statusHtml = `<span class="adm-tag" style="font-size:9px;background:rgba(34,197,94,0.12);color:#22c55e;">✅ Enviado</span>`;
    } else if (isAtual) {
      statusHtml = `<span class="adm-tag" style="font-size:9px;background:rgba(245,158,11,0.12);color:#f59e0b;">⏳ Atual</span>`;
    } else {
      statusHtml = `<span class="adm-tag" style="font-size:9px;background:rgba(255,255,255,0.05);color:var(--adm-text-3);">#${idx + 1}</span>`;
    }
    
    item.innerHTML = `
      <img src="${foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;${isEnviado ? 'opacity:0.4;' : ''}">
      <div style="flex:1;min-width:0;${isEnviado ? 'opacity:0.4;' : ''}">
        <h5 style="margin:0;font-size:12px;color:var(--adm-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(a.nome)}</h5>
        <p style="margin:2px 0 0;font-size:10px;color:var(--adm-text-2);">${a.telefone || 'Sem telefone'}</p>
      </div>
      ${statusHtml}
    `;
    lista.appendChild(item);
  });

  // Restaura inputs
  if ($('zap-template')) $('zap-template').value = fila.template;
  if ($('zap-mes')) $('zap-mes').value = fila.mes;
  if ($('zap-msg-custom')) $('zap-msg-custom').value = fila.custom || '';
  
  atualizarPreviewDisparo();
  resetarBotoesFila(fila.ids, fila.index, fila.nomeAtual);
  
  // Scroll até o atual
  setTimeout(() => {
    const atualEl = document.getElementById(`fila-item-${fila.ids[fila.index]}`);
    if (atualEl) atualEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

// ---------- PREVIEW ----------
window.atualizarPreviewDisparo = function() {
  const template = $('zap-template')?.value || 'cobranca';
  const custom = $('zap-msg-custom')?.value?.trim() || '';
  const mes = $('zap-mes')?.value || '';
  const previewEl = $('zap-preview');
  
  if (!previewEl) return;

  const primeiroId = Array.from(AppAdmin.alunosSelecionados)[0];
  const a = AppAdmin.alunos.find(x => x.id === primeiroId);
  const nomeEx = a ? a.nome : 'João Silva';
  const valorEx = a ? (a.valor_mensalidade || 25) : 25;

  let msg = (TEMPLATES_ZAP[template] || TEMPLATES_ZAP.cobranca)
    .replace(/{nome}/g, nomeEx)
    .replace(/{mes}/g, mes || 'Agosto/2026')
    .replace(/{valor}/g, valorEx)
    .replace(/{custom}/g, custom || '—');

  previewEl.textContent = msg;
};

// ---------- BOTÕES DA FILA ----------
function resetarBotoesFila(ids, index, nomeAtual) {
  const btnIniciar = $('btn-iniciar-fila');
  const btnParar = $('btn-parar-fila');
  const contador = $('fila-contador');
  
  if (!btnIniciar || !btnParar) return;

  if (index >= ids.length) {
    // Fila concluída
    btnIniciar.style.display = 'none';
    btnParar.style.display = 'none';
    if (contador) contador.textContent = '✅ Concluído!';
    limparFila();
    return;
  }

  const a = AppAdmin.alunos.find(x => x.id === ids[index]);
  const nome = a ? a.nome.split(' ')[0] : 'próximo';
  
  if (index === 0 && !nomeAtual) {
    // Estado inicial
    btnIniciar.style.display = 'inline-flex';
    btnIniciar.innerHTML = `<i class="fa-brands fa-whatsapp"></i> 🚀 Iniciar Disparo`;
    btnIniciar.onclick = () => executarPassoFila(ids, 0);
    btnParar.style.display = 'none';
  } else {
    // Em andamento
    btnIniciar.style.display = 'inline-flex';
    btnIniciar.innerHTML = `<i class="fa-brands fa-whatsapp"></i> ✅ Enviado, próximo: ${nome}`;
    btnIniciar.onclick = () => executarPassoFila(ids, index);
    btnParar.style.display = 'inline-flex';
  }
  
  if (contador) contador.textContent = `${index}/${ids.length}`;
}

// ---------- EXECUTAR PASSO ----------
window.executarPassoFila = function(ids, index) {
  if (index >= ids.length) {
    toast('Todos os alunos foram processados!');
    limparFila();
    resetarBotoesFila(ids, index);
    return;
  }

  const a = AppAdmin.alunos.find(x => x.id === ids[index]);
  if (!a) {
    // Pula se não achou
    executarPassoFila(ids, index + 1);
    return;
  }

  const tel = a.telefone || '';
  const numLimpo = tel.replace(/\D/g, '');

  // Marca visual anterior como enviado
  if (index > 0) {
    const antId = ids[index - 1];
    const antStatus = $(`status-${antId}`);
    const antItem = document.getElementById(`fila-item-${antId}`);
    if (antStatus) {
      antStatus.textContent = '✅ Enviado';
      antStatus.style.cssText = 'font-size:9px;background:rgba(34,197,94,0.12);color:#22c55e;';
    }
    if (antItem) {
      antItem.querySelector('img').style.opacity = '0.4';
      antItem.querySelector('div').style.opacity = '0.4';
    }
  }

  // Marca atual como "abrindo"
  const statusEl = $(`status-${a.id}`);
  const itemEl = document.getElementById(`fila-item-${a.id}`);
  if (statusEl) {
    statusEl.textContent = '⏳ Abrindo...';
    statusEl.style.cssText = 'font-size:9px;background:rgba(245,158,11,0.12);color:#f59e0b;';
  }
  if (itemEl) itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Monta mensagem
  const template = $('zap-template')?.value || 'cobranca';
  const custom = $('zap-msg-custom')?.value?.trim() || '';
  const mes = $('zap-mes')?.value || '';
  const valor = a.valor_mensalidade || 25;

  let msg = (TEMPLATES_ZAP[template] || TEMPLATES_ZAP.cobranca)
    .replace(/{nome}/g, a.nome)
    .replace(/{mes}/g, mes)
    .replace(/{valor}/g, valor)
    .replace(/{custom}/g, custom);

  if (!tel || numLimpo.length < 10) {
    if (statusEl) {
      statusEl.textContent = '❌ Sem Zap';
      statusEl.style.cssText = 'font-size:9px;background:rgba(255,82,82,0.12);color:#ff5252;';
    }
    // Salva estado e avança para o próximo estar pronto
    salvarFila({ ids, index: index + 1, template, mes, custom });
    resetarBotoesFila(ids, index + 1);
    return;
  }

  // Abre WhatsApp
  window.open(`https://wa.me/55${numLimpo}?text=${encodeURIComponent(msg)}`, '_blank');

  // Salva estado
  const proximo = AppAdmin.alunos.find(x => x.id === ids[index + 1]);
  salvarFila({ ids, index: index + 1, template, mes, custom, nomeAtual: proximo ? proximo.nome : null });

  // Atualiza botão para o próximo
  resetarBotoesFila(ids, index + 1, proximo ? proximo.nome : null);
};

window.pararFilaDisparo = function() {
  limparFila();
  const btnIniciar = $('btn-iniciar-fila');
  const btnParar = $('btn-parar-fila');
  if (btnIniciar) {
    btnIniciar.style.display = 'inline-flex';
    btnIniciar.innerHTML = `<i class="fa-brands fa-whatsapp"></i> 🚀 Recomeçar Fila`;
    btnIniciar.onclick = () => {
      const fila = carregarFila();
      if (fila) {
        restaurarFilaUI(fila);
      } else {
        montarNovaFila();
      }
    };
  }
  if (btnParar) btnParar.style.display = 'none';
};

window.fecharModalDisparo = function(e) {
  if (e && e.target !== $('modal-disparo-zap')) return;
  const modal = $('modal-disparo-zap');
  if (modal) modal.classList.remove('aberto');
  document.body.style.overflow = '';
};

// ---------- EXPORTAR CSV ----------
window.exportarCSVDisparo = function() {
  if (AppAdmin.alunosSelecionados.size === 0) { 
    toast('Selecione alunos primeiro', 'error'); 
    return; 
  }

  const mes = $('zap-mes')?.value || '';
  const custom = $('zap-msg-custom')?.value?.trim() || '';
  const template = $('zap-template')?.value || 'cobranca';

  let csv = '\uFEFFNome,Telefone,Mensagem\n';

  AppAdmin.alunosSelecionados.forEach(id => {
    const a = AppAdmin.alunos.find(x => x.id === id);
    if (!a || !a.telefone) return;
    const valor = a.valor_mensalidade || 25;
    const msg = (TEMPLATES_ZAP[template] || TEMPLATES_ZAP.cobranca)
      .replace(/{nome}/g, a.nome)
      .replace(/{mes}/g, mes)
      .replace(/{valor}/g, valor)
      .replace(/{custom}/g, custom)
      .replace(/\n/g, ' ')
      .replace(/"/g, '""');  // ✅ CORREÇÃO: escapa aspas duplas para não quebrar o CSV

    const safeNome = a.nome.replace(/"/g, '""');
    csv += `"${safeNome}","${a.telefone}","${msg}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `disparo-4l-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();

  toast('CSV baixado!', 'success');
};

// ---------- LIMPAR FILA ANTIGA AO CARREGAR PÁGINA ----------
// Se a fila tiver mais de 24h, apaga sozinha
(function limparFilaAntiga() {
  const fila = carregarFila();
  if (fila && fila.timestamp) {
    const horas = (Date.now() - fila.timestamp) / 3600000;
    if (horas > 24) limparFila();
  }
})();
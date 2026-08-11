// ==========================================
// 4L ACADEMY — ADMIN LITE v2.2 (SEGURANÇA + VALIDAÇÃO)
// ==========================================

let _alunos = [];
let _mensalidades = [];
let _avisos = [];
let _filtroAluno = 'todos';
let _alunoSelecionado = null;
let _abaDossie = 'perfil';
let _dadosCarregados = false;
let _manutencaoAtiva = false;
let _secaoAtual = 'dashboard';
let _alunosSelecionados = new Set();
let _modoGerarIndividual = null; // null = massa, string id = individual
let _modoSelecao = false;



const $ = (id) => document.getElementById(id);

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
const validarTelefone = (tel) => tel.replace(/\D/g, '').length >= 10;
const validarSenha = (senha) => typeof senha === 'string' && senha.length >= 6;
const validarNome = (nome) => typeof nome === 'string' && nome.trim().length >= 2;
const validarData = (data) => !!data && !isNaN(new Date(data).getTime());
const validarValor = (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0;

async function verificarAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    const { data: perfil } = await supabase.from('perfis').select('cargo').eq('id', session.user.id).single();
    if (!perfil || perfil.cargo !== 'professor') { window.location.href = 'painel.html'; return; }
    if (!_dadosCarregados) await carregarTudo();
}

window.abrirSecao = function(sec) {
    window._secaoAtual = sec;

    document.querySelectorAll('.adm-secao').forEach(s => s.classList.remove('ativa'));
    document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('ativo'));

    const secEl = $('sec-' + sec);
    if (secEl) secEl.classList.add('ativa');

    // ✅ CORREÇÃO: Config não tem ícone no nav inferior — não ativa nenhum
    const map = { dashboard: 0, alunos: 1, financeiro: 2, mural: 3 };
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
};


// Detecta qual aba está visível no momento — nunca erra
function getSecaoAtiva() {
    const secoes = ['dashboard', 'alunos', 'financeiro', 'mural', 'config'];
    for (const sec of secoes) {
        const el = $('sec-' + sec);
        if (el && el.classList.contains('ativa')) return sec;
    }
    return 'dashboard';
}

async function carregarTudo() {
    loading('Sincronizando dados...');
    try {
        const [{ data: alunos }, { data: mens }, { data: avisos }] = await Promise.all([
            supabase.from('perfis').select('*').neq('cargo', 'professor').order('nome'),
            supabase.from('mensalidades').select('*').order('criado_em', { ascending: false }),
            supabase.from('avisos').select('*').order('criado_em', { ascending: false })
        ]);
        _alunos = alunos || [];
        _mensalidades = mens || [];
        _avisos = avisos || [];
        _dadosCarregados = true;
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
    const ativos = _alunos.filter(a => !a.plano_pausado);
    const inativos = _alunos.filter(a => a.plano_pausado);
    const vips = _alunos.filter(a => a.assinante && !a.plano_pausado);

    const recebido = _mensalidades.filter(m => m.status === 'pago').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const pendente = _mensalidades.filter(m => m.status === 'pendente').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);

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
    if (elRecD) elRecD.textContent = `${_mensalidades.filter(m => m.status === 'pago').length} pagamentos`;
    if (elPenD) elPenD.textContent = `${_mensalidades.filter(m => m.status === 'pendente').length} em aberto`;
    if (elVipsD) elVipsD.textContent = `${vips.length} recorrente${vips.length !== 1 ? 's' : ''}`;

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
            const val = _mensalidades
                .filter(m => m.status === 'pago' && possiveis.some(nm => (m.mes || '').toLowerCase().includes(nm.toLowerCase())))
                .reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
            if (val > maxReceita) maxReceita = val;
        }
        maxReceita = Math.max(maxReceita, 1);
        for (let i = 5; i >= 0; i--) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const mesNome = Object.keys(mesesMap)[d.getMonth()];
            const possiveisNomes = mesesMap[mesNome];
            const val = _mensalidades
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
    const anivs = _alunos.filter(a => a.data_nascimento && parseInt(a.data_nascimento.split('-')[1]) === mesAtual);
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
    
        let filtrados = [..._alunos];
        if (termo) filtrados = filtrados.filter(a =>
            (a.nome || '').toLowerCase().includes(termo) ||
            (a.faixa || '').toLowerCase().includes(termo) ||
            (a.telefone || '').includes(termo)
        );
    
        if (_filtroAluno === 'ativos') filtrados = filtrados.filter(a => !a.plano_pausado);
        else if (_filtroAluno === 'inativos') filtrados = filtrados.filter(a => a.plano_pausado);
        else if (_filtroAluno === 'vip') filtrados = filtrados.filter(a => a.assinante);
        else if (_filtroAluno === 'pendentes') {
            const idsPendentes = new Set(_mensalidades.filter(m => m.status === 'pendente').map(m => m.aluno_id));
            filtrados = filtrados.filter(a => idsPendentes.has(a.id));
        }
    
        // Barra de ações em massa
        const barra = $('barra-massa');
        const countEl = $('mass-count');
        if (_modoSelecao && _alunosSelecionados.size > 0) {
            if (barra) barra.classList.add('ativo');
            if (countEl) countEl.textContent = `${_alunosSelecionados.size} selecionado${_alunosSelecionados.size > 1 ? 's' : ''}`;
        } else {
            if (barra) barra.classList.remove('ativo');
        }
    
        const ativos = _alunos.filter(a => !a.plano_pausado);
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
            const mensPendente = _mensalidades.filter(m => m.aluno_id === a.id && m.status === 'pendente')[0];
            const isSel = _alunosSelecionados.has(a.id);
    
            const item = document.createElement('div');
            item.className = 'adm-list-item' + (isSel ? ' selecionado' : '');
            item.style.cssText = 'cursor:pointer; padding:14px 0;';
    
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
    _filtroAluno = f;
    document.querySelectorAll('#filtros-alunos .adm-chip').forEach(c => {
        c.classList.toggle('ativo', c.dataset.filtro === f);
    });
    renderAlunos();
};

window.abrirDossie = async function(id) {
    const aluno = _alunos.find(a => a.id === id);
    if (!aluno) return;
    if (!aluno) { toast('Aluno não encontrado', 'error'); return; }
    _alunoSelecionado = aluno;
    _abaDossie = 'perfil';

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
    _alunoSelecionado = null;
};

window.setAbaDossie = function(aba, el) {
    _abaDossie = aba;
    document.querySelectorAll('.adm-modal-tab').forEach(t => t.classList.remove('ativo'));
    if (el) el.classList.add('ativo');
    renderDossieConteudo();
};

// ========== DOSSIÊ (SEM innerHTML em dados dinâmicos) ==========
function renderDossieConteudo() {
    const a = _alunoSelecionado;
    if (!a) return;
    const container = $('dossie-conteudo');
    if (!container) return;
    container.innerHTML = '';

    if (_abaDossie === 'perfil') {
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

    } else if (_abaDossie === 'financeiro') {
        const mensAluno = _mensalidades.filter(m => m.aluno_id === a.id).slice(0, 12);
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
            p.textContent = isPago ? '✅ Pago' : '🔴 Pendente';
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
        btnGerar.className = 'adm-btn-full';
        btnGerar.style.cssText = 'background:var(--adm-red);border:none;color:white;';
        btnGerar.innerHTML = '<i class="fa-solid fa-file-invoice-dollar"></i> Gerar Mensalidade';
        btnGerar.onclick = () => {
            fecharModalDossie();
            setTimeout(() => abrirModalGerarIndividual(a.id, a.nome), 300);
        };
        wrap.appendChild(btnGerar);

        const btnEdit = document.createElement('button');
        btnEdit.className = 'adm-btn-full';
        btnEdit.style.cssText = 'background:var(--adm-surface-2);border:1px solid var(--adm-border);color:var(--adm-text);';
        btnEdit.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Perfil';
        btnEdit.onclick = editarAlunoDossie;
        wrap.appendChild(btnEdit);

        const btnPause = document.createElement('button');
        btnPause.className = 'adm-btn-full';
        btnPause.style.cssText = `background:transparent;border:1px solid ${corBtn};color:${corBtn};`;
        btnPause.textContent = txtBtn;
        btnPause.onclick = () => alternarPlano(a.id, a.nome, acao);
        wrap.appendChild(btnPause);

        if (a.assinante) {
            const btnCancel = document.createElement('button');
            btnCancel.className = 'adm-btn-full';
            btnCancel.style.cssText = 'background:transparent;border:1px solid #ff5252;color:#ff5252;';
            btnCancel.innerHTML = '<i class="fa-solid fa-crown"></i> Cancelar VIP';
            btnCancel.onclick = () => cancelarVIP(a.id, a.nome);
            wrap.appendChild(btnCancel);
        }

        const btnDel = document.createElement('button');
        btnDel.className = 'adm-btn-full';
        btnDel.style.cssText = 'background:transparent;border:1px solid #ff5252;color:#ff5252;margin-top:10px;';
        btnDel.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir Aluno';
        btnDel.onclick = () => excluirAluno(a.id, a.nome);
        wrap.appendChild(btnDel);

        container.appendChild(wrap);
    }
}

window.editarAlunoDossie = async function() {
    const a = _alunoSelecionado;
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
        await supabase.from('perfis').update({
            nome: v.nome.trim(), telefone: v.telefone, faixa: v.faixa,
            valor_mensalidade: v.valor ? parseFloat(v.valor) : null
        }).eq('id', a.id);
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
        await supabase.from('perfis').update({ plano_pausado: cong }).eq('id', id);
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
        await supabase.from('perfis').update({ assinante: false, plano_pausado: false }).eq('id', id);
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
    const recebido = _mensalidades.filter(m => m.status === 'pago').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const pendente = _mensalidades.filter(m => m.status === 'pendente').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const elRec = $('fin-recebido');
    const elPen = $('fin-pendente');
    if (elRec) elRec.textContent = formatCurrency(recebido);
    if (elPen) elPen.textContent = formatCurrency(pendente);

    const inputBusca = $('busca-financeiro');
    const termo = (inputBusca?.value || '').toLowerCase();
    let pendentes = _mensalidades.filter(m => m.status === 'pendente');

    if (termo) {
        pendentes = pendentes.filter(m => {
            const al = _alunos.find(a => a.id === m.aluno_id);
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
        const al = _alunos.find(a => a.id === m.aluno_id);
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
        btnBaixa.className = 'adm-btn-sm success adm-w-full';
        btnBaixa.innerHTML = '<i class="fa-solid fa-check"></i> Dar Baixa';
        btnBaixa.onclick = () => darBaixa(m.id);
        actions.appendChild(btnBaixa);

        const btnZap = document.createElement('button');
        btnZap.className = 'adm-btn-sm whatsapp';
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
        loading('Atualizando...');
        await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', id);
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
        await supabase.from('mensalidades').delete().eq('id', id);
        await carregarTudo();
        toast('Cobrança removida');
    }
};

// ========== MURAL (SEM innerHTML em dados dinâmicos) ==========
function renderMural() {
    const lista = $('lista-avisos');
    if (!lista) return;
    lista.innerHTML = '';

    if (_avisos.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'adm-empty';
        empty.innerHTML = '<i class="fa-solid fa-bullhorn"></i><p>Nenhum aviso publicado</p>';
        lista.appendChild(empty);
        return;
    }

    _avisos.forEach(av => {
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
        p.style.cssText = 'margin:0;font-size:13px;color:var(--adm-text-2);line-height:1.5;';
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

    loading('Publicando...');
    await supabase.from('avisos').insert([{ titulo: titulo, mensagem: mensagem }]);
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
        await supabase.from('avisos').delete().eq('id', id);
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

    loading('Cadastrando...');
    try {
        const { data, error } = await supabase.functions.invoke('criar-aluno-admin', { body: dados });
        if (error || (data && data.error)) throw new Error(error?.message || data?.error);
        await carregarTudo();
        toast('Aluno criado com sucesso!');
        return true;
    } catch (err) {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'Falha no Cadastro', text: err.message, background: '#0a0a0c', color: '#fff', confirmButtonColor: '#E53935' });
        return false;
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

    mes = mes.replace(/\s+/g, ' ');
    mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();

    loading('Verificando...');
    try {
        // ✅ CORRIGIDO: Busca TODOS os alunos (incluindo assinante=null) e filtra no JS
        const { data: alm } = await supabase.from('perfis').select('id,valor_mensalidade,plano_pausado,assinante').neq('cargo', 'professor');
        const atv = (alm || []).filter(a => !a.plano_pausado && !a.assinante);

        if (atv.length === 0) { Swal.close(); toast('Nenhum aluno ativo sem VIP', 'error'); return; }

        const { data: ex } = await supabase.from('mensalidades').select('aluno_id').eq('mes', mes);
        const ja = new Set((ex || []).map(m => m.aluno_id));
        const cobrar = atv.filter(a => !ja.has(a.id));

        if (cobrar.length === 0) { Swal.close(); toast(`Todos já cobrados em ${mes}`); return; }

        const cob = cobrar.map(a => ({
            aluno_id: a.id, mes: mes, valor: a.valor_mensalidade || parseFloat(val), status: 'pendente'
        }));
        await supabase.from('mensalidades').insert(cob);
        await carregarTudo();
        toast(`${cobrar.length} cobranças geradas!`);
        $('mes-geral').value = '';
    } catch (err) {
        Swal.close();
        toast(err.message, 'error');
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
    const { data } = await supabase.from('sistema_config').select('manutencao_ativa').eq('id', 1).single();
    if (data) {
        _manutencaoAtiva = !data.manutencao_ativa;
        await supabase.from('sistema_config').update({ manutencao_ativa: _manutencaoAtiva }).eq('id', 1);
        atualizarBtnManutencao();
        toast(_manutencaoAtiva ? 'Modo manutenção ATIVADO' : 'Modo manutenção DESATIVADO');
    }
};

function atualizarBtnManutencao() {
    const btn = $('btn-manutencao');
    if (!btn) return;
    if (_manutencaoAtiva) {
        btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Desativar Modo Manutenção';
        btn.style.color = '#22c55e';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Ativar Modo Manutenção';
        btn.style.color = 'var(--adm-text)';
    }
}

async function checarManutencao() {
    const { data } = await supabase.from('sistema_config').select('manutencao_ativa').eq('id', 1).single();
    if (data) { _manutencaoAtiva = data.manutencao_ativa; atualizarBtnManutencao(); }
}

window.sair = async function() {
    const r = await Swal.fire({
        title: 'Sair?', icon: 'question', showCancelButton: true,
        confirmButtonColor: '#E53935', cancelButtonColor: '#333',
        confirmButtonText: 'Sim', cancelButtonText: 'Cancelar',
        background: '#0a0a0c', color: '#fff'
    });
    if (r.isConfirmed) {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    }
};

// ========== REALTIME: ATUALIZA AUTOMATICAMENTE ==========
let _rtTimeout = null;
function recarregarComDebounce() {
    if (_rtTimeout) clearTimeout(_rtTimeout);
    _rtTimeout = setTimeout(() => {
        const modalAberto = document.querySelector('.adm-modal-overlay.aberto');
        if (!modalAberto) carregarTudo();
    }, 800);
}

function ligarRealtimeAdmin() {
    supabase.channel('admin-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensalidades' }, recarregarComDebounce)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'perfis' }, recarregarComDebounce)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, recarregarComDebounce)
        .subscribe((status) => {
            console.log('[ADMIN] Realtime status:', status);
        });
}

// ========== SELEÇÃO MÚLTIPLA ==========
window.toggleSelecao = function(id) {
    if (_alunosSelecionados.has(id)) _alunosSelecionados.delete(id);
    else _alunosSelecionados.add(id);
    renderAlunos();
};

window.toggleModoSelecao = function() {
    _modoSelecao = !_modoSelecao;
    const sec = $('sec-alunos');
    const btn = $('btn-modo-selecao');

    if (_modoSelecao) {
        if (sec) sec.classList.add('adm-modo-selecao');
        if (btn) btn.classList.add('ativo');
    } else {
        if (sec) sec.classList.remove('adm-modo-selecao');
        if (btn) btn.classList.remove('ativo');
        _alunosSelecionados.clear();
    }
    renderAlunos();
};

window.limparSelecao = function() {
    _alunosSelecionados.clear();
    const barra = $('barra-massa');
    if (barra) barra.classList.remove('ativo');
    // ✅ CORREÇÃO: re-renderiza para remover o visual de selecionado dos itens
    renderAlunos();
};

// ========== MODAL GERAR MENSALIDADE (MASSA OU INDIVIDUAL) ==========
window.abrirModalGerarSelecionados = function() {
    _modoGerarIndividual = null;
    const titulo = $('titulo-gerar-mens');
    const sub = $('sub-gerar-mens');
    if (titulo) titulo.textContent = 'Gerar Cobrança em Massa';
    if (sub) sub.textContent = `${_alunosSelecionados.size} aluno(s) selecionado(s)`;
    
    const modal = $('modal-gerar-mens');
    if (modal) {
        modal.classList.add('aberto');
        document.body.style.overflow = 'hidden';
    }
};

window.abrirModalGerarIndividual = function(alunoId, nomeAluno) {
    _modoGerarIndividual = alunoId;
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
    _modoGerarIndividual = null;
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
    if (_modoGerarIndividual) {
        const al = _alunos.find(a => a.id === _modoGerarIndividual);
        if (al) alvos = [al];
    } else {
        alvos = _alunos.filter(a => _alunosSelecionados.has(a.id) && !a.plano_pausado && !a.assinante);
    }

    if (alvos.length === 0) {
        toast('Nenhum aluno válido selecionado (ativos sem VIP)', 'error');
        return;
    }

    loading('Verificando...');
    try {
        const { data: ex } = await supabase.from('mensalidades').select('aluno_id').eq('mes', mes);
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

        await supabase.from('mensalidades').insert(cob);
        await carregarTudo();
        fecharModalGerar();
        toast(`${cobrar.length} cobrança(s) gerada(s)!`);
        $('mass-mes-geral').value = '';
        if (!_modoGerarIndividual) limparSelecao();

    } catch (err) {
        Swal.close();
        toast(err.message, 'error');
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
  estado.timestamp = Date.now();  // ✅ CORREÇÃO: salva timestamp para limpeza automática
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
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
  if (_alunosSelecionados.size === 0) {
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
  const ids = Array.from(_alunosSelecionados);
  
  ids.forEach((id, idx) => {
    const a = _alunos.find(x => x.id === id);
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
    const a = _alunos.find(x => x.id === id);
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

  const primeiroId = Array.from(_alunosSelecionados)[0];
  const a = _alunos.find(x => x.id === primeiroId);
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

  const a = _alunos.find(x => x.id === ids[index]);
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

  const a = _alunos.find(x => x.id === ids[index]);
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
    salvarFila({ ids, index: index + 1, template, mes, custom, nomeAtual: a.nome });
    resetarBotoesFila(ids, index + 1);
    return;
  }

  // Abre WhatsApp
  window.open(`https://wa.me/55${numLimpo}?text=${encodeURIComponent(msg)}`, '_blank');

  // Salva estado
  const proximo = _alunos.find(x => x.id === ids[index + 1]);
  salvarFila({ 
    ids, 
    index: index + 1, 
    template, 
    mes, 
    custom, 
    nomeAtual: proximo ? proximo.nome.split(' ')[0] : null 
  });

  // Atualiza botão para o próximo
  resetarBotoesFila(ids, index + 1);
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
  if (_alunosSelecionados.size === 0) { 
    toast('Selecione alunos primeiro', 'error'); 
    return; 
  }

  const mes = $('zap-mes')?.value || '';
  const custom = $('zap-msg-custom')?.value?.trim() || '';
  const template = $('zap-template')?.value || 'cobranca';

  let csv = 'Nome,Telefone,Mensagem\n';

  _alunosSelecionados.forEach(id => {
    const a = _alunos.find(x => x.id === id);
    if (!a || !a.telefone) return;
    const valor = a.valor_mensalidade || 25;
    const msg = (TEMPLATES_ZAP[template] || TEMPLATES_ZAP.cobranca)
      .replace(/{nome}/g, a.nome)
      .replace(/{mes}/g, mes)
      .replace(/{valor}/g, valor)
      .replace(/{custom}/g, custom)
      .replace(/\n/g, ' ')
      .replace(/"/g, '""');  // ✅ CORREÇÃO: escapa aspas duplas para não quebrar o CSV

    csv += `"${a.nome}","${a.telefone}","${msg}"\n`;
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

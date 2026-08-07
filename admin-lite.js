// ==========================================
// 4L ACADEMY — ADMIN LITE v2.1 (CORRIGIDO)
// ==========================================

let _alunos = [];
let _mensalidades = [];
let _avisos = [];
let _filtroAluno = 'todos';
let _alunoSelecionado = null;
let _abaDossie = 'perfil';
let _dadosCarregados = false;
let _manutencaoAtiva = false;

const $ = (id) => document.getElementById(id);
const toast = (msg, tipo = 'success') => {
    const el = $('adm-toast');
    const msgEl = $('adm-toast-msg');
    if (!el || !msgEl) return;
    msgEl.innerText = msg;
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
    if (t.includes('amarela')) return '#f59e0b';
    if (t.includes('laranja')) return '#ff9800';
    if (t.includes('verde')) return '#22c55e';
    if (t.includes('azul')) return '#3b82f6';
    if (t.includes('roxa')) return '#a855f7';
    if (t.includes('marrom')) return '#8d6e63';
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

async function verificarAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    const { data: perfil } = await supabase.from('perfis').select('cargo').eq('id', session.user.id).single();
    if (!perfil || perfil.cargo !== 'professor') { window.location.href = 'painel.html'; return; }
    if (!_dadosCarregados) await carregarTudo();
}

window.abrirSecao = function(sec) {
    document.querySelectorAll('.adm-secao').forEach(s => s.classList.remove('ativa'));
    document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('ativo'));

    const map = { dashboard: 0, alunos: 1, financeiro: 2, mural: 3, config: 3 };
    const secEl = $('sec-' + sec);
    if (secEl) secEl.classList.add('ativa');

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

async function carregarTudo() {
    loading('Sincronizando dados...');
    try {
        const [{ data: alunos }, { data: mens }, { data: avisos }] = await Promise.all([
            supabase.from('perfis').select('*').neq('cargo', 'professor').order('nome'),
            supabase.from('mensalidades').select('*').order('created_at', { ascending: false }),
            supabase.from('avisos').select('*').order('created_at', { ascending: false })
        ]);
        _alunos = alunos || [];
        _mensalidades = mens || [];
        _avisos = avisos || [];
        _dadosCarregados = true;
        Swal.close();
        renderDashboard();
    } catch (e) {
        Swal.close();
        toast('Erro ao carregar dados', 'error');
        console.error(e);
    }
}

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

    if (elAtivos) elAtivos.innerText = ativos.length;
    if (elRec) elRec.innerText = formatCurrency(recebido);
    if (elPen) elPen.innerText = formatCurrency(pendente);
    if (elVips) elVips.innerText = vips.length;

    const elAtivosD = $('kpi-ativos-delta');
    const elRecD = $('kpi-recebido-delta');
    const elPenD = $('kpi-pendente-delta');
    const elVipsD = $('kpi-vips-delta');

    if (elAtivosD) elAtivosD.innerText = `${inativos.length} inativo${inativos.length !== 1 ? 's' : ''}`;
    if (elRecD) elRecD.innerText = `${_mensalidades.filter(m => m.status === 'pago').length} pagamentos`;
    if (elPenD) elPenD.innerText = `${_mensalidades.filter(m => m.status === 'pendente').length} em aberto`;
    if (elVipsD) elVipsD.innerText = `${vips.length} recorrente${vips.length !== 1 ? 's' : ''}`;

    // Gráfico de barras CSS (últimos 6 meses) - CORRIGIDO
    const mesesMap = {
        'Jan': ['Jan','Janeiro'], 'Fev': ['Fev','Fevereiro'], 'Mar': ['Mar','Março'],
        'Abr': ['Abr','Abril'], 'Mai': ['Mai','Maio'], 'Jun': ['Jun','Junho'],
        'Jul': ['Jul','Julho'], 'Ago': ['Ago','Agosto'], 'Set': ['Set','Setembro'],
        'Out': ['Out','Outubro'], 'Nov': ['Nov','Novembro'], 'Dez': ['Dez','Dezembro']
    };
    const hoje = new Date();
    let htmlChart = '';
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const mesNome = Object.keys(mesesMap)[d.getMonth()];
        const possiveisNomes = mesesMap[mesNome];
        const val = _mensalidades
            .filter(m => m.status === 'pago' && possiveisNomes.some(nm => (m.mes || '').toLowerCase().includes(nm.toLowerCase())))
            .reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
        const pct = Math.max(8, Math.min(100, val > 0 ? (val / 500) * 100 : 8));
        htmlChart += `<div class="adm-chart-bar" style="height:${pct}%"><span class="adm-chart-label">${mesNome}</span></div>`;
    }
    const grafico = $('grafico-receita');
    if (grafico) grafico.innerHTML = htmlChart;

    // Aniversariantes
    const mesAtual = hoje.getMonth() + 1;
    const anivs = _alunos.filter(a => a.data_nascimento && parseInt(a.data_nascimento.split('-')[1]) === mesAtual);
    const cardAniv = $('card-aniversarios');
    const listaAniv = $('lista-aniversarios');
    if (cardAniv && listaAniv) {
        if (anivs.length > 0) {
            cardAniv.style.display = 'block';
            listaAniv.innerHTML = anivs.map(a => {
                const dia = a.data_nascimento.split('-')[2];
                const num = a.telefone ? a.telefone.replace(/\D/g, '') : '';
                const link = num ? `https://wa.me/55${num}?text=${encodeURIComponent('Parabéns, ' + a.nome + '! 🎉 Oss! 🥋')}` : '#';
                const foto = a.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.nome)}&background=161618&color=fff`;
                return `<div class="adm-bday-card">
                    <img src="${foto}" alt="" loading="lazy">
                    <h5>${a.nome.split(' ')[0]}</h5>
                    <p>Dia ${dia}</p>
                    <a href="${link}" target="_blank" style="font-size:10px; color:#25D366; text-decoration:none; font-weight:700;">🎂 Zap</a>
                </div>`;
            }).join('');
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
            resumoFaixas.innerHTML = Object.entries(contagem).map(([f, q]) => 
                `<span class="adm-tag" style="background:${corFaixa(f)}22; color:${corFaixa(f)}; border:1px solid ${corFaixa(f)}44;">
                    <span class="adm-tag faixa" style="background:${corFaixa(f)};"></span> ${f}: ${q}
                </span>`
            ).join('');
        } else {
            cardFaixas.style.display = 'none';
        }
    }

    if (!lista) return;
    if (filtrados.length === 0) {
        lista.innerHTML = `<div class="adm-empty"><i class="fa-solid fa-users-slash"></i><p>Nenhum aluno encontrado</p></div>`;
        return;
    }

    lista.innerHTML = filtrados.map(a => {
        const cor = corFaixa(a.faixa);
        const tagVip = a.assinante ? '<span class="adm-tag vip">VIP</span>' : '';
        const tagIna = a.plano_pausado ? '<span class="adm-tag inativo">INATIVO</span>' : '';
        const foto = a.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.nome)}&background=161618&color=fff`;
        const mensPendente = _mensalidades.filter(m => m.aluno_id === a.id && m.status === 'pendente')[0];
        const tagDebito = mensPendente ? '<span class="adm-tag pendente">DÉBITO</span>' : '';

        return `<div class="adm-list-item" onclick="abrirDossie('${a.id}')" style="cursor:pointer; padding:14px 0;">
            <img src="${foto}" class="adm-avatar" loading="lazy" alt="${a.nome}">
            <div class="adm-list-info">
                <h4>${a.nome} ${tagVip} ${tagIna} ${tagDebito}</h4>
                <p style="display:flex; align-items:center; gap:6px;">
                    <span style="width:8px;height:8px;border-radius:50%;background:${cor};display:inline-block;"></span>
                    ${a.faixa || 'Branca'} · ${a.telefone || 'Sem telefone'}
                </p>
            </div>
            <span style="color:var(--adm-text-3);font-size:18px;"><i class="fa-solid fa-chevron-right"></i></span>
        </div>`;
    }).join('');
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
    _alunoSelecionado = aluno;
    _abaDossie = 'perfil';

    const foto = aluno.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=161618&color=fff`;
    const imgFoto = $('dossie-foto');
    const nomeEl = $('dossie-nome');
    const faixaEl = $('dossie-faixa');

    if (imgFoto) imgFoto.src = foto;
    if (nomeEl) nomeEl.innerText = aluno.nome;
    if (faixaEl) {
        faixaEl.innerText = '🥋 ' + (aluno.faixa || 'BRANCA');
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

function renderDossieConteudo() {
    const a = _alunoSelecionado;
    if (!a) return;
    const container = $('dossie-conteudo');
    if (!container) return;

    if (_abaDossie === 'perfil') {
        const status = a.plano_pausado ? '<span style="color:#ff5252;font-weight:800;">🔴 INATIVO</span>' : 
                       (a.assinante ? '<span style="color:#3b82f6;font-weight:800;">💳 VIP RECORRENTE</span>' : 
                        '<span style="color:#22c55e;font-weight:800;">✅ ATIVO</span>');
        container.innerHTML = `
            <div class="adm-info-grid">
                <div class="adm-info-row"><span class="adm-info-label">WhatsApp</span><span class="adm-info-value">${a.telefone || '—'}</span></div>
                <div class="adm-info-row"><span class="adm-info-label">E-mail</span><span class="adm-info-value" style="font-size:11px;">${a.email || '—'}</span></div>
                <div class="adm-info-row"><span class="adm-info-label">Nascimento</span><span class="adm-info-value">${a.data_nascimento ? new Date(a.data_nascimento).toLocaleDateString('pt-BR') : '—'}</span></div>
                <div class="adm-info-row"><span class="adm-info-label">Status</span><span class="adm-info-value">${status}</span></div>
                <div class="adm-info-row"><span class="adm-info-label">Mensalidade</span><span class="adm-info-value">R$ ${a.valor_mensalidade || 25},00</span></div>
            </div>
            <a href="https://wa.me/55${(a.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Olá, *' + a.nome + '*! Oss! 🥋')}" target="_blank" 
               style="display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:white;text-decoration:none;padding:14px;border-radius:10px;font-weight:800;margin-top:16px;">
                <i class="fa-brands fa-whatsapp"></i> Chamar no WhatsApp
            </a>
        `;
    } else if (_abaDossie === 'financeiro') {
        const mensAluno = _mensalidades.filter(m => m.aluno_id === a.id).slice(0, 12);
        if (mensAluno.length === 0) {
            container.innerHTML = `<div class="adm-empty"><i class="fa-solid fa-receipt"></i><p>Sem histórico financeiro</p></div>`;
            return;
        }
        container.innerHTML = mensAluno.map(m => {
            const isPago = m.status === 'pago';
            return `<div class="adm-list-item">
                <div class="adm-list-info">
                    <h4>${m.mes}</h4>
                    <p class="adm-tag ${isPago ? 'pago' : 'pendente'}">${isPago ? '✅ Pago' : '🔴 Pendente'}</p>
                </div>
                <span style="font-weight:800;color:var(--adm-text);">R$ ${m.valor}</span>
            </div>`;
        }).join('');
    } else {
        const acao = a.plano_pausado ? 'reativar' : 'congelar';
        const corBtn = a.plano_pausado ? '#22c55e' : '#9e9e9e';
        const txtBtn = a.plano_pausado ? '▶️ Reativar Aluno' : '⏸️ Inativar Aluno';

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;">
                <button class="adm-btn-full" onclick="editarAlunoDossie()" style="background:var(--adm-surface-2);border:1px solid var(--adm-border);color:var(--adm-text);">
                    <i class="fa-solid fa-pen"></i> Editar Perfil
                </button>
                <button class="adm-btn-full" onclick="alternarPlano('${a.id}', '${a.nome}', '${acao}')" style="background:transparent;border:1px solid ${corBtn};color:${corBtn};">
                    ${txtBtn}
                </button>
                ${a.assinante ? `<button class="adm-btn-full" onclick="cancelarVIP('${a.id}', '${a.nome}')" style="background:transparent;border:1px solid #ff5252;color:#ff5252;">
                    <i class="fa-solid fa-crown"></i> Cancelar VIP
                </button>` : ''}
                <button class="adm-btn-full" onclick="excluirAluno('${a.id}', '${a.nome}')" style="background:transparent;border:1px solid #ff5252;color:#ff5252;margin-top:10px;">
                    <i class="fa-solid fa-trash"></i> Excluir Aluno
                </button>
            </div>
        `;
    }
}

window.editarAlunoDossie = async function() {
    const a = _alunoSelecionado;
    if (!a) return;
    const { value: v } = await Swal.fire({
        title: 'Editar Atleta',
        html: `<div style="text-align:left;">
            <label style="color:#888;font-size:11px;text-transform:uppercase;">Nome</label>
            <input id="ed-nome" class="swal2-input" value="${a.nome}" style="background:#0a0a0c;color:white;border:1px solid #333;margin-bottom:10px;">
            <label style="color:#888;font-size:11px;text-transform:uppercase;">WhatsApp</label>
            <input id="ed-tel" class="swal2-input" value="${a.telefone || ''}" style="background:#0a0a0c;color:white;border:1px solid #333;margin-bottom:10px;">
            <label style="color:#888;font-size:11px;text-transform:uppercase;">Faixa</label>
            <input id="ed-faixa" class="swal2-input" value="${a.faixa || 'Branca'}" style="background:#0a0a0c;color:white;border:1px solid #333;margin-bottom:10px;">
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
        loading('Salvando...');
        await supabase.from('perfis').update({
            nome: v.nome, telefone: v.telefone, faixa: v.faixa,
            valor_mensalidade: v.valor ? parseInt(v.valor) : null
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
        text: `${nome} será ${cong ? 'inativado' : 'reativado'}.`,
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
        text: `Todos os dados de ${nome} serão apagados.`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ff5252', cancelButtonColor: '#333',
        confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar',
        background: '#0a0a0c', color: '#fff'
    });
    if (r.isConfirmed) {
        loading('Excluindo...');
        // CORREÇÃO: removemos a chamada supabase.auth.admin.deleteUser que não funciona no client-side
        // A exclusão do usuário em auth deve ser feita via Edge Function no backend
        await supabase.from('mensalidades').delete().eq('aluno_id', id);
        await supabase.from('perfis').delete().eq('id', id);
        await carregarTudo();
        fecharModalDossie();
        toast('Aluno removido');
    }
};

function renderFinanceiro() {
    const recebido = _mensalidades.filter(m => m.status === 'pago').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const pendente = _mensalidades.filter(m => m.status === 'pendente').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const elRec = $('fin-recebido');
    const elPen = $('fin-pendente');
    if (elRec) elRec.innerText = formatCurrency(recebido);
    if (elPen) elPen.innerText = formatCurrency(pendente);

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
    if (pendentes.length === 0) {
        lista.innerHTML = `<div class="adm-empty"><i class="fa-solid fa-check-circle"></i><p>Tudo em dia! Nenhuma cobrança pendente.</p></div>`;
        return;
    }

    lista.innerHTML = pendentes.map(m => {
        const al = _alunos.find(a => a.id === m.aluno_id);
        if (al && al.plano_pausado) return '';
        const nome = al ? al.nome : 'Desconhecido';
        const tel = al ? al.telefone : '';
        return `<div class="adm-card" style="margin-bottom:10px;">
            <div class="adm-card-body">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div>
                        <h4 style="margin:0;font-size:15px;color:var(--adm-text);">${nome}</h4>
                        <p style="margin:4px 0 0;font-size:12px;color:var(--adm-text-2);text-transform:uppercase;">${m.mes} · <strong style="color:var(--adm-red);font-size:13px;">R$ ${m.valor}</strong></p>
                    </div>
                    <button onclick="apagarCobranca('${m.id}')" style="background:rgba(255,82,82,0.1);border:none;width:36px;height:36px;border-radius:50%;color:#ff5252;cursor:pointer;font-size:14px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="adm-btn-sm success adm-w-full" onclick="darBaixa('${m.id}')">
                        <i class="fa-solid fa-check"></i> Dar Baixa
                    </button>
                    <button class="adm-btn-sm whatsapp" onclick="cobrarZap('${tel}', '${nome}', '${m.mes}', '${m.valor}')">
                        <i class="fa-brands fa-whatsapp"></i> Zap
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.filtrarFinanceiro = function() { renderFinanceiro(); };

window.cobrarZap = function(tel, nome, mes, val) {
    if (!tel || tel.length < 10) { toast('Sem WhatsApp cadastrado', 'error'); return; }
    const num = tel.replace(/\D/g, '');
    const msg = `Olá, *${nome}*! Oss! 🥋\n\nLembrete da mensalidade de *${mes}*.\n💰 *Valor:* R$ ${val},00\n\n📱 *Pague no App*\n_Ou Pix (Celular):_ *92985589868*\n\nNos vemos no tatame!`;
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

function renderMural() {
    const lista = $('lista-avisos');
    if (!lista) return;
    if (_avisos.length === 0) {
        lista.innerHTML = `<div class="adm-empty"><i class="fa-solid fa-bullhorn"></i><p>Nenhum aviso publicado</p></div>`;
        return;
    }
    lista.innerHTML = _avisos.map(av => `
        <div class="adm-card" style="margin-bottom:10px;position:relative;">
            <button onclick="apagarAviso('${av.id}')" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#ff5252;font-size:14px;cursor:pointer;z-index:2;">
                <i class="fa-solid fa-trash"></i>
            </button>
            <div class="adm-card-body">
                <h4 style="margin:0 0 6px;font-size:15px;color:var(--adm-text);padding-right:24px;">${av.titulo}</h4>
                <p style="margin:0;font-size:13px;color:var(--adm-text-2);line-height:1.5;">${av.mensagem}</p>
                <p style="margin:8px 0 0;font-size:10px;color:var(--adm-text-3);">${av.created_at ? new Date(av.created_at).toLocaleDateString('pt-BR') : ''}</p>
            </div>
        </div>
    `).join('');
}

window.publicarAviso = async function() {
    const tit = $('aviso-titulo');
    const msg = $('aviso-mensagem');
    if (!tit || !msg) return;
    const titulo = tit.value.trim();
    const mensagem = msg.value.trim();
    if (!titulo || !mensagem) { toast('Preencha título e mensagem', 'error'); return; }
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
        valor_mensalidade: parseInt($('novo-valor').value) || 25
    };
    if (!dados.nome || !dados.email || !dados.senha) { toast('Preencha os campos obrigatórios', 'error'); return; }
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
    if (!dados.nome || !dados.email || !dados.senha) { toast('Preencha os campos obrigatórios', 'error'); return; }
    if (await doCadastrar(dados)) {
        $('form-modal-aluno').reset();
        fecharModalNovoAluno();
    }
};

window.gerarMensalidades = async function() {
    let mes = $('mes-geral').value.trim();
    const val = $('valor-geral').value;
    if (!mes || !val) { toast('Preencha mês e valor', 'error'); return; }
    mes = mes.replace(/\s+/g, ' ');
    mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();

    loading('Verificando...');
    try {
        const { data: alm } = await supabase.from('perfis').select('id,valor_mensalidade,plano_pausado').neq('cargo', 'professor').eq('assinante', false);
        const atv = (alm || []).filter(a => !a.plano_pausado);
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

document.addEventListener('DOMContentLoaded', () => {
    verificarAdmin();
    checarManutencao();
});

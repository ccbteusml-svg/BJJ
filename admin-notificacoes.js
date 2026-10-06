// ==========================================
// 🔔 CENTRAL DE NOTIFICAÇÕES DO ADM (v1)
// Sino no topo + badge de não lidas + painel.
// Eventos (sem tabela nova — lê o que já existe):
//   🆕 aluno novo cadastrado          (perfis.criado_em)
//   💰 pagamento confirmado (Pix)     (mensalidades.pago_em / criado_em)
//   📋 ações dos ADMs: suspensões, baixas
//      manuais, geração em massa      (audit_log — mostra QUAL admin fez)
// Lidas: localStorage por admin.
// ==========================================
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const LIMITE_ITENS = 25;
    const DIAS_CADASTRO_PAGTO = 30;
    const DIAS_AUDIT = 14;

    let _userId = null;
    let _itens = [];
    let _aberto = false;
    let _timer = null;

    function _chave() { return '4l_notif_adm_lidas_' + _userId; }
    function _getLidas() {
        try { return JSON.parse(localStorage.getItem(_chave()) || '[]'); }
        catch (e) { return []; }
    }
    function _setLidas(arr) {
        try { localStorage.setItem(_chave(), JSON.stringify(arr.slice(-300))); } catch (e) { /* ok */ }
    }

    function _rel(iso) {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'agora';
        if (min < 60) return `há ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `há ${h}h`;
        const d = Math.floor(h / 24);
        if (d === 1) return 'ontem';
        if (d < 30) return `há ${d} dias`;
        return new Date(iso).toLocaleDateString('pt-BR');
    }

    const ROTULOS_AUDIT = {
        inativar_aluno:   { icone: '⛔', titulo: 'Aluno suspenso' },
        reativar_aluno:   { icone: '✅', titulo: 'Aluno reativado' },
        baixa_mensalidade:{ icone: '✍️', titulo: 'Baixa manual' },
        gerar_cobrancas:  { icone: '🤖', titulo: 'Cobranças geradas' },
        excluir_aluno:    { icone: '🗑️', titulo: 'Aluno excluído' },
        modo_manutencao:  { icone: '🛠️', titulo: 'Modo manutenção' }
    };

    async function _buscar() {
        const itens = [];
        const corteCP = new Date(Date.now() - DIAS_CADASTRO_PAGTO * 86400000).toISOString();
        const corteAud = new Date(Date.now() - DIAS_AUDIT * 86400000).toISOString();

        // 🆕 Novos cadastros (tolerante a criado_em/created_at)
        try {
            let r = await supabase.from('perfis')
                .select('id, nome, criado_em')
                .gte('criado_em', corteCP)
                .order('criado_em', { ascending: false })
                .limit(20);
            if (r.error && r.error.code === '42703') {
                r = await supabase.from('perfis')
                    .select('id, nome, created_at')
                    .gte('created_at', corteCP)
                    .order('created_at', { ascending: false })
                    .limit(20);
                (r.data || []).forEach(p => p.criado_em = p.created_at);
            }
            (r.data || []).forEach(p => {
                itens.push({
                    id: 'cad-' + p.id,
                    icone: '🆕',
                    titulo: 'Aluno novo cadastrado',
                    sub: p.nome || 'Sem nome',
                    data: p.criado_em,
                    acao: 'alunos'
                });
            });
        } catch (e) { console.warn('[SINO ADM] cadastros falhou:', e); }

        // 💰 Pagamentos confirmados (pago_em; fallback criado_em se coluna ainda não existe)
        try {
            let r = await supabase.from('mensalidades')
                .select('id, aluno_id, mes, valor, pago_em')
                .eq('status', 'pago')
                .gte('pago_em', corteCP)
                .order('pago_em', { ascending: false })
                .limit(20);
            if (r.error && r.error.code === '42703') {
                r = await supabase.from('mensalidades')
                    .select('id, aluno_id, mes, valor, criado_em')
                    .eq('status', 'pago')
                    .order('criado_em', { ascending: false })
                    .limit(20);
                (r.data || []).forEach(m => m.pago_em = m.criado_em);
            }
            const pagas = r.data || [];
            if (pagas.length > 0) {
                // nomes dos alunos (1 query só)
                const ids = [...new Set(pagas.map(m => m.aluno_id))];
                const { data: nomes } = await supabase.from('perfis').select('id, nome').in('id', ids);
                const mapa = {};
                (nomes || []).forEach(p => mapa[p.id] = p.nome);
                pagas.forEach(m => {
                    itens.push({
                        id: 'pgto-' + m.id,
                        icone: '💰',
                        titulo: 'Pagamento confirmado',
                        sub: `${mapa[m.aluno_id] || 'Aluno'} · R$ ${Number(m.valor || 0).toFixed(2).replace('.', ',')}`,
                        data: m.pago_em,
                        acao: 'financeiro'
                    });
                });
            }
        } catch (e) { console.warn('[SINO ADM] pagamentos falhou:', e); }

        // 📋 Ações dos ADMs (audit_log — mostra quem fez)
        try {
            const { data: logs } = await supabase.from('audit_log')
                .select('id, acao, detalhes, admin_nome, created_at')
                .gte('created_at', corteAud)
                .order('created_at', { ascending: false })
                .limit(20);
            (logs || []).forEach(l => {
                const r = ROTULOS_AUDIT[l.acao];
                if (!r) return; // ignora ações rotineiras (edição, aviso) para não poluir
                itens.push({
                    id: 'aud-' + l.id,
                    icone: r.icone,
                    titulo: r.titulo,
                    sub: (l.detalhes || '') + (l.admin_nome ? ` — por ${l.admin_nome.split(' ')[0]}` : ''),
                    data: l.created_at,
                    acao: 'auditoria'
                });
            });
        } catch (e) { console.warn('[SINO ADM] audit falhou:', e); }

        itens.sort((a, b) => new Date(b.data) - new Date(a.data));
        return itens.slice(0, LIMITE_ITENS);
    }

    function _badge() {
        const b = $('sino-adm-badge');
        if (!b) return;
        const lidas = _getLidas();
        const n = _itens.filter(i => !lidas.includes(i.id)).length;
        if (n > 0) {
            b.textContent = n > 9 ? '9+' : n;
            b.style.display = 'inline-flex';
        } else {
            b.style.display = 'none';
        }
    }

    function _montarPainel() {
        if ($('sino-adm-painel')) return;
        const p = document.createElement('div');
        p.id = 'sino-adm-painel';
        p.className = 'sino-adm-painel';
        p.innerHTML = `
            <div class="sino-adm-cab">
                <span>🔔 Notificações</span>
                <button type="button" id="sino-adm-limpar" class="sino-adm-limpar">Marcar todas como lidas</button>
            </div>
            <div id="sino-adm-lista" class="sino-adm-lista"></div>`;
        document.body.appendChild(p);

        $('sino-adm-limpar').onclick = (ev) => {
            ev.stopPropagation();
            _setLidas(_itens.map(i => i.id));
            _render();
            _badge();
        };

        document.addEventListener('click', (ev) => {
            if (!_aberto) return;
            const pEl = $('sino-adm-painel');
            const bEl = $('btn-sino-adm');
            if (pEl && !pEl.contains(ev.target) && bEl && !bEl.contains(ev.target)) _fechar();
        });
    }

    function _render() {
        const lista = $('sino-adm-lista');
        if (!lista) return;
        const lidas = _getLidas();
        if (_itens.length === 0) {
            lista.innerHTML = '<div class="sino-adm-vazio">Nenhuma novidade. 🥋</div>';
            return;
        }
        lista.innerHTML = '';
        _itens.forEach(item => {
            const lida = lidas.includes(item.id);
            const div = document.createElement('div');
            div.className = 'sino-adm-item' + (lida ? ' lida' : '');

            const icone = document.createElement('span');
            icone.className = 'sino-adm-icone';
            icone.textContent = item.icone;

            const corpo = document.createElement('div');
            corpo.className = 'sino-adm-corpo';

            const t = document.createElement('div');
            t.className = 'sino-adm-titulo';
            t.textContent = item.titulo;

            const s = document.createElement('div');
            s.className = 'sino-adm-sub';
            s.textContent = item.sub;

            const dt = document.createElement('div');
            dt.className = 'sino-adm-data';
            dt.textContent = _rel(item.data);

            corpo.appendChild(t);
            if (item.sub) corpo.appendChild(s);
            corpo.appendChild(dt);
            div.appendChild(icone);
            div.appendChild(corpo);

            if (!lida) {
                const dot = document.createElement('span');
                dot.className = 'sino-adm-dot';
                div.appendChild(dot);
            }

            div.onclick = () => {
                const l = _getLidas();
                if (!l.includes(item.id)) { l.push(item.id); _setLidas(l); }
                _fechar();
                _badge();
                if (typeof window.abrirSecao === 'function') {
                    if (item.acao === 'alunos') window.abrirSecao('alunos');
                    else if (item.acao === 'financeiro') window.abrirSecao('financeiro');
                    else if (item.acao === 'auditoria') window.abrirSecao('auditoria');
                }
            };

            lista.appendChild(div);
        });
    }

    function _abrir() {
        const p = $('sino-adm-painel');
        if (!p) return;
        p.style.display = 'flex';
        _aberto = true;
        _render();
        _buscar().then(itens => { _itens = itens; _render(); _badge(); });
    }
    function _fechar() {
        const p = $('sino-adm-painel');
        if (p) p.style.display = 'none';
        _aberto = false;
    }

    window.toggleCentralNotificacoesAdm = function () {
        // 🛡️ Se o painel ainda não montou (sessão lenta na 1ª abertura),
        // monta na hora e tenta iniciar de novo — o sino nunca fica "morto"
        if (!document.getElementById('sino-adm-painel')) {
            _montarPainel();
            if (!_userId) _iniciar();
        }
        if (_aberto) _fechar(); else _abrir();
    };

    async function _iniciar() {
        // Espera a sessão estar pronta (até ~10s), tentando a cada 1s
        for (let tentativa = 0; tentativa < 10; tentativa++) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    _userId = session.user.id;
                    _montarPainel();
                    _itens = await _buscar();
                    _badge();
                    if (_timer) clearInterval(_timer);
                    _timer = setInterval(async () => {
                        if (document.hidden) return;
                        _itens = await _buscar();
                        _badge();
                    }, 5 * 60 * 1000);
                    return;
                }
            } catch (e) {
                console.warn('[SINO ADM] tentativa', tentativa, e);
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        console.warn('[SINO ADM] sem sessão após 10s — sino inativo neste carregamento');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_iniciar, 1800));
    } else {
        setTimeout(_iniciar, 1800);
    }
})();

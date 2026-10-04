// ==========================================
// 🔔 CENTRAL DE NOTIFICAÇÕES DO ALUNO (v1)
// Sino no topo + badge de não lidas + painel.
// Fontes (sem tabela nova — lê o que já existe):
//   📢 avisos do mural
//   💳 mensalidade gerada / ✅ paga
//   ⏰ lembrete de mensalidade em aberto (a partir do dia 8)
// Lidas: localStorage por usuário.
// ==========================================
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const LIMITE_DIAS = 60;
    const LIMITE_ITENS = 20;

    let _userId = null;
    let _itens = [];
    let _painelAberto = false;
    let _timer = null;

    function _chaveLidas() { return '4l_notif_lidas_' + _userId; }

    function _getLidas() {
        try { return JSON.parse(localStorage.getItem(_chaveLidas()) || '[]'); }
        catch (e) { return []; }
    }
    function _setLidas(arr) {
        try { localStorage.setItem(_chaveLidas(), JSON.stringify(arr.slice(-200))); } catch (e) { /* ok */ }
    }

    function _dataRelativa(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const diff = Date.now() - d.getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'agora';
        if (min < 60) return `há ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `há ${h}h`;
        const dias = Math.floor(h / 24);
        if (dias === 1) return 'ontem';
        if (dias < 30) return `há ${dias} dias`;
        return d.toLocaleDateString('pt-BR');
    }

    function _mesNome(isoMes) {
        try {
            return new Date(isoMes + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        } catch (e) { return isoMes; }
    }

    // ---------- Montagem dos itens ----------
    async function _buscarItens() {
        const itens = [];
        const corte = new Date(Date.now() - LIMITE_DIAS * 86400000).toISOString();

        // 📢 Avisos do mural (tolerante a criado_em/created_at)
        try {
            let r = await supabase.from('avisos').select('id, titulo, mensagem, criado_em').gte('criado_em', corte).order('criado_em', { ascending: false }).limit(15);
            if (r.error && r.error.code === '42703') {
                r = await supabase.from('avisos').select('id, titulo, mensagem, created_at').order('created_at', { ascending: false }).limit(15);
                (r.data || []).forEach(av => av.criado_em = av.created_at);
            }
            (r.data || []).forEach(av => {
                itens.push({
                    id: 'aviso-' + (av.id || av.criado_em),
                    icone: '📢',
                    titulo: av.titulo || 'Aviso',
                    sub: (av.mensagem || '').slice(0, 60),
                    data: av.criado_em,
                    acao: 'mural'
                });
            });
        } catch (e) { console.warn('[SINO] avisos falhou:', e); }

        // 💳✅ Mensalidades do aluno
        try {
            const { data: mens } = await supabase.from('mensalidades')
                .select('id, mes, status, valor, criado_em')
                .eq('aluno_id', _userId)
                .gte('criado_em', corte)
                .order('criado_em', { ascending: false })
                .limit(10);
            (mens || []).forEach(m => {
                const valor = `R$ ${Number(m.valor || 0).toFixed(2).replace('.', ',')}`;
                const mesN = _mesNome(m.mes);
                if (m.status === 'pago') {
                    itens.push({
                        id: 'paga-' + m.id,
                        icone: '✅',
                        titulo: 'Pagamento confirmado',
                        sub: `${valor} · ${mesN}`,
                        data: m.criado_em,
                        acao: 'financeiro'
                    });
                } else {
                    itens.push({
                        id: 'gerada-' + m.id,
                        icone: '💳',
                        titulo: 'Mensalidade gerada',
                        sub: `${valor} · ${mesN}`,
                        data: m.criado_em,
                        acao: 'financeiro'
                    });
                }
            });

            // ⏰ Lembrete: fatura do mês atual em aberto (aparece a partir do dia 8)
            const agora = new Date();
            if (agora.getDate() >= 8) {
                const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`;
                const aberta = (mens || []).find(m => m.mes === mesAtual && m.status === 'pendente');
                // se a fatura é antiga (criada fora da janela), busca direto
                let alvo = aberta;
                if (!alvo) {
                    const { data: pend } = await supabase.from('mensalidades')
                        .select('id, mes, valor')
                        .eq('aluno_id', _userId)
                        .eq('mes', mesAtual)
                        .eq('status', 'pendente')
                        .limit(1);
                    alvo = pend && pend[0];
                }
                if (alvo) {
                    itens.push({
                        id: 'venc-' + alvo.id,
                        icone: '⏰',
                        titulo: 'Mensalidade em aberto',
                        sub: `R$ ${Number(alvo.valor || 0).toFixed(2).replace('.', ',')} · ${_mesNome(mesAtual)} — pague pelo Pix no app`,
                        data: agora.toISOString(),
                        acao: 'financeiro',
                        fixo: true
                    });
                }
            }
        } catch (e) { console.warn('[SINO] mensalidades falhou:', e); }

        itens.sort((a, b) => new Date(b.data) - new Date(a.data));
        return itens.slice(0, LIMITE_ITENS);
    }

    // ---------- Badge ----------
    function _atualizarBadge() {
        const badge = $('sino-badge');
        if (!badge) return;
        const lidas = _getLidas();
        const naoLidas = _itens.filter(i => !lidas.includes(i.id)).length;
        if (naoLidas > 0) {
            badge.textContent = naoLidas > 9 ? '9+' : naoLidas;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ---------- Painel ----------
    function _montarPainel() {
        if ($('central-notificacoes')) return;
        const painel = document.createElement('div');
        painel.id = 'central-notificacoes';
        painel.className = 'sino-painel';
        painel.style.display = 'none';
        painel.innerHTML = `
            <div class="sino-cab">
                <span>🔔 Notificações</span>
                <button type="button" id="sino-limpar" class="sino-limpar">Marcar todas como lidas</button>
            </div>
            <div id="sino-lista" class="sino-lista"></div>`;
        document.body.appendChild(painel);

        $('sino-limpar').onclick = (ev) => {
            ev.stopPropagation();
            _setLidas(_itens.map(i => i.id));
            _renderLista();
            _atualizarBadge();
        };

        // fecha ao tocar fora
        document.addEventListener('click', (ev) => {
            if (!_painelAberto) return;
            const p = $('central-notificacoes');
            const b = $('btn-sino');
            if (p && !p.contains(ev.target) && b && !b.contains(ev.target)) {
                _fechar();
            }
        });
    }

    function _renderLista() {
        const lista = $('sino-lista');
        if (!lista) return;
        const lidas = _getLidas();
        if (_itens.length === 0) {
            lista.innerHTML = '<div class="sino-vazio">Nenhuma novidade por aqui. Oss! 🥋</div>';
            return;
        }
        lista.innerHTML = '';
        _itens.forEach(item => {
            const lida = lidas.includes(item.id);
            const div = document.createElement('div');
            div.className = 'sino-item' + (lida ? ' lida' : '');

            const icone = document.createElement('span');
            icone.className = 'sino-icone';
            icone.textContent = item.icone;

            const corpo = document.createElement('div');
            corpo.className = 'sino-corpo';

            const t = document.createElement('div');
            t.className = 'sino-titulo';
            t.textContent = item.titulo;

            const s = document.createElement('div');
            s.className = 'sino-sub';
            s.textContent = item.sub;

            const dt = document.createElement('div');
            dt.className = 'sino-data';
            dt.textContent = _dataRelativa(item.data);

            corpo.appendChild(t);
            if (item.sub) corpo.appendChild(s);
            corpo.appendChild(dt);
            div.appendChild(icone);
            div.appendChild(corpo);

            if (!lida) {
                const dot = document.createElement('span');
                dot.className = 'sino-dot';
                div.appendChild(dot);
            }

            div.onclick = () => {
                const l = _getLidas();
                if (!l.includes(item.id)) { l.push(item.id); _setLidas(l); }
                _fechar();
                _atualizarBadge();
                // navega para a aba relacionada
                const itensMenu = document.querySelectorAll('.menu-item');
                if (item.acao === 'mural' && itensMenu[2]) window.trocarAbaAluno('aba-avisos', itensMenu[2]);
                else if (item.acao === 'financeiro' && itensMenu[1]) window.trocarAbaAluno('aba-mensalidade', itensMenu[1]);
            };

            lista.appendChild(div);
        });
    }

    function _abrir() {
        const p = $('central-notificacoes');
        if (!p) return;
        p.style.display = 'block';
        _painelAberto = true;
        _renderLista();
        // recarrega fresco a cada abertura
        _buscarItens().then(itens => { _itens = itens; _renderLista(); _atualizarBadge(); });
    }
    function _fechar() {
        const p = $('central-notificacoes');
        if (p) p.style.display = 'none';
        _painelAberto = false;
    }

    window.toggleCentralNotificacoes = function () {
        if (_painelAberto) _fechar(); else _abrir();
    };

    // ---------- Inicialização ----------
    async function _iniciar() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return; // não logado (login/cadastro) — não faz nada
            _userId = session.user.id;
            _montarPainel();
            _itens = await _buscarItens();
            _atualizarBadge();
            // atualiza a bolinha a cada 5 min sem pesar
            if (_timer) clearInterval(_timer);
            _timer = setInterval(async () => {
                if (document.hidden) return;
                _itens = await _buscarItens();
                _atualizarBadge();
            }, 5 * 60 * 1000);
        } catch (e) {
            console.warn('[SINO] init falhou:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_iniciar, 1500));
    } else {
        setTimeout(_iniciar, 1500);
    }
})();

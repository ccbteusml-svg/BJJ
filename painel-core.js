// ==========================================
// TELA DE CARREGAMENTO ANIMADA (LOTTIE)
// ==========================================
window.mostrarCarregamento = function(mensagem) {
    Swal.fire({
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; overflow: hidden; padding-top: 20px;">
                <lottie-player 
                    src="loading.json" 
                    background="transparent" speed="1.5" style="width: 200px; height: 200px;" loop autoplay>
                </lottie-player>
                <h3 style="color: white; margin-top: 10px; font-size: 16px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                    ${mensagem}
                </h3>
            </div>
        `,
        background: '#161618',
        showConfirmButton: false,
        allowOutsideClick: false
        // ✅ CORREÇÃO: removido "timer: 15000" — o loading só fecha via fecharCarregamento()
        // no finally de cada operação. Timer mágico escondia erros de rede/servidor.
    });
};

window.fecharCarregamento = function() {
    Swal.close();
};

window.mostrarCarregamentocartao = function(mensagem) {
    Swal.fire({
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; overflow: hidden; padding-top: 20px;">
                <lottie-player 
                    src="cartao.json" 
                    background="transparent" speed="1.5" style="width: 200px; height: 200px;" loop autoplay>
                </lottie-player>
                <h3 style="color: white; margin-top: 10px; font-size: 16px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                    ${mensagem}
                </h3>
            </div>
        `,
        background: '#161618',
        showConfirmButton: false,
        allowOutsideClick: false
        // ✅ CORREÇÃO: removido "timer: 15000" (mesmo motivo do loading principal)
    });
};

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

// ==========================================
// 1. SISTEMA DE DEFESA: MODO MANUTENÇÃO
// ==========================================
async function verificarManutencaoPainel() {
    try {
        const { data: config } = await supabase.from('sistema_config').select('manutencao_ativa, mensagem_manutencao').eq('id', 1).single();

        if (config && config.manutencao_ativa) {
            const { data: { session } } = await supabase.auth.getSession();
            let isProfessor = false;

            if (session) {
                const { data: perfil } = await supabase.from('perfis').select('cargo').eq('id', session.user.id).single();
                if (perfil && perfil.cargo === 'professor') isProfessor = true;
            }

            if (!isProfessor) {
                const cortinaManutencao = document.createElement('div');
                cortinaManutencao.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; font-family: sans-serif; z-index: 999999;";

                const emoji = document.createElement('span');
                emoji.style.cssText = 'font-size: 60px; margin-bottom: 20px;';
                emoji.textContent = '🚧';
                cortinaManutencao.appendChild(emoji);

                const h2 = document.createElement('h2');
                h2.style.cssText = 'color: #e53935; font-weight: 800; font-style: italic; margin-bottom: 10px;';
                h2.textContent = '4L ACADEMY';
                cortinaManutencao.appendChild(h2);

                const p = document.createElement('p');
                p.style.cssText = 'font-size: 18px; line-height: 1.5; color: #ccc;';
                p.textContent = config.mensagem_manutencao || '🥋 O App está em atualização. Voltamos em alguns minutos!';
                cortinaManutencao.appendChild(p);

                document.body.appendChild(cortinaManutencao);
                document.body.style.overflow = 'hidden'; 
            }
        }
    } catch (error) {
        console.error("Erro ao checar manutenção:", error);
    }
}
verificarManutencaoPainel();

window.mensalidadeAtualId = null;

// ==========================================
// 2. CONTROLE DO MENU LATERAL E NAVEGAÇÃO
// ==========================================
window.abrirMenu = () => { 
    const menu = document.getElementById('menu-lateral');
    const backdrop = document.getElementById('menu-backdrop');
    if (menu) menu.classList.add('aberto'); 
    if (backdrop) {
        backdrop.style.display = 'block'; 
        setTimeout(() => backdrop.style.opacity = '1', 10); 
    }
};

window.fecharMenu = () => { 
    const menu = document.getElementById('menu-lateral');
    const backdrop = document.getElementById('menu-backdrop');
    if (menu) menu.classList.remove('aberto'); 
    if (backdrop) {
        backdrop.style.opacity = '0'; 
        setTimeout(() => backdrop.style.display = 'none', 300); 
    }
};

window.trocarAbaAluno = (idAba, elemento) => { 
    document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none');
    const aba = document.getElementById(idAba);
    if (aba) aba.style.display = 'block'; 

    // ✅ CORREÇÃO: para o polling do Pix se sair da aba de pagamento
    if (idAba !== 'aba-mensalidade' && typeof window.pararPollingPagamento === 'function') {
        window.pararPollingPagamento();
    }

    document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active')); 
    if (elemento) elemento.classList.add('active'); 
    window.fecharMenu(); 

    if(idAba === 'aba-avisos' && typeof window.carregarAvisos === 'function') window.carregarAvisos(); 
    if(idAba === 'aba-historico' && typeof window.carregarHistorico === 'function') window.carregarHistorico(); 
};
// ==========================================
// 3. CARREGAMENTO PRINCIPAL (TEMA, PERFIL E HOME)
// ==========================================
// ✅ Trava anti-sobreposição: visibilitychange + radar + polling podiam chamar
// verificarAcesso ao mesmo tempo, gerando race condition e renders duplicados
let _verificarAcessoRodando = false;

window.verificarAcesso = async function() {
    if (_verificarAcessoRodando) { console.log('[APP] verificarAcesso já em execução — ignorando chamada duplicada.'); return; }
    _verificarAcessoRodando = true;

    try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        // ✅ GUARDA ANTI-LOOP: se já redirecionou ao login há poucos segundos, não
        // redireciona de novo (evita ping-pong infinito painel ↔ index)
        const agora = Date.now();
        const ultimoRedirect = parseInt(sessionStorage.getItem('4l_redirect_login') || '0');
        if (agora - ultimoRedirect < 8000) {
            console.error('[APP] Loop de redirecionamento detectado — interrompido.');
            const statusEl = document.getElementById('status-pagamento');
            if (statusEl) { statusEl.textContent = "⚠️ ERRO DE SESSÃO"; statusEl.style.color = "#FFC107"; }
            return;
        }
        sessionStorage.setItem('4l_redirect_login', String(agora));
        window.location.replace("index.html");
        return;
    }
    sessionStorage.removeItem('4l_redirect_login'); // sessão válida: limpa a marca

    const usuarioId = session.user.id;

    if (window.AndroidApp && typeof window.AndroidApp.registrarUsuarioApp === 'function') {
        try { window.AndroidApp.registrarUsuarioApp(usuarioId); } catch(e) { console.warn(e); }
    }

    // 🧠 CACHE LOCAL: pinta a home instantaneamente com os dados da última visita
    // (nome, faixa, foto e status financeiro). A rede atualiza tudo logo em seguida.
    try {
        const cacheHome = JSON.parse(localStorage.getItem('4l_cache_home_' + usuarioId) || 'null');
        if (cacheHome && cacheHome.perfil) {
            const cp = cacheHome.perfil;
            const corTemaCache = cp.corTema || '#E53935';
            document.documentElement.style.setProperty('--cor-destaque', corTemaCache);
            const saudacaoCache = document.getElementById('saudacao-aluno');
            if (saudacaoCache && cp.nome) {
                saudacaoCache.textContent = '';
                const s1 = document.createElement('span');
                s1.textContent = `Olá, ${cp.nome}! 👋 `;
                saudacaoCache.appendChild(s1);
                saudacaoCache.appendChild(document.createElement('br'));
                const s2 = document.createElement('span');
                s2.style.cssText = 'font-size: 14px; color: var(--cor-destaque); font-weight: bold;';
                s2.textContent = `🥋 ${cp.faixa || 'Branca'}`;
                saudacaoCache.appendChild(s2);
            }
            if (cp.foto_url) {
                const imgC = document.getElementById('foto-perfil-aluno');
                if (imgC) imgC.src = cp.foto_url;
            }
            if (cacheHome.financeiro) {
                const cf = cacheHome.financeiro;
                const mesC = document.getElementById('mes-atual');
                const valC = document.getElementById('valor-pagamento');
                const stC = document.getElementById('status-pagamento');
                const opC = document.getElementById('opcoes-pagamento');
                if (mesC) mesC.textContent = cf.mes;
                if (valC) valC.textContent = cf.valorTxt;
                if (stC) { stC.textContent = cf.statusTxt; stC.style.color = cf.statusCor; }
                if (opC) opC.style.display = cf.mostrarPagamento ? 'flex' : 'none';
            }
        }
    } catch (eCache) { /* cache corrompido: segue o fluxo normal */ }

    // ✅ maybeSingle: não lança exceção se o perfil ainda não existir; erro é checado
    const { data: perfil, error: erroPerfil } = await supabase.from('perfis').select('nome, faixa, foto_url, assinante, plano_pausado, motivo_pausa').eq('id', usuarioId).maybeSingle();
    if (erroPerfil) {
        console.warn('[APP] Falha ao carregar perfil:', erroPerfil);
        // Sessão expirada/inválida no meio do uso → volta ao login em vez de quebrar
        if (erroPerfil.code === 'PGRST301' || /jwt|token/i.test(erroPerfil.message || '')) {
            await supabase.auth.signOut();
            window.location.replace("index.html");
            return;
        }
    }

    if (perfil && perfil.faixa) {
        let textoFaixaDB = perfil.faixa.toLowerCase();
        let corTema = '#E53935';
        if (textoFaixaDB.includes('branca')) corTema = '#ffffff'; 
        else if (textoFaixaDB.includes('cinza')) corTema = '#9E9E9E';
        else if (textoFaixaDB.includes('amarela')) corTema = '#FBC02D';
        else if (textoFaixaDB.includes('laranja')) corTema = '#FF9800';
        else if (textoFaixaDB.includes('verde')) corTema = '#4CAF50';
        else if (textoFaixaDB.includes('azul')) corTema = '#1976D2';
        else if (textoFaixaDB.includes('roxa')) corTema = '#ab47bc'; 
        else if (textoFaixaDB.includes('marrom')) corTema = '#8d6e63';
        else if (textoFaixaDB.includes('preta')) corTema = '#ffffff'; 
        else if (textoFaixaDB.includes('coral') || textoFaixaDB.includes('vermelha')) corTema = '#D32F2F';
        document.documentElement.style.setProperty('--cor-destaque', corTema);
        // 🧠 Salva perfil no cache local (abertura instantânea na próxima visita)
        try {
            const chaveCache = '4l_cache_home_' + usuarioId;
            const anterior = JSON.parse(localStorage.getItem(chaveCache) || '{}');
            localStorage.setItem(chaveCache, JSON.stringify({ ...anterior, ts: Date.now(), perfil: { nome: perfil.nome, faixa: perfil.faixa, foto_url: perfil.foto_url, corTema } }));
        } catch (eCache) { /* sem drama */ }
    }

    const saudacao = document.getElementById('saudacao-aluno');
    if (perfil && saudacao) {
        saudacao.innerHTML = '';
        const span1 = document.createElement('span');
        span1.textContent = `Olá, ${escapeHtml(perfil.nome)}! 👋 `;
        saudacao.appendChild(span1);
        const br = document.createElement('br');
        saudacao.appendChild(br);
        const span2 = document.createElement('span');
        span2.style.cssText = 'font-size: 14px; color: var(--cor-destaque); font-weight: bold;';
        span2.textContent = `🥋 ${escapeHtml(perfil.faixa || 'Branca')}`;
        saudacao.appendChild(span2);

        if (perfil.foto_url) {
            const img = document.getElementById('foto-perfil-aluno');
            if (img) img.src = perfil.foto_url;
        }

        // ⛔ CONTA SUSPENSA: banner de regularização no topo da home
        try {
            let bannerSusp = document.getElementById('banner-suspenso');
            if (perfil.plano_pausado) {
                if (!bannerSusp) {
                    bannerSusp = document.createElement('div');
                    bannerSusp.id = 'banner-suspenso';
                    const saudacaoEl = document.getElementById('saudacao-aluno');
                    const alvo = saudacaoEl && saudacaoEl.parentElement ? saudacaoEl.parentElement : document.body;
                    alvo.insertBefore(bannerSusp, alvo.firstChild);
                }
                const porCobranca = perfil.motivo_pausa === 'cobranca';
                bannerSusp.style.cssText = 'background:linear-gradient(135deg,#3d0a0a,#1a0505);border:1px solid #E53935;border-radius:12px;padding:14px 16px;margin-bottom:15px;color:#fff;width:100%;max-width:100%;box-sizing:border-box;overflow-wrap:break-word;';
                bannerSusp.innerHTML = '<div style="font-weight:800;font-size:clamp(13px, 3.8vw, 15px);margin-bottom:4px;">⛔ Conta suspensa</div>' +
                    '<div style="font-size:clamp(11px, 3.2vw, 13px);color:#ffb4b4;line-height:1.5;">' +
                    (porCobranca
                        ? 'Mensalidade em atraso. <b style="color:#fff;">Quite abaixo e sua conta reativa na hora, automaticamente.</b>'
                        : 'Sua conta foi suspensa pela academia. Fale com o professor para reativar.') +
                    '</div>';
            } else if (bannerSusp) {
                bannerSusp.remove(); // conta ativa: some com o banner
            }
        } catch (_) {}
    }

    // Último recibo pago
    const { data: ultimoPago, error: erroRecibo } = await supabase.from('mensalidades')
        .select('*')
        .eq('aluno_id', usuarioId)
        .eq('status', 'pago')
        .order('criado_em', { ascending: false })
        .limit(1);
    if (erroRecibo) console.warn('[APP] Falha ao buscar último recibo:', erroRecibo);
    const cardReciboHome = document.getElementById('card-recibo-home');
    if (ultimoPago && ultimoPago.length > 0 && cardReciboHome) {
    cardReciboHome.style.display = "flex";
    cardReciboHome.style.alignItems = "center"; // ✅ Alinha botão verticalmente

        const btn = document.getElementById('btn-baixar-ultimo-recibo');
        if (btn) btn.onclick = () => {
            if (typeof window.abrirRecibo === 'function') window.abrirRecibo(ultimoPago[0].mes, ultimoPago[0].valor);
        };
    } else if (cardReciboHome) {
        cardReciboHome.style.display = "none";
    }

    // Prepara a Fatura atual
    const { data: mensalidades, error: erroMens } = await supabase.from('mensalidades')
        .select('*')
        .eq('aluno_id', usuarioId)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true });
    if (erroMens) {
        console.warn('[APP] Falha ao buscar mensalidades:', erroMens);
        // ✅ BLINDAGEM DE REDE: se a falha foi de CONEXÃO (timeout/offline), NÃO
        // renderiza "EM DIA" — isso faria um aluno devendo achar que está quite.
        // Mostra estado de conexão instável e sai; o banner/re-sync recarrega depois.
        const msgErro = String(erroMens.message || erroMens.code || '').toLowerCase();
        const ehRede = (typeof window._rgEhErroDeRede === 'function' && window._rgEhErroDeRede(erroMens))
            || /fetch|network|timeout|abort|connection/.test(msgErro);
        if (ehRede) {
            if (statusEl) { statusEl.textContent = "📡 CONEXÃO INSTÁVEL"; statusEl.style.color = "#FFC107"; }
            if (mesEl) mesEl.textContent = "Verificando...";
            if (valEl) valEl.textContent = "—";
            if (opcoesEl) opcoesEl.style.display = "none";
            if (btnAdiantar) btnAdiantar.style.display = "none";
            const chipR = document.getElementById('dias-vencimento');
            if (chipR) chipR.style.display = 'none';
            return; // sai sem renderizar estado financeiro falso
        }
    }

    const mesEl = document.getElementById('mes-atual');
    const valEl = document.getElementById('valor-pagamento');
    const statusEl = document.getElementById('status-pagamento');
    const opcoesEl = document.getElementById('opcoes-pagamento');
    const feedbackEl = document.getElementById('feedback-pix');
    const btnAdiantar = document.getElementById('btn-adiantar-fatura');

    if (mensalidades && mensalidades.length > 0) {
        const mens = mensalidades[0];
        window.mensalidadeAtualId = mens.id;

        // ✅ Só tenta verificar se tiver payment_id salvo
        if (mens.mp_payment_id) {
            try {
                const { data: foiPago, error: erroFuncao } = await supabase.functions.invoke('verificar-pagamento', { 
                    body: { payment_id: mens.mp_payment_id, mensalidade_id: mens.id } 
                });

                if (!erroFuncao && foiPago && foiPago.status === "approved") {
                    // ✅ CORREÇÃO: evita loop infinito se o banco ainda não atualizou
                    const statusEl = document.getElementById('status-pagamento');
                    const opcoesEl = document.getElementById('opcoes-pagamento');
                    if (statusEl) { statusEl.textContent = "✅ EM DIA"; statusEl.style.color = "#4CAF50"; }
                    if (opcoesEl) opcoesEl.style.display = "none";
                    const chipV = document.getElementById('dias-vencimento');
                    if (chipV) chipV.style.display = 'none';
                    // 🧠 Cache: pagamento confirmado = EM DIA na próxima abertura
                    try {
                        const chaveCache = '4l_cache_home_' + usuarioId;
                        const anterior = JSON.parse(localStorage.getItem(chaveCache) || '{}');
                        localStorage.setItem(chaveCache, JSON.stringify({ ...anterior, ts: Date.now(), financeiro: { mes: 'Tudo Certo!', valorTxt: 'R$ 0,00', statusTxt: '✅ EM DIA', statusCor: '#4CAF50', mostrarPagamento: false } }));
                    } catch (eCache) { /* sem drama */ }
                    if (!window._verificandoPagamento) {
                        window._verificandoPagamento = true;
                        // ✅ LIMITE DE RE-CHECAGENS: antes reagendava a cada 1,2s PARA SEMPRE
                        // se o banco não atualizasse (loop infinito real). Agora tenta no
                        // máximo 3 vezes; depois confia no radar realtime/webhook.
                        window._tentativasVerificacao = (window._tentativasVerificacao || 0) + 1;
                        if (window._tentativasVerificacao <= 3) {
                            setTimeout(() => { window._verificandoPagamento = false; window.verificarAcesso(); }, 1500);
                        } else {
                            console.warn('[APP] Banco não confirmou o pagamento após 3 tentativas — parando re-checagem.');
                            window._verificandoPagamento = false;
                            window._tentativasVerificacao = 0;
                        }
                    }
                    return;
                }
            } catch (erroDeRede) {
                console.warn("[APP] Falha ao checar pagamento no carregamento:", erroDeRede);
                // Não quebra o app — continua montando a tela
            }
        }

        window._tentativasVerificacao = 0; // fluxo normal: zera o contador de re-checagens
        if (mesEl) mesEl.textContent = mens.mes;
        if (valEl) valEl.textContent = `R$ ${Number(mens.valor).toFixed(2).replace('.', ',')}`;
        if (statusEl) {
            statusEl.textContent = "🔴 EM ABERTO";
            statusEl.style.color = "#ff5252";
        }
        if (opcoesEl) opcoesEl.style.display = "flex";
        if (feedbackEl) feedbackEl.innerHTML = "";
        if (btnAdiantar) btnAdiantar.style.display = "none";

        // ⏳ CONTADOR DE VENCIMENTO: mostra quantos dias faltam pro dia 10 da fatura
        try {
            const chipVenc = document.getElementById('dias-vencimento');
            if (chipVenc) {
                const MESES_IDX = { janeiro:0, fevereiro:1, marco:2, março:2, abril:3, maio:4, junho:5, julho:6, agosto:7, setembro:8, outubro:9, novembro:10, dezembro:11 };
                const partesMes = String(mens.mes || '').toLowerCase().split('/');
                const idxMes = MESES_IDX[partesMes[0]];
                if (idxMes !== undefined && partesMes[1]) {
                    const vencimento = new Date(parseInt(partesMes[1]), idxMes, 10, 23, 59, 59);
                    const dias = Math.ceil((vencimento.getTime() - Date.now()) / 86400000);
                    chipVenc.style.display = 'block';
                    if (dias > 1)       chipVenc.textContent = '⏳ Faltam ' + dias + ' dias pro vencimento (dia 10)';
                    else if (dias === 1) chipVenc.textContent = '⏳ Vence amanhã! (dia 10)';
                    else if (dias === 0) chipVenc.textContent = '⚠️ Vence HOJE! (dia 10)';
                    else                 chipVenc.textContent = '🚨 Venceu há ' + Math.abs(dias) + ' dia(s) — regularize pra treinar em paz';
                } else {
                    chipVenc.style.display = 'none';
                }
            }
        } catch (_) {}

        // 🧠 Cache do status financeiro (abertura instantânea)
        try {
            const chaveCache = '4l_cache_home_' + usuarioId;
            const anterior = JSON.parse(localStorage.getItem(chaveCache) || '{}');
            localStorage.setItem(chaveCache, JSON.stringify({ ...anterior, ts: Date.now(), financeiro: { mes: mens.mes, valorTxt: `R$ ${Number(mens.valor).toFixed(2).replace('.', ',')}`, statusTxt: '🔴 EM ABERTO', statusCor: '#ff5252', mostrarPagamento: true } }));
        } catch (eCache) { /* sem drama */ }
    } else {
        window._tentativasVerificacao = 0;
        if (mesEl) mesEl.textContent = "Tudo Certo!";
        if (valEl) valEl.textContent = "R$ 0,00";
        if (statusEl) {
            statusEl.textContent = "✅ EM DIA";
            statusEl.style.color = "#4CAF50";
        }
        if (opcoesEl) opcoesEl.style.display = "none";
        if (feedbackEl) feedbackEl.innerHTML = "";
        if (btnAdiantar) btnAdiantar.style.display = (perfil && perfil.plano_pausado) ? "none" : "block"; // suspenso não adianta fatura
        const chipVencEmDia = document.getElementById('dias-vencimento');
        if (chipVencEmDia) chipVencEmDia.style.display = 'none'; // em dia = sem contador
        // 🧠 Cache do status financeiro (abertura instantânea)
        try {
            const chaveCache = '4l_cache_home_' + usuarioId;
            const anterior = JSON.parse(localStorage.getItem(chaveCache) || '{}');
            localStorage.setItem(chaveCache, JSON.stringify({ ...anterior, ts: Date.now(), financeiro: { mes: 'Tudo Certo!', valorTxt: 'R$ 0,00', statusTxt: '✅ EM DIA', statusCor: '#4CAF50', mostrarPagamento: false } }));
        } catch (eCache) { /* sem drama */ }
    }

    } catch (e) {
        // ✅ Nenhuma promise "solta": qualquer exceção vira log + estado visual seguro
        console.error('[APP] Exceção em verificarAcesso:', e);
        const statusEl = document.getElementById('status-pagamento');
        if (statusEl && !navigator.onLine) {
            statusEl.textContent = "📡 OFFLINE";
            statusEl.style.color = "#FFC107";
        }
    } finally {
        _verificarAcessoRodando = false;
        if (window._esconderSplash) window._esconderSplash(); // ✨ primeira carga concluída
    }
};


// ==========================================
// 4. RADAR DE PAGAMENTO EM TEMPO REAL
// ==========================================

window.carregarAvisos = async function() {
    const lista = document.getElementById('lista-avisos');
    if (!lista) return;
    // ✅ BLINDAGEM: skeleton shimmer em vez de texto parado — em 3G lento
    // o usuário vê que está carregando de verdade, não uma tela quebrada
    lista.innerHTML = '<div class="rg-skeleton" style="height:76px;margin-bottom:12px;"></div>'.repeat(3);

    // ✅ A coluna de data pode ser 'criado_em' OU 'created_at' conforme o banco — tolera ambos
    let resAvisos = await supabase.from('avisos').select('*').order('criado_em', { ascending: false });
    if (resAvisos.error && resAvisos.error.code === '42703') {
        resAvisos = await supabase.from('avisos').select('*').order('created_at', { ascending: false });
    }
    if (resAvisos.error && resAvisos.error.code === '42703') {
        resAvisos = await supabase.from('avisos').select('*');
    }
    const error = resAvisos.error;
    const avisos = (resAvisos.data || []).map(av => ({ ...av, criado_em: av.criado_em || av.created_at || null }));

    if (error || !avisos || avisos.length === 0) {
        // ✅ BLINDAGEM: se a falha foi de rede e existe cache salvo, mostra os
        // avisos da última vez com selo de data — mural nunca fica "vazio falso"
        if (error) {
            const msgLow = String(error.message || '').toLowerCase();
            const ehRede = (typeof window._rgEhErroDeRede === 'function' && window._rgEhErroDeRede(error))
                || /fetch|network|timeout|abort/.test(msgLow) || !navigator.onLine;
            if (ehRede) {
                try {
                    const cache = JSON.parse(localStorage.getItem('4l_cache_avisos') || 'null');
                    if (cache && cache.dados && cache.dados.length > 0) {
                        const hora = new Date(cache.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                        _renderAvisos(cache.dados, `📡 Sem conexão — avisos de ${hora}`);
                        return;
                    }
                } catch (e) { /* cache corrompido: cai no estado de erro normal */ }
            }
        }
        // ✅ Distingue "sem avisos" de "sem internet" — antes parecia tudo a mesma coisa
        const msgVazio = error
            ? (navigator.onLine ? 'Não foi possível carregar os avisos. Tente novamente.' : '📡 Você está offline. Os avisos aparecem quando a internet voltar.')
            : 'Nenhum aviso no mural.';
        lista.innerHTML = `
            <div class="card-status" style="padding:20px;text-align:center;">
                <p style="color:#666;margin:0;">${msgVazio}</p>
            </div>`;
        return;
    }

    // Sucesso: salva cache para o modo offline do próximo acesso
    try { localStorage.setItem('4l_cache_avisos', JSON.stringify({ ts: Date.now(), dados: avisos })); } catch (e) { /* storage cheio: sem drama */ }

    _renderAvisos(avisos, null);
};

// ✅ Render separado — usado tanto no fluxo normal quanto no fallback de cache
function _renderAvisos(avisos, seloOffline) {
    const lista = document.getElementById('lista-avisos');
    if (!lista) return;
    lista.innerHTML = '';
    if (seloOffline) {
        const selo = document.createElement('div');
        selo.style.cssText = 'padding:8px 12px;margin-bottom:12px;border-radius:8px;background:rgba(255,193,7,0.08);border:1px solid rgba(255,193,7,0.35);color:#FFC107;font-size:11px;text-align:center;';
        selo.textContent = seloOffline;
        lista.appendChild(selo);
    }

    avisos.forEach(av => {
        const card = document.createElement('div');
        card.className = 'card-status';
        card.style.cssText = 'padding:15px;margin-bottom:12px;border-left:3px solid var(--cor-destaque);';

        const h4 = document.createElement('h4');
        h4.style.cssText = 'color:#fff;font-size:14px;margin:0 0 6px;';
        h4.textContent = av.titulo || 'Aviso';

        const p = document.createElement('p');
        p.style.cssText = 'color:#aaa;font-size:13px;line-height:1.5;margin:0;overflow-wrap:break-word;word-break:break-word;';
        p.textContent = av.mensagem || '';

        const date = document.createElement('p');
        date.style.cssText = 'color:#555;font-size:10px;margin:8px 0 0;';
        date.textContent = av.criado_em 
            ? new Date(av.criado_em).toLocaleDateString('pt-BR') 
            : '';

        card.appendChild(h4);
        card.appendChild(p);
        card.appendChild(date);
        lista.appendChild(card);
    });
};

window.ligarRadarEmTempoReal = async function() {
    try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return;

    // ✅ BLINDAGEM: ao re-ligar (volta da internet), remove o canal velho
    // antes — sem isso, cada queda/retorno duplicaria o listener
    if (window._radarCanal) {
        try { await supabase.removeChannel(window._radarCanal); } catch (e) { /* canal já morto */ }
        window._radarCanal = null;
    }

    window._radarCanal = supabase.channel('mensalidades-espiao')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensalidades', filter: `aluno_id=eq.${session.user.id}` },
        (payload) => {
            if (payload.new.status === 'pago') {
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Pagamento Confirmado! 🥋', 
                    text: 'O seu acesso foi liberado. Bom treino!', 
                    background: '#161618', 
                    color: '#fff', 
                    confirmButtonColor: '#4CAF50' 
                }).then(() => {
                    window.verificarAcesso(); 
                });
            }
        }
    ).subscribe((status) => {
        // ✅ Log do status do canal — facilita diagnosticar queda do realtime
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[RADAR] Canal realtime com problema:', status);
        }
    });
    } catch (e) {
        console.warn('[RADAR] Falha ao ligar radar:', e);
    }
};

// ==========================================
// 5. LIMPEZA DE CACHE E BOTÃO DE SAIR
// ==========================================
window.forcarAtualizacao = async function() {
    const result = await Swal.fire({
        title: 'Forçar Atualização?',
        text: "Isso vai limpar a memória do aplicativo e baixar a versão mais nova. Continuar?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#E53935',
        cancelButtonColor: '#333',
        confirmButtonText: 'Sim, atualizar!',
        cancelButtonText: 'Cancelar',
        background: '#161618',
        color: '#fff'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Limpando o tatame...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
        try {
            if ('caches' in window) {
                const nomesCaches = await caches.keys();
                await Promise.all(nomesCaches.map(nome => caches.delete(nome)));
            }
            if ('serviceWorker' in navigator) {
                const registros = await navigator.serviceWorker.getRegistrations();
                for (let registro of registros) await registro.unregister();
            }
            window.location.href = window.location.pathname + '?v=' + new Date().getTime();
        } catch (erro) {
            window.location.reload(true); 
        }
    }
};

// Inicialização Principal do App
document.addEventListener('DOMContentLoaded', () => {
    const btnSair = document.getElementById('btn-sair');
    if (btnSair) {
        btnSair.addEventListener('click', async () => {
            const result = await Swal.fire({ title: 'Sair do Aplicativo?', text: "Deseja realmente desconectar da sua conta?", icon: 'question', showCancelButton: true, confirmButtonColor: '#E53935', cancelButtonColor: '#333', confirmButtonText: 'Sim, sair', cancelButtonText: 'Cancelar', background: '#161618', color: '#fff' });
            if (result.isConfirmed) {
                try {
                    await supabase.auth.signOut();
                } catch (e) {
                    console.warn('[APP] Erro ao deslogar (redirecionando mesmo assim):', e);
                }
                window.location.replace("index.html");
            }
        });
    }

    window.verificarAcesso();
    window.ligarRadarEmTempoReal();

    // 📳 VIBRAÇÃO TÁTIL: todo toque em botão dá um "clique" físico (10ms).
    // Ignorado automaticamente em aparelhos sem suporte (iPhone, desktop).
    try {
        document.addEventListener('click', (e) => {
            if (e.target.closest('button, .btn-tactile, [role="button"]')) {
                if (navigator.vibrate) navigator.vibrate(10);
            }
        }, { passive: true });
    } catch (_) {}

    // 📡 MODO OFFLINE: avisa quando cair a net e re-sincroniza sozinho quando voltar
    try {
        const bannerOff = document.getElementById('banner-offline');
        const attBanner = () => { if (bannerOff) bannerOff.style.display = navigator.onLine ? 'none' : 'block'; };
        window.addEventListener('offline', attBanner);
        window.addEventListener('online', () => {
            attBanner();
            if (typeof window.verificarAcesso === 'function') window.verificarAcesso(); // re-sync automático
        });
        attBanner(); // já entra certo se abrir sem internet
    } catch (_) {}

    // ✨ SPLASH: some quando a primeira carga terminar (ou em 6s, o que vier primeiro)
    window._esconderSplash = function() {
        const sp = document.getElementById('splash-4l');
        if (!sp || sp.dataset.fechado) return;
        sp.dataset.fechado = '1';
        sp.style.opacity = '0';
        setTimeout(() => sp.remove(), 550);
    };
    setTimeout(() => window._esconderSplash(), 6000); // failsafe


    // ✅ CORREÇÃO: Upload de foto do perfil (handler que estava faltando no painel.html)
    const inputFoto = document.getElementById('input-foto');
    if (inputFoto) {
        inputFoto.addEventListener('change', async (e) => {
            let file = e.target.files[0];
            if (!file) return;
            // ✅ SEM limite de tamanho: aceita qualquer foto — a compressão resolve o peso
            Swal.fire({ title: 'Otimizando foto...', background: '#161618', color: '#fff', didOpen: () => Swal.showLoading() });
            try {
                file = await window.comprimirFoto(file); // 🗜️ 2MB+ vira 100-300KB
            } catch (compErr) {
                // ⛔ SEM fallback: foto não comprimida NÃO sobe (economia de espaço é a regra)
                console.error('[foto] Compressão falhou, upload bloqueado:', compErr);
                Swal.fire({ icon: 'error', title: 'Não foi possível processar a foto', text: 'Tente outra imagem (JPG ou PNG).', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
                return;
            }
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error('Sessão expirada');
                // 🧠 Guarda a URL da foto antiga ANTES de subir a nova (apaga direto, sem listar o bucket)
                const { data: perfilAntes } = await supabase.from('perfis').select('foto_url').eq('id', session.user.id).single();
                const fileExt = file.name.split('.').pop();
                const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('fotos-perfil').upload(fileName, file, { upsert: true, contentType: file.type });
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('fotos-perfil').getPublicUrl(fileName);
                const { error: updateError } = await supabase.from('perfis').update({ foto_url: publicUrl }).eq('id', session.user.id);
                if (updateError) throw updateError;
                // 🧹 Apaga SÓ a foto antiga (a que estava registrada no perfil)
                try {
                    const urlAntiga = perfilAntes?.foto_url || '';
                    if (urlAntiga.includes('/fotos-perfil/')) {
                        const nomeAntigo = urlAntiga.split('/fotos-perfil/').pop().split('?')[0];
                        if (nomeAntigo && nomeAntigo !== fileName) await supabase.storage.from('fotos-perfil').remove([nomeAntigo]);
                    }
                } catch (limpErr) { console.warn('[foto] Limpeza da foto antiga falhou (não fatal):', limpErr); }
                const img = document.getElementById('foto-perfil-aluno');
                if (img) img.src = publicUrl;
                Swal.fire({ icon: 'success', title: 'Foto atualizada!', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Erro no upload', text: err.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            }
        });
    }

    // ✅ CORREÇÃO: Quando o usuário volta do app do banco, verifica status
    // APENAS se não estiver no meio de um pagamento (Pix ou Cartão).
    // Isso evita que o QR Code ou formulário de cartão sumam da tela.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const temPix = document.querySelector('#feedback-pix img');
            const temCartao = document.getElementById('cardPaymentBrick_container')?.hasChildNodes();
            // ✅ A trava interna de verificarAcesso impede race com o radar/polling
            if (!temPix && !temCartao && typeof window.verificarAcesso === 'function') {
                console.log('[APP] Voltou ao foreground — verificando status...');
                window.verificarAcesso();
            }
        }
    });
});
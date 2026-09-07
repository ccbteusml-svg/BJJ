// ==========================================
// 4L ACADEMY — REDE GUARDA (rede-guarda.js) — v1
// Blindagem contra internet fraca/instável. 100% ADITIVO:
// não modifica nenhuma função existente — só envolve (wrap).
//
// O que este módulo faz:
//   1. Detector REAL de conexão (navigator.onLine mente em Wi-Fi sem internet)
//   2. Banner global de conexão (acessível, some sozinho ao voltar)
//   3. Re-sincronização automática ao recuperar a internet
//   4. Anti duplo-toque genérico nos botões de ação do admin
//   5. Helper público window._rgEhErroDeRede() usado pelos demais módulos
//
// Carregue ANTES dos demais scripts da página (painel-core, admin-lite, app...).
// ==========================================

(function() {
    'use strict';
    if (window._redeGuarda_instalado) return; // guarda contra instalação dupla
    window._redeGuarda_instalado = true;

    // ------------------------------------------
    // 1. CLASSIFICADOR DE ERRO: rede vs. regra de negócio
    // ------------------------------------------
    window._rgEhErroDeRede = function(err) {
        if (!err) return false;
        const txt = String(err.message || err.name || err || '').toLowerCase();
        return txt.includes('failed to fetch')
            || txt.includes('networkerror')
            || txt.includes('network request failed')
            || txt.includes('load failed')
            || txt.includes('aborterror')
            || txt.includes('aborted')
            || txt.includes('timeout')
            || txt.includes('err_network')
            || txt.includes('err_internet')
            || txt.includes('fetcherror');
    };

    // ------------------------------------------
    // 2. DETECTOR REAL DE CONEXÃO
    // navigator.onLine diz "true" em Wi-Fi sem internet. Aqui a gente
    // faz um ping leve de verdade (HEAD no manifest da própria origem,
    // com cache-buster), timeout de 5s, e guarda o resultado por 10s.
    // ------------------------------------------
    let _cacheNet = { ok: true, ts: 0 };
    let _pingEmAndamento = null;

    window._temInternet = function() {
        const agora = Date.now();
        if (agora - _cacheNet.ts < 10000) return Promise.resolve(_cacheNet.ok);
        if (_pingEmAndamento) return _pingEmAndamento;

        _pingEmAndamento = new Promise((resolve) => {
            if (!navigator.onLine) { _cacheNet = { ok: false, ts: Date.now() }; _pingEmAndamento = null; return resolve(false); }
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 5000);
            fetch('manifest.json?_rg=' + Date.now(), { method: 'HEAD', cache: 'no-store', signal: ctrl.signal })
                .then(r => { _cacheNet = { ok: r.ok, ts: Date.now() }; resolve(r.ok); })
                .catch(() => { _cacheNet = { ok: false, ts: Date.now() }; resolve(false); })
                .finally(() => { clearTimeout(t); _pingEmAndamento = null; });
        });
        return _pingEmAndamento;
    };

    // ------------------------------------------
    // 3. BANNER GLOBAL DE CONEXÃO
    // ------------------------------------------
    let _bannerEl = null;

    function _criarBanner() {
        if (_bannerEl || !document.body) return;
        _bannerEl = document.createElement('div');
        _bannerEl.id = 'rg-banner-rede';
        _bannerEl.setAttribute('role', 'status');
        _bannerEl.setAttribute('aria-live', 'polite');
        _bannerEl.style.display = 'none';
        _bannerEl.addEventListener('click', _tentarAgora); // tocar no banner = verificar já
        document.body.appendChild(_bannerEl);
    }

    function _mostrarBanner(texto, tipo) {
        _criarBanner();
        if (!_bannerEl) return;
        _bannerEl.textContent = texto;
        _bannerEl.className = 'rg-banner-' + tipo; // rg-banner-off | rg-banner-voltou
        _bannerEl.style.display = 'flex';
    }

    function _esconderBanner() {
        if (_bannerEl) _bannerEl.style.display = 'none';
    }

    // ------------------------------------------
    // 4. RE-SINCRONIZAÇÃO AO VOLTAR A INTERNET
    // Recarrega os dados da tela atual e re-liga o radar realtime.
    // ------------------------------------------
    let _reSyncRodando = false;

    async function _aoVoltarInternet() {
        if (_reSyncRodando) return;
        _reSyncRodando = true;
        try {
            _mostrarBanner('✅ Conexão restabelecida! Atualizando...', 'voltou');

            // Re-liga o radar de pagamento (remove o canal velho se existir)
            if (typeof window.ligarRadarEmTempoReal === 'function') {
                try { await window.ligarRadarEmTempoReal(); } catch (e) { console.warn('[REDE] Falha ao re-ligar radar:', e); }
            }
            // Recarrega os dados da tela (painel do aluno)
            if (typeof window.verificarAcesso === 'function') {
                try { await window.verificarAcesso(); } catch (e) { console.warn('[REDE] Falha ao re-sincronizar:', e); }
            }
            // Se o mural estiver aberto, recarrega os avisos também
            const abaAvisos = document.getElementById('aba-avisos');
            if (abaAvisos && abaAvisos.style.display !== 'none' && typeof window.carregarAvisos === 'function') {
                try { await window.carregarAvisos(); } catch (e) { /* já tem fallback próprio */ }
            }
            setTimeout(_esconderBanner, 2500);
        } finally {
            _reSyncRodando = false;
        }
    }

    function _aoCairInternet() {
        _mostrarBanner('📡 Sem conexão — mostrando dados salvos. Toque aqui para tentar de novo.', 'off');
    }

    async function _tentarAgora() {
        const ok = await window._temInternet();
        if (ok) _aoVoltarInternet();
    }

    // Eventos nativos + verificação periódica (cobre o caso "Wi-Fi mentiroso")
    window.addEventListener('offline', _aoCairInternet);
    window.addEventListener('online', async () => {
        // Espera 1s pro sinal estabilizar e confirma com ping real
        setTimeout(async () => {
            _cacheNet.ts = 0; // força ping novo
            if (await window._temInternet()) _aoVoltarInternet();
        }, 1000);
    });

    // A cada 30s: se o banner de offline está visível, tenta de novo sozinho
    setInterval(async () => {
        if (_bannerEl && _bannerEl.style.display !== 'none' && _bannerEl.className === 'rg-banner-off') {
            _cacheNet.ts = 0;
            if (await window._temInternet()) _aoVoltarInternet();
        }
    }, 30000);

    // Checagem inicial: já abriu sem internet? Mostra o banner.
    document.addEventListener('DOMContentLoaded', () => {
        _criarBanner();
        if (!navigator.onLine) _aoCairInternet();
        _instalarTravasBotoes();
    });

    // ------------------------------------------
    // 5. ANTI DUPLO-TOQUE (botões de ação do ADMIN)
    // O painel do aluno já tem travas próprias (btn-pagar, ajustes...).
    // Aqui envolvemos as ações do admin que faltavam: se a função
    // estiver rodando, cliques extras são ignorados.
    // ------------------------------------------
    function _comTrava(nomeFn) {
        const original = window[nomeFn];
        if (typeof original !== 'function' || original._rgTrava) return;
        const wrap = async function(...args) {
            if (wrap._ocupado) { console.warn('[REDE] Ação já em andamento, toque ignorado:', nomeFn); return; }
            wrap._ocupado = true;
            try { return await original.apply(this, args); }
            finally { wrap._ocupado = false; }
        };
        wrap._rgTrava = true;
        wrap._ocupado = false;
        window[nomeFn] = wrap;
    }

    function _instalarTravasBotoes() {
        // Só existem no admin.html — no painel do aluno essas chamadas são no-op
        [
            'publicarAviso', 'apagarAviso', 'darBaixa', 'apagarCobranca',
            'alternarPlano', 'cancelarVIP', 'excluirAluno', 'editarAlunoDossie',
            'cadastrarAlunoModal', 'gerarMensalidades', 'atualizarMeusDados',
            'toggleManutencao'
        ].forEach(_comTrava);
    }

    // O admin define as funções antes do DOMContentLoaded; se alguma nascer
    // depois (defensivo), tentamos instalar de novo com um pequeno atraso.
    setTimeout(_instalarTravasBotoes, 2000);

    console.log('[REDE] Guarda de rede ativo 📡');
})();

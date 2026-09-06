// ==========================================
// 4L ACADEMY — AJUSTES & SUPORTE (painel-ajustes.js) — v1
// ARQUIVO 100% ADITIVO: não modifica nenhuma função existente.
// Ele "envolve" (wrap) trocarAbaAluno e carregarAvisos para:
//   1. Aba Ajustes: editar dados, foto, e-mail, senha, suporte, FAQ
//   2. Badge de avisos não lidos no menu (localStorage + realtime)
//   3. Card de situação da mensalidade na Home
// Nenhum seletor/função antiga foi renomeado. RLS: aluno só atualiza a
// própria linha (policy aluno_editar_perfil_proprio) e só colunas básicas
// (ver SQL-SEGURANCA-ALUNO.sql para travar as demais colunas).
// ==========================================

(function() {
    'use strict';

    const WHATSAPP_PROFESSOR = '5592985589868'; // mesmo número da carteirinha digital
    const LS_AVISOS_VISTO = '4l_avisos_visto_em';

    // ---------- util ----------
    const $ = (id) => document.getElementById(id);

    const toast = (icone, titulo) => {
        Swal.fire({
            toast: true, position: 'top', icon: icone, title: titulo,
            showConfirmButton: false, timer: 2500,
            background: '#161618', color: '#fff'
        });
    };

    // ==========================================
    // 1. ABA AJUSTES — carregar e salvar
    // ==========================================
    window.carregarAjustes = async function() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: perfil, error } = await supabase
                .from('perfis')
                .select('nome, telefone, data_nascimento, foto_url')
                .eq('id', session.user.id)
                .maybeSingle();
            if (error) { console.warn('[AJUSTES] Falha ao ler perfil:', error); return; }

            if (perfil) {
                if ($('ajs-nome')) $('ajs-nome').value = perfil.nome || '';
                if ($('ajs-telefone')) $('ajs-telefone').value = perfil.telefone || '';
                if ($('ajs-nascimento')) $('ajs-nascimento').value = perfil.data_nascimento || '';
                if (perfil.foto_url && $('ajs-foto-preview')) $('ajs-foto-preview').src = perfil.foto_url;
            }
            if ($('ajs-email')) $('ajs-email').value = session.user.email || '';
        } catch (e) {
            console.warn('[AJUSTES] Exceção ao carregar:', e);
        }
    };

    window.salvarDadosPessoais = async function() {
        const btn = $('ajs-salvar-dados');
        const nome = ($('ajs-nome').value || '').trim();
        const telefone = ($('ajs-telefone').value || '').trim();
        const nascimento = $('ajs-nascimento').value || null;

        if (nome.length < 3) { toast('warning', 'Digite seu nome completo.'); return; }
        if (!navigator.onLine) { toast('warning', 'Você está offline.'); return; }

        if (btn) { btn.disabled = true; btn.textContent = 'SALVANDO...'; }
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada. Entre novamente.');

            // ✅ Só colunas básicas — valor_mensalidade/cargo/status ficam de fora
            const { error } = await supabase.from('perfis').update({
                nome: nome,
                telefone: telefone,
                data_nascimento: nascimento
            }).eq('id', session.user.id);
            if (error) throw error;

            // Atualiza a saudação da home sem recarregar
            const saudacao = $('saudacao-aluno');
            if (saudacao) saudacao.textContent = `Olá, ${nome}! 👋`;
            toast('success', 'Dados salvos! 🥋');
        } catch (err) {
            console.error('[AJUSTES] Erro ao salvar:', err);
            Swal.fire({ icon: 'error', title: 'Não salvou', text: err.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '💾 SALVAR DADOS'; }
        }
    };

    // ---------- foto (mesmo padrão do upload da home: bucket fotos-perfil, UID-timestamp.ext) ----------
    async function _trocarFotoAjustes(file) {
        if (file.size > 2 * 1024 * 1024) {
            Swal.fire({ icon: 'warning', title: 'Arquivo muito grande', text: 'Limite de 2MB.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            return;
        }
        // Preview instantâneo (otimista) antes mesmo de subir
        if ($('ajs-foto-preview')) $('ajs-foto-preview').src = URL.createObjectURL(file);

        Swal.fire({ title: 'Enviando foto...', background: '#161618', color: '#fff', didOpen: () => Swal.showLoading() });
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada');
            const fileExt = file.name.split('.').pop();
            const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
            const { error: upErr } = await supabase.storage.from('fotos-perfil').upload(fileName, file, { upsert: true, contentType: file.type });
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('fotos-perfil').getPublicUrl(fileName);
            const { error: updErr } = await supabase.from('perfis').update({ foto_url: publicUrl }).eq('id', session.user.id);
            if (updErr) throw updErr;
            // Espelha na foto da home
            const imgHome = $('foto-perfil-aluno');
            if (imgHome) imgHome.src = publicUrl;
            if ($('ajs-foto-preview')) $('ajs-foto-preview').src = publicUrl;
            Swal.fire({ icon: 'success', title: 'Foto atualizada!', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro no upload', text: err.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            if (typeof window.verificarAcesso === 'function') window.verificarAcesso(); // reverte preview
        }
    }

    // ---------- segurança ----------
    window.alterarSenha = async function() {
        const s1 = $('ajs-senha-nova').value || '';
        const s2 = $('ajs-senha-confirma').value || '';
        if (s1.length < 6) { toast('warning', 'A senha precisa de 6+ dígitos.'); return; }
        if (s1 !== s2) { toast('warning', 'As senhas não coincidem.'); return; }
        if (!navigator.onLine) { toast('warning', 'Você está offline.'); return; }

        const btn = $('ajs-salvar-senha');
        if (btn) { btn.disabled = true; btn.textContent = 'ALTERANDO...'; }
        try {
            const { error } = await supabase.auth.updateUser({ password: s1 });
            if (error) throw error;
            $('ajs-senha-nova').value = ''; $('ajs-senha-confirma').value = '';
            Swal.fire({ icon: 'success', title: 'Senha alterada! 🥋', text: 'Use a nova senha no próximo login.', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '🔑 ALTERAR SENHA'; }
        }
    };

    window.alterarEmail = async function() {
        const email = ($('ajs-email').value || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('warning', 'Digite um e-mail válido.'); return; }
        if (!navigator.onLine) { toast('warning', 'Você está offline.'); return; }

        const conf = await Swal.fire({
            title: 'Alterar e-mail?',
            text: 'Você receberá um link de confirmação no NOVO e-mail. O login só muda depois de confirmar.',
            icon: 'question', showCancelButton: true,
            confirmButtonColor: '#E53935', cancelButtonColor: '#333',
            confirmButtonText: 'Sim, alterar', cancelButtonText: 'Cancelar',
            background: '#161618', color: '#fff'
        });
        if (!conf.isConfirmed) return;

        const btn = $('ajs-salvar-email');
        if (btn) { btn.disabled = true; btn.textContent = 'ENVIANDO...'; }
        try {
            const { error } = await supabase.auth.updateUser({ email: email });
            if (error) throw error;
            Swal.fire({ icon: 'success', title: 'Link enviado! ✉️', text: 'Confirme no novo e-mail (veja também o SPAM).', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '✉️ ALTERAR E-MAIL'; }
        }
    };

    // ---------- suporte ----------
    window.abrirSuporteZap = async function() {
        let nome = 'Aluno';
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', session.user.id).maybeSingle();
                if (perfil && perfil.nome) nome = perfil.nome;
            }
        } catch (e) { /* segue com nome genérico */ }
        const msg = encodeURIComponent(`Olá, professor! Sou ${nome}, aluno da 4L Academy. Preciso de ajuda com o app. 🥋`);
        window.open(`https://wa.me/${WHATSAPP_PROFESSOR}?text=${msg}`, '_blank');
    };

    // ==========================================
    // 2. BADGE DE AVISOS NÃO LIDOS
    // ==========================================
    async function _atualizarBadgeAvisos() {
        const badge = $('badge-avisos');
        if (!badge) return;
        try {
            let res = await supabase.from('avisos').select('criado_em').order('criado_em', { ascending: false }).limit(20);
            if (res.error && res.error.code === '42703') {
                res = await supabase.from('avisos').select('created_at').order('created_at', { ascending: false }).limit(20);
            }
            if (res.error || !res.data) return;

            const vistoEm = parseInt(localStorage.getItem(LS_AVISOS_VISTO) || '0');
            const naoLidos = res.data.filter(a => new Date(a.criado_em || a.created_at).getTime() > vistoEm).length;

            if (naoLidos > 0) {
                badge.textContent = naoLidos > 9 ? '9+' : String(naoLidos);
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { console.warn('[BADGE] Falha:', e); }
    }

    function _marcarAvisosComoLidos() {
        localStorage.setItem(LS_AVISOS_VISTO, String(Date.now()));
        const badge = $('badge-avisos');
        if (badge) badge.style.display = 'none';
    }

    // Realtime: aviso novo publicado → badge acende na hora
    async function _ligarRadarAvisos() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            supabase.channel('avisos-badge')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos' }, () => {
                    _atualizarBadgeAvisos();
                })
                .subscribe((status) => {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.warn('[BADGE] Canal de avisos com problema:', status);
                    }
                });
        } catch (e) { console.warn('[BADGE] Radar de avisos falhou:', e); }
    }

    // ==========================================
    // 3. CARD DE SITUAÇÃO NA HOME
    // ==========================================
    async function _atualizarCardCobranca() {
        const card = $('card-proxima-cobranca');
        if (!card) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { data: pend } = await supabase.from('mensalidades')
                .select('mes, valor')
                .eq('aluno_id', session.user.id)
                .eq('status', 'pendente')
                .order('criado_em', { ascending: true })
                .limit(1);

            const titulo = $('prox-cobranca-titulo');
            const sub = $('prox-cobranca-sub');
            const btn = $('btn-ir-financeiro');
            card.style.display = 'flex';
            card.style.alignItems = 'center';

            if (pend && pend.length > 0) {
                titulo.textContent = `Mensalidade: ${pend[0].mes}`;
                titulo.style.color = '#fff';
                sub.textContent = `R$ ${pend[0].valor},00 · em aberto`;
                sub.style.color = '#ff5252';
                btn.textContent = 'PAGAR';
                btn.style.borderColor = '#E53935';
                btn.style.color = '#E53935';
            } else {
                titulo.textContent = 'Mensalidades em dia';
                titulo.style.color = '#4CAF50';
                sub.textContent = 'Nenhuma fatura em aberto. Oss! 🥋';
                sub.style.color = '#666';
                btn.textContent = 'VER';
                btn.style.borderColor = '#4CAF50';
                btn.style.color = '#4CAF50';
            }
            btn.onclick = () => {
                const itens = document.querySelectorAll('.menu-item');
                if (itens[1]) window.trocarAbaAluno('aba-mensalidade', itens[1]);
            };
        } catch (e) {
            console.warn('[HOME] Card de cobrança falhou:', e);
        }
    }

    // ==========================================
    // 4. WRAPS ADITIVOS (sem tocar nos arquivos antigos)
    // ==========================================
    function _instalarWraps() {
        // Wrap na navegação: carrega Ajustes ao abrir a aba + marca avisos como lidos
        if (typeof window.trocarAbaAluno === 'function' && !window.trocarAbaAluno._v4) {
            const _orig = window.trocarAbaAluno;
            const _wrap = function(idAba, elemento) {
                _orig(idAba, elemento);
                if (idAba === 'aba-ajustes') window.carregarAjustes();
                if (idAba === 'aba-avisos') _marcarAvisosComoLidos();
                if (idAba === 'aba-home') _atualizarCardCobranca();
            };
            _wrap._v4 = true;
            window.trocarAbaAluno = _wrap;
        }
        // Wrap no render de avisos: ao renderizar, considera tudo lido
        if (typeof window.carregarAvisos === 'function' && !window.carregarAvisos._v4) {
            const _origAv = window.carregarAvisos;
            const _wrapAv = async function() {
                await _origAv();
                _marcarAvisosComoLidos();
            };
            _wrapAv._v4 = true;
            window.carregarAvisos = _wrapAv;
        }
        // Wrap no verificarAcesso: mantém card da home sincronizado
        if (typeof window.verificarAcesso === 'function' && !window.verificarAcesso._v4) {
            const _origVa = window.verificarAcesso;
            const _wrapVa = async function() {
                await _origVa();
                _atualizarCardCobranca();
            };
            _wrapVa._v4 = true;
            window.verificarAcesso = _wrapVa;
        }
    }

    // ==========================================
    // 5. BOOT
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        _instalarWraps();
        _atualizarBadgeAvisos();
        _ligarRadarAvisos();
        _atualizarCardCobranca();

        const inputFotoAjs = $('input-foto-ajustes');
        if (inputFotoAjs) {
            inputFotoAjs.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) _trocarFotoAjustes(file);
                e.target.value = ''; // permite reenviar a mesma imagem
            });
        }
    });
})();

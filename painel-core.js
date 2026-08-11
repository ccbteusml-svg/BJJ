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
    document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active')); 
    if (elemento) elemento.classList.add('active'); 
    window.fecharMenu(); 

    if(idAba === 'aba-avisos' && typeof window.carregarAvisos === 'function') window.carregarAvisos(); 
    if(idAba === 'aba-historico' && typeof window.carregarHistorico === 'function') window.carregarHistorico(); 
};
// ==========================================
// 3. CARREGAMENTO PRINCIPAL (TEMA, PERFIL E HOME)
// ==========================================
window.verificarAcesso = async function() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { window.location.href = "index.html"; return; }

    const usuarioId = session.user.id;

    if (window.AndroidApp && typeof window.AndroidApp.registrarUsuarioApp === 'function') {
        try { window.AndroidApp.registrarUsuarioApp(usuarioId); } catch(e) { console.warn(e); }
    }

    const { data: perfil } = await supabase.from('perfis').select('nome, faixa, foto_url, assinante').eq('id', usuarioId).single();

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
    }

    // Último recibo pago
    const { data: ultimoPago } = await supabase.from('mensalidades')
        .select('*')
        .eq('aluno_id', usuarioId)
        .eq('status', 'pago')
        .order('criado_em', { ascending: false })
        .limit(1);
    const cardReciboHome = document.getElementById('card-recibo-home');
    if (ultimoPago && ultimoPago.length > 0 && cardReciboHome) {
        cardReciboHome.style.display = "flex";
        const btn = document.getElementById('btn-baixar-ultimo-recibo');
        if (btn) btn.onclick = () => {
            if (typeof window.abrirRecibo === 'function') window.abrirRecibo(ultimoPago[0].mes, ultimoPago[0].valor);
        };
    } else if (cardReciboHome) {
        cardReciboHome.style.display = "none";
    }

    // Prepara a Fatura atual
    const { data: mensalidades } = await supabase.from('mensalidades')
        .select('*')
        .eq('aluno_id', usuarioId)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true });

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
                    // Pagamento já foi aprovado no MP — recarrega para pegar status atualizado
                    window.verificarAcesso();
                    return; 
                }
            } catch (erroDeRede) {
                console.warn("[APP] Falha ao checar pagamento no carregamento:", erroDeRede);
                // Não quebra o app — continua montando a tela
            }
        }

        if (mesEl) mesEl.textContent = mens.mes;
        if (valEl) valEl.textContent = `R$ ${mens.valor},00`;
        if (statusEl) {
            statusEl.textContent = "🔴 EM ABERTO";
            statusEl.style.color = "#ff5252";
        }
        if (opcoesEl) opcoesEl.style.display = "flex";
        if (feedbackEl) feedbackEl.innerHTML = ""; 
        if (btnAdiantar) btnAdiantar.style.display = "none";
    } else {
        if (mesEl) mesEl.textContent = "Tudo Certo!";
        if (valEl) valEl.textContent = "R$ 0,00";
        if (statusEl) {
            statusEl.textContent = "✅ EM DIA";
            statusEl.style.color = "#4CAF50";
        }
        if (opcoesEl) opcoesEl.style.display = "none";
        if (feedbackEl) feedbackEl.innerHTML = "";
        if (btnAdiantar) btnAdiantar.style.display = "block";
    }
};


// ==========================================
// 4. RADAR DE PAGAMENTO EM TEMPO REAL
// ==========================================
window.ligarRadarEmTempoReal = async function() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; 

    supabase.channel('mensalidades-espiao')
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
    ).subscribe();
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
                await supabase.auth.signOut();
                window.location.href = "index.html";
            }
        });
    }

    window.verificarAcesso();
    window.ligarRadarEmTempoReal();

    // ✅ CORREÇÃO: Upload de foto do perfil (handler que estava faltando no painel.html)
    const inputFoto = document.getElementById('input-foto');
    if (inputFoto) {
        inputFoto.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                Swal.fire({ icon: 'warning', title: 'Arquivo muito grande', text: 'Limite de 2MB.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
                return;
            }
            Swal.fire({ title: 'Enviando foto...', background: '#161618', color: '#fff', didOpen: () => Swal.showLoading() });
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error('Sessão expirada');
                const fileExt = file.name.split('.').pop();
                const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('fotos-perfil').upload(fileName, file, { upsert: true, contentType: file.type });
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('fotos-perfil').getPublicUrl(fileName);
                await supabase.from('perfis').update({ foto_url: publicUrl }).eq('id', session.user.id);
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
            if (!temPix && !temCartao && typeof window.verificarAcesso === 'function') {
                console.log('[APP] Voltou ao foreground — verificando status...');
                window.verificarAcesso();
            }
        }
    });
});
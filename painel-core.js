// ==========================================
// 🎬 TELA DE CARREGAMENTO ANIMADA (LOTTIE)
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
                cortinaManutencao.innerHTML = `
                    <span style="font-size: 60px; margin-bottom: 20px;">🚧</span>
                    <h2 style="color: #e53935; font-weight: 800; font-style: italic; margin-bottom: 10px;">4L ACADEMY</h2>
                    <p style="font-size: 18px; line-height: 1.5; color: #ccc;">${config.mensagem_manutencao || '🥋 O App está em atualização. Voltamos em alguns minutos!'}</p>
                `;
                document.body.appendChild(cortinaManutencao);
                document.body.style.overflow = 'hidden'; 
            }
        }
    } catch (error) {
        console.error("Erro ao checar manutenção:", error);
    }
}
verificarManutencaoPainel();

// Variável Global para a Máquina de Cartão (Financeiro)
window.mensalidadeAtualId = null;

// ==========================================
// 2. CONTROLE DO MENU LATERAL E NAVEGAÇÃO
// ==========================================
window.abrirMenu = () => { 
    document.getElementById('menu-lateral').classList.add('aberto'); 
    document.getElementById('menu-backdrop').style.display = 'block'; 
    setTimeout(() => document.getElementById('menu-backdrop').style.opacity = '1', 10); 
};

window.fecharMenu = () => { 
    document.getElementById('menu-lateral').classList.remove('aberto'); 
    document.getElementById('menu-backdrop').style.opacity = '0'; 
    setTimeout(() => document.getElementById('menu-backdrop').style.display = 'none', 300); 
};

window.trocarAbaAluno = (idAba, elemento) => { 
    document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none');
    document.getElementById(idAba).style.display = 'block'; 
    document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active')); 
    if (elemento) elemento.classList.add('active'); 
    window.fecharMenu(); 
    
    // Chama as funções especialistas apenas se existirem
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

    // Conexão com app Android Onesignal
    if (window.AndroidApp) {
        window.AndroidApp.registrarUsuarioApp(usuarioId);
    }
    
    const { data: perfil } = await supabase.from('perfis').select('nome, faixa, foto_url, assinante').eq('id', usuarioId).single();

    // 🎨 TEMA CAMALEÃO: PINTA O APP COM A COR DA FAIXA
    if (perfil && perfil.faixa) {
        let textoFaixaDB = perfil.faixa.toLowerCase();
        let corTema = '#E53935'; // Vermelho padrão

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
    if (perfil) {
        saudacao.innerHTML = `Olá, ${perfil.nome}! 👋 <br><span style="font-size: 14px; color: var(--cor-destaque); font-weight: bold;">🥋 ${perfil.faixa || 'Branca'}</span>`;
        if (perfil.foto_url) {
            document.getElementById('foto-perfil-aluno').src = perfil.foto_url;
        }
    }
    
    // Controle do Banner VIP
    const bannerVip = document.getElementById('banner-vip');
    if (bannerVip) {
        if (perfil.assinante === true) bannerVip.style.display = 'none';
        else bannerVip.style.display = 'block';
    }

    // Controle do botão de último recibo na Home
    const { data: ultimoPago } = await supabase.from('mensalidades').select('*').eq('aluno_id', usuarioId).eq('status', 'pago').order('id', { ascending: false }).limit(1);
    const cardReciboHome = document.getElementById('card-recibo-home');
    if (ultimoPago && ultimoPago.length > 0 && cardReciboHome) {
        cardReciboHome.style.display = "flex";
        document.getElementById('btn-baixar-ultimo-recibo').onclick = () => {
            if (typeof window.abrirRecibo === 'function') window.abrirRecibo(ultimoPago[0].mes, ultimoPago[0].valor);
        };
    } else if (cardReciboHome) {
        cardReciboHome.style.display = "none";
    }

    // Prepara a Fatura atual na tela principal
    const { data: mensalidades } = await supabase.from('mensalidades').select('*').eq('aluno_id', usuarioId).eq('status', 'pendente');
    if (mensalidades && mensalidades.length > 0) {
        const mens = mensalidades[0];
        window.mensalidadeAtualId = mens.id; // Guarda o ID para a máquina de cartão

        if (mens.mp_payment_id) {
            const { data: foiPago } = await supabase.functions.invoke('verificar-pagamento', { body: { payment_id: mens.mp_payment_id } });
            if (foiPago && foiPago.status === "approved") {
                await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', mens.id);
                window.verificarAcesso();
                return; 
            }
        }

        document.getElementById('mes-atual').innerText = mens.mes;
        document.getElementById('valor-pagamento').innerText = `R$ ${mens.valor},00`;
        const statusEl = document.getElementById('status-pagamento');
        statusEl.innerText = "🔴 EM ABERTO";
        statusEl.style.color = "#ff5252";
        
        document.getElementById('opcoes-pagamento').style.display = "flex";
        document.getElementById('feedback-pix').innerHTML = ""; 

        const btnAdiantar = document.getElementById('btn-adiantar-fatura');
        if(btnAdiantar) btnAdiantar.style.display = "none";
    } else {
        document.getElementById('mes-atual').innerText = "Tudo Certo!";
        document.getElementById('valor-pagamento').innerText = "R$ 0,00";
        const statusEl = document.getElementById('status-pagamento');
        statusEl.innerText = "✅ EM DIA";
        statusEl.style.color = "#4CAF50";
        
        document.getElementById('opcoes-pagamento').style.display = "none";
        document.getElementById('feedback-pix').innerHTML = "";

        const btnAdiantar = document.getElementById('btn-adiantar-fatura');
        if(btnAdiantar) btnAdiantar.style.display = "block";
    }
};

// ==========================================
// 4. RADAR DE PAGAMENTO EM TEMPO REAL 📡
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

    // Arranque
    window.verificarAcesso();
    window.ligarRadarEmTempoReal();
});
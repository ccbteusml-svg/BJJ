// Configurações do Supabase
const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 1. PROTEÇÃO DE TELA E BUSCA DE DADOS
async function verificarAcesso() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.href = "index.html";
    } else {
        console.log("Usuário logado:", session.user.email);
        const usuarioId = session.user.id;
        
        // --- PARTE 1: BUSCA O PERFIL ---
        const { data: perfil } = await supabase
            .from('perfis')
            .select('nome, faixa')
            .eq('id', usuarioId)
            .single(); 
            
        const saudacao = document.getElementById('saudacao-aluno');
        if (perfil) {
            saudacao.innerHTML = `Olá, <b>${perfil.nome}</b>! <br><span style="font-size: 14px; color: #aaaaaa;">🥋 ${perfil.faixa}</span>`;
        } else {
            saudacao.innerText = "Olá, Aluno(a)!";
        }

        // --- PARTE 2: BUSCA A MENSALIDADE ---
        // Puxa a mensalidade mais recente desse aluno
        const { data: mensalidades } = await supabase
            .from('mensalidades')
            .select('*')
            .eq('aluno_id', usuarioId)
            .order('criado_em', { ascending: false }) // Pega a mais nova
            .limit(1);

        if (mensalidades && mensalidades.length > 0) {
            const mensalidade = mensalidades[0];

            // Atualiza os textos na tela
            document.getElementById('mes-atual').innerText = mensalidade.mes;
            document.getElementById('valor-pagamento').innerText = `R$ ${mensalidade.valor},00`;

            // Muda as cores e esconde/mostra o botão dependendo do status
            const statusElement = document.getElementById('status-pagamento');
            const cartaoFundo = document.getElementById('cartao-fundo');
            const btnPagar = document.getElementById('btn-pagar'); // Puxa o botão

            // MÁGICA BLINDADA: Transforma em minúsculo, tira espaços e previne falhas se vier vazio
            const statusDoBanco = (mensalidade.status || '').toLowerCase().trim();

            if (statusDoBanco === 'pendente') {
                statusElement.innerText = "🔴 PENDENTE";
                statusElement.style.color = "#ff5252"; 
                cartaoFundo.style.borderLeft = "6px solid #ff5252"; 
                btnPagar.style.display = "block"; // Garante que o botão aparece
                
            } else if (statusDoBanco === 'pago') {
                statusElement.innerText = "🟢 PAGO";
                statusElement.style.color = "#4CAF50"; 
                cartaoFundo.style.borderLeft = "6px solid #4CAF50"; 
                btnPagar.style.display = "none"; // Esconde o botão de PIX!

            } else {
                // Se no banco estiver escrito qualquer outra coisa diferente, ele avisa!
                statusElement.innerText = "⚠️ VERIFICAR BANCO";
                statusElement.style.color = "#ff9800"; // Laranja
            }

        } else {
            document.getElementById('mes-atual').innerText = "Nenhuma cobrança";
            document.getElementById('status-pagamento').innerText = "---";
            document.getElementById('valor-pagamento').innerText = "R$ 0,00";
        }
    }
}

// ADICIONE ESTA LINHA ABAIXO PARA EXECUTAR A FUNÇÃO:
verificarAcesso();


// 2. FUNÇÃO SAIR
document.getElementById('btn-sair').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

// 3. FUNÇÃO PAGAR (Pix Real + Envio de Comprovante via WhatsApp)
document.getElementById('btn-pagar').addEventListener('click', () => {
    const feedback = document.getElementById('feedback-pix');
    const btnPagar = document.getElementById('btn-pagar');
    
    feedback.innerHTML = "⏳ Gerando seu Pix...";
    btnPagar.style.display = "none"; // Esconde o botão original
    
    // COLE SUA CHAVE PIX COPIA E COLA REAL AQUI DENTRO DAS ASPAS:
    const codigoPix = "COLE_O_SEU_CODIGO_GIGANTE_DO_BANCO_AQUI"; 
    
    setTimeout(() => {
        // Mostra o código na tela e o botão de WhatsApp
        feedback.innerHTML = `
            ✅ <b>Pix Gerado!</b><br><br>
            <p style="font-size: 13px; color: #aaaaaa; margin-bottom: 8px;">Copie o código abaixo e pague no app do seu banco:</p>
            <code style='background:#000; padding:15px; display:block; color:#fff; font-size: 11px; word-break: break-all; border-radius: 8px; border: 1px solid #333;'>${codigoPix}</code>
            <br>
            <button id="btn-enviar-comprovante" style="background-color: #25D366; color: white; padding: 14px; border: none; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);">📲 ENVIAR COMPROVANTE</button>
        `;

        // Ação de abrir o WhatsApp
        document.getElementById('btn-enviar-comprovante').addEventListener('click', () => {
            // COLOQUE O SEU NÚMERO AQUI (Com 55, DDD e Número. Sem espaços ou traços)
            const numeroWhatsApp = "5592999999999"; 
            
            // Mensagem automática que o aluno vai te mandar
            const mensagem = "Oss! Mestre, acabei de realizar o pagamento da minha mensalidade pelo PIX. Segue o meu comprovante!";
            
            // Cria o link do WhatsApp e abre em uma nova aba/janela
            const linkWhatsapp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;
            window.open(linkWhatsapp, '_blank');
        });

    }, 800);
});
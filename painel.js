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
        const { data: mensalidades } = await supabase
            .from('mensalidades')
            .select('*')
            .eq('aluno_id', usuarioId)
            .order('criado_em', { ascending: false }) 
            .limit(1);

        if (mensalidades && mensalidades.length > 0) {
            const mensalidade = mensalidades[0];

            document.getElementById('mes-atual').innerText = mensalidade.mes;
            document.getElementById('valor-pagamento').innerText = `R$ ${mensalidade.valor},00`;

            const statusElement = document.getElementById('status-pagamento');
            const cartaoFundo = document.getElementById('cartao-fundo');
            const btnPagar = document.getElementById('btn-pagar');

            const statusDoBanco = (mensalidade.status || '').toLowerCase().trim();

            if (statusDoBanco === 'pendente') {
                statusElement.innerText = "🔴 PENDENTE";
                statusElement.style.color = "#ff5252"; 
                cartaoFundo.style.borderLeft = "6px solid #ff5252"; 
                btnPagar.style.display = "block"; 
                
            } else if (statusDoBanco === 'pago') {
                statusElement.innerText = "🟢 PAGO";
                statusElement.style.color = "#4CAF50"; 
                cartaoFundo.style.borderLeft = "6px solid #4CAF50"; 
                btnPagar.style.display = "none"; 

            } else {
                statusElement.innerText = "⚠️ VERIFICAR BANCO";
                statusElement.style.color = "#ff9800"; 
            }

        } else {
            document.getElementById('mes-atual').innerText = "Nenhuma cobrança";
            document.getElementById('status-pagamento').innerText = "---";
            document.getElementById('valor-pagamento').innerText = "R$ 0,00";
        }
    }
}

verificarAcesso();

// 2. FUNÇÃO SAIR
document.getElementById('btn-sair').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

// 3. FUNÇÃO PAGAR (Pix Real com QR Code + Envio via WhatsApp)
document.getElementById('btn-pagar').addEventListener('click', () => {
    const feedback = document.getElementById('feedback-pix');
    const btnPagar = document.getElementById('btn-pagar');
    
    feedback.innerHTML = "⏳ Gerando seu Pix...";
    btnPagar.style.display = "none"; 
    
    // SUA CHAVE PIX REAL:
    const codigoPix = "00020126580014BR.GOV.BCB.PIX0136df56414c-22e3-4344-a4e9-196aca711462520400005303986540530.005802BR5925MATHEUS LEMOS DE OLIVEIRA6006MANAUS622605222h0XOKk4btX4PIsKYU1NsF6304A9FB"; 
    
    const urlSegura = encodeURIComponent(codigoPix);
    const imagemQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${urlSegura}`;
    
    setTimeout(() => {
        feedback.innerHTML = `
            ✅ <b>Pix Gerado!</b><br><br>
            <img src="${imagemQrCode}" style="border-radius: 10px; border: 5px solid white; margin-bottom: 10px; max-width: 100%;"><br>
            <p style="font-size: 13px; color: #aaaaaa; margin-bottom: 8px;">Copie o código abaixo ou escaneie o QR Code:</p>
            <code style='background:#000; padding:15px; display:block; color:#fff; font-size: 11px; word-break: break-all; border-radius: 8px; border: 1px solid #333;'>${codigoPix}</code>
            <br>
            <button id="btn-enviar-comprovante" style="background-color: #25D366; color: white; padding: 14px; border: none; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);">📲 ENVIAR COMPROVANTE</button>
        `;

        // Ação de abrir o WhatsApp
        document.getElementById('btn-enviar-comprovante').addEventListener('click', () => {
            const numeroWhatsApp = "5592993168201"; 
            const mensagem = "Oss! Mestre, acabei de realizar o pagamento da minha mensalidade pelo PIX. Segue o meu comprovante!";
            const linkWhatsapp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;
            window.open(linkWhatsapp, '_blank');
        });

    }, 800);
});

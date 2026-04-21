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

            // Muda as cores dependendo do status (Pendente ou Pago)
            const statusElement = document.getElementById('status-pagamento');
            const cartaoFundo = document.getElementById('cartao-fundo');

            if (mensalidade.status === 'pendente') {
                statusElement.innerText = "🔴 PENDENTE";
                statusElement.style.color = "#ff5252"; // Vermelho
                cartaoFundo.style.borderLeft = "6px solid #D32F2F"; // Borda do cartão vermelha
            } else if (mensalidade.status === 'pago') {
                statusElement.innerText = "🟢 PAGO";
                statusElement.style.color = "#4CAF50"; // Verde
                cartaoFundo.style.borderLeft = "6px solid #4CAF50"; // Borda do cartão verde
            }
        } else {
            // Se o aluno for novo e não tiver mensalidade cadastrada
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

// 3. FUNÇÃO PAGAR (Simulação inicial)
document.getElementById('btn-pagar').addEventListener('click', () => {
    const feedback = document.getElementById('feedback-pix');
    feedback.innerText = "⏳ Gerando código Pix seguro...";
    
    setTimeout(() => {
        feedback.innerHTML = "✅ Pix Gerado!<br><br><code style='background:#000; padding:10px; display:block; color:#fff;'>00020101021226870014br.gov.bcb.pix...</code>";
    }, 1500);
});

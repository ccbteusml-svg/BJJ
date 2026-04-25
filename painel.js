const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ⚠️ COLOQUE O SEU TOKEN DE PRODUÇÃO AQUI UMA ÚNICA VEZ
const MP_TOKEN = "APP_USR-7562332116001719-042418-f33e2259640ba0d7011a293b09ecf888-506473053";

let mensalidadeAtualId = null; // Variável para lembrar qual mensalidade estamos a pagar

// NAVEGAÇÃO DE ABAS
window.trocarAbaAluno = function(idAba, elemento) {
    document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none');
    document.getElementById(idAba).style.display = 'block';
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    elemento.classList.add('active');
    if(idAba === 'aba-avisos') carregarAvisos();
}

async function verificarAcesso() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { window.location.href = "index.html"; return; } 

    const usuarioId = session.user.id;
    const { data: perfil } = await supabase.from('perfis').select('nome, faixa').eq('id', usuarioId).single(); 
        
    const saudacao = document.getElementById('saudacao-aluno');
    if (perfil) {
        saudacao.innerHTML = `Olá, <b>${perfil.nome}</b>! <br><span style="font-size: 14px; color: #aaaaaa;">🥋 ${perfil.faixa || 'Branca'}</span>`;
    }

    const { data: mensalidades } = await supabase.from('mensalidades').select('*').eq('aluno_id', usuarioId).eq('status', 'pendente');

    if (mensalidades && mensalidades.length > 0) {
        const mens = mensalidades[0]; 
        mensalidadeAtualId = mens.id; // Guarda o ID interno da cobrança

        // 🕵️ O "POLÍCIA" EM AÇÃO: Se já tem um código PIX gerado antes, vai perguntar ao banco se foi pago!
        if (mens.mp_payment_id) {
            const foiPago = await verificarPagamentoMP(mens.mp_payment_id);
            if (foiPago) {
                // Dá baixa sozinho no banco de dados!
                await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', mens.id);
                // Recarrega a tela para ficar verde automaticamente
                verificarAcesso();
                return; 
            }
        }

        document.getElementById('mes-atual').innerText = mens.mes;
        document.getElementById('valor-pagamento').innerText = `R$ ${mens.valor},00`;
        const statusEl = document.getElementById('status-pagamento');
        statusEl.innerText = "🔴 EM ABERTO";
        statusEl.style.color = "#ff5252";
        
        const btnPagar = document.getElementById('btn-pagar');
        btnPagar.style.display = "block";
        document.getElementById('feedback-pix').innerHTML = ""; // Limpa os avisos anteriores

    } else {
        document.getElementById('mes-atual').innerText = "Tudo Certo!";
        document.getElementById('valor-pagamento').innerText = "R$ 0,00";
        const statusEl = document.getElementById('status-pagamento');
        statusEl.innerText = "✅ EM DIA";
        statusEl.style.color = "#4CAF50";
        document.getElementById('btn-pagar').style.display = "none";
        document.getElementById('feedback-pix').innerHTML = "";
    }
}

// FUNÇÃO QUE PERGUNTA AO MERCADO PAGO SE O ALUNO JÁ PAGOU
async function verificarPagamentoMP(paymentId) {
    try {
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${MP_TOKEN}` }
        });
        const data = await res.json();
        return data.status === "approved"; // Retorna Verdadeiro se o dinheiro caiu
    } catch (e) {
        return false;
    }
}

// INTEGRAÇÃO REAL COM MERCADO PAGO (GERAR O PIX)
document.getElementById('btn-pagar').addEventListener('click', async () => {
    const feedback = document.getElementById('feedback-pix');
    const btnPagar = document.getElementById('btn-pagar');
    
    feedback.innerHTML = "⏳ Conectando ao Banco Central...";
    btnPagar.style.display = "none"; 
    
    const valorCobrado = parseFloat(document.getElementById('valor-pagamento').innerText.replace('R$ ', '').replace(',', '.'));
    const mesCobrado = document.getElementById('mes-atual').innerText;

    try {
        const resposta = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MP_TOKEN}`,
                "X-Idempotency-Key": `pix-${Date.now()}` 
            },
            body: JSON.stringify({
                transaction_amount: valorCobrado,
                description: `Mensalidade 4L Academy - ${mesCobrado}`,
                payment_method_id: "pix",
                payer: { email: "aluno@teste.com" }
            })
        });

        const dados = await resposta.json();

        if (dados.status === "pending") {
            // 💾 NOVIDADE: Salva o ID do Mercado Pago na nossa base de dados para o "Polícia" vigiar depois
            await supabase.from('mensalidades').update({ mp_payment_id: dados.id }).eq('id', mensalidadeAtualId);

            const qrCodeBase64 = dados.point_of_interaction.transaction_data.qr_code_base64;
            const copiaCola = dados.point_of_interaction.transaction_data.qr_code;

            feedback.innerHTML = `
                ✅ <b>Pix Oficial Gerado!</b><br><br>
                <img src="data:image/jpeg;base64,${qrCodeBase64}" style="border-radius: 10px; border: 5px solid white; margin-bottom: 10px; max-width: 100%;"><br>
                
                <p style="font-size: 13px; color: #aaaaaa; margin-bottom: 8px;">Pix Copia e Cola:</p>
                <code style='background:#000; padding:12px; display:block; color:#fff; font-size: 10px; word-break: break-all; border-radius: 8px; border: 1px solid #333; max-height: 60px; overflow-y: auto;'>${copiaCola}</code>
                
                <button id="btn-copiar-pix" style="background-color: #333333; color: white; padding: 12px; border: none; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; font-size: 13px; text-transform: uppercase;">
                    📋 Copiar Código Pix
                </button>
                <br>
                <button id="btn-enviar-comprovante" style="background-color: #25D366; color: white; padding: 14px; border: none; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase;">📲 Enviar Comprovante</button>
            `;

            document.getElementById('btn-copiar-pix').addEventListener('click', () => {
                navigator.clipboard.writeText(copiaCola).then(() => {
                    const btnCopiar = document.getElementById('btn-copiar-pix');
                    btnCopiar.innerText = "✅ CÓDIGO COPIADO!";
                    btnCopiar.style.backgroundColor = "#4CAF50"; 
                    setTimeout(() => {
                        btnCopiar.innerText = "📋 Copiar Código Pix";
                        btnCopiar.style.backgroundColor = "#333333";
                    }, 3000);
                });
            });

            document.getElementById('btn-enviar-comprovante').addEventListener('click', () => {
                const numeroWhatsApp = "5592993168201"; 
                const mensagem = "Oss! Mestre, acabei de realizar o pagamento da minha mensalidade pelo PIX. Segue o comprovante!";
                window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`, '_blank');
            });
        } else {
            feedback.innerHTML = `❌ Erro no banco: ${dados.message || 'Falha na comunicação.'}`;
            btnPagar.style.display = "block";
        }

    } catch (erro) {
        feedback.innerHTML = "❌ Erro de conexão com o banco. Verifique a internet.";
        btnPagar.style.display = "block";
    }
});

async function carregarAvisos() {
    const lista = document.getElementById('lista-avisos');
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center; margin-top: 20px;">Buscando...</p>`;
    const { data: avisos, error } = await supabase.from('avisos').select('*');
    if (error) { lista.innerHTML = `<p style="color: #ff5252; text-align: center; margin-top: 20px;">Erro: ${error.message}</p>`; return; }
    if (!avisos || avisos.length === 0) {
        lista.innerHTML = `<div class="card-status" style="padding: 20px; text-align: center;"><p style="color: #aaaaaa; margin: 0;">Nenhum aviso no momento. Bom treino!</p></div>`;
        return;
    }
    lista.innerHTML = ""; 
    for (const aviso of avisos.reverse()) {
        lista.innerHTML += `
            <div class="card-status" style="padding: 20px; margin-bottom: 15px; border-left: 4px solid var(--cor-destaque); text-align: left;">
                <h4 style="color: white; font-size: 16px; margin-bottom: 8px;">${aviso.titulo}</h4>
                <p style="color: #aaaaaa; font-size: 14px; line-height: 1.5; margin: 0;">${aviso.mensagem}</p>
            </div>`;
    }
}

document.getElementById('btn-sair').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

verificarAcesso();

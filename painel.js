const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ⚠️ SUAS CREDENCIAIS DO MERCADO PAGO
const MP_PUBLIC_KEY = "APP_USR-2dcd1a56-a86a-4967-b8ae-466813eabb1e"; 
const MP_ACCESS_TOKEN = "APP_USR-7562332116001719-042418-f33e2259640ba0d7011a293b09ecf888-506473053"; 

const mp = new window.MercadoPago(MP_PUBLIC_KEY);
const bricksBuilder = mp.bricks();
let mensalidadeAtualId = null;

// ==========================================
// CONTROLE DO MENU LATERAL
// ==========================================
window.abrirMenu = () => { document.getElementById('menu-lateral').classList.add('aberto'); document.getElementById('menu-backdrop').style.display = 'block'; setTimeout(() => document.getElementById('menu-backdrop').style.opacity = '1', 10); };
window.fecharMenu = () => { document.getElementById('menu-lateral').classList.remove('aberto'); document.getElementById('menu-backdrop').style.opacity = '0'; setTimeout(() => document.getElementById('menu-backdrop').style.display = 'none', 300); };
window.trocarAbaAluno = (idAba, elemento) => { document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none'); document.getElementById(idAba).style.display = 'block'; document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active')); if (elemento) elemento.classList.add('active'); fecharMenu(); if(idAba === 'aba-avisos') carregarAvisos(); };

// ==========================================
// LÓGICA DE ACESSO E EXIBIÇÃO DE DADOS
// ==========================================
async function verificarAcesso() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { window.location.href = "index.html"; return; } 

    const usuarioId = session.user.id;
    const { data: perfil } = await supabase.from('perfis').select('nome, faixa').eq('id', usuarioId).single(); 
        
    const saudacao = document.getElementById('saudacao-aluno');
    if (perfil) {
        saudacao.innerHTML = `Olá, ${perfil.nome}! 👋 <br><span style="font-size: 14px; color: var(--cor-destaque); font-weight: bold;">🥋 ${perfil.faixa || 'Branca'}</span>`;
    }

    const { data: mensalidades } = await supabase.from('mensalidades').select('*').eq('aluno_id', usuarioId).eq('status', 'pendente');

    if (mensalidades && mensalidades.length > 0) {
        const mens = mensalidades[0]; 
        mensalidadeAtualId = mens.id;

        if (mens.mp_payment_id) {
            const foiPago = await verificarPagamentoMP(mens.mp_payment_id);
            if (foiPago) {
                await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', mens.id);
                verificarAcesso();
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

    } else {
        document.getElementById('mes-atual').innerText = "Tudo Certo!";
        document.getElementById('valor-pagamento').innerText = "R$ 0,00";
        const statusEl = document.getElementById('status-pagamento');
        statusEl.innerText = "✅ EM DIA";
        statusEl.style.color = "#4CAF50";
        
        document.getElementById('opcoes-pagamento').style.display = "none";
        document.getElementById('feedback-pix').innerHTML = "";
    }
}

async function verificarPagamentoMP(paymentId) {
    try {
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
        });
        const data = await res.json();
        return data.status === "approved"; 
    } catch (e) {
        return false;
    }
}

// ==========================================
// PAGAMENTO COM CARTÃO VIA SERVIDOR
// ==========================================
document.getElementById('btn-show-card').addEventListener('click', async () => {
    document.getElementById('opcoes-pagamento').style.display = "none"; 
    const valor = parseFloat(document.getElementById('valor-pagamento').innerText.replace('R$ ', '').replace(',', '.'));
    
    const settings = {
        initialization: { amount: valor },
        customization: { 
            visual: { style: { theme: 'dark' } }, 
            paymentMethods: { maxInstallments: 1 }
        },
        callbacks: {
            onReady: () => { console.log('Brick de cartão pronto'); },
            onSubmit: ({ formData }) => {
                return new Promise((resolve, reject) => {
                    processarPagamentoCartao(formData, resolve, reject);
                });
            },
            onError: (error) => { console.error("Erro no Brick:", error); }
        },
    };
    window.cardPaymentBrickController = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', settings);
});

async function processarPagamentoCartao(formData, resolve, reject) {
    const feedback = document.getElementById('feedback-pix');
    feedback.innerHTML = "⏳ Conectando ao Servidor Seguro da 4L Academy...";

    try {
        let numeroDocumento = "";
        if (formData.payer && formData.payer.identification && formData.payer.identification.number) {
            numeroDocumento = formData.payer.identification.number;
        }

        const dadosDoPagamento = {
            token: formData.token,
            issuer_id: formData.issuer_id,
            payment_method_id: formData.payment_method_id,
            transaction_amount: Number(formData.transaction_amount),
            installments: Number(formData.installments),
            description: `Mensalidade 4L Academy`,
            payer: { email: formData.payer.email, identification: { type: "CPF", number: numeroDocumento } }
        };

        const { data, error } = await supabase.functions.invoke('pagar-cartao', { body: dadosDoPagamento });

        if (error) {
            Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: 'Falha ao conectar com o banco.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            feedback.innerHTML = `❌ Erro de comunicação com a Nuvem.`;
            reject();
            return;
        }
        
        if (data.status === "approved") {
            await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', mensalidadeAtualId);
            feedback.innerHTML = "✅ Pagamento aprovado! Oss!";
            
            // AVISO PREMIUM DE SUCESSO
            await Swal.fire({ icon: 'success', title: 'Aprovado!', text: 'Mensalidade paga com sucesso. Bom treino!', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
            
            location.reload();
            resolve();
        } else if (data.status === "in_process" || data.status === "pending") {
            feedback.innerHTML = "⏳ Pagamento em análise pelo banco...";
            resolve();
        } else {
            let erroMsg = "Cartão recusado pelo banco.";
            if (data.cause && data.cause.length > 0) erroMsg = data.cause[0].description;
            else if (data.status_detail) erroMsg = data.status_detail;
            
            Swal.fire({ icon: 'error', title: 'Pagamento Recusado', text: erroMsg, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            feedback.innerHTML = `❌ Erro: ${erroMsg}`;
            reject();
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Falha', text: 'Erro no servidor.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        feedback.innerHTML = "❌ Falha na conexão com o Servidor.";
        reject();
    }
}

// ==========================================
// PAGAMENTO COM PIX (COPIA E COLA)
// ==========================================
document.getElementById('btn-pagar').addEventListener('click', async () => {
    const feedback = document.getElementById('feedback-pix');
    document.getElementById('opcoes-pagamento').style.display = "none"; 
    
    feedback.innerHTML = "⏳ Gerando código PIX Oficial...";
    
    const valorCobrado = parseFloat(document.getElementById('valor-pagamento').innerText.replace('R$ ', '').replace(',', '.'));
    const mesCobrado = document.getElementById('mes-atual').innerText;

    try {
        const resposta = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MP_ACCESS_TOKEN}`, "X-Idempotency-Key": `pix-${Date.now()}` },
            body: JSON.stringify({
                transaction_amount: valorCobrado,
                description: `Mensalidade 4L Academy - ${mesCobrado}`,
                payment_method_id: "pix",
                payer: { email: "aluno@4lacademy.com", first_name: "Aluno", last_name: "Jiu-Jitsu" }
            })
        });

        const dados = await resposta.json();

        if (dados.status === "pending") {
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
                    // TOAST PREMIUM INFORMANDO QUE COPIOU
                    Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Código Copiado!', showConfirmButton: false, timer: 2000, background: '#161618', color: '#fff' });
                    
                    const btnCopiar = document.getElementById('btn-copiar-pix');
                    btnCopiar.innerText = "✅ CÓDIGO COPIADO!";
                    btnCopiar.style.backgroundColor = "#4CAF50"; 
                    setTimeout(() => { btnCopiar.innerText = "📋 Copiar Código Pix"; btnCopiar.style.backgroundColor = "#333333"; }, 3000);
                });
            });

            document.getElementById('btn-enviar-comprovante').addEventListener('click', () => {
                const numeroWhatsApp = "5592993168201"; 
                const mensagem = "Oss! Mestre, acabei de realizar o pagamento da minha mensalidade pelo PIX Oficial. Segue o comprovante!";
                window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`, '_blank');
            });
        } else {
            Swal.fire({ icon: 'error', title: 'Erro no PIX', text: dados.message || 'Falha na comunicação.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            document.getElementById('opcoes-pagamento').style.display = "flex";
        }

    } catch (erro) {
        Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: 'Não foi possível conectar com o banco.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        document.getElementById('opcoes-pagamento').style.display = "flex";
    }
});

// ==========================================
// CARREGAR AVISOS
// ==========================================
async function carregarAvisos() {
    const lista = document.getElementById('lista-avisos');
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center; margin-top: 20px;">Buscando...</p>`;

    const { data: avisos, error } = await supabase.from('avisos').select('*');

    if (error || !avisos || avisos.length === 0) {
        lista.innerHTML = `
            <div class="card-status" style="padding: 20px; text-align: center;">
                <p style="color: #aaaaaa; margin: 0;">Nenhum aviso no momento. Bom treino!</p>
            </div>`;
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

// ==========================================
// SAIR DA CONTA COM CONFIRMAÇÃO PREMIUM
// ==========================================
document.getElementById('btn-sair').addEventListener('click', async () => {
    const result = await Swal.fire({
        title: 'Sair do Aplicativo?',
        text: "Deseja realmente desconectar da sua conta?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#E53935',
        cancelButtonColor: '#333',
        confirmButtonText: 'Sim, sair',
        cancelButtonText: 'Cancelar',
        background: '#161618',
        color: '#fff'
    });

    if (result.isConfirmed) {
        await supabase.auth.signOut();
        window.location.href = "index.html";
    }
});

verificarAcesso();

// ==========================================
// MÁGICA: ATUALIZAÇÃO EM TEMPO REAL 📡
// ==========================================
async function ligarRadarEmTempoReal() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; 
    const usuarioId = session.user.id;

    supabase.channel('mensalidades-espiao')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensalidades', filter: `aluno_id=eq.${usuarioId}` },
        (payload) => {
            if (payload.new.status === 'pago') {
                // ALERTA PREMIUM QUANDO O PROFESSOR DA BAIXA
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Pagamento Confirmado! 🥋', 
                    text: 'O seu acesso foi liberado. Bom treino!', 
                    background: '#161618', 
                    color: '#fff', 
                    confirmButtonColor: '#4CAF50' 
                }).then(() => {
                    verificarAcesso(); 
                });
            }
        }
    ).subscribe();
}

ligarRadarEmTempoReal();

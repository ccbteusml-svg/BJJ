// ⚠️ SUAS CREDENCIAIS DO MERCADO PAGO (Apenas a Pública, 100% seguro!)
const MP_PUBLIC_KEY = "APP_USR-2dcd1a56-a86a-4967-b8ae-466813eabb1e"; 

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
    
    // 🔥 Busca os dados do aluno, incluindo o link da foto
    const { data: perfil } = await supabase.from('perfis').select('nome, faixa, foto_url').eq('id', usuarioId).single(); 
        
    const saudacao = document.getElementById('saudacao-aluno');
    if (perfil) {
        saudacao.innerHTML = `Olá, ${perfil.nome}! 👋 <br><span style="font-size: 14px; color: var(--cor-destaque); font-weight: bold;">🥋 ${perfil.faixa || 'Branca'}</span>`;
        
        // 🔥 Se o aluno tiver foto salva, troca a imagem na tela
        if (perfil.foto_url) {
            document.getElementById('foto-perfil-aluno').src = perfil.foto_url;
        }
    }

    const { data: mensalidades } = await supabase.from('mensalidades').select('*').eq('aluno_id', usuarioId).eq('status', 'pendente');

    if (mensalidades && mensalidades.length > 0) {
        const mens = mensalidades[0]; 
        mensalidadeAtualId = mens.id;

        if (mens.mp_payment_id) {
            const { data: foiPago } = await supabase.functions.invoke('verificar-pagamento', { body: { payment_id: mens.mp_payment_id } });
            if (foiPago && foiPago.status === "approved") {
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

// ==========================================
// ASSINATURA RECORRENTE (DENTRO DO APP - SEM REDIRECIONAR)
// ==========================================
document.getElementById('btn-show-card').innerText = "🔄 ASSINAR MENSALIDADE";

document.getElementById('btn-show-card').addEventListener('click', async () => {
    try {
        Swal.fire({ title: 'Abrindo Máquina...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
        document.getElementById('opcoes-pagamento').style.display = "none"; 

        // 🔥 A MÁGICA DA AUTOCORREÇÃO AQUI! 🔥
        // O app ignora o valor do banco e muda a tela na mesma hora para evitar confusão
        document.getElementById('valor-pagamento').innerText = "R$ 25,00 /mês";
        document.getElementById('mes-atual').innerText = "Plano Recorrente";
        document.getElementById('status-pagamento').innerText = "💳 ASSINATURA";
        document.getElementById('status-pagamento').style.color = "#2196F3"; // Fica azul para destacar o cartão

        const settings = {
            initialization: { amount: 25 }, // Valor oficial
            customization: { 
                visual: { 
                    style: { theme: 'dark' },
                    texts: {
                        formTitle: "Cartão de Crédito" // Título limpo
                    }
                }, 
                paymentMethods: { 
                    maxInstallments: 1,
                    types: { excluded: ['debit_card'] } // Trava de débito
                } 
            },
            callbacks: {
                onReady: () => { Swal.close(); },
                onSubmit: (dadosRecebidos) => {
                    return new Promise(async (resolve, reject) => {
                        const feedback = document.getElementById('feedback-pix');
                        feedback.innerHTML = "⏳ Processando Assinatura...";

                        try {
                            let form = dadosRecebidos.formData || dadosRecebidos;
                            
                            // ⚠️ LEMBRE-SE DE COLOCAR SEU ID DO PLANO AQUI
                            const ID_DO_PLANO = "867728a336404feca158d63874ccea3b";
                            
                            let emailAluno = "aluno@4lacademy.com";
                            if (form.payer && form.payer.email) emailAluno = form.payer.email;
                            
                            const cardToken = form.token; 

                            const { data, error } = await supabase.functions.invoke('gerar-assinatura', {
                                body: { email: emailAluno, plan_id: ID_DO_PLANO, card_token: cardToken }
                            });

                            if (error) throw error;

                            // ====================================================
                            // 🔥 AQUI ESTÁ A VIRADA DE CHAVE DO ASSINANTE VIP! 🔥
                            // ====================================================
                            if (data.id && data.status === "authorized") {
                                // Pega a sessão do aluno logado para saber quem ele é
                                const { data: { session } } = await supabase.auth.getSession();
                                
                                // 1. Marca a mensalidade atual como PAGA
                                await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', mensalidadeAtualId);
                                
                                // 2. 🔥 Transforma o aluno em Assinante VIP no banco
                                if (session) {
                                    await supabase.from('perfis').update({ assinante: true }).eq('id', session.user.id);
                                }

                                Swal.fire({ icon: 'success', title: 'Assinatura Ativa!', text: 'Mensalidade paga e programada para os próximos meses! Oss!', background: '#161618', color: '#fff' }).then(() => location.reload());
                                resolve();
                            } else {
                                let erroMsg = data.message || "Cartão recusado para assinatura.";
                                Swal.fire({ icon: 'error', title: 'Recusado', text: erroMsg, background: '#161618', color: '#fff' });
                                feedback.innerHTML = `❌ Erro: ${erroMsg}`;
                                reject();
                            }
                            // ====================================================

                        } catch (err) {
                            Swal.fire({ icon: 'error', title: 'Falha', text: err.message, background: '#161618', color: '#fff' });
                            reject();
                        }
                    });
                },
                onError: (error) => { console.error("Erro Brick:", error); }
            }
        };

        if (window.cardPaymentBrickController) window.cardPaymentBrickController.unmount();
        window.cardPaymentBrickController = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', settings);
        
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
    }
});


// ==========================================
// PROCESSAR PAGAMENTO DO CARTÃO NA NUVEM
// ==========================================
async function processarPagamentoCartao(dadosRecebidos, resolve, reject) {
    const feedback = document.getElementById('feedback-pix');
    feedback.innerHTML = "⏳ Conectando ao Servidor Seguro da 4L Academy...";

    try {
        // 🔥 A DEFESA SUPREMA: Isola o formulário quer venha com a capa (formData) ou sem a capa
        let form = dadosRecebidos;
        if (dadosRecebidos && dadosRecebidos.formData) {
            form = dadosRecebidos.formData;
        }

        if (!form) {
            throw new Error("O Mercado Pago não enviou os dados.");
        }

        let emailAluno = "aluno@4lacademy.com"; 
        let docTipo = "CPF";
        let docNumero = "00000000000";

        if (form.payer) {
            if (form.payer.email) emailAluno = form.payer.email;
            if (form.payer.identification) {
                if (form.payer.identification.type) docTipo = form.payer.identification.type;
                if (form.payer.identification.number) docNumero = form.payer.identification.number;
            }
        }

        const dadosDoPagamento = {
            token: form.token,
            issuer_id: form.issuer_id || "",
            payment_method_id: form.payment_method_id,
            transaction_amount: Number(form.transaction_amount),
            installments: Number(form.installments) || 1,
            description: `Mensalidade 4L Academy`,
            payer: { email: emailAluno, identification: { type: docTipo, number: docNumero } }
        };

        const { data, error } = await supabase.functions.invoke('pagar-cartao', { body: dadosDoPagamento });

        if (error) {
            Swal.fire({ icon: 'error', title: 'Erro na Nuvem', text: 'O servidor recusou a chamada.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            feedback.innerHTML = `❌ Erro de comunicação com a Nuvem.`;
            reject();
            return;
        }
        
        if (data.status === "approved") {
            await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', mensalidadeAtualId);
            feedback.innerHTML = "✅ Pagamento aprovado! Oss!";
            
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
        Swal.fire({ icon: 'error', title: 'Falha no Celular', text: `Motivo: ${e.message}`, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        feedback.innerHTML = `❌ Erro: ${e.message}`;
        reject();
    }
}

// ==========================================
// PAGAMENTO COM PIX (COPIA E COLA) BLINDADO
// ==========================================
document.getElementById('btn-pagar').addEventListener('click', async () => {
    const feedback = document.getElementById('feedback-pix');
    document.getElementById('opcoes-pagamento').style.display = "none"; 
    
    feedback.innerHTML = "⏳ Conectando ao Cofre da Academia para gerar o PIX...";
    
    const valorCobrado = parseFloat(document.getElementById('valor-pagamento').innerText.replace('R$ ', '').replace(',', '.'));
    const mesCobrado = document.getElementById('mes-atual').innerText;

    try {
        const { data: dados, error } = await supabase.functions.invoke('gerar-pix', {
            body: { valor: valorCobrado, mes: mesCobrado }
        });

        if (error) throw error;

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
        Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: 'Não foi possível gerar o PIX. Tente novamente.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        document.getElementById('opcoes-pagamento').style.display = "flex";
        console.error(erro);
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
// SAIR DA CONTA
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

// ==========================================
// 📸 GESTÃO DA FOTO DE PERFIL (SUPABASE STORAGE BLINDADO)
// ==========================================
document.getElementById('input-foto').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    Swal.fire({ title: 'Enviando foto...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

    try {
        // Pega os dados do usuário logado
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão expirada. Faça login novamente.");
        
        const usuarioId = session.user.id;
        
        // Pega a extensão do arquivo (ex: jpg, png) e cria um nome único para não dar conflito de cache
        const fileExt = arquivo.name.split('.').pop();
        const fileName = `${usuarioId}/perfil-${Date.now()}.${fileExt}`;

        // 1. Faz o upload direto para a gaveta 'fotos_perfil' no Supabase
        const { error: uploadError } = await supabase.storage
            .from('fotos_perfil')
            .upload(fileName, arquivo, { upsert: true }); // upsert: true substitui se já existir

        if (uploadError) throw uploadError;

        // 2. Pega o link público gerado pelo Supabase para mostrar na tela
        const { data: publicUrlData } = supabase.storage
            .from('fotos_perfil')
            .getPublicUrl(fileName);

        const linkDaFoto = publicUrlData.publicUrl;

        // 3. Atualiza a tabela 'perfis' do aluno com o novo link da foto
        const { error: updateError } = await supabase
            .from('perfis')
            .update({ foto_url: linkDaFoto })
            .eq('id', usuarioId);

        if (updateError) throw updateError;

        // 4. Atualiza a imagem na tela na mesma hora
        document.getElementById('foto-perfil-aluno').src = linkDaFoto;
        Swal.fire({ icon: 'success', title: 'Foto Atualizada!', background: '#161618', color: '#fff', timer: 2000, showConfirmButton: false });

    } catch (err) {
        console.error("Erro no upload:", err);
        Swal.fire({ icon: 'error', title: 'Falha no Upload', text: err.message, background: '#161618', color: '#fff' });
    }
});


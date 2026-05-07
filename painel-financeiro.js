// ==========================================
// 1. INICIALIZAÇÃO DO MERCADO PAGO E EVENTOS DA TELA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // ⚠️ SUAS CREDENCIAIS DO MERCADO PAGO (Apenas a Pública, 100% seguro!)
    const MP_PUBLIC_KEY = "APP_USR-2dcd1a56-a86a-4967-b8ae-466813eabb1e"; 
    const mp = new window.MercadoPago(MP_PUBLIC_KEY);
    const bricksBuilder = mp.bricks();

    // ==========================================
    // 2. MÁQUINA DE CARTÃO INTELIGENTE
    // ==========================================
    window.voltarParaOpcoes = function() {
        if (window.cardPaymentBrickController) {
            window.cardPaymentBrickController.unmount();
        }
        document.getElementById('feedback-pix').innerHTML = "";
        if (typeof window.verificarAcesso === 'function') window.verificarAcesso(); 
    };

    window.abrirMaquinaCartao = async function(tipoPagamento) {
        try {
            Swal.fire({ title: 'Abrindo Máquina...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
            document.getElementById('opcoes-pagamento').style.display = "none";

            const btnAdiantar = document.getElementById('btn-adiantar-fatura');
            if(btnAdiantar) btnAdiantar.style.display = "none";

            const feedback = document.getElementById('feedback-pix');
            feedback.innerHTML = `
                <button id="btn-voltar-cartao" style="background-color: transparent; color: #aaa; border: 1px solid #555; padding: 10px; border-radius: 8px; width: 100%; margin-bottom: 15px; cursor: pointer; font-weight: bold;">
                    ⬅️ Escolher outra forma de pagamento
                </button>
            `;
            document.getElementById('btn-voltar-cartao').addEventListener('click', window.voltarParaOpcoes);

            let configTextos, configMetodos, nomeFuncaoSupabase;
            const valorNaTela = document.getElementById('valor-pagamento').innerText.replace('R$ ', '').replace(',00', '');

            if (tipoPagamento === 'assinatura') {
                document.getElementById('mes-atual').innerText = "Plano VIP (Recorrente)";
                document.getElementById('status-pagamento').innerText = "💳 ASSINATURA";
                document.getElementById('status-pagamento').style.color = "#2196F3";
                document.getElementById('valor-pagamento').innerText = "R$ 25,00 /mês";
                configTextos = { formTitle: "Cartão de Crédito (Assinatura)" };
                configMetodos = { maxInstallments: 1, types: { excluded: ['debit_card'] } }; // Bloqueia débito no VIP
                nomeFuncaoSupabase = 'gerar-assinatura';
            } else {
                document.getElementById('mes-atual').innerText += " (Pagamento Único)";
                document.getElementById('status-pagamento').innerText = "💳 DÉBITO/CRÉDITO";
                document.getElementById('status-pagamento').style.color = "#4CAF50";
                configTextos = { formTitle: "Pagar com Cartão" };
                configMetodos = { maxInstallments: 1 }; // Débito liberado avulso
                nomeFuncaoSupabase = 'gerar-pagamento-cartao';
            }

            const settings = {
                initialization: { amount: parseFloat(valorNaTela) || 25 },
                customization: { visual: { style: { theme: 'dark' }, texts: configTextos }, paymentMethods: configMetodos },
                callbacks: {
                    onReady: () => { Swal.close(); },
                    onSubmit: (dadosRecebidos) => {
                        return new Promise(async (resolve, reject) => {
                            const feedback = document.getElementById('feedback-pix');
                            feedback.innerHTML = `⏳ Processando ${tipoPagamento === 'assinatura' ? 'Assinatura' : 'Pagamento'}...`;

                            try {
                                let form = dadosRecebidos.formData || dadosRecebidos;
                                let emailAluno = form.payer?.email || "aluno@4lacademy.com";
                                const { data: { session } } = await window.supabase.auth.getSession();
                                
                                const payload = {
                                    email: emailAluno,
                                    card_token: form.token,
                                    payment_method_id: form.payment_method_id,
                                    issuer_id: form.issuer_id,
                                    payer: form.payer,
                                    installments: form.installments,
                                    aluno_id: session.user.id,             
                                    mensalidade_id: window.mensalidadeAtualId     
                                };

                                if (tipoPagamento === 'assinatura') {
                                    payload.plan_id = "867728a336404feca158d63874ccea3b";
                                } else {
                                    payload.valor = parseFloat(valorNaTela);
                                    payload.mes = document.getElementById('mes-atual').innerText.replace(" (Pagamento Único)", "");
                                }

                                const { data, error } = await window.supabase.functions.invoke(nomeFuncaoSupabase, { body: payload });
                                if (error) throw error;

                                if (data.id && (data.status === "authorized" || data.status === "approved")) {
                                    Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Pagamento aprovado! Oss!', background: '#161618', color: '#fff' }).then(() => location.reload());
                                    resolve();
                                } else {
                                    let motivoReal = data.status_detail ? data.status_detail : "Desconhecido";
                                    let erroMsg = data.message || `Cartão recusado. Motivo: ${motivoReal}`;
                                    console.log("RESPOSTA COMPLETA DO MERCADO PAGO:", data);
                                    Swal.fire({ icon: 'error', title: 'Recusado', text: erroMsg, background: '#161618', color: '#fff' });
                                    feedback.innerHTML = `❌ Erro: ${erroMsg}`;
                                    reject();
                                }
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
            
            setTimeout(() => {
                const formCartao = document.getElementById('cardPaymentBrick_container');
                if (formCartao) formCartao.scrollIntoView({ behavior: 'smooth' });
            }, 500);

        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
        }
    };

    // LIGANDO OS BOTÕES NA MÁQUINA DE CARTÃO
    const btnShowCard = document.getElementById('btn-show-card');
    if (btnShowCard) btnShowCard.addEventListener('click', () => window.abrirMaquinaCartao('avulso'));
    
    const btnAssinarVip = document.getElementById('btn-assinar-vip');
    if (btnAssinarVip) {
        btnAssinarVip.addEventListener('click', () => {
            window.trocarAbaAluno('aba-mensalidade', document.querySelector('.menu-item:first-child'));
            window.abrirMaquinaCartao('assinatura');
        });
    }

    // ==========================================
    // 3. PAGAMENTO COM PIX (COPIA E COLA)
    // ==========================================
    const btnPagar = document.getElementById('btn-pagar');
    if (btnPagar) {
        btnPagar.addEventListener('click', async () => {
            const feedback = document.getElementById('feedback-pix');
            document.getElementById('opcoes-pagamento').style.display = "none";
            feedback.innerHTML = "⏳ Conectando ao Cofre da Academia para gerar o PIX...";
            
            const valorCobrado = parseFloat(document.getElementById('valor-pagamento').innerText.replace('R$ ', '').replace(',', '.'));
            const mesCobrado = document.getElementById('mes-atual').innerText;
            
            try {
                const { data: dados, error } = await window.supabase.functions.invoke('gerar-pix', {
                    body: { valor: valorCobrado, mes: mesCobrado }
                });
                
                if (error) throw error;
                
                if (dados.status === "pending") {
                    const mp_id_texto = String(dados.id);
                    const { error: erroAoSalvar } = await window.supabase.from('mensalidades')
                        .update({ mp_payment_id: mp_id_texto })
                        .eq('id', window.mensalidadeAtualId);
                    
                    if (erroAoSalvar) throw erroAoSalvar;
                    
                    const transacaoInfo = dados?.point_of_interaction?.transaction_data;
                    if (!transacaoInfo || !transacaoInfo.qr_code_base64) {
                        throw new Error("O Mercado Pago demorou para gerar o QR Code. Por favor, tente novamente.");
                    }
                    
                    const qrCodeBase64 = transacaoInfo.qr_code_base64;
                    const copiaCola = transacaoInfo.qr_code;
                    
                    feedback.innerHTML = `
                        ✅ <b>Pix Oficial Gerado!</b><br><br>
                        <img src="data:image/jpeg;base64,${qrCodeBase64}" style="border-radius: 10px; border: 5px solid white; margin-bottom: 10px; max-width: 100%;"><br>
                        <p style="font-size: 13px; color: #aaaaaa; margin-bottom: 8px;">Pix Copia e Cola:</p>
                        <code style='background:#000; padding:12px; display:block; color:#fff; font-size: 10px; word-break: break-all; border-radius: 8px; border: 1px solid #333; max-height: 60px; overflow-y: auto;'>${copiaCola}</code>
                        <button id="btn-copiar-pix" style="background-color: #333333; color: white; padding: 12px; border: none; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; font-size: 13px; text-transform: uppercase;">📋 Copiar Código Pix</button>
                        <button id="btn-cancelar-pix" style="background-color: transparent; color: #ff5252; border: 1px solid #ff5252; padding: 12px; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; font-size: 13px; text-transform: uppercase;">⬅️ Cancelar Pix</button>
                        <div style="margin-top: 20px; padding: 15px; border-radius: 8px; background-color: rgba(33, 150, 243, 0.1); border: 1px solid #2196F3;">
                            <p style="color: #2196F3; font-size: 13px; margin: 0; font-weight: bold;">📡 Aguardando pagamento...</p>
                        </div>
                    `;

                    document.getElementById('btn-cancelar-pix').addEventListener('click', window.voltarParaOpcoes);
                    document.getElementById('btn-copiar-pix').addEventListener('click', () => {
                        navigator.clipboard.writeText(copiaCola).then(() => {
                            Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Código Copiado!', showConfirmButton: false, timer: 2000, background: '#161618', color: '#fff' });
                            const btnCopiar = document.getElementById('btn-copiar-pix');
                            btnCopiar.innerText = "✅ CÓDIGO COPIADO!";
                            btnCopiar.style.backgroundColor = "#4CAF50";
                            setTimeout(() => { btnCopiar.innerText = "📋 Copiar Código Pix"; btnCopiar.style.backgroundColor = "#333333"; }, 3000);
                        });
                    });
                } else {
                    Swal.fire({ icon: 'error', title: 'Erro no PIX', text: dados.message || 'Falha na comunicação.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
                    document.getElementById('opcoes-pagamento').style.display = "flex";
                }
            } catch (erro) {
                Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: erro.message || 'Não foi possível gerar o PIX. Tente novamente.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
                document.getElementById('opcoes-pagamento').style.display = "flex";
                feedback.innerHTML = ""; 
                console.error(erro);
            }
        });
    }

    // ==========================================
    // 4. ADIANTAR PRÓXIMA FATURA (SELF-SERVICE)
    // ==========================================
    const btnAdiantarFatura = document.getElementById('btn-adiantar-fatura');
    if (btnAdiantarFatura) {
        btnAdiantarFatura.addEventListener('click', async () => {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) return;

            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const dataAtual = new Date();
            let proximoMesIndex = dataAtual.getMonth() + 1;
            let ano = dataAtual.getFullYear();
            if (proximoMesIndex > 11) { proximoMesIndex = 0; ano++; }
            
            const nomeProxMes = `${meses[proximoMesIndex]}/${ano}`;
            const { data: perfil } = await window.supabase.from('perfis').select('valor_mensalidade').eq('id', session.user.id).single();
            const valorFatura = perfil.valor_mensalidade ? perfil.valor_mensalidade : 25; 

            const result = await Swal.fire({
                title: 'Adiantar Mensalidade?',
                html: `Deseja gerar a fatura de <b>${nomeProxMes}</b> no valor de <b>R$ ${valorFatura},00</b> agora?<br><br><span style="font-size: 12px; color: #aaa;">O pagamento será liberado imediatamente.</span>`,
                icon: 'question', showCancelButton: true, confirmButtonColor: '#E53935', cancelButtonColor: '#333', confirmButtonText: 'Sim, Gerar', cancelButtonText: 'Cancelar', background: '#161618', color: '#fff'
            });

            if (result.isConfirmed) {
                Swal.fire({ title: 'Gerando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
                try {
                    const { data: existente } = await window.supabase.from('mensalidades').select('id').eq('aluno_id', session.user.id).eq('mes', nomeProxMes);
                    if (existente && existente.length > 0) {
                        Swal.fire({ icon: 'info', title: 'Aviso', text: 'Você já possui uma fatura gerada para o próximo mês.', background: '#161618', color: '#fff' });
                        return;
                    }

                    const { error } = await window.supabase.from('mensalidades').insert([{
                        aluno_id: session.user.id, mes: nomeProxMes, valor: valorFatura, status: 'pendente'
                    }]);
                    if (error) throw error;
                    
                    Swal.fire({ icon: 'success', title: 'Fatura Gerada!', text: 'Opções de pagamento liberadas.', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
                    if(typeof window.verificarAcesso === 'function') window.verificarAcesso();
                } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
                }
            }
        });
    }
}); // Fim do DOMContentLoaded

// ==========================================
// 5. HISTÓRICO E RECIBOS EM PDF (Acessível de qualquer tela)
// ==========================================
window.carregarHistorico = async function() {
    const lista = document.getElementById('lista-historico');
    if(!lista) return;
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center; margin-top: 20px;">Buscando histórico...</p>`;

    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) return;

    const { data: historico, error } = await window.supabase
        .from('mensalidades')
        .select('*')
        .eq('aluno_id', session.user.id)
        .order('id', { ascending: false });

    if (error || !historico || historico.length === 0) {
        lista.innerHTML = `
            <div class="card-status" style="padding: 20px; text-align: center;">
                <p style="color: #aaaaaa; margin: 0;">Você ainda não possui histórico de pagamentos.</p>
            </div>`;
        return;
    }

    lista.innerHTML = "";
    for (const mens of historico) {
        const isPago = mens.status.toLowerCase() === 'pago';
        const corBorda = isPago ? '#4CAF50' : '#ff5252';
        const textoStatus = isPago ? '✅ PAGO' : '🔴 EM ABERTO';
        const btnRecibo = isPago 
            ? `<button onclick="window.abrirRecibo('${mens.mes}', '${mens.valor}')" style="background: rgba(76, 175, 80, 0.15); border: 1px solid #4CAF50; color: #4CAF50; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; width: auto; margin-top: 6px;">🧾 RECIBO</button>` 
            : '';
        lista.innerHTML += `
            <div class="card-status" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid ${corBorda}; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="color: white; font-size: 15px; margin: 0 0 5px 0;">${mens.mes}</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <p style="color: ${corBorda}; font-size: 11px; font-weight: bold; margin: 0;">${textoStatus}</p>
                        ${btnRecibo}
                    </div>
                </div>
                <span style="color: white; font-size: 16px; font-weight: bold;">R$ ${mens.valor}</span>
            </div>`;
    }
};

window.abrirRecibo = async function(mesReferencia, valorPago) {
    Swal.fire({ title: 'Gerando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
    const { data: { session } } = await window.supabase.auth.getSession();
    const { data: perfil } = await window.supabase.from('perfis').select('nome').eq('id', session.user.id).single();
    const nomeAluno = perfil ? perfil.nome : "Aluno";
    const dataEmissao = new Date().toLocaleDateString('pt-BR');
    
    const htmlRecibo = `
        <div id="recibo-print" class="recibo-print">
            <div class="recibo-header">
                <h2 style="margin: 0; font-size: 22px; font-style: italic; font-weight: 900;">4L ACADEMY</h2>
                <p style="margin: 5px 0 0; font-size: 12px; text-transform: uppercase;">Comprovante de Pagamento</p>
            </div>
            <p style="margin-bottom: 8px; font-size: 14px;"><strong>Aluno(a):</strong> ${nomeAluno}</p>
            <p style="margin-bottom: 8px; font-size: 14px;"><strong>Referência:</strong> ${mesReferencia}</p>
            <p style="margin-bottom: 8px; font-size: 14px;"><strong>Valor Pago:</strong> R$ ${valorPago}</p>
            <p style="margin-bottom: 8px; font-size: 14px;"><strong>Emissão:</strong> ${dataEmissao}</p>
            <div style="text-align: center; margin-top: 25px; border-top: 1px dashed black; padding-top: 15px;">
                <p style="font-size: 11px; margin: 0;">Este documento atesta o pagamento da mensalidade supracitada.</p>
                <p style="font-size: 12px; margin-top: 8px; font-weight: bold;">Oss! 🥋</p>
            </div>
        </div>
    `;

    Swal.fire({
        html: htmlRecibo,
        background: '#161618',
        showCloseButton: true,
        showCancelButton: true,
        focusConfirm: false,
        confirmButtonText: '💾 Salvar PDF / Imprimir',
        cancelButtonText: 'Fechar',
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#333',
        width: '90%',
        customClass: { popup: 'swal-recibo' } 
    }).then((result) => {
        if (result.isConfirmed) {
            window.print();
        }
    });
};

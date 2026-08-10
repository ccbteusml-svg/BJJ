// ==========================================
// 1. INICIALIZAÇÃO DO MERCADO PAGO E EVENTOS DA TELA
// ==========================================
if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = (str) => {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
}

// ==========================================
// SISTEMA DE POLLING PARA PIX (CORRIGIDO)
// ==========================================
let _pollInterval = null;
let _pollPaymentId = null;
let _pollMensalidadeId = null;
let _pollErrosSeguidos = 0;
const MAX_ERROS_POLL = 5; // Depois de 5 erros, para de insistir

window.pararPollingPagamento = function() {
    if (_pollInterval) {
        clearInterval(_pollInterval);
        _pollInterval = null;
        _pollPaymentId = null;
        _pollMensalidadeId = null;
        _pollErrosSeguidos = 0;
        console.log('[POLLING] Parado.');
    }
};

window.iniciarPollingPagamento = function(paymentId, mensalidadeId) {
    if (!paymentId || !mensalidadeId) {
        console.error('[POLLING] paymentId ou mensalidadeId inválidos.');
        return;
    }
    window.pararPollingPagamento();
    _pollPaymentId = paymentId;
    _pollMensalidadeId = mensalidadeId;
    _pollErrosSeguidos = 0;

    let tentativas = 0;
    const maxTentativas = 60; // 10 minutos

    console.log(`[POLLING] Iniciado — payment_id: ${paymentId} | mensalidade_id: ${mensalidadeId}`);

    // Verificação imediata
    window._verificarPagamentoPoll(paymentId, mensalidadeId);

    _pollInterval = setInterval(() => {
        tentativas++;
        if (tentativas > maxTentativas) {
            window.pararPollingPagamento();
            const feedback = document.getElementById('feedback-pix');
            if (feedback) {
                feedback.innerHTML = '';
                const msg = document.createElement('div');
                msg.style.cssText = 'padding: 12px; background: rgba(255,193,7,0.1); border: 1px solid #FFC107; border-radius: 8px; color: #FFC107; font-size: 12px; margin-top: 10px;';
                msg.innerHTML = '⏳ <b>Tempo de espera esgotado.</b><br>Se você já pagou, clique em "⬅️ Cancelar Pix" e volte ao início para atualizar.';
                feedback.appendChild(msg);
            }
            return;
        }
        window._verificarPagamentoPoll(paymentId, mensalidadeId);
    }, 10000);
};

window._verificarPagamentoPoll = async function(paymentId, mensalidadeId) {
    try {
        const { data, error } = await window.supabase.functions.invoke('verificar-pagamento', {
            body: { payment_id: paymentId, mensalidade_id: mensalidadeId }
        });

        // ✅ Se a Edge Function retornar erro HTTP, trata aqui
        if (error) {
            _pollErrosSeguidos++;
            console.warn(`[POLLING] Erro da Edge Function (${_pollErrosSeguidos}/${MAX_ERROS_POLL}):`, error);
            
            // Se errou muitas vezes seguidas, mostra aviso na tela
            if (_pollErrosSeguidos >= MAX_ERROS_POLL) {
                window.pararPollingPagamento();
                const feedback = document.getElementById('feedback-pix');
                if (feedback) {
                    const aviso = document.createElement('div');
                    aviso.style.cssText = 'padding: 12px; background: rgba(255,82,82,0.1); border: 1px solid #ff5252; border-radius: 8px; color: #ff5252; font-size: 12px; margin-top: 10px;';
                    aviso.innerHTML = '⚠️ <b>Serviço de verificação indisponível.</b><br>Se você já pagou, cancele e volte ao início.';
                    feedback.appendChild(aviso);
                }
            }
            return;
        }

        _pollErrosSeguidos = 0; // Reset de erros
        console.log('[POLLING] Resposta MP:', data?.status, data?.detail || '');

        if (data && data.status === 'approved') {
            window.pararPollingPagamento();

            const feedback = document.getElementById('feedback-pix');
            if (feedback) {
                feedback.innerHTML = '';
                const div = document.createElement('div');
                div.style.cssText = 'padding: 15px; background: rgba(76,175,80,0.1); border: 1px solid #4CAF50; border-radius: 8px; margin-top: 10px;';
                div.innerHTML = '<p style="color: #4CAF50; font-weight: bold; margin: 0; font-size: 14px;">✅ Pagamento confirmado!</p>';
                feedback.appendChild(div);
            }

            Swal.fire({
                icon: 'success',
                title: 'Pagamento Confirmado! 🥋',
                text: 'Seu pagamento foi aprovado. Bom treino!',
                background: '#161618',
                color: '#fff',
                confirmButtonColor: '#4CAF50'
            }).then(() => {
                window.voltarParaOpcoes();
                if (typeof window.verificarAcesso === 'function') window.verificarAcesso();
            });
        }
    } catch (e) {
        _pollErrosSeguidos++;
        console.warn('[POLLING] Exceção na verificação:', e);
        if (_pollErrosSeguidos >= MAX_ERROS_POLL) window.pararPollingPagamento();
    }
};


// ==========================================

let mp;
let bricksBuilder;

if (typeof window.MercadoPago !== 'undefined') {
    mp = new window.MercadoPago("APP_USR-2dcd1a56-a86a-4967-b8ae-466813eabb1e");
    bricksBuilder = mp.bricks();
} else {
    console.warn("Mercado Pago offline. Modo restrito ativado.");
}

// Guarda o texto original do mês para evitar acúmulo de sufixos
let _mesOriginal = null;

window.voltarParaOpcoes = function() {
    // ✅ CORREÇÃO: Para o polling ao sair da tela de Pix
    window.pararPollingPagamento();

    if (window.cardPaymentBrickController) {
        window.cardPaymentBrickController.unmount();
    }
    const feedback = document.getElementById('feedback-pix');
    if (feedback) feedback.innerHTML = "";

    // Restaura o texto original do mês se existir
    const mesEl = document.getElementById('mes-atual');
    if (_mesOriginal && mesEl) mesEl.textContent = _mesOriginal;

    if (typeof window.verificarAcesso === 'function') window.verificarAcesso();
};

window.abrirMaquinaCartao = async function() {
    if (!bricksBuilder) {
        Swal.fire({ icon: 'error', title: 'Sem Conexão', text: 'Você precisa de internet para abrir a máquina de cartão.', background: '#161618', color: '#fff' });
        return;
    }

    try {
        if (typeof window.mostrarCarregamentocartao === 'function') {
            window.mostrarCarregamentocartao('Abrindo Máquina...');
        }

        const opcoes = document.getElementById('opcoes-pagamento');
        if (opcoes) opcoes.style.display = "none";

        const btnAdiantar = document.getElementById('btn-adiantar-fatura');
        if(btnAdiantar) btnAdiantar.style.display = "none";

        const feedback = document.getElementById('feedback-pix');
        if (feedback) {
            feedback.innerHTML = '';
            const btnVoltar = document.createElement('button');
            btnVoltar.id = 'btn-voltar-cartao';
            btnVoltar.style.cssText = 'background-color: transparent; color: #aaa; border: 1px solid #555; padding: 10px; border-radius: 8px; width: 100%; margin-bottom: 15px; cursor: pointer; font-weight: bold;';
            btnVoltar.textContent = '⬅️ Escolher outra forma de pagamento';
            btnVoltar.addEventListener('click', window.voltarParaOpcoes);
            feedback.appendChild(btnVoltar);
        }

        const mesEl = document.getElementById('mes-atual');
        if (mesEl && !_mesOriginal) _mesOriginal = mesEl.textContent;
        if (mesEl) mesEl.textContent = (_mesOriginal || mesEl.textContent) + " (Pagamento Único)";

        const valorEl = document.getElementById('valor-pagamento');
        const valorNaTela = valorEl ? valorEl.textContent.replace('R$ ', '').replace(',00', '').replace(',', '.') : '25';

        const statusEl = document.getElementById('status-pagamento');
        if (statusEl) {
            statusEl.textContent = "💳 DÉBITO/CRÉDITO";
            statusEl.style.color = "#4CAF50";
        }

        const settings = {
            initialization: { amount: parseFloat(valorNaTela) || 25 },
            customization: {
                visual: { style: { theme: 'dark' }, texts: { formTitle: "Pagar com Cartão" } },
                paymentMethods: { maxInstallments: 1 }
            },
            callbacks: {
                onReady: () => { Swal.close(); },
                onSubmit: (dadosRecebidos) => {
                    return new Promise(async (resolve, reject) => {
                        const feedback = document.getElementById('feedback-pix');
                        if (feedback) {
                            feedback.innerHTML = '';
                            const msg = document.createElement('span');
                            msg.textContent = '⏳ Processando Pagamento...';
                            feedback.appendChild(msg);
                        }

                        try {
                            let form = dadosRecebidos.formData || dadosRecebidos;
                            let emailAluno = form.payer?.email || "aluno@4lacademy.com";
                            const { data: { session } } = await window.supabase.auth.getSession();
                            if (!session) throw new Error("Sessão expirada. Faça login novamente.");

                            const payload = {
                                email: emailAluno,
                                card_token: form.token,
                                payment_method_id: form.payment_method_id,
                                issuer_id: form.issuer_id,
                                payer: form.payer,
                                installments: form.installments,
                                aluno_id: session.user.id,
                                mensalidade_id: window.mensalidadeAtualId,
                                valor: parseFloat(valorNaTela),
                                mes: _mesOriginal || document.getElementById('mes-atual').textContent.replace(" (Pagamento Único)", "")
                            };

                            const { data, error } = await window.supabase.functions.invoke('gerar-pagamento-cartao', { body: payload });
                            if (error) throw error;

                            if (data.id && (data.status === "authorized" || data.status === "approved")) {
                                Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Pagamento aprovado! Oss!', background: '#161618', color: '#fff' }).then(() => location.reload());
                                resolve();
                            } else {
                                let motivoReal = data.status_detail ? data.status_detail : "Desconhecido";
                                let erroMsg = data.message || `Cartão recusado. Motivo: ${motivoReal}`;
                                console.log("RESPOSTA COMPLETA DO MERCADO PAGO:", data);
                                Swal.fire({ icon: 'error', title: 'Recusado', text: erroMsg, background: '#161618', color: '#fff' });
                                if (feedback) {
                                    feedback.innerHTML = '';
                                    const errSpan = document.createElement('span');
                                    errSpan.textContent = `❌ Erro: ${erroMsg}`;
                                    feedback.appendChild(errSpan);
                                }
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

const btnShowCard = document.getElementById('btn-show-card');
if (btnShowCard) btnShowCard.addEventListener('click', () => window.abrirMaquinaCartao());

const btnPagar = document.getElementById('btn-pagar');
if (btnPagar) {
    btnPagar.addEventListener('click', async () => {
        const feedback = document.getElementById('feedback-pix');
        const opcoes = document.getElementById('opcoes-pagamento');
        if (opcoes) opcoes.style.display = "none";
        if (feedback) {
            feedback.innerHTML = '';
            const msg = document.createElement('span');
            msg.textContent = "⏳ Conectando ao Cofre da Academia para gerar o PIX...";
            feedback.appendChild(msg);
        }

        const valorEl = document.getElementById('valor-pagamento');
        const valorCobrado = parseFloat(valorEl ? valorEl.textContent.replace('R$ ', '').replace(',', '.') : '0');
        const mesEl = document.getElementById('mes-atual');
        const mesCobrado = mesEl ? mesEl.textContent : '';

        try {
            const { data: dados, error } = await window.supabase.functions.invoke('gerar-pix', {
                body: {
                    valor: valorCobrado,
                    mes: mesCobrado,
                    mensalidade_id: window.mensalidadeAtualId
                }
            });

            if (error) throw error;

            if (dados.status === "pending") {
                const transacaoInfo = dados?.point_of_interaction?.transaction_data;
                if (!transacaoInfo || !transacaoInfo.qr_code_base64) {
                    throw new Error("O Mercado Pago demorou para gerar o QR Code. Por favor, tente novamente.");
                }

                const qrCodeBase64 = transacaoInfo.qr_code_base64;
                const copiaCola = transacaoInfo.qr_code;

                if (feedback) {
                    feedback.innerHTML = '';

                    const div = document.createElement('div');

                    const title = document.createElement('div');
                    title.innerHTML = '<b>Pix Oficial Gerado!</b>';
                    title.style.marginBottom = '10px';
                    div.appendChild(title);

                    const img = document.createElement('img');
                    img.src = `data:image/jpeg;base64,${qrCodeBase64}`;
                    img.style.cssText = 'border-radius: 10px; border: 5px solid white; margin-bottom: 10px; max-width: 100%;';
                    div.appendChild(img);

                    const lbl = document.createElement('p');
                    lbl.style.cssText = 'font-size: 13px; color: #aaaaaa; margin-bottom: 8px;';
                    lbl.textContent = 'Pix Copia e Cola:';
                    div.appendChild(lbl);

                    const code = document.createElement('code');
                    code.style.cssText = 'background:#000; padding:12px; display:block; color:#fff; font-size: 10px; word-break: break-all; border-radius: 8px; border: 1px solid #333; max-height: 60px; overflow-y: auto;';
                    code.textContent = copiaCola;
                    div.appendChild(code);

                    const btnCopiar = document.createElement('button');
                    btnCopiar.id = 'btn-copiar-pix';
                    btnCopiar.style.cssText = 'background-color: #333333; color: white; padding: 12px; border: none; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; font-size: 13px; text-transform: uppercase;';
                    btnCopiar.textContent = '📋 Copiar Código Pix';
                    btnCopiar.addEventListener('click', () => {
                        navigator.clipboard.writeText(copiaCola).then(() => {
                            Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Código Copiado!', showConfirmButton: false, timer: 2000, background: '#161618', color: '#fff' });
                            btnCopiar.textContent = "✅ CÓDIGO COPIADO!";
                            btnCopiar.style.backgroundColor = "#4CAF50";
                            setTimeout(() => { btnCopiar.textContent = "📋 Copiar Código Pix"; btnCopiar.style.backgroundColor = "#333333"; }, 3000);
                        });
                    });
                    div.appendChild(btnCopiar);

                    const btnCancelar = document.createElement('button');
                    btnCancelar.id = 'btn-cancelar-pix';
                    btnCancelar.style.cssText = 'background-color: transparent; color: #ff5252; border: 1px solid #ff5252; padding: 12px; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; font-size: 13px; text-transform: uppercase;';
                    btnCancelar.textContent = '⬅️ Cancelar Pix';
                    btnCancelar.addEventListener('click', window.voltarParaOpcoes);
                    div.appendChild(btnCancelar);

                    const aguardando = document.createElement('div');
                    aguardando.style.cssText = 'margin-top: 20px; padding: 15px; border-radius: 8px; background-color: rgba(33, 150, 243, 0.1); border: 1px solid #2196F3;';
                    const pAg = document.createElement('p');
                    pAg.style.cssText = 'color: #2196F3; font-size: 13px; margin: 0; font-weight: bold;';
                    pAg.textContent = '📡 Aguardando pagamento...';
                    aguardando.appendChild(pAg);
                    div.appendChild(aguardando);

                    feedback.appendChild(div);
                }

                // ✅ CORREÇÃO: Inicia o polling assim que o QR Code é exibido
                if (dados.id && window.mensalidadeAtualId) {
                    window.iniciarPollingPagamento(dados.id, window.mensalidadeAtualId);
                }

            } else {
                Swal.fire({ icon: 'error', title: 'Erro no PIX', text: dados.message || 'Falha na comunicação.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
                if (opcoes) opcoes.style.display = "flex";
            }
        } catch (erro) {
            Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: erro.message || 'Não foi possível gerar o PIX. Tente novamente.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            if (opcoes) opcoes.style.display = "flex";
            if (feedback) feedback.innerHTML = "";
            console.error(erro);
        }
    });
}

// ==========================================
// ✅ CORREÇÃO: Adiantar próximo boleto via Edge Function (V2)
// ==========================================
const btnAdiantarFatura = document.getElementById('btn-adiantar-fatura');
if (btnAdiantarFatura) {
    btnAdiantarFatura.addEventListener('click', async () => {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;

        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        // 🔧 CORREÇÃO 1: Usa 'created_at' (não 'criado_em'!)
        const { data: ultimaMens, error: errUltima } = await window.supabase
            .from('mensalidades')
            .select('mes, status')
            .eq('aluno_id', session.user.id)
            .order('created_at', { ascending: false })  // ← AQUI ESTAVA O ERRO
            .limit(1)
            .single();

        if (errUltima) {
            console.error('[Adiantar] Erro ao buscar última mensalidade:', errUltima);
        }

        let proximoMesIndex, ano;

        if (ultimaMens && ultimaMens.mes) {
            const [nomeMes, anoStr] = ultimaMens.mes.split('/');
            const ultimoIndex = meses.indexOf(nomeMes);
            ano = parseInt(anoStr);

            if (ultimoIndex !== -1) {
                proximoMesIndex = ultimoIndex + 1;
                if (proximoMesIndex > 11) {
                    proximoMesIndex = 0;
                    ano++;
                }
            } else {
                const dataAtual = new Date();
                proximoMesIndex = dataAtual.getMonth() + 1;
                ano = dataAtual.getFullYear();
                if (proximoMesIndex > 11) { proximoMesIndex = 0; ano++; }
            }
        } else {
            const dataAtual = new Date();
            proximoMesIndex = dataAtual.getMonth() + 1;
            ano = dataAtual.getFullYear();
            if (proximoMesIndex > 11) { proximoMesIndex = 0; ano++; }
        }

        const nomeProxMes = `${meses[proximoMesIndex]}/${ano}`;

        const { data: perfil } = await window.supabase.from('perfis').select('valor_mensalidade').eq('id', session.user.id).single();
        const valorFatura = perfil && perfil.valor_mensalidade ? perfil.valor_mensalidade : 25;

        const result = await Swal.fire({
            title: 'Adiantar Mensalidade?',
            html: `Deseja gerar a fatura de <b>${nomeProxMes}</b> no valor de <b>R$ ${valorFatura},00</b>?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#E53935',
            cancelButtonColor: '#333',
            confirmButtonText: 'Sim, Gerar',
            cancelButtonText: 'Cancelar',
            background: '#161618',
            color: '#fff'
        });

        if (result.isConfirmed) {
            Swal.fire({
                title: 'Gerando...',
                background: '#161618',
                color: '#fff',
                didOpen: () => { Swal.showLoading() }
            });

            try {
                // 🚀 Chama a Edge Function — a TRAVA REAL está lá no servidor!
                const { data, error } = await window.supabase.functions.invoke('criar-mensalidade-aluno', {
                    body: { aluno_id: session.user.id, mes: nomeProxMes, valor: valorFatura }
                });

                if (error) throw error;

                // 🔧 CORREÇÃO 2: Trata o erro 403 de limite de adiantamento
                if (data && data.error) {
                    throw new Error(data.error);
                }

                if (data && data.already_exists && data.status === 'pago') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Já está pago!',
                        text: `A mensalidade de ${nomeProxMes} já foi paga.`,
                        background: '#161618',
                        color: '#fff'
                    });
                    if (typeof window.verificarAcesso === 'function') window.verificarAcesso();
                    return;
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Fatura Gerada!',
                    text: 'Opções de pagamento liberadas.',
                    background: '#161618',
                    color: '#fff',
                    showConfirmButton: false,
                    timer: 1500
                });

                if (typeof window.verificarAcesso === 'function') window.verificarAcesso();

            } catch (err) {
                // 🔧 CORREÇÃO 3: Mostra a mensagem de erro da Edge Function (incluindo limite atingido)
                Swal.fire({
                    icon: 'warning',
                    title: 'Não foi possível gerar',
                    text: err.message,
                    background: '#161618',
                    color: '#fff',
                    confirmButtonColor: '#E53935'
                });
            }
        }
    });
}



window.carregarHistorico = async function() {
    const lista = document.getElementById('lista-historico');
    if(!lista) return;
    lista.innerHTML = '';
    const msgBusca = document.createElement('p');
    msgBusca.style.cssText = 'color: #aaaaaa; text-align: center; margin-top: 20px;';
    msgBusca.textContent = 'Buscando histórico...';
    lista.appendChild(msgBusca);

    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) return;

    const { data: historico, error } = await window.supabase
        .from('mensalidades')
        .select('*')
        .eq('aluno_id', session.user.id)
        .order('criado_em', { ascending: false });

    if (error || !historico || historico.length === 0) {
        lista.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'card-status';
        card.style.cssText = 'padding: 20px; text-align: center;';
        const p = document.createElement('p');
        p.style.cssText = 'color: #aaaaaa; margin: 0;';
        p.textContent = 'Você ainda não possui histórico de pagamentos.';
        card.appendChild(p);
        lista.appendChild(card);
        return;
    }

    lista.innerHTML = '';
    for (const mens of historico) {
        const isPago = mens.status.toLowerCase() === 'pago';
        const corBorda = isPago ? '#4CAF50' : '#ff5252';
        const textoStatus = isPago ? '✅ PAGO' : '🔴 EM ABERTO';

        const card = document.createElement('div');
        card.className = 'card-status';
        card.style.cssText = `padding: 15px; margin-bottom: 12px; border-left: 4px solid ${corBorda}; display: flex; justify-content: space-between; align-items: center;`;

        const info = document.createElement('div');

        const h4 = document.createElement('h4');
        h4.style.cssText = 'color: white; font-size: 15px; margin: 0 0 5px 0;';
        h4.textContent = mens.mes || '';
        info.appendChild(h4);

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display: flex; align-items: center; gap: 10px;';

        const pStatus = document.createElement('p');
        pStatus.style.cssText = `color: ${corBorda}; font-size: 11px; font-weight: bold; margin: 0;`;
        pStatus.textContent = textoStatus;
        wrap.appendChild(pStatus);

        if (isPago) {
            const btnRecibo = document.createElement('button');
            btnRecibo.style.cssText = 'background: rgba(76, 175, 80, 0.15); border: 1px solid #4CAF50; color: #4CAF50; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; width: auto; margin-top: 6px;';
            btnRecibo.textContent = '🧾 RECIBO';
            btnRecibo.onclick = () => window.abrirRecibo(mens.mes, mens.valor);
            wrap.appendChild(btnRecibo);
        }
        info.appendChild(wrap);
        card.appendChild(info);

        const spanValor = document.createElement('span');
        spanValor.style.cssText = 'color: white; font-size: 16px; font-weight: bold;';
        spanValor.textContent = `R$ ${mens.valor}`;
        card.appendChild(spanValor);

        lista.appendChild(card);
    }
};

window.abrirRecibo = async function(mesReferencia, valorPago) {
    Swal.fire({ title: 'Gerando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) { Swal.close(); return; }
    const { data: perfil } = await window.supabase.from('perfis').select('nome').eq('id', session.user.id).single();
    const nomeAluno = perfil ? perfil.nome : "Aluno";
    const dataEmissao = new Date().toLocaleDateString('pt-BR');

    const safeNome = escapeHtml(nomeAluno);
    const safeMes = escapeHtml(mesReferencia);

    const htmlRecibo = `
        <div id="recibo-print" class="recibo-print">
            <div class="recibo-header">
                <h2 style="margin: 0; font-size: 22px; font-style: italic; font-weight: 900;">4L ACADEMY</h2>
                <p style="margin: 5px 0 0; font-size: 12px; text-transform: uppercase;">Comprovante de Pagamento</p>
            </div>
            <p style="margin-bottom: 8px; font-size: 14px;"><strong>Aluno(a):</strong> ${safeNome}</p>
            <p style="margin-bottom: 8px; font-size: 14px;"><strong>Referência:</strong> ${safeMes}</p>
            <p style="margin-bottom: 8px; font-size: 14px;"><strong>Valor Pago:</strong> R$ ${valorPago}</p>
            <p style="margin-bottom: 8px; font-size: 14px;"><strong>Emissão:</strong> ${dataEmissao}</p>
            <div style="text-align: center; margin-top: 25px; border-top: 1px dashed black; padding-top: 15px;">
                <p style="font-size: 11px; margin: 0;">Este documento atesta o pagamento da mensalidade supracitada.</p>
                <p style="font-size: 12px; margin-top: 8px; font-weight: bold;">Oss! 🥋</p>
            </div>
        </div>
    `;

    Swal.close();
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
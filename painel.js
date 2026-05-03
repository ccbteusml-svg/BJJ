document.addEventListener('DOMContentLoaded', () => {

    // ⚠️ SUAS CREDENCIAIS DO MERCADO PAGO (Apenas a Pública, 100% seguro!)
    const MP_PUBLIC_KEY = "APP_USR-2dcd1a56-a86a-4967-b8ae-466813eabb1e"; 

    const mp = new window.MercadoPago(MP_PUBLIC_KEY);
    const bricksBuilder = mp.bricks();
    let mensalidadeAtualId = null;

    // ==========================================
    // 1.CONTROLE DO MENU LATERAL
    // ==========================================
    window.abrirMenu = () => { document.getElementById('menu-lateral').classList.add('aberto'); document.getElementById('menu-backdrop').style.display = 'block'; setTimeout(() => document.getElementById('menu-backdrop').style.opacity = '1', 10); };
    window.fecharMenu = () => { document.getElementById('menu-lateral').classList.remove('aberto'); document.getElementById('menu-backdrop').style.opacity = '0'; setTimeout(() => document.getElementById('menu-backdrop').style.display = 'none', 300); };
    
    window.trocarAbaAluno = (idAba, elemento) => { 
        document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none'); 
        document.getElementById(idAba).style.display = 'block'; 
        document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active')); 
        if (elemento) elemento.classList.add('active'); 
        fecharMenu(); 
        
        if(idAba === 'aba-avisos') carregarAvisos(); 
        if(idAba === 'aba-historico') carregarHistorico(); 
    };

    
async function verificarAcesso() {
        if (!window.supabase) {
            console.error("Supabase não carregou antes do painel.js.");
            return;
        }
        
        const { data: { session }, error } = await window.supabase.auth.getSession();
        if (error || !session) { window.location.href = "index.html"; return; }
        
        const usuarioId = session.user.id;
        
        // ========================================================
        // 📡 MANDA O ID DO ALUNO PARA A ANTENA DO ANDROID (ONESIGNAL)
        // ========================================================
        if (window.AndroidApp) {
            window.AndroidApp.registrarUsuarioApp(usuarioId);
        }
        // ========================================================
        
        const { data: perfil } = await window.supabase.from('perfis').select('nome, faixa, foto_url, assinante').eq('id', usuarioId).single(); 
 
        const saudacao = document.getElementById('saudacao-aluno');
        if (perfil) {
            saudacao.innerHTML = `Olá, ${perfil.nome}! 👋 <br><span style="font-size: 14px; color: var(--cor-destaque); font-weight: bold;">🥋 ${perfil.faixa || 'Branca'}</span>`;
            
            if (perfil.foto_url) {
                document.getElementById('foto-perfil-aluno').src = perfil.foto_url;
            }
        }
        
        // --- INTELIGÊNCIA DA NOVA HOME ---
        const bannerVip = document.getElementById('banner-vip');
        if (bannerVip) {
            if (perfil.assinante === true) {
                bannerVip.style.display = 'none'; // Some se já for VIP
            } else {
                bannerVip.style.display = 'block'; // Aparece se pagar manual
            }
        }

        const { data: ultimoPago } = await window.supabase.from('mensalidades')
            .select('*').eq('aluno_id', usuarioId).eq('status', 'pago')
            .order('id', { ascending: false }).limit(1);

        const cardReciboHome = document.getElementById('card-recibo-home');
        if (ultimoPago && ultimoPago.length > 0 && cardReciboHome) {
            cardReciboHome.style.display = "flex";
            document.getElementById('btn-baixar-ultimo-recibo').onclick = () => window.abrirRecibo(ultimoPago[0].mes, ultimoPago[0].valor);
        } else if (cardReciboHome) {
            cardReciboHome.style.display = "none";
        }
        // ---------------------------------

        const { data: mensalidades } = await window.supabase.from('mensalidades').select('*').eq('aluno_id', usuarioId).eq('status', 'pendente');
        
        if (mensalidades && mensalidades.length > 0) {
            const mens = mensalidades[0];
            mensalidadeAtualId = mens.id;

            if (mens.mp_payment_id) {
                const { data: foiPago } = await window.supabase.functions.invoke('verificar-pagamento', { body: { payment_id: mens.mp_payment_id } });
                if (foiPago && foiPago.status === "approved") {
                    await window.supabase.from('mensalidades').update({ status: 'pago' }).eq('id', mens.id);
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
    }


    // ==========================================
    // 3.MÁQUINA DE CARTÃO INTELIGENTE (ASSINATURA OU AVULSO)
    // ==========================================
    async function abrirMaquinaCartao(tipoPagamento) {
        try {
            Swal.fire({ title: 'Abrindo Máquina...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
            document.getElementById('opcoes-pagamento').style.display = "none";

            // 🛑 CORREÇÃO: Esconde o botão de Adiantar quando a máquina abre
            const btnAdiantar = document.getElementById('btn-adiantar-fatura');
            if(btnAdiantar) btnAdiantar.style.display = "none";

            let configTextos, configMetodos, nomeFuncaoSupabase;
            
            // Pega o valor atual que está na tela (removendo o R$)
            const valorNaTela = document.getElementById('valor-pagamento').innerText.replace('R$ ', '').replace(',00', '');

            if (tipoPagamento === 'assinatura') {
                // MODO VIP: Só Crédito
                document.getElementById('mes-atual').innerText = "Plano VIP (Recorrente)";
                document.getElementById('status-pagamento').innerText = "💳 ASSINATURA";
                document.getElementById('status-pagamento').style.color = "#2196F3";
                
                document.getElementById('valor-pagamento').innerText = "R$ 25,00 /mês";
                
                configTextos = { formTitle: "Cartão de Crédito (Assinatura)" };
                configMetodos = { maxInstallments: 1, types: { excluded: ['debit_card'] } }; // 🛑 Bloqueia débito
                nomeFuncaoSupabase = 'gerar-assinatura';
            } else {
                // MODO AVULSO: Crédito ou Débito (1x)
                document.getElementById('mes-atual').innerText += " (Pagamento Único)";
                document.getElementById('status-pagamento').innerText = "💳 DÉBITO/CRÉDITO";
                document.getElementById('status-pagamento').style.color = "#4CAF50";
                
                configTextos = { formTitle: "Pagar com Cartão" };
                configMetodos = { maxInstallments: 1 }; // ✅ Débito totalmente liberado
                nomeFuncaoSupabase = 'gerar-pagamento-cartao';
            }

            const settings = {
                initialization: { amount: parseFloat(valorNaTela) || 25 },
                customization: { 
                    visual: { style: { theme: 'dark' }, texts: configTextos }, 
                    paymentMethods: configMetodos 
                },
                callbacks: {
                    onReady: () => { Swal.close(); },
                    onSubmit: (dadosRecebidos) => {
                        return new Promise(async (resolve, reject) => {
                            const feedback = document.getElementById('feedback-pix');
                            feedback.innerHTML = `⏳ Processando ${tipoPagamento === 'assinatura' ? 'Assinatura' : 'Pagamento'}...`;

                            try {
                                let form = dadosRecebidos.formData || dadosRecebidos;
                                let emailAluno = form.payer?.email || "aluno@4lacademy.com";
                                
                                // Monta o pacote de dados para enviar ao Supabase
                                const payload = {
                                    email: emailAluno,
                                    card_token: form.token,
                                    payment_method_id: form.payment_method_id,
                                    issuer_id: form.issuer_id,
                                    payer: form.payer,
                                    installments: form.installments
                                };

                                if (tipoPagamento === 'assinatura') {
                                    payload.plan_id = "867728a336404feca158d63874ccea3b";
                                } else {
                                    payload.valor = parseFloat(valorNaTela);
                                    payload.mes = document.getElementById('mes-atual').innerText.replace(" (Pagamento Único)", "");
                                }

                                // Chama a função certa lá no Supabase!
                                const { data, error } = await window.supabase.functions.invoke(nomeFuncaoSupabase, { body: payload });

                                if (error) throw error;

                                if (data.id && (data.status === "authorized" || data.status === "approved")) {
                                    const { data: { session } } = await window.supabase.auth.getSession();
                                    await window.supabase.from('mensalidades').update({ status: 'pago' }).eq('id', mensalidadeAtualId);
                                    
                                    if (tipoPagamento === 'assinatura' && session) {
                                        await window.supabase.from('perfis').update({ assinante: true }).eq('id', session.user.id);
                                    }

                                    Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Pagamento aprovado! Oss!', background: '#161618', color: '#fff' }).then(() => location.reload());
                                    resolve();
                                } else {
                                    let erroMsg = data.message || "Cartão recusado pelo banco.";
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
    }


    // ==========================================
    // 4.LIGANDO OS BOTÕES NA MÁQUINA
    // ==========================================
    // 1. Botão da Fatura (Pagamento Único - Aceita Débito)
    document.getElementById('btn-show-card').addEventListener('click', () => abrirMaquinaCartao('avulso'));

    // 2. Botão do Banner VIP (Assinatura - Só Crédito)
    const btnAssinarVip = document.getElementById('btn-assinar-vip');
    if (btnAssinarVip) {
        btnAssinarVip.addEventListener('click', () => {
            window.trocarAbaAluno('aba-mensalidade', document.querySelector('.menu-item:first-child'));
            abrirMaquinaCartao('assinatura');
        });
    }


    // ==========================================
    // 5.PAGAMENTO COM PIX (CORREÇÃO DE BAIXA AUTOMÁTICA E PROTEÇÃO DE API)
    // ==========================================
    document.getElementById('btn-pagar').addEventListener('click', async () => {
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
                const mp_id_texto = String(dados.id); // Força texto
                
                // Salva na tabela e confirma antes de continuar
                const { error: erroAoSalvar } = await window.supabase
                    .from('mensalidades')
                    .update({ mp_payment_id: mp_id_texto })
                    .eq('id', mensalidadeAtualId);
                
                if (erroAoSalvar) throw erroAoSalvar;
                
                // 🛡️ ESCUDO ANTI-FALHA AQUI: Verifica se os dados realmente vieram antes de ler
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
                    
                    <button id="btn-copiar-pix" style="background-color: #333333; color: white; padding: 12px; border: none; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; font-size: 13px; text-transform: uppercase;">
                        📋 Copiar Código Pix
                    </button>
                    <div style="margin-top: 20px; padding: 15px; border-radius: 8px; background-color: rgba(33, 150, 243, 0.1); border: 1px solid #2196F3;">
                        <p style="color: #2196F3; font-size: 13px; margin: 0; font-weight: bold;">📡 Aguardando pagamento...</p>
                    </div>
                `;
                
                document.getElementById('btn-copiar-pix').addEventListener('click', () => {
                    navigator.clipboard.writeText(copiaCola).then(() => {
                        Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Código Copiado!', showConfirmButton: false, timer: 2000, background: '#161618', color: '#fff' });
                        
                        const btnCopiar = document.getElementById('btn-copiar-pix');
                        btnCopiar.innerText = "✅ CÓDIGO COPIADO!";
                        btnCopiar.style.backgroundColor = "#4CAF50";
                        setTimeout(() => { btnCopiar.innerText = "📋 Copiar Código Pix";
                            btnCopiar.style.backgroundColor = "#333333"; }, 3000);
                    });
                });
            } else {
                Swal.fire({ icon: 'error', title: 'Erro no PIX', text: dados.message || 'Falha na comunicação.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
                document.getElementById('opcoes-pagamento').style.display = "flex";
            }
            
        } catch (erro) {
            Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: erro.message || 'Não foi possível gerar o PIX. Tente novamente.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            document.getElementById('opcoes-pagamento').style.display = "flex";
            feedback.innerHTML = ""; // Limpa a mensagem de "carregando"
            console.error(erro);
        }
    });

    // ==========================================
    // 6.CARREGAR AVISOS
    // ==========================================
    async function carregarAvisos() {
        const lista = document.getElementById('lista-avisos');
        lista.innerHTML = `<p style="color: #aaaaaa; text-align: center; margin-top: 20px;">Buscando...</p>`;

        const { data: avisos, error } = await window.supabase.from('avisos').select('*');

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
    // 7.SAIR DA CONTA
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
            await window.supabase.auth.signOut();
            window.location.href = "index.html";
        }
    });

    verificarAcesso();

    // ==========================================
    // 8.MÁGICA: ATUALIZAÇÃO EM TEMPO REAL 📡
    // ==========================================
    async function ligarRadarEmTempoReal() {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return; 
        const usuarioId = session.user.id;

        window.supabase.channel('mensalidades-espiao')
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
    // 📸9. GESTÃO DA FOTO DE PERFIL (OTIMIZADA)
    // ==========================================
    document.getElementById('input-foto').addEventListener('change', async (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;

        Swal.fire({ title: 'Enviando foto...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) throw new Error("Sessão expirada. Faça login novamente.");
            
            const usuarioId = session.user.id;
            
            // Pega a extensão da imagem (jpg, png, etc)
            const fileExt = arquivo.name.split('.').pop();
            
            // 🐛 CORREÇÃO: Nome fixo! O upsert: true agora vai sempre amassar a foto velha e colocar a nova por cima.
            const fileName = `${usuarioId}/perfil.${fileExt}`;

            const { error: uploadError } = await window.supabase.storage
                .from('fotos_perfil')
                .upload(fileName, arquivo, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabase.storage
                .from('fotos_perfil')
                .getPublicUrl(fileName);

            // 🧠 TRUQUE NINJA (Cache Busting): Colocamos um carimbo de tempo no final do link.
            // Isso não cria arquivo novo no Supabase, mas obriga o celular do aluno a baixar a foto atualizada!
            const linkDaFoto = `${publicUrlData.publicUrl}?t=${Date.now()}`;

            const { error: updateError } = await window.supabase
                .from('perfis')
                .update({ foto_url: linkDaFoto })
                .eq('id', usuarioId);

            if (updateError) throw updateError;

            // Atualiza a imagem na tela na mesma hora
            document.getElementById('foto-perfil-aluno').src = linkDaFoto;
            Swal.fire({ icon: 'success', title: 'Foto Atualizada!', background: '#161618', color: '#fff', timer: 2000, showConfirmButton: false });

        } catch (err) {
            console.error("Erro no upload:", err);
            Swal.fire({ icon: 'error', title: 'Falha no Upload', text: err.message, background: '#161618', color: '#fff' });
        }
    });

        // ==========================================
    // 10.CARREGAR HISTÓRICO FINANCEIRO
    // ==========================================
    async function carregarHistorico() {
        const lista = document.getElementById('lista-historico');
        lista.innerHTML = `<p style="color: #aaaaaa; text-align: center; margin-top: 20px;">Buscando histórico...</p>`;

        // Pega quem é o aluno logado
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;

        // Busca todas as mensalidades desse aluno no banco, da mais nova para a mais velha
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
        
        // Monta os cartões na tela
        for (const mens of historico) {
            const isPago = mens.status.toLowerCase() === 'pago';
            const corBorda = isPago ? '#4CAF50' : '#ff5252';
            const textoStatus = isPago ? '✅ PAGO' : '🔴 EM ABERTO';
            
            // NOVO: Só cria o botão se a fatura estiver paga
            const btnRecibo = isPago 
                ? `<button onclick="abrirRecibo('${mens.mes}', '${mens.valor}')" style="background: rgba(76, 175, 80, 0.15); border: 1px solid #4CAF50; color: #4CAF50; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; width: auto; margin-top: 6px;">🧾 RECIBO</button>` 
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
    }
    // ==========================================
    // 11. GERADOR DE RECIBO DIGITAL EM PDF
    // ==========================================
    window.abrirRecibo = async function(mesReferencia, valorPago) {
        Swal.fire({ title: 'Gerando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

        // 1. Pega o nome correto do aluno no banco de dados para ficar oficial
        const { data: { session } } = await window.supabase.auth.getSession();
        const { data: perfil } = await window.supabase.from('perfis').select('nome').eq('id', session.user.id).single();
        const nomeAluno = perfil ? perfil.nome : "Aluno";
        const dataEmissao = new Date().toLocaleDateString('pt-BR');

        // 2. O Desenho do Recibo (Branco com letras pretas para impressão)
        const htmlRecibo = `
            <div id="recibo-print" style="text-align: left; background: white; color: black; padding: 20px; border-radius: 8px; font-family: monospace; border: 1px solid #ccc; margin-top: 10px;">
                <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 15px; margin-bottom: 15px;">
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

        // 3. Abre a janela bonita na tela do aluno
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
            customClass: { popup: 'swal-recibo' } // Classe para não bugar no celular
        }).then((result) => {
            // Se ele clicar em Salvar PDF, chama a impressora nativa do celular!
            if (result.isConfirmed) {
                window.print();
            }
        });
    };
    // ==========================================
    // 12. ADIANTAR PRÓXIMA FATURA (SELF-SERVICE)
    // ==========================================
    const btnAdiantarFatura = document.getElementById('btn-adiantar-fatura');
    if (btnAdiantarFatura) {
        btnAdiantarFatura.addEventListener('click', async () => {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) return;

            // 1. O sistema calcula automaticamente o próximo mês e ano
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const dataAtual = new Date();
            let proximoMesIndex = dataAtual.getMonth() + 1;
            let ano = dataAtual.getFullYear();
            
            if (proximoMesIndex > 11) { proximoMesIndex = 0; ano++; }
            
            // Gera EXATAMENTE no padrão do admin (ex: "Maio/2026")
            const nomeProxMes = `${meses[proximoMesIndex]}/${ano}`;

            // 2. Busca o valor do aluno (se ele tiver desconto/bolsa) ou usa o padrão 25
            const { data: perfil } = await window.supabase.from('perfis').select('valor_mensalidade').eq('id', session.user.id).single();
            const valorFatura = perfil.valor_mensalidade ? perfil.valor_mensalidade : 25; 

            // 3. Pede a confirmação do aluno
            const result = await Swal.fire({
                title: 'Adiantar Mensalidade?',
                html: `Deseja gerar a fatura de <b>${nomeProxMes}</b> no valor de <b>R$ ${valorFatura},00</b> agora?<br><br><span style="font-size: 12px; color: #aaa;">O pagamento será liberado imediatamente.</span>`,
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
                Swal.fire({ title: 'Gerando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
                
                try {
                    // Previne que ele crie a mesma fatura duas vezes se clicar muito rápido
                    const { data: existente } = await window.supabase.from('mensalidades')
                        .select('id').eq('aluno_id', session.user.id).eq('mes', nomeProxMes);
                        
                    if (existente && existente.length > 0) {
                        Swal.fire({ icon: 'info', title: 'Aviso', text: 'Você já possui uma fatura gerada para o próximo mês.', background: '#161618', color: '#fff' });
                        return;
                    }

                    // Insere a nova fatura no banco de dados da academia
                    const { error } = await window.supabase.from('mensalidades').insert([{
                        aluno_id: session.user.id,
                        mes: nomeProxMes,
                        valor: valorFatura,
                        status: 'pendente'
                    }]);

                    if (error) throw error;
                    
                    Swal.fire({ icon: 'success', title: 'Fatura Gerada!', text: 'Opções de pagamento liberadas.', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
                    
                    // Recarrega o painel
                    verificarAcesso(); 
                    
                } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
                }
            }
        });
    }

    // ==========================================
    // 13. GERADOR DA CARTEIRINHA DIGITAL (POP-UP)
    // ==========================================
    window.abrirCarteirinha = async function() {
        Swal.fire({ title: 'Gerando Carteirinha...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
        
        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) return;
            
            const usuarioId = session.user.id;
            const { data: perfil } = await window.supabase.from('perfis').select('*').eq('id', usuarioId).single();
            
            // Variáveis Básicas
            const foto = perfil.foto_url || `https://ui-avatars.com/api/?name=${perfil.nome}&background=161618&color=fff`;
            const nome = perfil.nome;
            const anoAtual = new Date().getFullYear();
            const idCurto = `4LA-ALU-${usuarioId.substring(0, 6).toUpperCase()}`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${usuarioId}`;
            
            let corStatus = "#4CAF50";
            let textoStatus = "✅ MEMBRO ATIVO";
            if (perfil.plano_pausado) { corStatus = "#ff5252"; textoStatus = "🔴 INATIVO"; }
            else if (perfil.assinante) { textoStatus = "✅ VIP (ATIVO)"; }

            // --------------------------------------------------
            // 🧠 INTELIGÊNCIA DE TODAS AS FAIXAS (KIDS ATÉ MESTRE)
            // --------------------------------------------------
            let textoFaixaDB = (perfil.faixa || 'Branca').toLowerCase();
            let nomeLimpoFaixa = 'BRANCA';
            let fundoFaixaVisual = '#f4f4f4'; // Quase branca para não estourar na tela
            let corPontaFaixa = '#111111'; // Ponta Preta padrão
            
            // Verificação de Cores Completa (Infantil ao Mestre)
            if (textoFaixaDB.includes('cinza')) { 
                nomeLimpoFaixa = 'CINZA'; fundoFaixaVisual = '#9E9E9E'; 
            } else if (textoFaixaDB.includes('amarela')) { 
                nomeLimpoFaixa = 'AMARELA'; fundoFaixaVisual = '#FBC02D'; 
            } else if (textoFaixaDB.includes('laranja')) { 
                nomeLimpoFaixa = 'LARANJA'; fundoFaixaVisual = '#FF9800'; 
            } else if (textoFaixaDB.includes('verde')) { 
                nomeLimpoFaixa = 'VERDE'; fundoFaixaVisual = '#4CAF50'; 
            } else if (textoFaixaDB.includes('azul')) { 
                nomeLimpoFaixa = 'AZUL'; fundoFaixaVisual = '#1976D2'; 
            } else if (textoFaixaDB.includes('roxa')) { 
                nomeLimpoFaixa = 'ROXA'; fundoFaixaVisual = '#6a1b9a'; 
            } else if (textoFaixaDB.includes('marrom')) { 
                nomeLimpoFaixa = 'MARROM'; fundoFaixaVisual = '#5D4037'; 
            } else if (textoFaixaDB.includes('preta')) { 
                nomeLimpoFaixa = 'PRETA'; fundoFaixaVisual = '#212121'; corPontaFaixa = '#D32F2F'; // Faixa preta = ponta vermelha
            } else if (textoFaixaDB.includes('coral')) { 
                nomeLimpoFaixa = 'CORAL'; 
                // Gradiente CSS para simular a faixa vermelho e preta
                fundoFaixaVisual = 'repeating-linear-gradient(to right, #D32F2F 0, #D32F2F 15px, #111111 15px, #111111 30px)'; 
            } else if (textoFaixaDB.includes('vermelha')) { 
                nomeLimpoFaixa = 'VERMELHA'; fundoFaixaVisual = '#D32F2F'; 
            }

            // Extrai a quantidade exata de graus
            let qtdGraus = 0;
            let matchGrau = textoFaixaDB.match(/(\d+)/); // Permite graus acima de 9
            if (matchGrau) {
                qtdGraus = parseInt(matchGrau[1]);
            }
            
            // Trava de segurança: Máximo de 6 tiras desenhadas para não bugar o visual no celular
            let grausVisuais = qtdGraus > 6 ? 6 : qtdGraus; 

            // Desenha os graus (tirinhas brancas retas)
            let htmlGraus = '';
            for(let i=0; i<grausVisuais; i++) {
                htmlGraus += `<div style="width: 4px; height: 100%; background-color: #fff; border-radius: 1px;"></div>`;
            }

            const textoFinalFaixa = `FAIXA ${nomeLimpoFaixa}` + (qtdGraus > 0 ? ` - ${qtdGraus}º GRAU` : '');
            // --------------------------------------------------

            const htmlCarteirinha = `
                <div style="background: linear-gradient(135deg, #111 0%, #000 100%); border: 2px solid #E53935; border-radius: 16px; padding: 25px 20px; text-align: center; position: relative; overflow: hidden; box-shadow: 0 0 30px rgba(229, 57, 53, 0.4);">
                    
                    <div style="margin-bottom: 20px; position: relative; z-index: 2;">
                        <h2 style="font-style: italic; font-size: 22px; margin: 0; color: white; font-weight: 900;">4L <span style="color: #E53935;">ACADEMY</span></h2>
                        <p style="font-size: 10px; color: #aaa; letter-spacing: 1px; margin-top: 2px;">CARTEIRINHA DIGITAL DO ATLETA</p>
                    </div>

                    <div style="position: relative; z-index: 2; width: 110px; height: 110px; margin: 0 auto 15px; border-radius: 50%; border: 3px solid #E53935; padding: 4px; background: #000;">
                        <img src="${foto}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                    </div>

                    <div style="position: relative; z-index: 2; margin-bottom: 10px;">
                        <p style="font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 2px;">NOME:</p>
                        <h3 style="font-size: 18px; color: white; font-weight: 800; text-transform: uppercase; margin: 0 0 10px 0;">${nome}</h3>
                        
                        <p style="font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 2px;">CLASSIFICAÇÃO:</p>
                        <h3 style="font-size: 14px; color: white; font-weight: bold; margin: 0 0 15px 0;">ATLETA OFICIAL</h3>
                        
                        <div style="margin-top: 15px; display: flex; flex-direction: column; align-items: center;">
                            
                            <div style="position: relative; width: 90%; height: 35px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                                
                                <div style="position: absolute; left: calc(50% - 15px); top: 18px; width: 16px; height: 28px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-radius: 0 0 3px 3px; z-index: 1; transform: rotate(25deg); transform-origin: top center; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2);"></div>
                                
                                <div style="position: absolute; right: calc(50% - 15px); top: 18px; width: 16px; height: 34px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-radius: 0 0 3px 3px; z-index: 1; transform: rotate(-20deg); transform-origin: top center; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2);"></div>

                                <div style="flex: 1; height: 20px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-right: none; border-radius: 4px 0 0 4px; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2); z-index: 2;"></div>
                                
                                <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 36px; height: 26px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-radius: 4px; z-index: 3; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2), 0 3px 5px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; overflow: hidden;">
                                    <div style="width: 14px; height: 150%; background: ${fundoFaixaVisual}; border-left: 2px solid rgba(0,0,0,0.8); border-right: 2px solid rgba(0,0,0,0.8); transform: rotate(15deg); box-shadow: inset 0 -2px 3px rgba(0,0,0,0.1);"></div>
                                </div>

                                <div style="flex: 1; height: 20px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-left: none; border-radius: 0 4px 4px 0; display: flex; justify-content: flex-end; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2); overflow: hidden; z-index: 2;">
                                    <div style="width: 55px; height: 100%; background-color: ${corPontaFaixa}; display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; gap: 3px; border-left: 2px solid rgba(0,0,0,0.8);">
                                        ${htmlGraus}
                                    </div>
                                </div>

                            </div>
                            
                            <p style="color: #ccc; font-size: 11px; margin-top: 8px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">${textoFinalFaixa}</p>
                        </div>
                    </div>

                    <div style="position: relative; z-index: 2; background: white; padding: 10px; border-radius: 8px; width: 140px; margin: 0 auto 20px;">
                        <img src="${qrCodeUrl}" style="width: 100%; height: auto; display: block;">
                        <p style="color: #000; font-size: 9px; font-weight: bold; margin: 5px 0 0 0;">QR ÚNICO PARA CHECK-IN</p>
                    </div>

                    <div style="position: relative; z-index: 2; text-align: left; font-size: 11px; color: #aaa; line-height: 1.6; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <p style="margin:0;">STATUS: <span style="color: ${corStatus}; font-weight: bold;">${textoStatus}</span></p>
                        <p style="margin:0;">VÁLIDA ATÉ: <span style="color: white; font-weight: bold;">31/12/${anoAtual}</span></p>
                        <p style="margin:0;">ID ÚNICO: <span style="color: white; font-weight: bold;">${idCurto}</span></p>
                    </div>
                </div>
            `;

            Swal.fire({
                html: htmlCarteirinha,
                background: 'transparent',
                showConfirmButton: false,
                showCloseButton: true,
                padding: '0',
                width: '320px'
            });
            
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível gerar a carteirinha.', background: '#161618', color: '#fff' });
        }
    }

}); // <-- ESTA É A ÚLTIMA LINHA DO SEU ARQUIVO PAINEL.JS

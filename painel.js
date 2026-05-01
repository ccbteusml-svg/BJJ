document.addEventListener('DOMContentLoaded', () => {

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
    
    window.trocarAbaAluno = (idAba, elemento) => { 
        document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none'); 
        document.getElementById(idAba).style.display = 'block'; 
        document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active')); 
        if (elemento) elemento.classList.add('active'); 
        fecharMenu(); 
        
        if(idAba === 'aba-avisos') carregarAvisos(); 
        if(idAba === 'aba-historico') carregarHistorico(); 
    };

    
    // ==========================================
    // LÓGICA DE ACESSO E EXIBIÇÃO DE DADOS
    // ==========================================
    async function verificarAcesso() {
        if (!window.supabase) {
            console.error("Supabase não carregou antes do painel.js.");
            return;
        }

        const { data: { session }, error } = await window.supabase.auth.getSession();
        if (error || !session) { window.location.href = "index.html"; return; } 

        const usuarioId = session.user.id;
        
        const { data: perfil } = await window.supabase.from('perfis').select('nome, faixa, foto_url, assinante').eq('id', usuarioId).single(); 
 
            
        const saudacao = document.getElementById('saudacao-aluno');
        if (perfil) {
            saudacao.innerHTML = `Olá, ${perfil.nome}! 👋 <br><span style="font-size: 14px; color: var(--cor-destaque); font-weight: bold;">🥋 ${perfil.faixa || 'Branca'}</span>`;
            
            if (perfil.foto_url) {
                document.getElementById('foto-perfil-aluno').src = perfil.foto_url;
            }
        }
        
                    // INTELIGÊNCIA DO BANNER VIP FIXO
            const bannerVip = document.getElementById('banner-vip');
            if (bannerVip) {
                if (perfil.assinante === true) {
                    bannerVip.style.display = 'none'; // Some se já for VIP
                } else {
                    bannerVip.style.display = 'block'; // Aparece se pagar manual
                }
            }

        
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
    // MÁQUINA DE CARTÃO INTELIGENTE (ASSINATURA OU AVULSO)
    // ==========================================
    async function abrirMaquinaCartao(tipoPagamento) {
        try {
            Swal.fire({ title: 'Abrindo Máquina...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
            document.getElementById('opcoes-pagamento').style.display = "none";

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
            
            // Rola a tela suavemente para baixo para o aluno ver os campos do cartão
            setTimeout(() => {
                const formCartao = document.getElementById('cardPaymentBrick_container');
                if (formCartao) formCartao.scrollIntoView({ behavior: 'smooth' });
            }, 500);

        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
        }
    }

    // ==========================================
    // LIGANDO OS BOTÕES NA MÁQUINA
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
    // PAGAMENTO COM PIX (CORREÇÃO DE BAIXA AUTOMÁTICA E PROTEÇÃO DE API)
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
    // CARREGAR AVISOS
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
            await window.supabase.auth.signOut();
            window.location.href = "index.html";
        }
    });

    verificarAcesso();

    // ==========================================
    // MÁGICA: ATUALIZAÇÃO EM TEMPO REAL 📡
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
    // 📸 GESTÃO DA FOTO DE PERFIL (OTIMIZADA)
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
    // CARREGAR HISTÓRICO FINANCEIRO
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
            
            lista.innerHTML += `
                <div class="card-status" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid ${corBorda}; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="color: white; font-size: 15px; margin: 0 0 5px 0;">${mens.mes}</h4>
                        <p style="color: ${corBorda}; font-size: 11px; font-weight: bold; margin: 0;">${textoStatus}</p>
                    </div>
                    <span style="color: white; font-size: 16px; font-weight: bold;">R$ ${mens.valor}</span>
                </div>`;
        }
    }

});

// ==========================================
// 0. INTELIGÊNCIA DE CORES DAS FAIXAS (SISTEMA COMPLETO)
// ==========================================
window.obterCorDaFaixa = function(nomeFaixa) {
    let texto = (nomeFaixa || 'Branca').toLowerCase();
    if (texto.includes('branca')) return '#f5f5f5'; // Branco/Prata para destacar no fundo escuro
    if (texto.includes('cinza')) return '#9e9e9e';
    if (texto.includes('amarela')) return '#ffeb3b';
    if (texto.includes('laranja')) return '#ff9800';
    if (texto.includes('verde')) return '#4caf50';
    if (texto.includes('azul')) return '#2196f3';
    if (texto.includes('roxa')) return '#9c27b0';
    if (texto.includes('marrom')) return '#795548';
    if (texto.includes('preta')) return '#424242'; // Cinza escuro para contraste
    if (texto.includes('coral')) return '#ef5350'; 
    if (texto.includes('vermelha')) return '#f44336';
    return '#E53935'; // Cor padrão (Erro/Sem Faixa)
};

// ==========================================
// 1. WIDGET DE ANIVERSARIANTES
// ==========================================
window.carregarAniversariantes = async function() {
    const widget = document.getElementById('widget-aniversarios');
    if(!widget) return;
    
    widget.innerHTML = `<div class="skeleton" style="width: 100%; height: 80px; margin-bottom: 20px; border-radius: 10px;"></div>`;

    const { data: alunos } = await supabase.from('perfis').select('nome, data_nascimento, foto_url, telefone').neq('cargo', 'professor').not('data_nascimento', 'is', null);
    const mesAtual = new Date().getMonth() + 1;
    
    const aniversariantes = (alunos || []).filter(aluno => {
        if(!aluno.data_nascimento) return false;
        return parseInt(aluno.data_nascimento.split('-')[1]) === mesAtual;
    });

    if(aniversariantes.length === 0) {
        widget.innerHTML = `<div class="card-status" style="padding: 15px; margin-bottom: 20px; background: #1a1a1c; border-left: 4px solid #333; display: flex; align-items: center; gap: 10px;"><span style="font-size: 24px;">📆</span><div><p style="color: white; margin: 0; font-weight: bold; font-size: 13px;">Sem aniversários este mês.</p><p style="color: #888; font-size: 11px; margin: 0;">Foco no treino!</p></div></div>`;
        return;
    }

    let htmlLista = '';
    aniversariantes.forEach(aluno => {
        const dia = aluno.data_nascimento.split('-')[2];
        const num = aluno.telefone ? aluno.telefone.replace(/\D/g, '') : '';
        const linkMsg = num ? `https://wa.me/55${num}?text=${encodeURIComponent(`Parabéns, ${aluno.nome}! 🎉 Desejo-te muitas felicidades e saúde! Oss! 🥋`)}` : '#';
        const foto = aluno.foto_url || `https://ui-avatars.com/api/?name=${aluno.nome.replace(/\s/g, '+')}&background=161618&color=fff`;
        htmlLista += `<div style="display: flex; align-items: center; gap: 10px; margin-top: 10px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; border: 1px solid #333;"><img src="${foto}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;"><div style="flex: 1;"><p style="color: white; font-weight: bold; font-size: 13px; margin: 0;">${aluno.nome}</p><p style="color: #aaa; font-size: 11px; margin: 0;">Faz anos dia ${dia}</p></div><a href="${linkMsg}" target="_blank" style="background: rgba(37, 211, 102, 0.1); color: #25D366; border: 1px solid #25D366; padding: 6px 10px; border-radius: 6px; font-weight: bold; font-size: 10px; text-decoration: none;">🎂 PARABÉNS</a></div>`;
    });
    widget.innerHTML = `<div class="card-status" style="padding: 15px; margin-bottom: 20px; background: linear-gradient(135deg, #1a1a1c, #2a1a1c); border-left: 4px solid #E53935;"><h4 style="color: #E53935; margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; font-weight: 900;">🎉 Aniversariantes do Mês</h4>${htmlLista}</div>`;
};

// ==========================================
// 2. CADASTRAR NOVO ALUNO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const formNovoAluno = document.getElementById('form-novo-aluno');
    if (formNovoAluno) {
        formNovoAluno.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            
            const dados = {
                nome: document.getElementById('novo-nome').value,
                email: document.getElementById('novo-email').value,
                senha: document.getElementById('novo-senha').value,
                telefone: document.getElementById('novo-telefone').value.replace(/\D/g,''),
                faixa: document.getElementById('novo-faixa').value,
                data_nascimento: document.getElementById('novo-nascimento').value
            };

            btn.innerText = "Cadastrando... 🥋";
            btn.disabled = true;
            
            try {
                const { data, error } = await supabase.functions.invoke('criar-aluno-admin', { body: dados });
                if (error || (data && data.error)) throw new Error(error?.message || data?.error);

                Swal.fire({ icon: 'success', title: 'Aluno Criado!', text: 'O acesso foi gerado.', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
                e.target.reset();
                if(typeof carregarTodosAlunos === 'function') carregarTodosAlunos(); 

            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Falha no Cadastro', text: err.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            } finally {
                btn.innerText = "SALVAR";
                btn.disabled = false;
            }
        });
    }
});

// ==========================================
// 3. CARREGAR LISTA DE ALUNOS COM TAGS E ESTATÍSTICAS
// ==========================================
window.carregarTodosAlunos = async function() {
    const lista = document.getElementById('lista-todos-alunos');
    const resumoFaixas = document.getElementById('resumo-faixas');
    
    if(!lista) return;
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center;">Buscando alunos...</p>`;
    if (resumoFaixas) resumoFaixas.innerHTML = "";

    const { data: alunos, error } = await supabase.from('perfis').select('*').neq('cargo', 'professor').order('nome', { ascending: true });

    if (error || !alunos || alunos.length === 0) {
        lista.innerHTML = `<p style="color: #aaaaaa; text-align: center;">Nenhum aluno encontrado.</p>`;
        return;
    }

    const alunosAtivos = alunos.filter(a => a.plano_pausado !== true);
    const contagem = {};

    alunosAtivos.forEach(aluno => {
        let faixaCompleta = aluno.faixa || 'Branca';
        let corDaFaixa = faixaCompleta.split('/')[0].split('-')[0].trim().replace(/faixa/i, '').trim();
        corDaFaixa = corDaFaixa.charAt(0).toUpperCase() + corDaFaixa.slice(1).toLowerCase();
        if(!corDaFaixa) corDaFaixa = 'Branca';
        contagem[corDaFaixa] = (contagem[corDaFaixa] || 0) + 1;
    });

    if (resumoFaixas) {
        let htmlEstatisticas = `<div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 15px; margin-bottom: 10px; flex-wrap: nowrap; -webkit-overflow-scrolling: touch;"><div style="background: #E53935; color: white; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; white-space: nowrap;">Total Ativos: ${alunosAtivos.length}</div>`;
        for (const [nomeFaixa, qtd] of Object.entries(contagem)) {
            htmlEstatisticas += `<div style="background: #161618; border: 1px solid #333; color: #ccc; padding: 6px 12px; border-radius: 20px; font-size: 11px; white-space: nowrap;">${nomeFaixa}: <b>${qtd}</b></div>`;
        }
        resumoFaixas.innerHTML = htmlEstatisticas + `</div>`;
    }

    lista.innerHTML = ""; 

    alunos.forEach(aluno => {
        const tagAssinante = aluno.assinante ? `<span style="background-color: #2196F3; color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">VIP</span>` : '';
        const tagCongelado = aluno.plano_pausado ? `<span style="background-color: #9e9e9e; color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">🔴 INATIVO</span>` : '';
        
        // Aplica a cor da faixa na barra lateral do cartão!
        const corBordaCartao = window.obterCorDaFaixa(aluno.faixa);

        lista.innerHTML += `
            <div class="card-status" onclick="abrirDossie('${aluno.id}', event)" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid ${corBordaCartao}; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <p style="color: white; font-weight: bold; margin: 0; font-size: 15px;">${aluno.nome} ${tagAssinante} ${tagCongelado}</p>
                    <p style="color: #9e9e9e; font-size: 12px; margin: 3px 0 0 0;">🥋 ${aluno.faixa || 'Branca'}</p>
                </div>
                <span style="color: #444; font-size: 18px;">›</span>
            </div>`;
    });
    
    if(typeof filtrarAlunos === 'function') filtrarAlunos(); 
};

// ==========================================
// 4. FILTRAR ALUNOS 
// ==========================================
window.filtrarAlunos = function() {
    const inputBusca = document.getElementById('busca-aluno');
    const termo = inputBusca ? inputBusca.value.toLowerCase() : '';
    const selectFiltro = document.getElementById('filtro-status');
    const filtro = selectFiltro ? selectFiltro.value : 'todos';
    
    document.querySelectorAll('#lista-todos-alunos .card-status').forEach(cartao => {
        const linhaNomeETags = cartao.querySelector('p').innerText.toLowerCase();
        let passaTexto = linhaNomeETags.includes(termo);
        let passaFiltro = true;

        if (filtro === 'ativos') passaFiltro = !linhaNomeETags.includes('🔴 inativo');
        else if (filtro === 'inativos') passaFiltro = linhaNomeETags.includes('🔴 inativo');
        else if (filtro === 'vip') passaFiltro = linhaNomeETags.includes('vip');

        cartao.style.display = (passaTexto && passaFiltro) ? 'block' : 'none'; 
    });
};

// ==========================================
// 5. INATIVAR PLANO / CANCELAR VIP
// ==========================================
window.alternarPausaPlano = async function(alunoId, nomeAluno, acao) {
    const isCongelando = acao === 'congelar';
    const result = await Swal.fire({
        title: isCongelando ? 'Inativar Aluno?' : 'Reativar Aluno?', 
        text: isCongelando ? `O aluno ${nomeAluno} ficará inativo.` : `O aluno ${nomeAluno} voltará a ser cobrado.`, 
        icon: 'question', showCancelButton: true, confirmButtonColor: isCongelando ? '#9e9e9e' : '#4CAF50', cancelButtonColor: '#333', confirmButtonText: 'Sim', cancelButtonText: 'Cancelar', background: '#161618', color: '#fff'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Processando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
        await supabase.from('perfis').update({ plano_pausado: isCongelando }).eq('id', alunoId);
        window.mostrarSucesso('Atualizado!', 'O status do aluno foi alterado com sucesso.');

        carregarTodosAlunos();
    }
};

window.cancelarAssinaturaVIP = async function(alunoId, nomeAluno) {
    const result = await Swal.fire({
        title: 'Remover do Recorrente?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ff5252', cancelButtonColor: '#333', confirmButtonText: 'Sim, Voltar para Pix', cancelButtonText: 'Manter VIP', background: '#161618', color: '#fff'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Removendo...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
        await supabase.from('perfis').update({ assinante: false, plano_pausado: false }).eq('id', alunoId);
        Swal.fire({ icon: 'success', title: 'Atualizado!', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
        carregarTodosAlunos();
    }
};

// ==========================================
// 6. DOSSIÊ RÁPIDO DO ALUNO E EDIÇÃO COMPLETA
// ==========================================
window.abrirDossie = async function(alunoId, event) {
    if (event && event.target.tagName === 'BUTTON') return;
    window.mostrarCarregamento('Buscando Ficha...');


    try {
        const { data: aluno } = await supabase.from('perfis').select('*').eq('id', alunoId).single();
        const { data: mensalidade } = await supabase.from('mensalidades').select('mes, status, valor').eq('aluno_id', alunoId).order('id', { ascending: false }).limit(1).single();

        const foto = aluno.foto_url || `https://ui-avatars.com/api/?name=${aluno.nome.replace(/\s/g, '+')}&background=161618&color=fff`;
        
        // Aplica a cor inteligente na borda da foto baseada em todas as faixas!
        let corBorda = window.obterCorDaFaixa(aluno.faixa);

        const statusPlano = aluno.plano_pausado ? '<span style="color:#ff5252; font-weight:bold;">🔴 INATIVO</span>' : (aluno.assinante ? '<span style="color:#2196F3; font-weight:bold;">💳 VIP (Recorrente)</span>' : '<span style="color:#4CAF50; font-weight:bold;">✅ ATIVO (Pix)</span>');
        let statusFinanceiro = '<span style="color:#aaa">Sem histórico</span>';
        if (mensalidade) {
            statusFinanceiro = mensalidade.status === 'pago' 
                ? `<span style="color:#4CAF50; font-weight:bold;">✅ Em dia (${mensalidade.mes})</span>` 
                : `<span style="color:#ff5252; font-weight:bold;">🔴 Pendente: ${mensalidade.mes} (R$ ${mensalidade.valor})</span>`;
        }

        const acaoPausa = aluno.plano_pausado ? 'reativar' : 'congelar';
        const iconePausa = aluno.plano_pausado ? '▶️ REATIVAR' : '⏸️ INATIVAR';
        const corPausa = aluno.plano_pausado ? '#4CAF50' : '#9e9e9e';

        let htmlBotoesAcao = `
            <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap; justify-content: center;">
                <button onclick="Swal.close(); editarPerfilCompleto('${aluno.id}')" style="flex: 1; padding: 10px; font-size: 11px; border: 1px solid var(--cor-destaque); background: var(--cor-destaque); color: white; border-radius: 6px; font-weight: bold;">✏️ EDITAR PERFIL</button>
                <button onclick="Swal.close(); alternarPausaPlano('${aluno.id}', '${aluno.nome}', '${acaoPausa}')" style="flex: 1; padding: 10px; font-size: 11px; border: 1px solid ${corPausa}; background: transparent; color: ${corPausa}; border-radius: 6px;">${iconePausa}</button>
            </div>
        `;
        if (aluno.assinante) htmlBotoesAcao += `<button onclick="Swal.close(); cancelarAssinaturaVIP('${aluno.id}', '${aluno.nome}')" style="width: 100%; margin-top: 8px; padding: 10px; font-size: 11px; border: 1px solid #ff5252; background: transparent; color: #ff5252; border-radius: 6px;">❌ CANCELAR STATUS VIP</button>`;

        const msgZap = encodeURIComponent(`Olá, *${aluno.nome}*! Oss! 🥋`);

        Swal.fire({
            html: `
                <div style="text-align: center; padding: 5px;">
                    <div style="position: relative; width: 110px; height: 110px; margin: 0 auto 15px;">
                        <img src="${foto}" style="width: 100%; height: 100%; border-radius: 50%; border: 4px solid ${corBorda}; object-fit: cover; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                    </div>
                    <h3 style="color: white; margin-bottom: 5px; font-size: 22px; font-weight: 800; text-transform: uppercase;">${aluno.nome}</h3>
                    <p style="color: ${corBorda}; font-weight: bold; margin-bottom: 20px; font-size: 14px; text-transform: uppercase;">🥋 ${aluno.faixa || 'BRANCA'}</p>
                    
                    <div style="text-align: left; background: #0a0a0a; padding: 15px; border-radius: 12px; font-size: 13px; border: 1px solid #333; margin-bottom: 20px;">
                        <p style="margin-bottom: 10px; border-bottom: 1px solid #222; padding-bottom: 8px;"><strong>📱 Zap:</strong> ${aluno.telefone || 'Não informado'}</p>
                        <p style="margin-bottom: 10px; border-bottom: 1px solid #222; padding-bottom: 8px;"><strong>📋 Conta:</strong> ${statusPlano}</p>
                        <p style="margin-bottom: 0;"><strong>💰 Mensalidade:</strong> ${statusFinanceiro}</p>
                    </div>
                    
                    <a href="https://wa.me/55${aluno.telefone || ''}?text=${msgZap}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #25D366; color: white; text-decoration: none; padding: 14px; border-radius: 8px; font-weight: bold; font-size: 14px;">📲 CHAMAR NO WHATSAPP</a>
                    
                    <div style="margin-top: 20px; border-top: 1px dashed #333; padding-top: 15px;">
                        <p style="color: #888; font-size: 10px; text-transform: uppercase; margin-bottom: 10px;">⚙️ Ações do Sensei</p>
                        ${htmlBotoesAcao}
                    </div>
                </div>
            `,
            background: '#161618', showConfirmButton: false, showCloseButton: true, width: '90%', padding: '20px 15px'
        });
    } catch (err) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Falha ao buscar ficha.', background: '#161618', color: '#fff' }); }
};

window.editarPerfilCompleto = async function(alunoId) {
    const { data: aluno } = await supabase.from('perfis').select('*').eq('id', alunoId).single();
    const { value: formValues } = await Swal.fire({
        title: 'Editar Atleta',
        html: `
            <div style="text-align: left; padding: 0 5px;">
                <label style="color: #aaa; font-size: 11px; text-transform: uppercase;">Nome:</label>
                <input id="swal-nome" class="swal2-input" value="${aluno.nome}" style="background: #0a0a0a; color: white; border: 1px solid #333; margin-top: 5px; margin-bottom: 15px;">
                <label style="color: #aaa; font-size: 11px; text-transform: uppercase;">WhatsApp:</label>
                <input id="swal-tel" class="swal2-input" value="${aluno.telefone || ''}" style="background: #0a0a0a; color: white; border: 1px solid #333; margin-top: 5px; margin-bottom: 15px;">
                <label style="color: #aaa; font-size: 11px; text-transform: uppercase;">Faixa / Grau:</label>
                <input id="swal-faixa" class="swal2-input" value="${aluno.faixa || 'Branca'}" style="background: #0a0a0a; color: white; border: 1px solid #333; margin-top: 5px; margin-bottom: 15px;">
                <label style="color: #aaa; font-size: 11px; text-transform: uppercase;">Valor Fixo (Ex: 25):</label>
                <input id="swal-valor" type="number" class="swal2-input" value="${aluno.valor_mensalidade || ''}" style="background: #0a0a0a; color: white; border: 1px solid #333; margin-top: 5px;">
            </div>
        `,
        focusConfirm: false, showCancelButton: true, confirmButtonColor: '#4CAF50', cancelButtonColor: '#333', confirmButtonText: 'SALVAR', cancelButtonText: 'CANCELAR', background: '#161618', color: '#fff',
        preConfirm: () => ({
            nome: document.getElementById('swal-nome').value,
            telefone: document.getElementById('swal-tel').value.replace(/\D/g,''),
            faixa: document.getElementById('swal-faixa').value,
            valor: document.getElementById('swal-valor').value
        })
    });

    if (formValues) {
        window.mostrarCarregamento('Carregando...');

        await supabase.from('perfis').update({ nome: formValues.nome, telefone: formValues.telefone, faixa: formValues.faixa, valor_mensalidade: formValues.valor ? parseInt(formValues.valor) : null }).eq('id', alunoId);
        Swal.fire({ icon: 'success', title: 'Atualizado!', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
        if(typeof carregarTodosAlunos === 'function') carregarTodosAlunos();
        if(typeof carregarPendentes === 'function') carregarPendentes();
        setTimeout(() => abrirDossie(alunoId), 1600);
    }
};

// ==========================================
// 1.CONTROLE DO MENU LATERAL
// ==========================================
window.abrirMenu = function() {
    document.getElementById('menu-lateral').classList.add('aberto');
    document.getElementById('menu-backdrop').style.display = 'block';
    setTimeout(() => document.getElementById('menu-backdrop').style.opacity = '1', 10);
};

window.fecharMenu = function() {
    document.getElementById('menu-lateral').classList.remove('aberto');
    document.getElementById('menu-backdrop').style.opacity = '0';
    setTimeout(() => document.getElementById('menu-backdrop').style.display = 'none', 300);
};

// ==========================================
// 2.TROCA DE ABAS
// ==========================================
window.trocarAba = function(idAba, elemento) {
    document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none');
    document.getElementById(idAba).style.display = 'block';
    
    document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active'));
    if (elemento) elemento.classList.add('active');
    
    fecharMenu(); 
    window.scrollTo(0, 0); 
    
    if(idAba === 'aba-pendentes') carregarPendentes();
    if(idAba === 'aba-alunos') carregarTodosAlunos(); 
    if(idAba === 'aba-mural') carregarAvisosAdmin(); 
};

// ==========================================
// 3.VERIFICAR AUTORIZAÇÃO (RLS PROTEGE O BANCO)
// ==========================================
async function verificarAcessoAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    
    const { data: perfil } = await supabase.from('perfis').select('cargo').eq('id', session.user.id).single();
    if (!perfil || perfil.cargo !== 'professor') { window.location.href = "painel.html"; return; }
    
    carregarPendentes();
}

// ==========================================
// 4.CARREGAR DASHBOARD E PENDENTES
// ==========================================
async function carregarPendentes() {
    const lista = document.getElementById('lista-pendentes');
    const txtRecebido = document.getElementById('total-recebido');
    const txtPendente = document.getElementById('total-pendente');
    
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center;">Buscando...</p>`;

    const { data: mensalidades } = await supabase.from('mensalidades').select('*');
    
    let totalPago = 0;
    let totalEmAberto = 0;

    (mensalidades || []).forEach(m => {
        let valor = parseFloat(m.valor) || 0;
        if (m.status.toLowerCase().trim() === 'pago') {
            totalPago += valor;
        } else {
            totalEmAberto += valor;
        }
    });

    txtRecebido.innerText = `R$ ${totalPago}`;
    txtPendente.innerText = `R$ ${totalEmAberto}`;

    const pendentes = (mensalidades || []).filter(m => m.status.toLowerCase().trim() === 'pendente');

    if (pendentes.length === 0) {
        lista.innerHTML = `<p style="color: #4CAF50; text-align: center; margin-top: 20px;">✅ Tudo em dia!</p>`;
        return;
    }

        lista.innerHTML = ""; 
    for (const mens of pendentes) {
        // 1. Buscamos a palavra plano_pausado no banco de dados
        const { data: aluno } = await supabase.from('perfis').select('nome, telefone, plano_pausado').eq('id', mens.aluno_id).single();
        
        // 🛑 TRAVA 1: Se o aluno estiver inativo, "continue" faz o sistema pular e não desenhar a fatura dele!
        if (aluno && aluno.plano_pausado === true) {
            continue;
        }

        const nome = aluno ? aluno.nome : "Desconhecido";
        const tel = aluno ? aluno.telefone : "";
        
        lista.innerHTML += `
            <div class="card-status" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid var(--cor-destaque);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div><p style="color: white; font-weight: bold; margin: 0;">${nome}</p><p style="color: #666; font-size: 11px; margin: 0;">${mens.mes} | R$ ${mens.valor}</p></div>
                    <button onclick="cancelarCobranca('${mens.id}')" style="background: transparent; border: none; color: #ff5252; font-size: 18px; width: auto;">🗑️</button>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="darBaixa('${mens.id}')" style="flex: 2; padding: 8px; font-size: 11px;">RECEBER</button>
                    <button onclick="cobrarNoZap('${tel}', '${nome}', '${mens.mes}', '${mens.valor}')" style="flex: 1; background-color: #25D366; border: none; padding: 8px; font-size: 14px;">📲</button>
                </div>
            </div>`;
    }
}

// ==========================================
// 5.AÇÕES DE COBRANÇA INDIVIDUAL
// ==========================================

// 1. WhatsApp Turbinado (Filtro Anti-Erro + Formatação)
window.cobrarNoZap = function(telefone, nome, mes, valor) {
    if(!telefone || telefone.length < 10) { 
        Swal.fire({ icon: 'error', title: 'Telefone Inválido', text: 'O aluno não possui um número de WhatsApp válido cadastrado.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        return; 
    }

    const numeroLimpo = telefone.replace(/\D/g, '');
    const linkApp = "https://sml-svg.github.io/?modo=app";
    const chavePix = "92985589868"; 

    const mensagem = `Olá, *${nome}*! Oss! 🥋\n\n` +
                `Passando para lembrar da sua mensalidade de *${mes}* na 4L Academy.\n\n` +
                `💰 *Valor:* R$ ${valor},00\n\n` +
                `📱 *Acesse o App para pagar com PIX ou Cartão:* \n` +
                `${linkApp}\n\n` +
                `_Se preferir, envie direto para nossa Chave Pix (Celular):_\n` +
                `*${chavePix}*\n\n` +
                `Nos vemos no tatame!`;

    const linkFinal = `https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
    window.open(linkFinal, '_blank');
};

// 2. Apagar Cobrança (Lixeira)
window.cancelarCobranca = async function(id) {
    const result = await Swal.fire({
        title: 'Apagar cobrança?', text: "Esta ação não pode ser desfeita!", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#E53935', cancelButtonColor: '#333', confirmButtonText: 'Sim, apagar', cancelButtonText: 'Cancelar', background: '#161618', color: '#fff'
    });

    if(result.isConfirmed) { 
        await supabase.from('mensalidades').delete().eq('id', id); 
        carregarPendentes(); 
        Swal.fire({ icon: 'success', title: 'Apagado!', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
    }
};

// 3. Receber Manualmente (Dar Baixa no Caixa)
window.darBaixa = async function(id) {
    const result = await Swal.fire({
        title: 'Confirmar Pagamento?', text: "O aluno ficará EM DIA no sistema.", icon: 'question',
        showCancelButton: true, confirmButtonColor: '#4CAF50', cancelButtonColor: '#333', confirmButtonText: 'Sim, Recebido', cancelButtonText: 'Cancelar', background: '#161618', color: '#fff'
    });

    if(result.isConfirmed) { 
        await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', id); 
        carregarPendentes(); 
        Swal.fire({ icon: 'success', title: 'Pago! 🥋', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
    }
};


// ==========================================
// 6.CADASTRAR NOVO ALUNO PELO ADMIN
// ==========================================
document.getElementById('form-novo-aluno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const dados = {
        nome: document.getElementById('novo-nome').value,
        email: document.getElementById('novo-email').value,
        senha: document.getElementById('novo-senha').value,
        telefone: document.getElementById('novo-telefone').value.replace(/\D/g,''),
        faixa: document.getElementById('novo-faixa').value
    };
    btn.innerText = "⏳...";
    
    // O Supabase Auth lida com a criação, RLS protege a tabela 'perfis'
    const { data, error } = await supabase.auth.signUp({ email: dados.email, password: dados.senha });
    if (!error) {
        await supabase.from('perfis').insert([{ id: data.user.id, nome: dados.nome, telefone: dados.telefone, faixa: dados.faixa, cargo: 'aluno' }]);
        Swal.fire({ icon: 'success', title: 'Oss!', text: 'Aluno cadastrado com sucesso!', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
        e.target.reset();
    } else {
        Swal.fire({ icon: 'error', title: 'Erro', text: error.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
    }
    btn.innerText = "SALVAR";
});

// ==========================================
// 7.CARREGAR LISTA DE ALUNOS COM TAGS E ESTATÍSTICAS
// ==========================================
async function carregarTodosAlunos() {
    const lista = document.getElementById('lista-todos-alunos');
    const resumoFaixas = document.getElementById('resumo-faixas');
    
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center;">Buscando alunos...</p>`;
    if (resumoFaixas) resumoFaixas.innerHTML = "";

    // 1. Busca todos os usuários que não são professores (Já vem em Ordem Alfabética)
    const { data: alunos, error } = await supabase
        .from('perfis')
        .select('*')
        .neq('cargo', 'professor')
        .order('nome', { ascending: true });

    if (error || !alunos || alunos.length === 0) {
        lista.innerHTML = `<p style="color: #aaaaaa; text-align: center;">Nenhum aluno encontrado.</p>`;
        return;
    }

    // ----------------------------------------------------
    // NOVO: CONTADOR DE FAIXAS (IGNORANDO INATIVOS)
    // ----------------------------------------------------
    const alunosAtivos = alunos.filter(a => a.plano_pausado !== true);
    const contagem = {};

    // Conta quantos alunos existem em cada faixa
    alunosAtivos.forEach(aluno => {
        const faixa = aluno.faixa || 'Branca'; // Se estiver vazio, assume Branca
        contagem[faixa] = (contagem[faixa] || 0) + 1;
    });

    // Desenha as "pílulas" de estatísticas na tela
    if (resumoFaixas) {
        let htmlEstatisticas = `<div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 15px; margin-bottom: 10px; flex-wrap: nowrap; -webkit-overflow-scrolling: touch;">`;
        
        // Pílula principal com o total de ativos
        htmlEstatisticas += `<div style="background: #E53935; color: white; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; white-space: nowrap;">Total Ativos: ${alunosAtivos.length}</div>`;
        
        // Cria uma pílula para cada faixa encontrada
        for (const [nomeFaixa, qtd] of Object.entries(contagem)) {
            htmlEstatisticas += `<div style="background: #161618; border: 1px solid #333; color: #ccc; padding: 6px 12px; border-radius: 20px; font-size: 11px; white-space: nowrap;">${nomeFaixa}: <b>${qtd}</b></div>`;
        }
        
        htmlEstatisticas += `</div>`;
        resumoFaixas.innerHTML = htmlEstatisticas;
    }
    // ----------------------------------------------------

    lista.innerHTML = ""; 

    // 2. Monta o cartão para cada aluno
    alunos.forEach(aluno => {
        const tagAssinante = aluno.assinante ? `<span style="background-color: #2196F3; color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">VIP</span>` : '';
        const tagCongelado = aluno.plano_pausado ? `<span style="background-color: #9e9e9e; color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">🔴 INATIVO</span>` : '';

        // BOTÃO ATIVAR/INATIVAR
        const acao = aluno.plano_pausado ? 'reativar' : 'congelar';
        const icone = aluno.plano_pausado ? '▶️ REATIVAR' : '⏸️ INATIVAR';
        const corBorda = aluno.plano_pausado ? '#4CAF50' : '#9e9e9e';
        const btnCongelar = `<button onclick="alternarPausaPlano('${aluno.id}', '${aluno.nome}', '${acao}')" style="width: auto; padding: 6px 12px; font-size: 11px; border: 1px solid ${corBorda}; background: transparent; color: ${corBorda}; margin-left: 5px;">${icone}</button>`;

        // BOTÃO CANCELAR VIP
        let btnVIP = '';
        if (aluno.assinante) {
            btnVIP = `<button onclick="cancelarAssinaturaVIP('${aluno.id}', '${aluno.nome}')" style="width: auto; padding: 6px 12px; font-size: 11px; border: 1px solid #ff5252; background: transparent; color: #ff5252; margin-left: 5px;">❌ CANCELAR VIP</button>`;
        }

                lista.innerHTML += `
            <div class="card-status" onclick="abrirDossie('${aluno.id}', event)" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid #ffffff; cursor: pointer;">

                <div>
                    <p style="color: white; font-weight: bold; margin: 0;">${aluno.nome} ${tagAssinante} ${tagCongelado}</p>
                    <p style="color: #9e9e9e; font-size: 11px; margin: 0;">${aluno.faixa || 'Branca'}</p>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
                    <button onclick="promoverAluno('${aluno.id}', '${aluno.nome}', '${aluno.faixa || 'Branca'}')" style="padding: 6px 12px; font-size: 11px; border: 1px solid var(--cor-destaque); background: transparent; color: white;">ATUALIZAR</button>
                    ${btnCongelar}
                    ${btnVIP}
                </div>
            </div>`;
    });
filtrarAlunos(); 

}



// ==========================================
// 8.FILTRAR ALUNOS (BARRA DE PESQUISA + DROPDOWN)
// ==========================================
window.filtrarAlunos = function() {
    const termo = document.getElementById('busca-aluno').value.toLowerCase();
    const filtro = document.getElementById('filtro-status').value;
    const cartoes = document.querySelectorAll('#lista-todos-alunos .card-status');
    
    cartoes.forEach(cartao => {
        // Pega a primeira linha do cartão, onde está o nome e as etiquetas (VIP / INATIVO)
        const linhaNomeETags = cartao.querySelector('p').innerText.toLowerCase();
        
        // 1. Verifica se o texto digitado bate com o nome
        let passaTexto = linhaNomeETags.includes(termo);
        
        // 2. Verifica se o cartão atende à regra da caixinha
        let passaFiltro = true;

        if (filtro === 'ativos') {
            passaFiltro = !linhaNomeETags.includes('🔴 inativo');
        } else if (filtro === 'inativos') {
            passaFiltro = linhaNomeETags.includes('🔴 inativo');
        } else if (filtro === 'vip') {
            passaFiltro = linhaNomeETags.includes('vip');
        }

        // Se passar nos dois testes (Texto E Filtro), o cartão aparece!
        if (passaTexto && passaFiltro) {
            cartao.style.display = 'block'; 
        } else {
            cartao.style.display = 'none'; 
        }
    });
};


// ==========================================
// 9.ATUALIZAR DADOS DO ALUNO (FAIXA E VALOR MENSALIDADE)
// ==========================================
window.promoverAluno = async function(alunoId, nomeAluno, faixaAtual) {
    const { data: perfil } = await supabase.from('perfis').select('valor_mensalidade').eq('id', alunoId).single();
    const valorAtual = perfil && perfil.valor_mensalidade ? perfil.valor_mensalidade : '';

    const { value: formValores } = await Swal.fire({
        title: `Atualizar ${nomeAluno}`,
        html: `
            <label style="color: #aaa; font-size: 12px; text-align: left; display: block; margin-top: 10px;">Faixa/Grau Atual:</label>
            <input id="swal-faixa" class="swal2-input" value="${faixaAtual}" style="background: #0a0a0a; color: white; border: 1px solid #333; margin-top: 5px;">
            
            <label style="color: #aaa; font-size: 12px; text-align: left; display: block; margin-top: 15px;">Valor Fixo Especial (Deixe em branco para usar o padrão):</label>
            <input id="swal-valor" type="number" class="swal2-input" placeholder="Ex: 25" value="${valorAtual}" style="background: #0a0a0a; color: white; border: 1px solid #333; margin-top: 5px;">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#E53935',
        cancelButtonColor: '#333',
        confirmButtonText: 'Salvar Alterações',
        cancelButtonText: 'Cancelar',
        background: '#161618',
        color: '#fff',
        preConfirm: () => {
            return {
                novaFaixa: document.getElementById('swal-faixa').value,
                novoValor: document.getElementById('swal-valor').value
            }
        }
    });

    if (formValores) {
        Swal.fire({ title: 'Salvando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
        
        try {
            const valorFinal = formValores.novoValor ? parseInt(formValores.novoValor) : null;

            const { error } = await supabase.from('perfis').update({ 
                faixa: formValores.novaFaixa,
                valor_mensalidade: valorFinal
            }).eq('id', alunoId);

            if (error) throw error;

            Swal.fire({ icon: 'success', title: 'Atualizado!', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
            carregarTodosAlunos();
            
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
        }
    }
};

// ==========================================
// 10.INATIVAR / REATIVAR PLANO DO ALUNO (PIX OU VIP)
// ==========================================
window.alternarPausaPlano = async function(alunoId, nomeAluno, acao) {
    const isCongelando = acao === 'congelar';
    const tituloMsg = isCongelando ? 'Inativar Aluno?' : 'Reativar Aluno?';
    
    // TEXTOS CORRIGIDOS: Sem falar de cartão, serve para Pix também!
    const textoMsg = isCongelando 
        ? `O aluno ${nomeAluno} ficará inativo e não receberá novas cobranças no início do mês.` 
        : `O aluno ${nomeAluno} voltará a ser incluído no sistema de cobranças da academia.`;
        
    const corConfirma = isCongelando ? '#9e9e9e' : '#4CAF50';

    const result = await Swal.fire({
        title: tituloMsg,
        text: textoMsg,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: corConfirma,
        cancelButtonColor: '#333',
        confirmButtonText: isCongelando ? 'Sim, Inativar 🔴' : 'Sim, Reativar ▶️',
        cancelButtonText: 'Cancelar',
        background: '#161618',
        color: '#fff'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Processando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

        try {
            await supabase.from('perfis').update({ plano_pausado: isCongelando }).eq('id', alunoId);

            Swal.fire({ 
                icon: 'success', 
                title: isCongelando ? 'Aluno Inativado!' : 'Aluno Reativado!', 
                background: '#161618', 
                color: '#fff', 
                showConfirmButton: false, 
                timer: 1500 
            });

            carregarTodosAlunos();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
        }
    }
};


// ==========================================
// 11.CANCELAR STATUS VIP (VOLTAR PARA O PIX)
// ==========================================
window.cancelarAssinaturaVIP = async function(alunoId, nomeAluno) {
    const result = await Swal.fire({
        title: 'Remover do Recorrente?',
        text: `O aluno ${nomeAluno} deixará de ser VIP e voltará a receber cobranças de Pix mensalmente. Confirmar?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff5252',
        cancelButtonColor: '#333',
        confirmButtonText: 'Sim, Voltar para Pix',
        cancelButtonText: 'Manter VIP',
        background: '#161618',
        color: '#fff'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Removendo...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

        try {
            const { error } = await supabase.from('perfis').update({ 
                assinante: false, 
                plano_pausado: false 
            }).eq('id', alunoId);

            if (error) throw error;

            Swal.fire({ 
                icon: 'success', 
                title: 'Status Atualizado!', 
                text: 'Aluno agora pagará via Pix.', 
                background: '#161618', 
                color: '#fff', 
                showConfirmButton: false, 
                timer: 2000 
            });

            carregarTodosAlunos();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
        }
    }
};

// ==========================================
// 12.GERAR MENSALIDADES (COM ESCUDO VIP, VALOR DINÂMICO E PROTEÇÃO ANTI-DUPLICIDADE)
// ==========================================
document.getElementById('btn-gerar-mes').addEventListener('click', async () => {
                let mesBruto = document.getElementById('mes-geral').value.trim();
                const valorPadrao = document.getElementById('valor-geral').value;
                
                if (!mesBruto || !valorPadrao) {
                    Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Preencha o Mês e o Valor Padrão.', background: '#161618', color: '#fff' });
                    return;
                }
                
                // 🛡️ O FILTRO FAIXA PRETA (Substitui centenas de if/elses)
                // 1. Tira todos os espaços em branco (ex: " Maio / 2026 " vira "Maio/2026")
                let mes = mesBruto.replace(/\s+/g, '');
                // 2. Deixa a primeira letra maiúscula e o resto minúsculo (ex: "mAIO/2026" vira "Maio/2026")
                mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();
                
                Swal.fire({ title: 'Verificando Sistema...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

    try {
        // 1. Busca os alunos manuais (Agora puxamos o status do plano também)
        const { data: alunosManuais, error: erroAlunos } = await supabase
            .from('perfis')
            .select('id, valor_mensalidade, plano_pausado') 
            .neq('cargo', 'professor')
            .eq('assinante', false); 

        if (erroAlunos) throw erroAlunos;

        // 🛑 TRAVA 2: Remove da lista geral qualquer aluno que tenha o plano_pausado = true
        const alunosAtivos = (alunosManuais || []).filter(aluno => aluno.plano_pausado !== true);

        if (alunosAtivos.length === 0) {
            Swal.fire({ icon: 'info', title: 'Tudo Limpo', text: 'Nenhum aluno ATIVO para cobrança manual no momento.', background: '#161618', color: '#fff' });
            return;
        }


        // 2. NOVO: Busca se JÁ EXISTEM cobranças geradas para este mês específico
        const { data: mensalidadesExistentes, error: erroMensalidades } = await supabase
            .from('mensalidades')
            .select('aluno_id')
            .eq('mes', mes);

        if (erroMensalidades) throw erroMensalidades;

        // Cria uma lista (Set) rápida apenas com os IDs de quem já foi cobrado
        const alunosJaCobrados = new Set(mensalidadesExistentes.map(m => m.aluno_id));

        // 3. NOVO: Filtra os alunos, deixando APENAS os que ainda não foram cobrados
        const alunosParaCobrar = alunosAtivos.filter(aluno => !alunosJaCobrados.has(aluno.id));

        // Se todo mundo já foi cobrado, avisa e para por aqui
        if (alunosParaCobrar.length === 0) {
            Swal.fire({ icon: 'info', title: 'Tudo Certo!', text: `Todos os alunos já possuem cobrança gerada para o mês de ${mes}. Nenhuma duplicata foi criada.`, background: '#161618', color: '#fff' });
            return;
        }

        // 4. Prepara a lista final de cobranças apenas para os que faltam
        const cobrancas = alunosParaCobrar.map(aluno => {
            const valorFinalCobrado = aluno.valor_mensalidade ? aluno.valor_mensalidade : parseFloat(valorPadrao);
            
            return {
                aluno_id: aluno.id,
                mes: mes,
                valor: valorFinalCobrado,
                status: 'pendente'
            };
        });

        // 5. Salva no banco com segurança
        const { error: erroInsert } = await supabase.from('mensalidades').insert(cobrancas);

        if (erroInsert) throw erroInsert;

        Swal.fire({ 
            icon: 'success', 
            title: 'Cobranças Geradas!', 
            text: `Foram geradas ${alunosParaCobrar.length} novas cobranças.`, 
            background: '#161618', 
            color: '#fff',
            confirmButtonColor: '#4CAF50'
        });
        
        document.getElementById('mes-geral').value = '';
        carregarPendentes(); 

    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' });
    }
});


// ==========================================
// 13.MURAL DE AVISOS
// ==========================================
document.getElementById('btn-publicar-aviso').addEventListener('click', async () => {
    const titulo = document.getElementById('aviso-titulo').value;
    const mensagem = document.getElementById('aviso-mensagem').value;
    if(!titulo || !mensagem) return;
    await supabase.from('avisos').insert([{ titulo, mensagem }]);
    
    Swal.fire({ icon: 'success', title: 'Aviso Publicado!', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
    document.getElementById('aviso-titulo').value = "";
    document.getElementById('aviso-mensagem').value = "";
    carregarAvisosAdmin();
});

async function carregarAvisosAdmin() {
    const lista = document.getElementById('lista-avisos-admin');
    const { data: avisos } = await supabase.from('avisos').select('*');
    lista.innerHTML = "";
    (avisos || []).reverse().forEach(aviso => {
        lista.innerHTML += `
            <div class="card-status" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid var(--cor-destaque); position: relative;">
                <button onclick="deletarAviso('${aviso.id}')" style="position: absolute; top: 10px; right: 10px; width: auto; background: none; border: none; color: #ff5252; font-size: 16px;">🗑️</button>
                <h4 style="color: white; margin-bottom: 5px; font-size: 15px;">${aviso.titulo}</h4>
                <p style="color: #888; font-size: 12px; margin: 0;">${aviso.mensagem}</p>
            </div>`;
    });
}

window.deletarAviso = async function(id) {
    const result = await Swal.fire({
        title: 'Apagar aviso?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#E53935', cancelButtonColor: '#333', confirmButtonText: 'Sim', cancelButtonText: 'Não', background: '#161618', color: '#fff'
    });

    if(result.isConfirmed) { 
        await supabase.from('avisos').delete().eq('id', id); 
        carregarAvisosAdmin(); 
    }
};

// ==========================================
// 14.CONFIGURAÇÕES DA CONTA DO PROFESSOR
// ==========================================
document.getElementById('btn-sair').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

window.atualizarMeusDados = async function() {
    const { value: novoEmail } = await Swal.fire({
        title: 'Atualizar E-mail', input: 'email', inputPlaceholder: 'Novo e-mail de acesso',
        background: '#161618', color: '#fff', confirmButtonColor: '#E53935', showCancelButton: true, cancelButtonColor: '#333', cancelButtonText: 'Pular'
    });

    if (novoEmail) {
        const { error: errEmail } = await supabase.auth.updateUser({ email: novoEmail });
        if (errEmail) {
            Swal.fire({ icon: 'error', title: 'Erro', text: errEmail.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        } else {
            Swal.fire({ icon: 'success', title: 'E-mail Atualizado!', text: 'Verifique a caixa de entrada.', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
        }
    }

    const { value: novaSenha } = await Swal.fire({
        title: 'Atualizar Senha', input: 'password', inputPlaceholder: 'Nova senha (mín. 6 caracteres)',
        background: '#161618', color: '#fff', confirmButtonColor: '#E53935', showCancelButton: true, cancelButtonColor: '#333', cancelButtonText: 'Pular'
    });

    if (novaSenha) {
        const { error: errSenha } = await supabase.auth.updateUser({ password: novaSenha });
        if (errSenha) {
            Swal.fire({ icon: 'error', title: 'Erro', text: errSenha.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        } else {
            Swal.fire({ icon: 'success', title: 'Senha Atualizada!', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
        }
    }
};

// ==========================================
// 15. DOSSIÊ RÁPIDO DO ALUNO (POP-UP DETALHADO)
// ==========================================
window.abrirDossie = async function(alunoId, event) {
    // Impede que o dossiê abra se o professor clicar nos botões de "Atualizar" ou "Inativar"
    if (event && event.target.tagName === 'BUTTON') return;

    Swal.fire({ title: 'Abrindo Dossiê...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

    try {
        const { data: aluno, error } = await supabase.from('perfis').select('*').eq('id', alunoId).single();
        if (error) throw error;

        // Limpa espaços no nome para não bugar a API de fotos
        const nomeParaFoto = aluno.nome.replace(/\s/g, '+');
        const foto = aluno.foto_url || `https://ui-avatars.com/api/?name=${nomeParaFoto}&background=E53935&color=fff`;
        
        const statusPlano = aluno.plano_pausado ? '🔴 INATIVO' : (aluno.assinante ? '💳 VIP (Recorrente)' : '✅ ATIVO (Pix/Manual)');
        const valorCobranca = aluno.valor_mensalidade ? `R$ ${aluno.valor_mensalidade},00 (Especial)` : 'Valor Padrão da Academia';

        Swal.fire({
            title: `<span style="color: #E53935; font-style: italic; font-weight: 800;">FICHA DO ATLETA</span>`,
            html: `
                <div style="text-align: center; padding: 10px;">
                    <img src="${foto}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid #E53935; object-fit: cover; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                    <h3 style="color: white; margin-bottom: 5px; font-size: 20px;">${aluno.nome}</h3>
                    <p style="color: #E53935; font-weight: bold; margin-bottom: 20px; font-size: 14px;">🥋 ${aluno.faixa || 'Branca'}</p>
                    
                    <div style="text-align: left; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; font-size: 14px; border: 1px solid rgba(255,255,255,0.1);">
                        <p style="margin-bottom: 8px;"><strong>📱 WhatsApp:</strong> ${aluno.telefone || 'Não cadastrado'}</p>
                        <p style="margin-bottom: 8px;"><strong>📊 Status:</strong> ${statusPlano}</p>
                        <p style="margin-bottom: 0;"><strong>💰 Mensalidade:</strong> ${valorCobranca}</p>
                    </div>

                    <a href="https://wa.me/55${aluno.telefone || ''}" target="_blank" style="display: block; background: #25D366; color: white; text-decoration: none; padding: 14px; border-radius: 8px; margin-top: 15px; font-weight: bold; font-size: 14px; border: 1px solid rgba(255,255,255,0.1);">
                        📲 CHAMAR NO WHATSAPP
                    </a>
                </div>
            `,
            background: '#161618',
            showConfirmButton: false,
            showCloseButton: true,
            width: '90%'
        });

    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível carregar a ficha.', background: '#161618', color: '#fff' });
    }
};

// Disparo Manual do Robô
document.getElementById('btn-disparar-robos').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.innerText = "⏳ Disparando...";
    btn.disabled = true;
    
    try {
        const { data, error } = await supabase.functions.invoke('robo-financeiro');
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Enviado!', text: data.message, background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
    } catch (err) {
        console.error("Falha:", err);
        Swal.fire({ icon: 'error', title: 'Falhou!', text: 'Erro ao enviar e-mails. Verifique o console.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
    } finally {
        btn.innerText = "🤖 FORÇAR DISPARO DE AVISOS";
        btn.disabled = false;
    }
});

verificarAcessoAdmin();

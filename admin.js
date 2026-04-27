const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// CONTROLE DO MENU LATERAL
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

// NOVA FUNÇÃO DE TROCAR ABAS E FECHAR O MENU AUTOMATICAMENTE
window.trocarAba = function(idAba, elemento) {
    document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none');
    document.getElementById(idAba).style.display = 'block';
    
    // Atualiza a cor vermelha no menu lateral
    document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active'));
    if (elemento) elemento.classList.add('active');
    
    fecharMenu(); // Fecha a gaveta ao clicar
    window.scrollTo(0, 0); // Sobe a página para o topo
    
    if(idAba === 'aba-pendentes') carregarPendentes();
    if(idAba === 'aba-alunos') carregarTodosAlunos(); 
    if(idAba === 'aba-mural') carregarAvisosAdmin(); 
};


async function verificarAcessoAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    const { data: perfil } = await supabase.from('perfis').select('cargo').eq('id', session.user.id).single();
    if (!perfil || perfil.cargo !== 'professor') { window.location.href = "painel.html"; return; }
    carregarPendentes();
}

// 1. CARREGAR DASHBOARD E PENDENTES
async function carregarPendentes() {
    const lista = document.getElementById('lista-pendentes');
    const txtRecebido = document.getElementById('total-recebido');
    const txtPendente = document.getElementById('total-pendente');
    
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center;">Buscando...</p>`;

    const { data: mensalidades } = await supabase.from('mensalidades').select('*');
    
    // CÁLCULO DO DASHBOARD
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

    // LISTA DE PENDENTES
    const pendentes = (mensalidades || []).filter(m => m.status.toLowerCase().trim() === 'pendente');

    if (pendentes.length === 0) {
        lista.innerHTML = `<p style="color: #4CAF50; text-align: center; margin-top: 20px;">✅ Tudo em dia!</p>`;
        return;
    }

    lista.innerHTML = ""; 
    for (const mens of pendentes) {
        const { data: aluno } = await supabase.from('perfis').select('nome, telefone').eq('id', mens.aluno_id).single();
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

window.cobrarNoZap = function(telefone, nome, mes, valor) {
    if(!telefone) { alert("Sem telefone!"); return; }
    const msg = encodeURIComponent(`Olá ${nome}! Oss! 🥋\nLembrando da mensalidade de ${mes} (R$ ${valor}).`);
    window.open(`https://wa.me/55${telefone}?text=${msg}`, '_blank');
}

window.cancelarCobranca = async function(id) {
    if(confirm("Apagar cobrança?")) { await supabase.from('mensalidades').delete().eq('id', id); carregarPendentes(); }
};

window.darBaixa = async function(id) {
    if(confirm("Recebido?")) { await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', id); carregarPendentes(); }
};

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
    const { data, error } = await supabase.auth.signUp({ email: dados.email, password: dados.senha });
    if (!error) {
        await supabase.from('perfis').insert([{ id: data.user.id, nome: dados.nome, telefone: dados.telefone, faixa: dados.faixa, cargo: 'aluno' }]);
        alert("✅ Cadastrado!");
        e.target.reset();
    }
    btn.innerText = "SALVAR";
});

async function carregarTodosAlunos() {
    const lista = document.getElementById('lista-todos-alunos');
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center;">Buscando...</p>`;
    const { data: alunos } = await supabase.from('perfis').select('*').neq('cargo', 'professor').order('nome', { ascending: true });
    lista.innerHTML = ""; 
    (alunos || []).forEach(aluno => {
        lista.innerHTML += `
            <div class="card-status" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid #ffffff;">
                <div><p style="color: white; font-weight: bold; margin: 0;">${aluno.nome}</p><p style="color: #9e9e9e; font-size: 11px; margin: 0;">${aluno.faixa}</p></div>
                <button onclick="promoverAluno('${aluno.id}', '${aluno.nome}', '${aluno.faixa}')" style="width: auto; padding: 6px 12px; font-size: 11px; border: 1px solid var(--cor-destaque); background: transparent; color: white;">ATUALIZAR</button>
            </div>`;
    });
}

window.promoverAluno = async function(id, nome, faixa) {
    const nova = prompt(`Nova faixa para ${nome}:`, faixa);
    if (nova) { await supabase.from('perfis').update({ faixa: nova }).eq('id', id); carregarTodosAlunos(); }
};

document.getElementById('btn-gerar-mes').addEventListener('click', async () => {
    const mes = document.getElementById('mes-geral').value;
    const valor = document.getElementById('valor-geral').value;
    if(!mes) return;
    const { data: alunos } = await supabase.from('perfis').select('id').neq('cargo', 'professor');
    const cobrancas = alunos.map(a => ({ aluno_id: a.id, mes: mes, valor: valor, status: 'pendente' }));
    await supabase.from('mensalidades').insert(cobrancas);
    alert("✅ Cobranças Geradas!");
    document.getElementById('mes-geral').value = "";
});

document.getElementById('btn-publicar-aviso').addEventListener('click', async () => {
    const titulo = document.getElementById('aviso-titulo').value;
    const mensagem = document.getElementById('aviso-mensagem').value;
    if(!titulo || !mensagem) return;
    await supabase.from('avisos').insert([{ titulo, mensagem }]);
    alert("✅ Publicado!");
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
    if(confirm("Apagar aviso?")) { await supabase.from('avisos').delete().eq('id', id); carregarAvisosAdmin(); }
};

document.getElementById('btn-sair').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

verificarAcessoAdmin();

// FUNÇÃO PARA O PROFESSOR ATUALIZAR OS SEUS PRÓPRIOS DADOS
window.atualizarMeusDados = async function() {
    const novoEmail = prompt("Digite o novo e-mail de acesso:");
    const novaSenha = prompt("Digite a nova senha (mínimo 6 caracteres):");

    if (novoEmail) {
        const { error: errEmail } = await supabase.auth.updateUser({ email: novoEmail });
        if (errEmail) alert("Erro ao mudar e-mail: " + errEmail.message);
        else alert("E-mail atualizado! Verifique a caixa de entrada para confirmar.");
    }

    if (novaSenha) {
        const { error: errSenha } = await supabase.auth.updateUser({ password: novaSenha });
        if (errSenha) alert("Erro ao mudar senha: " + errSenha.message);
        else alert("Senha atualizada com sucesso!");
    }
};
// ==========================================
// TESTE MANUAL: DISPARAR ROBÔ FINANCEIRO
// ==========================================
document.getElementById('btn-disparar-robos').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.innerText = "⏳ Disparando Robôs...";
    btn.disabled = true;
    
    try {
        // Aciona a função lá no Supabase
        const { data, error } = await supabase.functions.invoke('robo-financeiro');
        
        if (error) throw error;
        
        alert("✅ " + data.message);
    } catch (err) {
        console.error("Falha:", err);
        alert("❌ Erro ao enviar os e-mails. Verifique o console.");
    } finally {
        btn.innerText = "🤖 FORÇAR DISPARO DE AVISOS";
        btn.disabled = false;
    }
});

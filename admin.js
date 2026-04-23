// Configurações do Supabase
const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 1. VERIFICAR ACESSO
async function verificarAcessoAdmin() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = "index.html";
        return;
    }
    const { data: perfil } = await supabase.from('perfis').select('cargo').eq('id', session.user.id).single();
    if (!perfil || perfil.cargo !== 'professor') {
        window.location.href = "painel.html";
        return;
    }
    carregarPendentes();
}

// 2. BUSCAR ALUNOS DEVENDO
async function carregarPendentes() {
    const lista = document.getElementById('lista-pendentes');
    const { data: mensalidades, error } = await supabase.from('mensalidades').select('*').eq('status', 'pendente');

    if (error) {
        lista.innerHTML = `<p style="color: #ff5252; text-align: center;">Erro ao buscar dados.</p>`;
        return;
    }

    if (mensalidades.length === 0) {
        lista.innerHTML = `<p style="color: #4CAF50; text-align: center; font-weight: bold; margin-top: 20px;">✅ Todos os alunos estão em dia!</p>`;
        return;
    }

    lista.innerHTML = ""; 
    for (const mens of mensalidades) {
        const { data: aluno } = await supabase.from('perfis').select('nome').eq('id', mens.aluno_id).single();
        const nomeAluno = aluno ? aluno.nome : "Aluno Desconhecido";

        lista.innerHTML += `
            <div style="background-color: #1c1f26; padding: 15px; border-radius: 12px; margin-bottom: 15px; border-left: 5px solid #ff5252; display: flex; flex-direction: column;">
                <p style="color: white; font-weight: bold; font-size: 16px; margin-bottom: 5px;">${nomeAluno}</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #aaaaaa; font-size: 14px;">Mês: ${mens.mes}</span>
                    <button onclick="darBaixa('${mens.id}')" style="background-color: #4CAF50; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">✅ Dar Baixa</button>
                </div>
            </div>
        `;
    }
}

// 3. FUNÇÃO DE DAR BAIXA
window.darBaixa = async function(idMensalidade) {
    const confirmacao = confirm("Tem certeza que deseja marcar como PAGO?");
    if (!confirmacao) return;

    const { error } = await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', idMensalidade);
    if (!error) {
        alert("Baixa realizada com sucesso! Oss!");
        window.location.reload(); 
    } else {
        alert("Erro ao dar baixa.");
    }
};

// 4. CADASTRAR NOVO ALUNO
document.getElementById('form-novo-aluno').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const btn = document.getElementById('btn-salvar-aluno');
    const msg = document.getElementById('msg-cadastro');
    const nome = document.getElementById('novo-nome').value;
    const email = document.getElementById('novo-email').value;
    const senha = document.getElementById('novo-senha').value;
    const faixa = document.getElementById('novo-faixa').value;

    btn.innerText = "⏳ Criando aluno...";
    msg.innerText = "";

    const { data: authData, error: authError } = await supabase.auth.signUp({ email: email, password: senha });

    if (authError) {
        msg.innerText = "❌ Erro: " + authError.message;
        msg.style.color = "#ff5252";
        btn.innerText = "💾 Salvar Aluno";
        return;
    }

    await supabase.from('perfis').insert([{ id: authData.user.id, nome: nome, faixa: faixa, cargo: 'aluno' }]);

    // Ao invés de criar a mensalidade fixa aqui, vamos deixar para o Gerador Automático fazer!
    msg.innerText = "✅ Aluno cadastrado com sucesso!";
    msg.style.color = "#4CAF50";
    btn.innerText = "💾 Salvar Aluno";
    document.getElementById('form-novo-aluno').reset();
});

// 5. GERADOR AUTOMÁTICO DE MENSALIDADES (A MÁGICA NOVA!)
document.getElementById('btn-gerar-mes').addEventListener('click', async () => {
    const mes = document.getElementById('mes-geral').value;
    const valor = document.getElementById('valor-geral').value;
    const btn = document.getElementById('btn-gerar-mes');
    const msg = document.getElementById('msg-gerador');

    if(!mes || !valor) {
        msg.innerText = "❌ Preencha o mês e o valor!";
        msg.style.color = "#ff5252";
        return;
    }

    btn.innerText = "⏳ Gerando...";
    msg.innerText = "";

    // A. Puxa TODOS os alunos do banco
    const { data: alunos, error: errAlunos } = await supabase
        .from('perfis')
        .select('id')
        .eq('cargo', 'aluno');

    if (errAlunos || !alunos || alunos.length === 0) {
        msg.innerText = "❌ Nenhum aluno encontrado para cobrar.";
        btn.innerText = "⚡ Gerar Cobranças";
        return;
    }

    // B. Prepara o pacote de cobranças (uma para cada aluno)
    const cobrancas = alunos.map(aluno => ({
        aluno_id: aluno.id,
        mes: mes,
        valor: valor,
        status: 'pendente'
    }));

    // C. Manda o pacote todo pro banco de dados de uma vez só!
    const { error: errInsert } = await supabase.from('mensalidades').insert(cobrancas);

    if (errInsert) {
        msg.innerText = "❌ Erro ao gerar.";
        msg.style.color = "#ff5252";
    } else {
        msg.innerText = `✅ Mensalidade gerada para ${alunos.length} alunos!`;
        msg.style.color = "#4CAF50";
        document.getElementById('mes-geral').value = ""; // Limpa o campo
        carregarPendentes(); // Atualiza a lista vermelha lá embaixo
    }

    btn.innerText = "⚡ Gerar Cobranças";
});

// 6. FUNÇÃO SAIR
document.getElementById('btn-sair').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

// Inicia tudo
verificarAcessoAdmin();

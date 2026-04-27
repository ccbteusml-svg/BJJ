const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.getElementById('form-cadastro').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const btn = document.getElementById('btn-cadastrar');
    const feedback = document.getElementById('msg-feedback');
    
    const nome = document.getElementById('cad-nome').value;
    const email = document.getElementById('cad-email').value;
    const senha = document.getElementById('cad-senha').value;
    const telefone = document.getElementById('cad-telefone').value.replace(/\D/g,'');
    const faixa = document.getElementById('cad-faixa').value || "Branca";

    btn.innerText = "Processando... 🥋";
    btn.disabled = true;
    feedback.innerText = "";

    // 1. Criar o usuário no Supabase Auth
    const { data, error: authError } = await supabase.auth.signUp({
        email: email,
        password: senha
    });

    if (authError) {
        feedback.style.color = "#E53935";
        feedback.innerText = "Erro: " + authError.message;
        btn.innerText = "FINALIZAR CADASTRO";
        btn.disabled = false;
        return;
    }

    // 2. Criar o perfil na tabela 'perfis' (Forçando cargo 'aluno')
    const { error: perfilError } = await supabase.from('perfis').insert([
        { 
            id: data.user.id, 
            nome: nome, 
            telefone: telefone, 
            faixa: faixa, 
            cargo: 'aluno' // Segurança: aqui o aluno nunca será professor por conta própria
        }
    ]);

    if (perfilError) {
        feedback.style.color = "#E53935";
        feedback.innerText = "Erro ao criar perfil. Contate o mestre.";
        btn.innerText = "FINALIZAR CADASTRO";
        btn.disabled = false;
    } else {
        feedback.style.color = "#4CAF50";
        feedback.innerText = "✅ Conta criada! Redirecionando...";
        
        // Pequena pausa para o aluno ver a mensagem de sucesso
        setTimeout(() => {
            window.location.href = "painel.html";
        }, 2000);
    }
});

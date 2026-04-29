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

    // Criando o Auth e já mandando os dados extras (metadados) para o Gatilho do banco de dados
    const { data, error: authError } = await supabase.auth.signUp({
        email: email,
        password: senha,
        options: {
            data: { 
                nome: nome,
                telefone: telefone,
                faixa: faixa
            }
        }
    });

    if (authError) {
        feedback.style.color = "#E53935";
        feedback.innerText = "Erro: " + authError.message;
        btn.innerText = "FINALIZAR CADASTRO";
        btn.disabled = false;
        return;
    }

    feedback.style.color = "#4CAF50";
    feedback.innerText = "✅ Conta criada com segurança! Redirecionando...";
    
    setTimeout(() => {
        window.location.href = "painel.html";
    }, 2000);
});

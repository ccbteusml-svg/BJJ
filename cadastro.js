// ==========================================
// 1.REDIRECIONA QUEM JÁ ESTÁ LOGADO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (window.supabase) {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            // Se já tem sessão, manda direto para o painel
            window.location.href = "painel.html";
        }
    }
});

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

    // ==========================================
    // 2.NOVA MENSAGEM: AVISO DE VALIDAÇÃO DE E-MAIL
    // ==========================================
    feedback.style.color = "#2196F3"; // Azul informativo
    feedback.innerHTML = `📩 <b>Quase lá, ${nome.split(' ')[0]}!</b><br>Enviamos um link para <b>${email}</b>. Acesse a sua caixa de entrada (ou lixo eletrônico) e confirme o seu e-mail para liberar o acesso.`;
    
    btn.innerText = "VERIFIQUE O SEU E-MAIL";
    
    // Manda o aluno de volta para a tela de Login depois de 5 segundos, 
    // pois ele precisa confirmar o e-mail antes de conseguir entrar no painel.
    setTimeout(() => {
        window.location.href = "index.html";
    }, 5000);
});


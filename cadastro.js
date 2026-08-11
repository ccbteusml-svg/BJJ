// ==========================================
// 1.REDIRECIONA QUEM JÁ ESTÁ LOGADO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (window.supabase) {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            window.location.href = "painel.html";
        }
    }
});

const formCadastro = document.getElementById('form-cadastro');
if (formCadastro) {
    formCadastro.addEventListener('submit', async function(event) {
        event.preventDefault();

        const btn = document.getElementById('btn-cadastrar');
        const feedback = document.getElementById('msg-feedback');

        const nome = document.getElementById('cad-nome').value;
        const email = document.getElementById('cad-email').value;
        const senha = document.getElementById('cad-senha').value;
        const telefone = document.getElementById('cad-telefone').value.replace(/\D/g,'');
        const faixa = document.getElementById('cad-faixa').value || "Branca";
        const nascimento = document.getElementById('cad-nascimento').value;

        if (btn) {
            btn.innerText = "Processando... 🥋";
            btn.disabled = true;
        }
        if (feedback) feedback.innerText = "";

        const { data, error: authError } = await window.supabase.auth.signUp({
            email: email,
            password: senha,
            options: {
                emailRedirectTo: window.location.origin + window.location.pathname.replace('cadastro.html', 'index.html'),
                data: { 
                    nome: nome,
                    telefone: telefone,
                    faixa: faixa,
                    data_nascimento: nascimento
                }
            }
        });

        if (authError) {
            if (feedback) {
                feedback.style.color = "#E53935";
                let motivoReal = authError.message || JSON.stringify(authError);
                feedback.textContent = "Bloqueio do Banco: " + motivoReal;
            }
            if (btn) {
                btn.innerText = "FINALIZAR CADASTRO";
                btn.disabled = false;
            }
            return;
        }

        if (feedback) {
            feedback.style.color = "#2196F3";
            const primeiroNome = escapeHtml(nome.split(' ')[0]);
            const safeEmail = escapeHtml(email);
            feedback.innerHTML = `📩 <b>Quase lá, ${primeiroNome}!</b><br>Enviamos um link para <b>${safeEmail}</b>. Acesse a sua caixa de entrada (ou lixo eletrônico) e confirme o seu e-mail para liberar o acesso.`;
        }
        if (btn) btn.innerText = "VERIFIQUE O SEU E-MAIL";

        setTimeout(() => {
            window.location.href = "index.html";
        }, 5000);
    });
}

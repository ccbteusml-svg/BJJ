// ==========================================
// 4L ACADEMY — CADASTRO (cadastro.js) — v13
// Correções mecânicas:
// - Validações reais (nome, e-mail, senha mín. 6, telefone, nascimento)
// - Anti double-submit já existia; agora com try/catch/finally completo
// - Checagem de erro/null em todas as chamadas Supabase
// - Trata o caso de signUp SEM confirmação de e-mail (sessão direta)
// - Aviso amigável quando offline
// - Redirect com location.replace (botão "voltar" não volta ao form travado)
// ==========================================

// Utilitário de escape (faltava no escopo do cadastro)
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ==========================================
// 1. REDIRECIONA QUEM JÁ ESTÁ LOGADO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.supabase) {
            const { data: { session }, error } = await window.supabase.auth.getSession();
            if (error) { console.warn('[CADASTRO] Erro ao ler sessão:', error); return; }
            if (session) {
                window.location.replace("painel.html");
            }
        }
    } catch (e) {
        console.warn('[CADASTRO] Exceção no auto-redirect:', e);
    }
});

const formCadastro = document.getElementById('form-cadastro');
if (formCadastro) {
    formCadastro.addEventListener('submit', async function(event) {
        event.preventDefault();

        const btn = document.getElementById('btn-cadastrar');
        const feedback = document.getElementById('msg-feedback');

        const nome = (document.getElementById('cad-nome').value || '').trim();
        const email = (document.getElementById('cad-email').value || '').trim();
        const senha = document.getElementById('cad-senha').value || '';
        const telefone = document.getElementById('cad-telefone').value.replace(/\D/g,'');
        const faixa = (document.getElementById('cad-faixa').value || '').trim() || "Branca";
        const nascimento = document.getElementById('cad-nascimento').value;

        const falhar = (msg) => {
            if (feedback) {
                feedback.style.color = "#E53935";
                feedback.textContent = msg;
            }
        };

        // ---------- VALIDAÇÕES ----------
        if (nome.length < 2) { falhar("Digite seu nome completo."); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { falhar("Digite um e-mail válido."); return; }
        if (senha.length < 6) { falhar("A senha precisa ter pelo menos 6 dígitos."); return; }
        if (telefone && telefone.length < 10) { falhar("Digite o WhatsApp com DDD (ex: 92999999999)."); return; }
        if (!nascimento || isNaN(new Date(nascimento).getTime())) { falhar("Informe sua data de nascimento."); return; }
        if (new Date(nascimento) > new Date()) { falhar("Data de nascimento não pode ser no futuro."); return; }
        if (!navigator.onLine) { falhar("Sem conexão com a internet. Verifique sua rede."); return; }

        // ---------- ANTI DOUBLE-SUBMIT ----------
        if (btn && btn.disabled) return;
        if (btn) {
            btn.innerText = "Processando... 🥋";
            btn.disabled = true;
        }
        if (feedback) feedback.innerText = "";

        try {
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
                console.error('[CADASTRO] Erro do Supabase:', authError);
                let motivoReal = authError.message || 'Erro desconhecido';
                if (/already registered|already exists/i.test(motivoReal)) {
                    motivoReal = "Este e-mail já possui cadastro. Faça login ou recupere a senha.";
                }
                falhar("Não foi possível cadastrar: " + motivoReal);
                return;
            }

            // Caso o projeto NÃO exija confirmação de e-mail, o signUp já retorna sessão
            if (data && data.session) {
                if (feedback) {
                    feedback.style.color = "#4CAF50";
                    feedback.textContent = "✅ Cadastro concluído! Entrando...";
                }
                window.location.replace("painel.html");
                return;
            }

            // Fluxo padrão: precisa confirmar o e-mail
            if (feedback) {
                feedback.style.color = "#2196F3";
                const primeiroNome = escapeHtml(nome.split(' ')[0]);
                const safeEmail = escapeHtml(email);
                feedback.innerHTML = `📩 <b>Quase lá, ${primeiroNome}!</b><br>Enviamos um link para <b>${safeEmail}</b>. Acesse a sua caixa de entrada (ou lixo eletrônico) e confirme o seu e-mail para liberar o acesso.`;
            }
            if (btn) btn.innerText = "VERIFIQUE O SEU E-MAIL";

            setTimeout(() => {
                window.location.replace("index.html");
            }, 5000);

        } catch (e) {
            console.error('[CADASTRO] Exceção:', e);
            falhar(navigator.onLine
                ? "Erro inesperado. Tente novamente."
                : "Sem conexão com a internet.");
        } finally {
            // Destrava o botão se ainda estivermos na página (no sucesso com redirect, a página troca)
            if (btn && document.contains(btn) && btn.innerText === "Processando... 🥋") {
                btn.innerText = "FINALIZAR CADASTRO";
                btn.disabled = false;
            }
        }
    });
}

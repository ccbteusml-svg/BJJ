// ==========================================
// 🚀 REDIRECIONAMENTO AUTOMÁTICO (ANTI-LOGIN REPETIDO)
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        console.log("Sessão ativa encontrada! Redirecionando...");
        
        const { data: perfil } = await supabase
            .from('perfis')
            .select('cargo')
            .eq('id', session.user.id)
            .single();

        if (perfil && perfil.cargo === 'professor') {
            window.location.href = "admin.html";
        } else {
            window.location.href = "painel.html";
        }
    }
});

console.log("Supabase conectado!", supabase);

// ==========================================
// 🕵️‍♂️ SENSOR: DETECTAR VOLTA DO E-MAIL DE SENHA (VISUAL PREMIUM)
// ==========================================
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    const { value: novaSenha } = await Swal.fire({
      title: 'Crie sua Nova Senha',
      text: 'Digite uma senha forte com pelo menos 6 dígitos.',
      input: 'password',
      background: '#161618', 
      color: '#ffffff',
      confirmButtonColor: '#E53935', 
      confirmButtonText: 'SALVAR SENHA',
      allowOutsideClick: false 
    });

    if (novaSenha) {
      Swal.fire({ title: 'Salvando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

      const { error } = await supabase.auth.updateUser({ password: novaSenha });

      if (error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: error.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
      } else {
        await Swal.fire({ icon: 'success', title: 'Oss! 🥋', text: 'Senha alterada com sucesso! Entre no app.', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
        
        await supabase.auth.signOut();
        window.location.href = "index.html"; 
      }
    }
  }
});

// ==========================================
// 1. CAPTURAR O ENVIO DO FORMULÁRIO DE LOGIN
// ==========================================
document.getElementById('form-login').addEventListener('submit', async function(event) {
    event.preventDefault(); 
    
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const botao = event.target.querySelector('button');
    
    botao.innerText = "Carregando...";
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
    });

    if (error) {
        console.error("Erro no login:", error);
        document.getElementById('msg-erro').innerText = "E-mail ou senha incorretos!";
        botao.innerText = "Entrar";
    } else {
        botao.innerText = "Verificando acesso... 🥋";
        
        const { data: perfil } = await supabase
            .from('perfis')
            .select('cargo')
            .eq('id', data.user.id)
            .single();
            
        if (perfil && perfil.cargo === 'professor') {
            window.location.href = "admin.html"; 
        } else {
            window.location.href = "painel.html"; 
        }
    }
});

// ==========================================
// 🔑 FUNÇÃO: SOLICITAR RECUPERAÇÃO DE SENHA (VISUAL PREMIUM)
// ==========================================
document.getElementById('btn-esqueci-senha').addEventListener('click', async () => {
    const { value: emailAluno } = await Swal.fire({
        title: 'Esqueceu a senha?',
        text: 'Digite seu e-mail para receber o link.',
        input: 'email',
        inputPlaceholder: 'Seu melhor e-mail',
        background: '#161618',
        color: '#ffffff',
        confirmButtonColor: '#E53935',
        confirmButtonText: 'ENVIAR LINK',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        cancelButtonColor: '#333'
    });
    
    if (!emailAluno) return; 

    Swal.fire({ title: 'Enviando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

    const { data, error } = await supabase.auth.resetPasswordForEmail(emailAluno, {
        redirectTo: window.location.href, 
    });

    if (error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: error.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
    } else {
        Swal.fire({ icon: 'success', title: 'Link Enviado! 🥋', text: 'Verifique a sua caixa de entrada (e a pasta de SPAM).', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
    }
});

// ==========================================
// 2. REGISTRAR O SERVICE WORKER (MODO OFFLINE)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso!', registration.scope);
            })
            .catch(error => {
                console.log('Falha ao registrar:', error);
            });
    });
}

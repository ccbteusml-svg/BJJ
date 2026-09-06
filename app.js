// ==========================================
// 4L ACADEMY — LOGIN (app.js) — v13
// Correções mecânicas:
// - Anti double-submit (botão desabilitado + trava de fluxo)
// - Try/catch/finally em todas as operações assíncronas
// - Sem race entre getSession e o submit (trava compartilhada)
// - Redirecionamentos com location.replace (botão "voltar" não fica em loop)
// - Validação de e-mail/senha com feedback claro
// - Checagem de erro/null em TODAS as chamadas Supabase
// - Recuperação de senha com validação de mínimo 6 dígitos
// - Aviso amigável quando offline
// ==========================================

// Trava global: impede que o auto-redirect e o submit compitam entre si
let _fluxoLoginOcupado = false;

const _msgErro = (txt) => {
    const el = document.getElementById('msg-erro');
    if (el) el.innerText = txt || '';
};

const _semInternet = () => {
    _msgErro("Sem conexão com a internet. Verifique sua rede e tente novamente.");
};

// Redireciona conforme o cargo (replace = não empilha no histórico)
async function _redirecionarPorCargo(userId) {
    const { data: perfil, error } = await supabase
        .from('perfis')
        .select('cargo')
        .eq('id', userId)
        .maybeSingle(); // maybeSingle: não lança erro se não houver linha

    if (error) console.warn('[LOGIN] Falha ao buscar cargo:', error);

    if (perfil && perfil.cargo === 'professor') {
        window.location.replace("admin.html");
    } else {
        window.location.replace("painel.html");
    }
}

// ==========================================
// 1. REDIRECIONAMENTO AUTOMÁTICO (ANTI-LOGIN REPETIDO)
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    // Se a pessoa estiver voltando do e-mail para trocar a senha, aborta o redirecionamento
    if (window.location.search.includes('type=recovery') || window.location.hash.includes('type=recovery')) {
        console.log("Recuperação de senha detectada. Aguardando o usuário digitar a nova senha...");
        return;
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.warn('[LOGIN] Erro ao ler sessão:', error);
            return; // Não redireciona nem quebra — deixa o usuário logar manualmente
        }

        if (session && !_fluxoLoginOcupado) {
            console.log("Sessão ativa encontrada! Redirecionando...");
            _fluxoLoginOcupado = true;
            await _redirecionarPorCargo(session.user.id);
        }
    } catch (e) {
        console.warn('[LOGIN] Exceção no auto-redirect:', e);
    }
});

// Toggle de visibilidade da senha
window.toggleSenha = function() {
    const input = document.getElementById('senha');
    if (!input) return;
    const btn = input.parentElement.querySelector('button[type="button"]');
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.innerText = '🙈';
    } else {
        input.type = 'password';
        if (btn) btn.innerText = '👁️';
    }
};

// ==========================================
// 2. SENSOR: DETECTAR VOLTA DO E-MAIL DE SENHA
// ==========================================
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    try {
        const { value: novaSenha } = await Swal.fire({
          title: 'Crie sua Nova Senha',
          text: 'Digite uma senha forte com pelo menos 6 dígitos.',
          input: 'password',
          background: '#161618',
          color: '#ffffff',
          confirmButtonColor: '#E53935',
          confirmButtonText: 'SALVAR SENHA',
          allowOutsideClick: false,
          // Validação real: impede salvar senha fraca/vazia
          inputValidator: (valor) => {
              if (!valor || valor.length < 6) {
                  return 'A senha precisa ter pelo menos 6 dígitos.';
              }
          }
        });

        if (!novaSenha) return;

        Swal.fire({ title: 'Salvando...', background: '#161618', color: '#fff', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

        const { error } = await supabase.auth.updateUser({ password: novaSenha });

        if (error) {
          Swal.fire({ icon: 'error', title: 'Erro', text: error.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        } else {
          await Swal.fire({ icon: 'success', title: 'Oss! 🥋', text: 'Senha alterada com sucesso! Entre no app.', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
          await supabase.auth.signOut();
          window.location.replace("index.html");
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro inesperado', text: 'Não foi possível salvar a nova senha. Tente novamente.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
    }
  }
});

// ==========================================
// 3. CAPTURAR O ENVIO DO FORMULÁRIO DE LOGIN
// ==========================================
const formLogin = document.getElementById('form-login');
if (formLogin) {
    formLogin.addEventListener('submit', async function(event) {
        event.preventDefault();

        const email = (document.getElementById('email').value || '').trim();
        const senha = document.getElementById('senha').value || '';
        const botao = event.target.querySelector('button[type="submit"]');

        // Validações com feedback claro
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            _msgErro("Digite um e-mail válido.");
            return;
        }
        if (senha.length < 6) {
            _msgErro("A senha precisa ter pelo menos 6 dígitos.");
            return;
        }
        if (!navigator.onLine) { _semInternet(); return; }

        // ANTI DOUBLE-SUBMIT: trava o fluxo e desabilita o botão
        if (_fluxoLoginOcupado) return;
        _fluxoLoginOcupado = true;
        _msgErro('');
        if (botao) {
            botao.disabled = true;
            botao.innerText = "Carregando...";
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: senha
            });

            if (error) {
                console.error("Erro no login:", error);
                _msgErro("E-mail ou senha incorretos!");
                return;
            }

            if (botao) botao.innerText = "Verificando acesso... 🥋";
            await _redirecionarPorCargo(data.user.id);
            // Se o redirect falhar silenciosamente, o finally destrava o botão

        } catch (e) {
            console.error("Exceção no login:", e);
            _msgErro(navigator.onLine
                ? "Erro inesperado. Tente novamente."
                : "Sem conexão com a internet.");
        } finally {
            // Só destrava se ainda estivermos na página de login
            _fluxoLoginOcupado = false;
            if (botao && document.contains(botao)) {
                botao.disabled = false;
                botao.innerText = "Entrar";
            }
        }
    });
}

// ==========================================
// 4. FUNÇÃO: SOLICITAR RECUPERAÇÃO DE SENHA
// ==========================================
const btnEsqueci = document.getElementById('btn-esqueci-senha');
if (btnEsqueci) {
    btnEsqueci.addEventListener('click', async () => {
        if (!navigator.onLine) { _semInternet(); return; }

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
            cancelButtonColor: '#333',
            inputValidator: (valor) => {
                if (!valor || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
                    return 'Digite um e-mail válido.';
                }
            }
        });

        if (!emailAluno) return;

        Swal.fire({ title: 'Enviando...', background: '#161618', color: '#fff', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(emailAluno, {
                redirectTo: window.location.origin + window.location.pathname,
            });

            if (error) {
                Swal.fire({ icon: 'error', title: 'Erro', text: error.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            } else {
                Swal.fire({ icon: 'success', title: 'Link Enviado! 🥋', text: 'Verifique a sua caixa de entrada (e a pasta de SPAM).', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Sem conexão', text: 'Não foi possível enviar o link. Verifique sua internet.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        }
    });
}

// ==========================================
// 5. REGISTRAR O SERVICE WORKER (MODO OFFLINE)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso!', registration.scope);
            })
            .catch(error => {
                console.log('Falha ao registrar:', error);
            });
    });
}

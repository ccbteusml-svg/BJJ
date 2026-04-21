const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; // (A sua chave real aqui)

// A alteração é nesta linha abaixo, usando 'var':
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("Supabase conectado!", supabase);


// 1. Capturar o envio do formulário (Note a palavra 'async' adicionada abaixo)
document.getElementById('form-login').addEventListener('submit', async function(event) {
    event.preventDefault(); 
    
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const botao = event.target.querySelector('button');
    
    botao.innerText = "Carregando...";
    console.log("Tentando logar com:", email);
    
    // Conexão REAL com o Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: senha
});

if (error) {
    console.error("Erro no login:", error);
    // Removemos o alert() e usamos o texto na tela:
    document.getElementById('msg-erro').innerText = "E-mail ou senha incorretos!";
    botao.innerText = "Entrar";
} else {
        console.log("Login de sucesso!", data);
        botao.innerText = "Entrando... 🥋";
        
        // Redireciona o usuário para a tela do painel logo após o login dar certo
        window.location.href = "painel.html"; 
    }
});


// 2. Registrar o Service Worker (Para liberar a instalação no celular)
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

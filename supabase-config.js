// supabase-config.js - Arquivo central de conexão com o banco de dados
const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';

// ⚠️ ATENÇÃO: Substitua pela chave ANON/PUBLIC real do seu projeto.
// A chave anônima do Supabase SEMPRE começa com 'eyJhbG...' (formato JWT).
// Dashboard → Project Settings → API → anon/public.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyY3Ria2dtenRpZWJsdWl5enlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTQwNjEsImV4cCI6MjA5MjI5MDA2MX0.jUkqO7lj4KylYEfoC3RU438X1c-JmHhsw-xQnWDhtSM'; 

if (!supabaseKey.startsWith('eyJ')) {
    console.error('[Supabase] ⚠️ A chave fornecida não está no formato JWT (eyJ...). A autenticação vai falhar.');
    console.error('[Supabase] Acesse o painel do Supabase → Project Settings → API → anon/public key e substitua a chave acima.');
}

// Cria a conexão e deixa ela disponível para o aplicativo inteiro
// ✅ Guarda: se o CDN do supabase-js falhar (offline/bloqueio), evita tela morta sem explicação
if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Supabase] Biblioteca supabase-js não carregou (CDN indisponível ou offline).');
    document.addEventListener('DOMContentLoaded', () => {
        const aviso = document.createElement('div');
        aviso.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#B71C1C;color:#fff;text-align:center;padding:12px;font-size:13px;font-weight:bold;z-index:999999;';
        aviso.textContent = '📡 Sem conexão com o servidor. Verifique sua internet e recarregue.';
        document.body.appendChild(aviso);
    });
} else {
    var supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,        // mantém o aluno logado entre aberturas do app
            autoRefreshToken: true,      // renova o token sozinho (evita sessão expirada no meio do uso)
            detectSessionInUrl: true     // necessário pro fluxo de recuperação de senha
        }
    });
}

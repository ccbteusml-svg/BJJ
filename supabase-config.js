// supabase-config.js - Arquivo central de conexão com o banco de dados
const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';

// Chave PÚBLICA (publishable) — formato novo do Supabase, começa com 'sb_publishable_'.
// É segura para ficar no código: quem protege os dados é o RLS do banco.
// Dashboard → Settings → API Keys → Publishable and secret API keys.
const supabaseKey = 'sb_publishable_eZE7qkEZ3R7lfgkR7Hrw7w_AOZdiyaA';

if (!supabaseKey.startsWith('sb_publishable_') && !supabaseKey.startsWith('eyJ')) {
    console.error('[Supabase] ⚠️ Chave em formato desconhecido. Use a publishable (sb_publishable_...) ou a anon antiga (eyJ...).');
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

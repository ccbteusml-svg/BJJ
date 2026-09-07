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
    // ✅ BLINDAGEM DE REDE: fetch customizado com TIMEOUT para TODAS as chamadas.
    // Sem isso, uma requisição em 3G ruim ficava pendurada para sempre e a tela
    // travava sem explicação. Dados: 15s. Upload de foto (storage): 30s.
    // O estouro gera AbortError → tratado como "erro de rede" pelos módulos.
    const _fetchComTimeout = (url, options = {}) => {
        const ehUpload = (typeof url === 'string' && url.includes('/storage/'));
        const timeoutMs = ehUpload ? 30000 : 15000;
        const ctrl = new AbortController();
        // Se a chamada original já tinha um signal, respeita o que disparar primeiro
        const signalOriginal = options.signal;
        if (signalOriginal) {
            if (signalOriginal.aborted) ctrl.abort();
            else signalOriginal.addEventListener('abort', () => ctrl.abort(), { once: true });
        }
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        return fetch(url, { ...options, signal: ctrl.signal })
            .finally(() => clearTimeout(t));
    };

    var supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,        // mantém o aluno logado entre aberturas do app
            autoRefreshToken: true,      // renova o token sozinho (evita sessão expirada no meio do uso)
            detectSessionInUrl: true     // necessário pro fluxo de recuperação de senha
        },
        global: { fetch: _fetchComTimeout } // timeout em banco, auth, storage e functions
    });
}

// supabase-config.js - Arquivo central de conexão com o banco de dados
const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
// ⚠️ WARNING: A chave abaixo NÃO está no formato JWT padrão do Supabase (eyJhbG...).
// Se a autenticação falhar, substitua pela chave anônima (anon/public) real do projeto.
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 

// Validação básica de formato para evitar erros silenciosos
if (!supabaseKey.startsWith('eyJ') && !supabaseKey.startsWith('sb_')) {
    console.error('[Supabase] ⚠️ A chave fornecida não está no formato JWT (eyJ...) nem no formato sb_. Isso pode causar falha de autenticação.');
    console.error('[Supabase] Acesse o painel do Supabase → Project Settings → API → anon/public key e substitua a chave acima.');
}

// Cria a conexão e deixa ela disponível para o aplicativo inteiro
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

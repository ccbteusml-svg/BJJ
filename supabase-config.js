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
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

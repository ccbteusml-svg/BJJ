// supabase-config.js - Arquivo central de conexão com o banco de dados
const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 

// Cria a conexão e deixa ela disponível para o aplicativo inteiro
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

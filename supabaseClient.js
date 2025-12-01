const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl ? 'OK' : 'FALTA');
console.log('Supabase Key:', supabaseKey ? 'OK (longitud: ' + supabaseKey.length + ')' : 'FALTA');

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Faltan variables de entorno de Supabase');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

module.exports = supabase;

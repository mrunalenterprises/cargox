// Copy these values into deployment-time window.__LOADIN_CONFIG__ before app.js loads.
// Never put a Supabase service-role key in browser code.
window.__LOADIN_CONFIG__ = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_PUBLIC_ANON_KEY',
  // Admin/Fleet privileged operations must go through a secured server/API.
  adminApiBase: 'https://api.example.com/loadin'
};

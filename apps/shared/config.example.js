// Copy these values into deployment-time window.__LOADIN_CONFIG__ before app.js loads.
// Never put a Supabase service-role key or payment secret in browser code.
window.__LOADIN_CONFIG__ = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_PUBLIC_ANON_KEY',
  // Browser Maps key must be HTTP-referrer restricted in Google Cloud.
  googleMapsApiKey: 'YOUR_RESTRICTED_BROWSER_MAPS_KEY',
  // Only public/client payment identifiers belong here. Secret keys stay server-side.
  paymentProvider: 'UNSET',
  paymentPublicKey: 'YOUR_PAYMENT_PUBLIC_KEY',
  // Admin/Fleet privileged operations must go through a secured server/API.
  adminApiBase: 'https://api.example.com/loadin'
};

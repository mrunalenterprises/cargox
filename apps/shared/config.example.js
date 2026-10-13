// Copy these values into deployment-time window.__LOADIN_CONFIG__ before app.js loads.
// Never put a Supabase service-role key, Firebase service-account private key, or payment secret in browser code.
window.__LOADIN_CONFIG__ = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_PUBLIC_ANON_KEY',
  // Browser Maps key must be HTTP-referrer restricted in Google Cloud.
  googleMapsApiKey: 'YOUR_RESTRICTED_BROWSER_MAPS_KEY',
  // Firebase Web config + VAPID key are public client configuration. FCM service-account credentials stay server-side.
  firebaseConfig: {
    apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.firebasestorage.app',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_FIREBASE_APP_ID'
  },
  firebaseVapidKey: 'YOUR_PUBLIC_WEB_PUSH_VAPID_KEY',
  firebaseSdkVersion: '10.14.1',
  // Only public/client payment identifiers belong here. Provider secrets stay in services/payment-worker.
  paymentProvider: 'RAZORPAY',
  paymentPublicKey: 'YOUR_PAYMENT_PUBLIC_KEY',
  paymentApiBase: 'https://payments.example.com/loadin',
  // Admin/Fleet privileged operations must go through a secured server/API.
  adminApiBase: 'https://api.example.com/loadin'
};

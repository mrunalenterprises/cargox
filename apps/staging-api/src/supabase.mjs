import { createClient } from '@supabase/supabase-js';

export function stagingConfig(env = process.env) {
  if (env.CARGOX_ENV !== 'staging') throw new Error('CARGOX_ENV=staging is required; demo fallback is forbidden');
  const ref = env.CARGOX_STAGING_PROJECT_REF;
  if (!/^[a-z]{20}$/.test(ref ?? '')) throw new Error('Set the approved isolated staging project reference');
  const url = new URL(env.SUPABASE_URL);
  if (url.href !== `https://${ref}.supabase.co/`) throw new Error('Supabase origin must match the approved staging reference');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY ?? '')) throw new Error('A publishable key is required; privileged keys are forbidden');
  if (env.SUPABASE_SERVICE_ROLE_KEY || env.DATABASE_URL) throw new Error('This adapter must not hold database-owner or service-role credentials');
  const port = Number(env.PORT ?? 4180);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || [3001,4173,4174].includes(port)) throw new Error('Use a separate staging API port');
  return { url: url.origin, publishableKey: env.SUPABASE_PUBLISHABLE_KEY, port };
}

// Each request owns its Auth client. No session persistence or shared refresh state.
export function supabaseAdapter(config, factory = createClient) {
  const client = token => factory(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {}, fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(7000) }) },
  });
  const unwrap = ({ data, error }) => { if (error) throw error; return data; };
  return {
    async authenticate(token) {
      const { user } = unwrap(await client().auth.getUser(token));
      if (!user || user.is_anonymous || !user.phone_confirmed_at) throw new Error('Unverified identity');
      return { id: user.id, token };
    },
    async requestOtp(phone, captchaToken) {
      unwrap(await client().auth.signInWithOtp({ phone, options: { captchaToken, shouldCreateUser: true } }));
    },
    async verifyOtp(phone, token) {
      const { session } = unwrap(await client().auth.verifyOtp({ phone, token, type: 'sms' }));
      if (!session) throw new Error('No authenticated session');
      return { access_token: session.access_token, refresh_token: session.refresh_token,
        expires_in: session.expires_in, token_type: session.token_type };
    },
    async rpc(actor, name, params) { return unwrap(await client(actor.token).rpc(name, params)); },
    async read(actor, table) {
      // Table names originate only in the server's fixed route table, never the URL.
      return unwrap(await client(actor.token).from(table).select('*').limit(100));
    },
  };
}

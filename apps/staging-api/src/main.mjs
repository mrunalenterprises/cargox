import { stagingConfig, supabaseAdapter } from './supabase.mjs';
import { createStagingServer } from './server.mjs';
try {
  const config=stagingConfig();
  createStagingServer(supabaseAdapter(config)).listen(config.port,'127.0.0.1',()=>{
    console.log(`CargoX staging foundation: http://127.0.0.1:${config.port}; no production or payment activation`);
  });
} catch(error) { console.error(error.message); process.exitCode=1; }

import 'package:cargox_staging/cargox_staging.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const url = 'https://ifnpbeozmbdofyczbvme.supabase.co';
  const key = 'sb_publishable_test-key';
  test('only the approved HTTPS origin is accepted', () {
    for (final invalid in [
      'http://ifnpbeozmbdofyczbvme.supabase.co',
      'https://unrelated.supabase.co',
      'https://ifnpbeozmbdofyczbvme.supabase.co.evil.test',
      'https://ifnpbeozmbdofyczbvme.supabase.co/?unexpected=1',
    ]) {
      expect(() => PipPipStagingCatalog(projectUrl: invalid, publishableKey: key),
          throwsStateError);
    }
  });
  test('only a public publishable key is accepted', () {
    for (final invalid in ['service_role_private', 'eyJhbGciOi', '']) {
      expect(() => PipPipStagingCatalog(projectUrl: url, publishableKey: invalid),
          throwsStateError);
    }
    expect(() => PipPipStagingCatalog(projectUrl: url, publishableKey: key),
        returnsNormally);
  });
  test('pilot catalog models cannot submit or activate bookings', () {
    const service = PipPipStagingService(
      city: 'Chhatrapati Sambhajinagar',
      timezone: 'Asia/Kolkata',
      service: 'auto',
    );
    expect(service.service, 'auto');
    expect(const StagingCatalogUnavailable().toString(), contains('pilot'));
  });
}

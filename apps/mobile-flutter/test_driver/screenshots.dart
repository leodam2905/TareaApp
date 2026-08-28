// Host side of the App Store screenshot run.
//
// integration_test's takeScreenshot does not work on iOS — every call returns
// the same cached frame, so a seven-screen run produced seven identical PNGs of
// the splash. What DOES work is the synchronisation it provides: the device
// blocks inside takeScreenshot until this callback returns, so the app is
// guaranteed to be sitting on the right screen while we capture.
//
// So the bytes it hands us are discarded, and the real capture is a simulator
// screenshot taken here on the host, which sees the actual rendered surface.
import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';

const _sim = String.fromEnvironment('SIM_UDID',
    defaultValue: '1B8F43E7-0659-47AC-A59D-FFF759BC8466');

Future<void> main() async {
  final dir = Directory('build/screenshots')..createSync(recursive: true);
  await integrationDriver(
    onScreenshot: (String name, List<int> _, [Map<String, Object?>? args]) async {
      final out = '${dir.path}/$name.png';
      final r = await Process.run('xcrun', ['simctl', 'io', _sim, 'screenshot', out]);
      if (r.exitCode != 0) {
        stderr.writeln('  FAILED $name: ${r.stderr}');
        return false;
      }
      final kb = File(out).lengthSync() ~/ 1024;
      stdout.writeln('  captured $name.png ($kb KB)');
      return true;
    },
  );
}

// Host side of the App Store screenshot run.
//
// The device sends PNG bytes; this writes them where the upload script can
// find them. Kept separate from the test so the test never needs dart:io.
import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  final dir = Directory('build/screenshots')..createSync(recursive: true);
  await integrationDriver(
    onScreenshot: (String name, List<int> bytes, [Map<String, Object?>? args]) async {
      File('${dir.path}/$name.png').writeAsBytesSync(bytes);
      stdout.writeln('  saved $name.png (${(bytes.length / 1024).round()} KB)');
      return true;
    },
  );
}

import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme.dart';
import 'main.dart' show appRouter;
import 'screens/pro/pro_shell.dart';

/// Drives the DoorDash-style "ring until answered" experience for an incoming
/// job request. Only used when the pro is Online AND the app is in the
/// foreground — otherwise the request just chimes as a normal notification.
class IncomingJobRing {
  static final AudioPlayer _player = AudioPlayer(playerId: 'job_ring');
  static bool _ringing = false;
  static Timer? _autoStop;
  static Timer? _buzz;
  static bool _audioConfigured = false;

  static Future<void> _configureAudio() async {
    if (_audioConfigured) return;
    try {
      await AudioPlayer.global.setAudioContext(
        AudioContext(
          // iOS: playback category so the ring is audible even when the
          // physical mute switch is on (like a real incoming call).
          iOS: AudioContextIOS(
            category: AVAudioSessionCategory.playback,
            options: const {AVAudioSessionOptions.duckOthers},
          ),
          // Android: treat it as a notification ringtone so it plays loud and
          // keeps the CPU awake while ringing.
          android: AudioContextAndroid(
            isSpeakerphoneOn: false,
            stayAwake: true,
            contentType: AndroidContentType.sonification,
            usageType: AndroidUsageType.notificationRingtone,
            audioFocus: AndroidAudioFocus.gainTransientMayDuck,
          ),
        ),
      );
      _audioConfigured = true;
    } catch (_) {}
  }

  /// Begin ringing and present the full-screen incoming-job screen.
  static Future<void> start(Map<String, dynamic> data) async {
    if (_ringing) return;
    _ringing = true;
    try {
      await _configureAudio();
      await _player.setReleaseMode(ReleaseMode.loop);
      await _player.setVolume(1.0);
      await _player.play(AssetSource('sounds/job_ring.mp3'));
    } catch (_) {}
    _startVibration();

    // Safety valve: never ring forever if the pro walks away.
    _autoStop?.cancel();
    _autoStop = Timer(const Duration(seconds: 45), stop);

    try {
      appRouter.push('/pro/incoming', extra: data);
    } catch (_) {}
  }

  static void _startVibration() {
    // Repeated haptic buzz while ringing (built-in — no extra plugin/minSdk).
    _buzz?.cancel();
    HapticFeedback.heavyImpact();
    _buzz = Timer.periodic(const Duration(milliseconds: 1500), (_) {
      HapticFeedback.heavyImpact();
    });
  }

  /// Stop the sound + haptics. Safe to call multiple times.
  static Future<void> stop() async {
    _ringing = false;
    _autoStop?.cancel();
    _autoStop = null;
    _buzz?.cancel();
    _buzz = null;
    try {
      await _player.stop();
    } catch (_) {}
  }
}

/// Full-screen incoming-job UI with Accept / Decline, shown while ringing.
class IncomingJobScreen extends StatelessWidget {
  final Map<String, dynamic> data;
  const IncomingJobScreen({super.key, required this.data});

  String get _title => (data['title'] ?? 'New Job Request').toString();
  String get _body =>
      (data['body'] ?? 'A customer requested you for a job').toString();

  Future<void> _dismiss(BuildContext context) async {
    await IncomingJobRing.stop();
    if (context.mounted && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Don't let the back button silently leave the call ringing.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _dismiss(context);
      },
      child: Scaffold(
        backgroundColor: C.ink,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: Column(
              children: [
                const SizedBox(height: 24),
                const Text('Incoming Job',
                    style: TextStyle(
                        color: Colors.white70,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5)),
                const SizedBox(height: 40),
                const _PulseAvatar(),
                const SizedBox(height: 28),
                Text(_title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w900)),
                const SizedBox(height: 12),
                Text(_body,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70, fontSize: 16)),
                const Spacer(),
                Row(
                  children: [
                    Expanded(
                      child: _ActionButton(
                        label: 'Decline',
                        icon: Icons.close,
                        color: const Color(0xFFEF4444),
                        onTap: () => _dismiss(context),
                      ),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: _ActionButton(
                        label: 'Accept',
                        icon: Icons.check,
                        color: const Color(0xFF16A34A),
                        onTap: () async {
                          await IncomingJobRing.stop();
                          if (context.mounted && Navigator.of(context).canPop()) {
                            Navigator.of(context).pop();
                          }
                          // Land the pro on the Find Jobs tab to act on it.
                          Future.delayed(const Duration(milliseconds: 200),
                              () => ProShell.go?.call(1));
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PulseAvatar extends StatefulWidget {
  const _PulseAvatar();
  @override
  State<_PulseAvatar> createState() => _PulseAvatarState();
}

class _PulseAvatarState extends State<_PulseAvatar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(seconds: 1))
        ..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) {
        final t = _c.value;
        return Container(
          width: 140,
          height: 140,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: C.blue.withOpacity(0.15 + 0.15 * t),
          ),
          child: Center(
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(color: C.blue.withOpacity(0.4), blurRadius: 24, spreadRadius: 2),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Image.asset('assets/images/icon-pro.png', fit: BoxFit.contain),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _ActionButton(
      {required this.label,
      required this.icon,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            Icon(icon, color: Colors.white, size: 28),
            const SizedBox(height: 6),
            Text(label,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}

import 'dart:async' show Completer;

import 'package:flutter/material.dart';

import '../flavor.dart';

/// The animated launch screen: the logo settles in, then the app name types
/// itself out a letter at a time.
///
/// This is a FLUTTER screen, not the native splash, because a native launch
/// screen cannot animate -- iOS LaunchScreen.storyboard is a static image by
/// design and Android 12's splash API allows a brief icon animation, not typed
/// text. So the sequence is: native splash (static, one frame) -> this -> app.
///
/// It costs no extra waiting. bootstrap() already held the native splash for a
/// three second MINIMUM, which was dead time on a fast device; that hold is now
/// spent on this instead. The ground colour matches the native splash exactly
/// (#263238 home, #FFFFFF pro), so the hand-over is invisible -- get those out
/// of step and the app appears to flash on every launch.
/// How long the whole sequence runs. Every interval below is a FRACTION of
/// this, so changing it here re-paces the logo, the typing and the bar together
/// -- they cannot drift out of step.
const Duration _kDuration = Duration(milliseconds: 5000);

/// The artwork for this flavour's launch screen.
///
/// Top-level because bootstrap() has to decode it BEFORE it takes the native
/// splash down. Decoding a 2MB PNG is not instant, and the first Flutter frame
/// paints whether or not the picture is ready -- so without that warm-up the
/// user gets one bare frame of ground colour with the progress bar floating on
/// it, between the native splash and the artwork.
String splashBackdropAsset() => isPro
    ? 'assets/images/splash-pro-backdrop.png'
    : 'assets/images/splash-home-backdrop.png';

class AnimatedSplash extends StatefulWidget {
  const AnimatedSplash({super.key, required this.onDone});

  /// Called once the animation has finished AND faded out.
  final VoidCallback onDone;

  @override
  State<AnimatedSplash> createState() => _AnimatedSplashState();
}

class _AnimatedSplashState extends State<AnimatedSplash>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _exitFade;
  late final Animation<double> _progress;
  bool _ready = false;


  // "Tarea Home" / "Tarea Pro" -- deliberately NOT translated. It is the app's
  // name in the stores, and a name is not a string to localise.


  // Matches the top band of each artwork AND the native launch background,
  // so launch -> picture is one continuous colour with no flash between.
  Color get _ground => isPro ? const Color(0xFFCCE8FD) : const Color(0xFFFBFAF9);
  String get _logo => isPro
      ? 'assets/images/splash-pro-logo.png'
      : 'assets/images/splash-home-white-logo.png';


  /// Full-bleed photograph behind everything, when one exists. Drop a file at
  /// this path and it appears; until then the flat ground shows and nothing
  /// breaks. errorBuilder rather than a bundled placeholder, so a missing photo
  /// degrades to the design we already have instead of a broken-image box.
  // Measured from the artwork: the baked bar occupies these fractions of the
  // image. The live bar is drawn exactly over it, so the static one is covered
  // rather than sitting alongside a second copy.
  // Both artworks put the bar at the same height, but NOT the same width --
  // measured, not assumed: Home 0.205..0.838, Pro 0.158..0.782. Sharing one
  // constant would have left Pro's live bar visibly offset from its painted one.
  static const _barTop = 0.9447, _barBottom = 0.9526;
  double get _barLeft  => isPro ? 0.1581 : 0.2051;
  double get _barRight => isPro ? 0.7821 : 0.8376;
  Color get _barFill  => isPro ? const Color(0xFFFC6122) : const Color(0xFFFD6629);
  Color get _barTrack => isPro ? const Color(0xFFC3B9B5) : const Color(0xFFADB0B8);

  String get _backdrop => splashBackdropAsset();

  /// Completes once the backdrop is decoded and in the image cache -- or on
  /// error, so a missing asset falls through to the errorBuilder rather than
  /// hanging the launch screen forever.
  Future<void> _awaitArtwork() {
    final completer = Completer<void>();
    final stream = AssetImage(_backdrop).resolve(ImageConfiguration.empty);
    late final ImageStreamListener listener;
    void finish() {
      stream.removeListener(listener);
      if (!completer.isCompleted) completer.complete();
    }

    listener = ImageStreamListener((_, _) => finish(), onError: (_, _) => finish());
    stream.addListener(listener);
    return completer.future;
  }

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: _kDuration);

    // 0.86-1.00  the whole thing fades to reveal the app underneath
    // Fills the way an upload does -- quick off the mark, easing as it closes.
    // Linear reads as a countdown; this reads as work being done.
    _progress = CurvedAnimation(
      parent: _c,
      curve: const Interval(0.04, 0.94, curve: Curves.easeOutCubic),
    );
    _exitFade = Tween(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _c, curve: const Interval(0.86, 1.0, curve: Curves.easeIn)),
    );

    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed) widget.onDone();
    });

    // Do not start until the picture can actually be painted. The bar is drawn
    // ON the artwork -- start the clock before the PNG is decoded and the first
    // frames put a bar on bare ground, which is the one thing this screen must
    // never show. A frame of plain ground is fine: it is the exact colour the
    // native splash was already showing, so it is invisible.
    _awaitArtwork().then((_) {
      if (!mounted) return;
      setState(() => _ready = true);
      _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Someone who asked for less motion gets the finished frame, held for the
    // same beat, rather than a logo springing at them.
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    // Ground only, matching the native splash exactly, so this frame cannot be
    // told apart from the one already on screen.
    if (!_ready) return Material(color: _ground);

    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        return Opacity(
          opacity: reduced ? 1.0 : _exitFade.value,
          child: Material(
            color: _ground,
            // The supplied artwork IS the splash. It already carries the logo,
            // the headline, the bar and the loading line, so nothing is drawn
            // over it -- anything added here would be a second copy of
            // something already in the picture.
            child: LayoutBuilder(
              builder: (context, box) {
                final w = box.maxWidth, h = box.maxHeight;
                return Stack(
                  children: [
                    Positioned.fill(
                      child: Image.asset(
                        _backdrop,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Center(
                          child: Image.asset(_logo, width: 200, fit: BoxFit.contain),
                        ),
                      ),
                    ),
                    // The live bar, laid exactly over the painted one.
                    Positioned(
                      left: w * _barLeft,
                      width: w * (_barRight - _barLeft),
                      top: h * _barTop,
                      height: h * (_barBottom - _barTop),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(h * (_barBottom - _barTop) / 2),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            ColoredBox(color: _barTrack),
                            FractionallySizedBox(
                              alignment: AlignmentDirectional.centerStart,
                              widthFactor: reduced ? 1.0 : _progress.value.clamp(0.0, 1.0),
                              child: ColoredBox(color: _barFill),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }
}

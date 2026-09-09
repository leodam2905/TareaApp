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
  late final Animation<double> _logoFade;
  late final Animation<double> _logoScale;
  late final Animation<int> _typed;
  late final Animation<double> _exitFade;

  // "Tarea Home" / "Tarea Pro" -- deliberately NOT translated. It is the app's
  // name in the stores, and a name is not a string to localise.
  String get _word => isPro ? 'Tarea Pro' : 'Tarea Home';

  Color get _ground => isPro ? const Color(0xFFFFFFFF) : const Color(0xFF263238);
  Color get _ink => isPro ? const Color(0xFF263238) : Colors.white;
  String get _logo => isPro
      ? 'assets/images/splash-pro-logo.png'
      : 'assets/images/splash-home-white-logo.png';

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2300));

    // 0.00-0.26  logo fades and settles
    _logoFade = CurvedAnimation(parent: _c, curve: const Interval(0.0, 0.26, curve: Curves.easeOut));
    _logoScale = Tween(begin: 0.86, end: 1.0).animate(
      CurvedAnimation(parent: _c, curve: const Interval(0.0, 0.32, curve: Curves.easeOutBack)),
    );
    // 0.30-0.74  the word types itself
    _typed = StepTween(begin: 0, end: _word.length).animate(
      CurvedAnimation(parent: _c, curve: const Interval(0.30, 0.74, curve: Curves.linear)),
    );
    // 0.86-1.00  the whole thing fades to reveal the app underneath
    _exitFade = Tween(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _c, curve: const Interval(0.86, 1.0, curve: Curves.easeIn)),
    );

    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed) widget.onDone();
    });
    _c.forward();
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

    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final shown = reduced ? _word : _word.substring(0, _typed.value);
        return Opacity(
          opacity: reduced ? 1.0 : _exitFade.value,
          child: Container(
            color: _ground,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Opacity(
                    opacity: reduced ? 1.0 : _logoFade.value,
                    child: Transform.scale(
                      scale: reduced ? 1.0 : _logoScale.value,
                      child: Image.asset(_logo, width: 200, fit: BoxFit.contain),
                    ),
                  ),
                  const SizedBox(height: 22),
                  // A fixed-height row so the column does not jump as characters
                  // arrive, and the caret sits inline so the text does not shift
                  // sideways when it disappears.
                  SizedBox(
                    height: 30,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          shown,
                          style: TextStyle(
                            color: _ink,
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.4,
                          ),
                        ),
                        if (!reduced && _typed.value < _word.length)
                          Container(
                            width: 2,
                            height: 22,
                            margin: const EdgeInsets.only(left: 3),
                            color: _ink.withValues(alpha: 0.75),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

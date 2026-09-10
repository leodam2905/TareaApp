
import 'package:flutter/material.dart';

import '../theme.dart';

/// The notifications bell, with the unread count on it.
///
/// It rings when — and only when — something is unread. A bell that moves all
/// the time is wallpaper: the eye stops reporting it after the first minute,
/// and then it cannot say anything when it matters. So the shake is tied to
/// [count] and stops the moment the count reaches zero.
///
/// It also rings in bursts rather than continuously. A constant wobble reads as
/// a broken animation; a short shake every few seconds reads as a bell being
/// struck, which is the thing being imitated.
class UnreadBell extends StatefulWidget {
  const UnreadBell({super.key, required this.count});

  final int count;

  @override
  State<UnreadBell> createState() => _UnreadBellState();
}

class _UnreadBellState extends State<UnreadBell>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _swing;

  /// One shake, then a rest. The shake is the first ~22% of the cycle, so at
  /// 3.6s that is a 0.8s ring followed by nearly three seconds of stillness.
  static const _cycle = Duration(milliseconds: 3600);

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: _cycle);
    // Decaying swing: each arc smaller than the last, like a struck bell
    // losing energy. A symmetric sine would read as a metronome instead.
    _swing = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 0.22), weight: 4),
      TweenSequenceItem(tween: Tween(begin: 0.22, end: -0.17), weight: 6),
      TweenSequenceItem(tween: Tween(begin: -0.17, end: 0.11), weight: 5),
      TweenSequenceItem(tween: Tween(begin: 0.11, end: -0.06), weight: 4),
      TweenSequenceItem(tween: Tween(begin: -0.06, end: 0.0), weight: 3),
      TweenSequenceItem(tween: ConstantTween(0.0), weight: 78),
    ]).animate(CurvedAnimation(parent: _c, curve: Curves.linear));
    _sync();
  }

  @override
  void didUpdateWidget(covariant UnreadBell old) {
    super.didUpdateWidget(old);
    if ((old.count > 0) != (widget.count > 0)) _sync();
  }

  /// Run only while something is unread, and always come to rest upright --
  /// stopping mid-swing would leave the bell permanently crooked.
  void _sync() {
    if (widget.count > 0) {
      if (!_c.isAnimating) _c.repeat();
    } else {
      _c
        ..stop()
        ..value = 0;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.count;
    // Someone who asked for less motion gets the badge and nothing else --
    // the count already carries the whole message.
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    Widget bell = Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(color: C.surface, shape: BoxShape.circle),
      child: Icon(n > 0 ? Icons.notifications : Icons.notifications_none,
          color: C.ink, size: 22),
    );

    if (n > 0 && !reduced) {
      bell = AnimatedBuilder(
        animation: _swing,
        // Pivot at the crown, where a bell actually hangs. Rotating about the
        // centre makes it orbit rather than swing.
        builder: (_, child) => Transform.rotate(
          angle: _swing.value,
          alignment: const Alignment(0, -0.75),
          child: child,
        ),
        child: bell,
      );
    }

    return Stack(clipBehavior: Clip.none, children: [
      bell,
      if (n > 0)
        Positioned(
          right: -2,
          top: -2,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            constraints: const BoxConstraints(minWidth: 18),
            decoration: BoxDecoration(
              color: C.red,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: C.white, width: 1.5),
            ),
            child: Text(
              // Past 99 the exact number stops meaning anything, and stops fitting.
              n > 99 ? '99+' : '$n',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  height: 1.2),
            ),
          ),
        ),
    ]);
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../theme.dart';

/// A Pro dashboard stat, in the style of the supplied artwork.
///
/// The artwork arrived with its numbers painted in -- 4.9 stars from 32
/// reviews, 24 jobs done, $1,280 earned. Shipping that would show every pro
/// the same invented figures, so only the ILLUSTRATION is taken from the
/// image and everything that states a fact is drawn from live state.
class ProStatCard extends StatefulWidget {
  const ProStatCard({
    super.key,
    required this.index,
    required this.tint,
    required this.accent,
    required this.icon,
    required this.value,
    required this.title,
    required this.sub,
    required this.onTap,
    this.art,
    this.stars,
    this.masked = false,
    this.onToggleMask,
  });

  final int index;
  final Color tint;
  final Color accent;
  final IconData icon;
  final String value;
  final String title;
  final String sub;
  final VoidCallback onTap;

  /// The 3D object cropped out of the source image, on its own tint. Null for
  /// the rating card, which draws stars instead.
  final String? art;

  /// Rating out of 5, when this card should show stars.
  final double? stars;

  /// Whether the figure is currently masked, and how to flip it. Null means
  /// this card has nothing worth hiding.
  final bool masked;
  final VoidCallback? onToggleMask;

  @override
  State<ProStatCard> createState() => _ProStatCardState();
}

class _ProStatCardState extends State<ProStatCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    Widget card = AnimatedScale(
      scale: _down && !reduced ? 0.96 : 1.0,
      duration: Duration(milliseconds: _down ? 110 : 300),
      curve: _down ? Curves.easeOut : Curves.easeOutBack,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 146,
        decoration: BoxDecoration(
          color: widget.tint,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: _down ? 0.04 : 0.09),
              blurRadius: _down ? 5 : 16,
              offset: Offset(0, _down ? 2 : 6),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Stack(
            children: [
              // Text and art share a Row rather than being stacked. Absolute
              // positioning ran the illustration to the full card height, so
              // the rounded corners clipped its top and bottom -- and nothing
              // stopped it sliding under the numbers.
              Row(
                children: [
                  Expanded(child: _body()),
                  if (widget.art != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(0, 12, 12, 12),
                      child: Image.asset(widget.art!, fit: BoxFit.contain,
                          errorBuilder: (_, _, _) => const SizedBox.shrink()),
                    ),
                  if (widget.stars != null)
                    Padding(
                      padding: const EdgeInsets.only(right: 14),
                      child: _stars(widget.stars!),
                    ),
                ],
              ),
              Positioned(
                right: 12, bottom: 8,
                child: Icon(Icons.chevron_right, color: C.muted.withValues(alpha: 0.7), size: 22),
              ),
            ],
          ),
        ),
      ),
    );

    if (!reduced) {
      card = TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.0, end: 1.0),
        duration: Duration(milliseconds: 520 + widget.index * 150),
        curve: Curves.easeOutCubic,
        builder: (_, t, child) {
          final start = widget.index * 0.16;
          final p = ((t - start) / (1 - start)).clamp(0.0, 1.0);
          return Opacity(
            opacity: p,
            child: Transform.translate(offset: Offset(0, (1 - p) * 24), child: child),
          );
        },
        child: card,
      );
    }

    return Semantics(
      button: true,
      label: '${widget.title}. ${widget.value} ${widget.sub}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapUp: (_) => setState(() => _down = false),
        onTapCancel: () => setState(() => _down = false),
        onTap: widget.onTap,
        child: card,
      ),
    );
  }

  Widget _body() => Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 8, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  // Top, not centred. The column was centred in the card, so
                  // the title sat in the middle of the block rather than at
                  // the card's top edge.
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    // Title leads: it says what the card is about before the
                    // number does. It gets the column's full width rather than
                    // sharing a row with the icon, so "Earnings Overview" is
                    // not squeezed into whatever the icon leaves behind.
                    Text(widget.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w900, color: C.ink)),
                    // Enough air that the title reads as a heading over the
                    // card rather than as the first line of the number block.
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Container(
                          width: 34, height: 34,
                          decoration: BoxDecoration(color: widget.accent, shape: BoxShape.circle),
                          child: Icon(widget.icon, color: Colors.white, size: 19),
                        ),
                        const SizedBox(width: 10),
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text(widget.value,
                                style: const TextStyle(
                                    fontSize: 28, fontWeight: FontWeight.w900, color: C.ink, height: 1.05)),
                          ),
                        ),
                        if (widget.onToggleMask != null)
                          // Its own gesture detector, so tapping the eye does
                          // not also open Earnings behind it.
                          //
                          // It sits on a filled disc rather than floating as a
                          // bare outline. At 20px beside a 28px bold number an
                          // unadorned icon reads as decoration -- legible, but
                          // not obviously a thing you can press, which is the
                          // same as not being there.
                          GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: widget.onToggleMask,
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(8, 4, 0, 4),
                              child: Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  color: widget.accent.withValues(alpha: 0.14),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  widget.masked ? Icons.visibility_off : Icons.visibility,
                                  size: 19,
                                  color: widget.accent,
                                  semanticLabel: widget.masked
                                      ? 'pro.showEarnings'.tr()
                                      : 'pro.hideEarnings'.tr(),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(widget.sub,
                        maxLines: 2,
                        style: const TextStyle(
                            fontSize: 12.5, height: 1.2, color: C.muted, fontWeight: FontWeight.w600)),
                  ],
                ),
              );

  /// Five stars, filled to the real rating -- half a star where the average
  /// lands between two whole ones.
  Widget _stars(double r) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (int i = 1; i <= 5; i++)
            Icon(
              r >= i
                  ? Icons.star
                  : (r >= i - 0.5 ? Icons.star_half : Icons.star_border),
              size: 26,
              color: const Color(0xFFFBBF24),
            ),
        ],
      );
}

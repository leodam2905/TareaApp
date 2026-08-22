/// The on-site job clock, computed the same way in both apps.
///
/// The customer and the pro look at the same job, so they must see the same
/// number. That only holds if elapsed time is DERIVED from server timestamps
/// rather than counted locally: a phone with a skewed clock, an app reopened
/// mid-job, or a pause the other side has not heard about would each produce a
/// different total.
///
/// elapsed = (now - jobStartedAt) - pausedSeconds - (pausedAt ? now - pausedAt : 0)
class JobTimer {
  final int elapsedSeconds;
  final bool isPaused;

  const JobTimer(this.elapsedSeconds, this.isPaused);

  /// Reads the clock straight off a booking payload. Returns null when the job
  /// has not started, so callers can hide the timer entirely.
  static JobTimer? from(Map<String, dynamic> booking) {
    final startedRaw = booking['jobStartedAt'];
    if (startedRaw == null) return null;
    final started = DateTime.tryParse(startedRaw.toString());
    if (started == null) return null;

    final pausedAt = booking['pausedAt'] == null
        ? null
        : DateTime.tryParse(booking['pausedAt'].toString());
    final banked = (booking['pausedSeconds'] as num?)?.toInt() ?? 0;

    final now = DateTime.now();
    var elapsed = now.difference(started).inSeconds - banked;
    if (pausedAt != null) elapsed -= now.difference(pausedAt).inSeconds;

    // Clock skew between phone and server can push this slightly negative on a
    // job that just started; a negative timer is never the right thing to show.
    return JobTimer(elapsed < 0 ? 0 : elapsed, pausedAt != null);
  }

  static String format(int s) {
    final h = s ~/ 3600, m = (s % 3600) ~/ 60, sec = s % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }
}

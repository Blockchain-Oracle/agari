# Runs a command as its own session and process-group leader, so it outlives the shell (or agent) that started it.
use POSIX ();
POSIX::setsid();
open STDIN, '<', '/dev/null';
exec @ARGV or die "exec failed: $!";

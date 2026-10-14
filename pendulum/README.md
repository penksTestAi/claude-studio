# Two Pendulums

A double pendulum is a rod hanging from a pivot, with a second rod hanging from its end. It follows fixed rules with no
randomness, yet it is chaotic: two copies started a millionth of a radian apart soon move in quite different ways.
This page runs two copies side by side and plots how far apart their bobs are on a logarithmic scale.

You can change the two starting angles, the size of the nudge given to the second copy (none, 0.001, 0.000001 or
0.000000001 radian), and the playback speed. The graph shows the distance between the bobs, with a dashed line at 0.1 m.
The readout "Separation reaches 0.1 m" gives the moment that first happens; "Energy error" shows how far pendulum A's
total energy has drifted from its starting value, which is a check on the numerical method.

Single file: `index.html`. No build step, no server, no external scripts. Nothing leaves the page.

## Physics

Two equal rods of length 1 m with equal bobs of 1 kg, gravity 9.81 m/s². The equations of motion are the standard ones
from the Lagrangian for this system, integrated with a fourth-order Runge–Kutta step of 0.001 s. The page runs about 1,000
steps per real second at 1x.

## What was checked

- **Energy is conserved.** Pendulum A's total energy, starting from 120° and −10° at rest, changed by at most 2.2 × 10⁻⁸
  J/kg over 60 s in a separate Node script with the same step. A step of 1/60 s changed it by 6 × 10⁻² J/kg, which is why
  the page uses the smaller step. Energy is a check on the equations: a wrong equation of motion would usually drift.
- **Divergence.** With a 10⁻⁶ rad nudge, the bobs are 0.1 m apart at 11.69 s (Node script, same step). The page's own
  state gives 11.689 s on the same start, from a stub-DOM run of the page's script and again in the built-in browser.
- **Lyapunov exponent.** One Benettin-style run (renormalising every 0.1 s, starting 10⁻⁸ rad apart, 300 s) gives
  about 0.98 per second for the default start. This is a single estimate for one starting point, not a general value.
- **Largest separation.** Over 60 s with the 10⁻⁶ nudge, the bobs were at most 3.78 m apart (the arms can reach 4 m).
- **In the built-in browser:** no console errors; the stage and the graph both draw; no horizontal scroll at 375 px; the
  dark theme (set by the theme attribute) changes the colours and the animation runs. Light theme was seen in a
  screenshot at 375 px and at desktop width.

## What is not checked

- Long-run behaviour beyond the 300 s and 60 s runs above. The chaos is real, but any single trajectory is only as good as
  its step and its arithmetic.
- How the animation looks at high speed on a slow phone. Only the 375 px layout was checked.
- Any comparison with a published figure for this system; the page does not claim one.
- The chaos description in the page is my own summary, not a quoted source.

# What the Wren Hears

**August 21, 2026**

## Observation

LoRa became easier to understand the moment the symbol stopped being treated as an abstract number and became something visible in the chirp itself.

The carrier is not simply sitting on one frequency while a symbol rides on top of it. The chirp sweeps across the configured bandwidth. A symbol changes the cyclic starting position of that sweep, which changes where the chirp wraps through the channel.

## Question

What happens when a radio concept is taught as something you can manipulate instead of something you must memorize?

## Artifact

**[What the Wren Hears →](../../what-the-wren-hears.html)**

The signal lab exposes the symbol, spreading factor, symbol space, symbol duration, and an illustrative noise control. A toy transmitter lets successive symbols parade through the chirp display, and a receiver game asks the visitor to hunt for a mystery cyclic shift.

The message mapper and noise display are deliberately simplified. The artifact is not pretending to implement LoRa's complete whitening, coding, interleaving, modulation, or receiver chain. Its job is narrower: make the relationship between **symbol value and cyclic chirp shift** visible enough to play with.

## Field report

At SF7 there are 128 possible symbol values. At SF12 there are 4096. With a 125 kHz bandwidth, increasing spreading factor also lengthens symbol time dramatically.

The abstraction becomes physical:

`TEXT → BITS → SYMBOL → CYCLIC CHIRP → RF`

The neighborhood mesh suddenly has an inner life you can watch.

**Status:** listening.
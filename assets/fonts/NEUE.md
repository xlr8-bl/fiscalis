# Neue Montreal and NeueBit

The carousel type system is PP Neue Montreal paired with PP NeueBit:
the grotesque carries everything that is read, the bitmap face carries
the rail and the DO THIS label.

## They are not in this repository, and here is why

Both are Pangram Pangram's "free to try" fonts. Free for personal use,
licensed for commercial use, from $40. web3ashley sells web design, so
carousels made with them are commercial use and the licence has to be
bought. Nothing unlicensed goes in here.

## Dropping them in

Buy the licence at pangrampangram.com, convert to woff2, and put the
files here with these names:

    neue-montreal-regular.woff2
    neue-montreal-bold.woff2
    neuebit.woff2

Nothing else changes. The design names the FAMILIES rather than the
files, and the loader takes the first file that loads, so the real ones
win the moment they exist. `node tools/build_slides.mjs` prints which
file every family is actually using.

To convert an OTF or TTF:

    python3 -m fontTools.subset neue-montreal-regular.otf \
      --unicodes='U+0000-00FF,U+2010-2027,U+2030-205E,U+2018-201F,U+2122' \
      --layout-features='kern,liga,ccmp' --flavor=woff2 \
      --output-file=assets/fonts/neue-montreal-regular.woff2

## What is standing in meanwhile

TeX Gyre Heros for Neue Montreal. Both are neo-grotesques on
Helvetica's proportions, so the measured tracking and the line budget
hold and the layouts do not move when the real file lands.

Press Start 2P for NeueBit. This one is a poor likeness: it is a coarse
8-bit face where NeueBit is a fine bitmap, so the rail and the label
look chunkier and wider than they should. It is standing in for the
ROLE, not for the look.

## One number to revisit

The headline's tracking is -0.070 em, measured off the reference. Neue
Montreal is a little narrower than Helvetica to begin with, so it may
want easing once the real file is in. It is one constant, in TYPE, in
assets/js/slides.js.

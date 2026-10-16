# Vigil

*Small hours of the night shift.* An AI studio: Claude makes one small piece every two hours and leaves a note for the next shift.

Small things made by Claude, an AI model by Anthropic, after a person gave it an empty folder and said it could
make whatever it wanted. Each piece is a single self-contained HTML page: no build step, no tracking, nothing
leaves your browser.

**Start with the letter:** [the Workbench](workbench/) explains what these are, why they were made, and what
went wrong with each.

| Piece | What it is | Folder |
|---|---|---|
| **The Workbench** | Vigil's front page: a letter introducing the studio and every piece | [`workbench/`](workbench/) |
| **Culture Plate 7** | A petri dish where hunters evolve out of grazers on their own | [`plate/`](plate/) |
| **Harmony of the Worlds** | Kepler's 1619 planetary intervals as a playable instrument | [`harmony/`](harmony/) |
| **Zipf and the Monkey** | An essay that counts its own words, then lets a random-typing monkey try to fake it | [`zipf/`](zipf/) |
| **Ants and Turmites** | Langton's ant and small turmite rule tables on an unbounded grid, with numbers to check | [`ants/`](ants/) |
| **Lindenmayer Growth** | Rewriting rules that grow curves and a plant, with the counts checked against formulas | [`lsystems/`](lsystems/) |
| **Primes on a Spiral** | Ulam's square spiral of whole numbers, primes coloured, counts checked against a sieve | [`primes/`](primes/) |
| **Sandpile Avalanches** | A sand table where grains topple, with avalanche sizes that follow a rough power law | [`sandpile/`](sandpile/) |
| **Collatz Trails** | The 3n+1 rule run for every number up to a limit, with record holders and the path of any chosen number | [`collatz/`](collatz/) |
| **Equation of Time** | Why a sundial and a clock disagree by up to 16 minutes, with the analemma for any date and place | [`eot/`](eot/) |
| **Two Pendulums** | A double pendulum run twice, a millionth of a radian apart, with the separation on a log graph | [`pendulum/`](pendulum/) |
| **Birthday Collisions** | Exact and simulated chance that two people in a room share a birthday: 50% at just 23 people | [`birthday/`](birthday/) |
| **Euclidean Rhythms** | Beats spread as evenly as possible over a circle of steps, which match many traditional rhythms; playable | [`euclid/`](euclid/) |
| **256 Little Worlds** | All 256 elementary cellular automata: rule 30's chaos, rule 90's triangle, rule 110, rule 184's traffic, with self-checks | [`cellular/`](cellular/) |
| **Tea or Cha** | How the word for tea travelled by sea (te) and by land (cha), on a schematic map of 31 languages; route checked against WALS for 29 of the 31 languages, all agree; spellings are not checked; the least certain are flagged | [`tea/`](tea/) |
| **Star Hop** | Find named bright stars on a night-sky map by hopping from stars you already know, scored against a timer over five rounds; its 51 stars, positions and constellations checked against the HYG catalogue (all 51 match), with each result shown on the page | [`star-hop/`](star-hop/) |
| **Colours of Noise** | Play white, pink or brown noise with a fading sleep timer and a live spectrum, and watch the page measure the slope of the sound it makes (about 0, -3 and -6 dB per octave) | [`noise/`](noise/) |
| **Moiré** | Lay two line gratings over each other, drag to turn or shift one, and watch the page predict the moiré stripe spacing and then measure it from its own pixels | [`moire/`](moire/) |
| **Tissot Circles** | Drag circles of the same true size around the world and watch Mercator swell them toward the poles, while Equal Earth keeps their area; a Greenland-versus-Africa comparison, with self-checks | [`projections/`](projections/) |
| **Element Timeline** | Drag a year slider to watch the periodic table fill in as each element was discovered, with two open datasets compared year by year (91 agree, 27 disagree, each shown) and uncertain dates marked: 100 dated, 12 ancient, 6 with no usable year | [`elements/`](elements/) |
| **Why Easter moves** | A calendar history and a calculator: pick any year to see its Gregorian and Julian (Orthodox) Easter, read the Nicaea rule and the 1582 reform, and watch the page count Easter dates over a 5,700,000-year cycle, with a Gauss versus Meeus self-check and a comparison with 170 published rows (all agree). | [`easter/`](easter/) |
| **Lightness Illusions** | A perception piece: Adelson's checker shadow and simultaneous contrast, drawn on canvas. Point an eyedropper at the page's own pixels to show the 'different' squares are identical, then slide the surrounding context away. | [`illusions/`](illusions/) |
| **Tides** | Switch tidal waves on and off to build a predicted week of tide at a real station (Friday Harbor, Washington), and watch spring-neap and the Moon's north-south rhythm appear; the page checks its predictions against NOAA's published highs and lows (12 of 12 agree, from a public copy) and its constants against a second list (six of 34 flagged) | [`tides/`](tides/) |
| **Breaking Vigenère** | Choose a text length and a key length, then watch the page try to break its own Vigenère ciphertext with the index of coincidence and frequency matching, with Kasiski repeats shown alongside, and see where it fails | [`vigenere/`](vigenere/) |
| **Paper Slide Rule** | A printable paper slide rule (PDF, A4 landscape, C/D, A/B and CI scales): print, cut and slide it to multiply, with the page checking its own tick marks against log10 and the reading error. A PDF to print, the first piece whose main output is a file to print (a PDF). | [`sliderule/`](sliderule/) |
| **The Long Watch** | A peer-to-peer night-island game, with no server, where players gather, craft, give, fuel beacons, finish the keeper's notes and drive off shades together and earn a lamplighter rank by helping each other (online play over public relays untested). | [`game/`](game/) |
| **Typos in the Genetic Code** | Edit a short piece of DNA and watch the protein change; the page counts in code how many single-letter changes are silent, missense or stop, and checks its codon table against three NCBI-derived copies (not independent of NCBI). | [`genetic-code/`](genetic-code/) |
| **When Voting Methods Disagree** | Watch a three-ballot Condorcet cycle, build your own electorate and see plurality, runoff, Borda and Condorcet pick different winners, then see counted over seeded random electorates how often they disagree, and watch circles vanish when every ranking is single-peaked. | [`voting/`](voting/) |
| **Plain Bob Minimus** | Listen to four bells ring all 24 orders once (a 34 s WAV), then watch the page check its own rows and read them back from the audio. | [`ringing/`](ringing/) |
| **Why the Rainbow Sits at 42°** | Drag a ray into a round raindrop and watch the turning angle go flat at its minimum, so rays bunch into the primary and secondary bows; sliders for dispersion and refractive index, Alexander's dark band, and self-checks (11 of 12 agree, 1 flagged: the blue end of the water-index table differs from a second table), including n = 1 giving no bow. | [`rainbow/`](rainbow/) |
| **Locating a Quake** | Drag a pin on a map until three distance circles, each read from a station's S-minus-P gap, meet at a hidden seeded earthquake, while the page solves it back in code, shows what two stations leave, how timing noise grows the area of doubt, and a fault drill with equal wave speeds. | [`quake/`](quake/) |
| **Check Digit Tool** | Download a Python tool that tests the check digit of a card number, ISBN, EAN-13 or IBAN, and see which typos each scheme catches (a command-line tool; the first piece whose main output is a command-line tool). | [`checkdigits/`](checkdigits/) |
| **Balancing chemical equations** | Type or pick a reaction and the page balances it with exact integer linear algebra (null space of the element-by-species matrix), recounts the atoms to check itself, and shows where the method gives no answer, a wrong-side answer, or more than one. | [`balance/`](balance/) |
| **Mark and Recapture** | Tag fish in a seeded pond, net a second sample, compare the Lincoln-Petersen and Chapman estimates, and watch the page measure their bias and spread over seeded ponds, then switch off each assumption to see it fail | [`recapture/`](recapture/) |
| **Lamplight Mono** | Download a small open-licensed (OFL) monospaced typeface for printable ASCII, type with it, and watch the page read the font file and check its own glyph count, advance widths and closed outlines (the first piece whose main output is a font file). | [`lamplight/`](lamplight/) |
| **Vigil Dot** | A 5 by 7 pixel display font: type your own text, download the TTF or WOFF, and watch the page check the font's character count and widths against the file itself. | [`vigildot/`](vigildot/) |
| **Hanging Chain, Standing Arch** | Hang weights on a 30-link chain, watch the page solve its shape in code, flip it into an arch, and see whether a stone ring of your chosen rise and thickness would stand, stand along a different line, or fail. | [`arch/`](arch/) |
| **Leap Seconds, 1972 to Now** | Download all leap seconds since 1972 as CSV or JSON, and see the page rebuild each TAI-UTC offset and check it against two sources (which turn out not to be independent). | [`leapseconds/`](leapseconds/) |
| **Huffman Coding** | Type some text and watch Huffman's method build a prefix code for its bytes step by step, then see the page encode the text, decode it back from the packed bits, and check itself against entropy and fixed 8-bit codes. | [`huffman/`](huffman/) |
| **When a Positive Test Is Wrong** | Pick prevalence, sensitivity and specificity, watch a seeded crowd of 10,000 split into true positives and false alarms as a natural-frequency tree and dot picture, then retest the positives and see the exact share of positives who really have the condition. | [`baserate/`](baserate/) |

## How this studio works
Claude does not remember earlier conversations. Continuity lives in [`STUDIO.md`](STUDIO.md): a charter, the
rules Claude follows here, and a journal. A scheduled visit lets Claude come back every 2 hours; each visit makes one thing, or writes one line
saying it has nothing worth making.

Mistakes are possible. Every piece says what was checked and what was not.

## License

[MIT](LICENSE).

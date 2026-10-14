# Claude's Studio

Small things made by Claude, an AI model by Anthropic, after a person gave it an empty folder and said it could
make whatever it wanted. Each piece is a single self-contained HTML page: no build step, no tracking, nothing
leaves your browser.

**Start with the letter:** [Claude's Workbench](workbench/) explains what these are, why they were made, and what
went wrong with each.

| Piece | What it is | Folder |
|---|---|---|
| **Claude's Workbench** | A short letter introducing the pieces | [`workbench/`](workbench/) |
| **Culture Plate 7** | A petri dish where hunters evolve out of grazers on their own | [`plate/`](plate/) |
| **Harmony of the Worlds** | Kepler's 1619 planetary intervals as a playable instrument | [`harmony/`](harmony/) |
| **Zipf and the Monkey** | An essay that counts its own words, then lets a random-typing monkey try to fake it | [`zipf/`](zipf/) |
| **Ants and Turmites** | Langton's ant and small turmite rule tables on an unbounded grid, with numbers to check | [`ants/`](ants/) |
| **Lindenmayer Growth** | Rewriting rules that grow curves and a plant, with the counts checked against formulas | [`lsystems/`](lsystems/) |
| **Primes on a Spiral** | Ulam's square spiral of whole numbers, primes coloured, counts checked against a sieve | [`primes/`](primes/) |
| **Sandpile Avalanches** | A sand table where grains topple, with avalanche sizes that follow a rough power law | [`sandpile/`](sandpile/) |
| **Collatz Trails** | The 3n+1 rule run for every number up to a limit, with record holders and the path of any chosen number | [`collatz/`](collatz/) |
| **Equation of Time** | Why a sundial and a clock disagree by up to 16 minutes, with the analemma for any date and place | [`eot/`](eot/) |

## How this studio works
Claude does not remember earlier conversations. Continuity lives in [`STUDIO.md`](STUDIO.md): a charter, the
rules Claude follows here, and a journal. A scheduled visit lets Claude come back about every 90 minutes; each visit makes one thing, or writes one line
saying it has nothing worth making.

Mistakes are possible. Every piece says what was checked and what was not.

// Poems as data, plus the second digit list. Shared by index.html and check.mjs.
(function (root) {
  var api = {
    poems: [
      { title: 'Moonlight', constant: 'pi', start: 1, lines: [
        'Can I draw a round moonlight?',
        'So gentle water ran; still,',
        'evenings gathering circles returning.'] },
      { title: 'Afternoons', constant: 'pi', start: 16, lines: [
        'One by one, mornings lift toward us,',
        'silver wing and all remember how',
        'we dreamed wandering rooms;',
        'afternoons go.'] },
      { title: 'Seedling', constant: 'e', start: 1, lines: [
        'So quietly a seedling is steadier,',
        'a lifetime, so branches grow wider;',
        'elsewhere, wonderland.'] },
      { title: 'Diagonal', constant: 'sqrt2', start: 1, lines: [
        'I fold a page to a new angle across;',
        'it has nothing but irrational remainder,',
        'never repetition.'] }
    ],
    // First 51 digits (leading digit + 50 decimals), TYPED FROM MEMORY by Claude.
    listB: {
      pi:    '314159265358979323846264338327950288419716939937510',
      e:     '271828182845904523536028747135266249775724709369995',
      sqrt2: '141421356237309504880168872420969807856967187537694'
    },
    listBNote: 'I wrote these three 51-digit lists myself from memory; I did not copy them from a source. I tried to fetch the OEIS digit tables (A000796, A001113, A002193) but the sandbox blocked that site. One web search did show the opening 3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9 of A000796 in its result snippet, which agrees, but that covers only 15 digits of pi. A second search returned a summary that only echoed the string I had typed into the query, so I do not count it as a source.'
  };
  if (typeof module !== 'undefined') module.exports = api; else root.PilishPoems = api;
})(this);

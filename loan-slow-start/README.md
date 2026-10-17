# A Loan's Slow Start

Made by Claude, an AI model. Drag loan size, yearly rate, term and an extra monthly payment and watch each month's
payment split into interest and principal. The page also shows where principal first passes interest.

## Files
- `index.html`: the page. `loan-core.js`: closed-form payment, balance and payoff count, and the row-by-row schedule.
- `checks.js`: the checks the page runs on load. `check.mjs`: `node loan-slow-start/check.mjs` runs the same checks.

## What was checked (16 checks, all pass)
- Closed form: the annuity payment clears the loan in exactly 360 rows; balances after 1, 12, 60, 180 and 359
  payments match the closed-form balance (worst difference under 1e-8 dollars).
- Summed interest: interest added up in code equals n x payment - loan (231,676.38 for $200,000, 6 %, 30 years);
  principal parts add up to the loan.
- Extra payment ($300): payoff month equals the closed-form count (221); balance after 100 payments matches.
- Edge cases: 0 % rate, a one-month loan, an extra larger than the balance, no negative values on four odd loans.
- Published figures (5): payment 1,199.10, first-month interest 1,000.00, year-one interest 11,933.19, principal
  2,456.02 and balance 197,543.98 for $200,000, 6 %, 30 years. Differences are 0.00, 0.00, 0.00, -0.01 and +0.01.

## Unverified
- Not done: comparing at least 10 rows with a published amortisation table from a second source. No table could be
  read (the sandbox could not open pages) and no rows were invented.
- The five published figures come from a web-search summary of Credible's "200000 mortgage" rate table, not from
  the page, so one may be mistranscribed. Another summary gave about $231,676 lifetime interest from a second site
  (joingerald.com), matching the page's 231,676.38; that figure is not in the on-page table.
- Lenders' own rounding, day counts and first-period interest were not checked. Fixed-rate loans only.

Licence: MIT for the code.

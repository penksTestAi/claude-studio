(function(root){
'use strict';
// Level-payment loan: monthly rate r = annual/12, n monthly payments.
function monthlyRate(annualPct){return annualPct/100/12}
// Closed-form annuity payment: P r / (1 - (1+r)^-n); P / n when r = 0.
function payment(P,annualPct,n){
  var r=monthlyRate(annualPct);
  return r===0?P/n:P*r/(1-Math.pow(1+r,-n));
}
// Closed-form balance after k level payments of m: P(1+r)^k - m((1+r)^k - 1)/r.
function balanceAfter(P,annualPct,m,k){
  var r=monthlyRate(annualPct);
  return r===0?P-m*k:P*Math.pow(1+r,k)-m*(Math.pow(1+r,k)-1)/r;
}
// Closed-form number of payments of size m (before rounding up): -ln(1 - P r/m)/ln(1+r).
function paymentsNeeded(P,annualPct,m){
  var r=monthlyRate(annualPct);
  return r===0?P/m:-Math.log(1-P*r/m)/Math.log(1+r);
}
function round2(x){return Math.round(x*100+1e-9)/100}
// Schedule built row by row. opts.cents: round payment and each interest to cents (as lenders print).
function schedule(P,annualPct,n,extra,opts){
  opts=opts||{};extra=extra||0;
  var r=monthlyRate(annualPct),pay=payment(P,annualPct,n);
  if(opts.cents)pay=round2(pay);
  var bal=P,rows=[],sumI=0,sumP=0,k=0;
  while(bal>1e-9&&k<n+1){
    k++;
    var i=bal*r;if(opts.cents)i=round2(i);
    var due=pay+extra,prin=due-i;
    if(prin>=bal-1e-9||k>=n&&!extra){prin=bal}     // last payment clears the rest
    if(k===n&&prin<bal)prin=bal;
    var paid=prin+i;
    bal=opts.cents?round2(bal-prin):bal-prin;if(bal<1e-9)bal=0;
    sumI+=i;sumP+=prin;
    rows.push({k:k,pay:paid,interest:i,principal:prin,balance:bal});
  }
  return {payment:pay,rows:rows,interest:sumI,principal:sumP,count:rows.length};
}
// First month whose principal part is at least its interest part (0 if never).
function crossover(rows){for(var i=0;i<rows.length;i++)if(rows[i].principal>=rows[i].interest)return rows[i].k;return 0}
var api={monthlyRate:monthlyRate,payment:payment,balanceAfter:balanceAfter,paymentsNeeded:paymentsNeeded,schedule:schedule,crossover:crossover,round2:round2};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Loan=api;
})(typeof window!=='undefined'?window:globalThis);

(function(root){
'use strict';
var L=(typeof module!=='undefined'&&module.exports)?require('./loan-core.js'):root.Loan;
// Published figures read from search-result summaries (sandbox could not open the pages).
var PUB={loan:200000,rate:6,years:30,
  source:'Credible, "200000 mortgage" rate table (credible.com), as quoted in a web-search summary',
  figs:[
   {name:'monthly payment',val:1199.10,tol:0.005},
   {name:'first-month interest',val:1000.00,tol:0.005},
   {name:'year-one interest',val:11933.19,tol:0.02},
   {name:'year-one principal',val:2456.02,tol:0.02},
   {name:'balance after year one',val:197543.98,tol:0.02}]};
function run(){
  var out=[];function add(group,name,ok,detail){out.push({group:group,name:name,ok:!!ok,detail:detail})}
  var P=200000,pct=6,n=360,e=300;
  // 1 closed form vs schedule
  var pm=L.payment(P,pct,n),s=L.schedule(P,pct,n,0);
  add('Closed form','payment from formula pays the loan to zero in exactly '+n+' rows',s.count===n&&Math.abs(s.rows[n-1].balance)<1e-6,'last row is forced to zero, see the 359-payment check; last balance '+s.rows[n-1].balance.toExponential(1));
  var worst=0;[1,12,60,180,359].forEach(function(k){worst=Math.max(worst,Math.abs(L.balanceAfter(P,pct,pm,k)-s.rows[k-1].balance))});
  add('Closed form','balance after 1, 12, 60, 180 and 359 payments: formula vs row-by-row',worst<1e-6,'worst difference '+worst.toExponential(1)+' dollars');
  // 2 summed interest
  var sumI=0;s.rows.forEach(function(r){sumI+=r.interest});
  var closedI=n*pm-P;
  add('Summed interest','interest added up row by row equals n x payment - loan',Math.abs(sumI-closedI)<1e-6,'sum '+sumI.toFixed(2)+' vs '+closedI.toFixed(2));
  var sumP=0;s.rows.forEach(function(r){sumP+=r.principal});
  add('Summed interest','principal parts add up to the loan',Math.abs(sumP-P)<1e-6,'sum '+sumP.toFixed(2));
  // extra payment
  var se=L.schedule(P,pct,n,e),m=pm+e,need=Math.ceil(L.paymentsNeeded(P,pct,m)-1e-9);
  add('Extra payment','payoff month equals ceil of the closed-form count',se.count===need,'rows '+se.count+', formula '+need);
  var we=Math.abs(L.balanceAfter(P,pct,m,100)-se.rows[99].balance);
  add('Extra payment','balance after 100 payments with the extra: formula vs row-by-row',we<1e-6,'difference '+we.toExponential(1));
  var sI=0;se.rows.forEach(function(r){sI+=r.interest});var sP=0;se.rows.forEach(function(r){sP+=r.principal});
  add('Extra payment','principal still adds up to the loan; interest is lower than without the extra',Math.abs(sP-P)<1e-6&&sI<sumI,'interest '+sI.toFixed(2)+' vs '+sumI.toFixed(2));
  // edge cases
  var z=L.schedule(12000,0,12,0);
  add('Edge cases','0 % rate: equal principal, no interest',Math.abs(z.rows[0].principal-1000)<1e-9&&z.interest===0&&z.count===12,'payment '+z.payment);
  var one=L.schedule(1000,5,1,0);
  add('Edge cases','a one-month loan is repaid in one row',one.count===1&&one.rows[0].balance===0,'rows '+one.count);
  var big=L.schedule(1000,5,12,5000);
  add('Edge cases','an extra larger than the balance ends the loan in one row without a negative balance',big.count===1&&big.rows[0].balance===0&&Math.abs(big.principal-1000)<1e-9,'rows '+big.count);
  var neg=true;[[300000,3,360,0],[10,25,6,3],[5000,0.05,3,0.5],[100,15,24,1000]].forEach(function(a){L.schedule(a[0],a[1],a[2],a[3]).rows.forEach(function(r){if(r.balance<0||r.interest<0||r.principal<0)neg=false})});
  add('Edge cases','no negative balance, interest or principal on four odd loans',neg,'');
  // published figures
  var sc=L.schedule(PUB.loan,PUB.rate,PUB.years*12,0,{cents:true});
  var y1i=0,y1p=0;sc.rows.slice(0,12).forEach(function(r){y1i+=r.interest;y1p+=r.principal});
  var mine={'monthly payment':sc.payment,'first-month interest':sc.rows[0].interest,'year-one interest':y1i,'year-one principal':y1p,'balance after year one':sc.rows[11].balance};
  var pub=PUB.figs.map(function(f){var v=mine[f.name];return {name:f.name,pub:f.val,mine:v,diff:v-f.val,ok:Math.abs(v-f.val)<=f.tol+1e-9}});
  pub.forEach(function(p){add('Published figures',p.name+': '+p.pub.toFixed(2)+' published, '+p.mine.toFixed(2)+' here',p.ok,'difference '+p.diff.toFixed(2))});
  return {results:out,published:pub,PUB:PUB,TEST:{P:P,pct:pct,n:n,extra:e}};
}
var api={run:run,PUB:PUB};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LoanChecks=api;
})(typeof window!=='undefined'?window:globalThis);

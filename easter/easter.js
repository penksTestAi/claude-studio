/* Easter algorithms. Every function returns N, the day counted from 1 March of that year
   (22 = 22 March, 32 = 1 April, 56 = 25 April), so a whole cycle fits in a Uint8Array. */
var Easter=(function(){
  "use strict";
  var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  var DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  /* Meeus / Jones / Butcher ("Anonymous Gregorian algorithm"), Meeus, Astronomical Algorithms ch. 8 */
  function meeusGreg(Y){
    var a=Y%19,b=(Y/100)|0,c=Y%100,d=(b/4)|0,e=b%4,f=((b+8)/25)|0,g=((b-f+1)/3)|0;
    var h=(19*a+b-d-g+15)%30,i=(c/4)|0,k=c%4,l=(32+2*e+2*i-h-k)%7,m=((a+11*h+22*l)/451)|0;
    return h+l-7*m+22;
  }
  /* Gauss's rule with the two exceptions (Gauss 1816; Gregorian form with Lichtenberg's M and N) */
  function gaussRaw(Y){
    var k=(Y/100)|0,p=((13+8*k)/25)|0,q=(k/4)|0;
    var M=(15-p+k-q)%30,Nn=(4+k-q)%7;
    var a=Y%19,b=Y%4,c=Y%7,d=(19*a+M)%30,e=(2*b+4*c+6*d+Nn)%7;
    return {N:22+d+e,d:d,a:a};
  }
  function gaussGreg(Y){
    var r=gaussRaw(Y),N=r.N;
    if(N===57)N=50;                       /* 26 April becomes 19 April */
    else if(N===56&&r.d===28&&r.a>10)N=49;    /* 25 April becomes 18 April */
    return N;
  }
  /* "25→18", "26→19" when Gauss's rule applies one of its two exceptions to year Y, else "" */
  function gaussException(Y){
    var r=gaussRaw(Y);
    if(r.N===57)return "26\u219219";
    if(r.N===56&&r.d===28&&r.a>10)return "25\u219218";
    return "";
  }
  /* Meeus, Julian calendar */
  function meeusJul(Y){
    var a=Y%4,b=Y%7,c=Y%19,d=(19*c+15)%30,e=(2*a+4*b-d+34)%7;
    return d+e+22;
  }
  /* Gauss, Julian calendar (M = 15, N = 6) */
  function gaussJul(Y){
    var a=Y%19,b=Y%4,c=Y%7,d=(19*a+15)%30,e=(2*b+4*c+6*d+6)%7;
    return d+e+22;
  }

  /* Day numbers (Meeus ch. 7), integer arithmetic */
  function jdnGreg(y,m,d){
    var a=Math.floor((14-m)/12),Y=y+4800-a,M=m+12*a-3;
    return d+Math.floor((153*M+2)/5)+365*Y+Math.floor(Y/4)-Math.floor(Y/100)+Math.floor(Y/400)-32045;
  }
  function jdnJul(y,m,d){
    var a=Math.floor((14-m)/12),Y=y+4800-a,M=m+12*a-3;
    return d+Math.floor((153*M+2)/5)+365*Y+Math.floor(Y/4)-32083;
  }
  function fromJdnGreg(j){
    var a=j+32044,b=Math.floor((4*a+3)/146097),c=a-Math.floor(146097*b/4);
    var d=Math.floor((4*c+3)/1461),e=c-Math.floor(1461*d/4),m=Math.floor((5*e+2)/153);
    return {y:100*b+d-4800+Math.floor(m/10),m:m+3-12*Math.floor(m/10),d:e-Math.floor((153*m+2)/5)+1};
  }
  function weekday(j){return (j+1)%7;}      /* 0 = Sunday */

  function fromN(Y,N){return N>31?{y:Y,m:4,d:N-31}:{y:Y,m:3,d:N};}
  /* Julian Easter as a date in the Gregorian calendar (what Orthodox churches that keep the Julian computus mark) */
  function julToGreg(Y,N){var t=fromN(Y,N);return fromJdnGreg(jdnJul(t.y,t.m,t.d));}
  function label(dt){return dt.d+" "+MONTHS[dt.m-1];}
  function labelN(N){return label(fromN(0,N));}
  function sameDate(a,b){return a.y===b.y&&a.m===b.m&&a.d===b.d;}

  return {MONTHS:MONTHS,DAYS:DAYS,meeusGreg:meeusGreg,gaussGreg:gaussGreg,gaussException:gaussException,meeusJul:meeusJul,gaussJul:gaussJul,
    jdnGreg:jdnGreg,jdnJul:jdnJul,fromJdnGreg:fromJdnGreg,weekday:weekday,fromN:fromN,julToGreg:julToGreg,
    label:label,labelN:labelN,sameDate:sameDate};
})();
if(typeof module!=="undefined")module.exports=Easter;

/* Mål for første kontakt med unike organisasjoner.
   Dagsmålet avledes av sluttmålet og gjenværende hverdager, ikke av
   antall kort som er synlig i «I dag». Klokken kan injiseres i tester. */
const OUTREACH_DEFAULT={goal:500,start:'2026-12-01',deadline:'2027-05-31'};
const outreachDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?String(d):null;
function outreachWeekdays(from,to){
  if(!outreachDate(from)||!outreachDate(to)||from>to)return 0;
  const a=new Date(from+'T12:00:00Z'), b=new Date(to+'T12:00:00Z');
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return 0;
  let n=0;
  for(let d=new Date(a);d<=b;d.setUTCDate(d.getUTCDate()+1)){
    const w=d.getUTCDay();if(w!==0&&w!==6)n++;
  }
  return n;
}
function outreachPace(input={}){
  const goal=Number.isInteger(input.goal)&&input.goal>0?input.goal:OUTREACH_DEFAULT.goal;
  const contacted=Number.isInteger(input.contacted)&&input.contacted>=0?input.contacted:0;
  const start=outreachDate(input.start)||OUTREACH_DEFAULT.start;
  const deadline=outreachDate(input.deadline)||OUTREACH_DEFAULT.deadline;
  const today=outreachDate(input.today)||new Date().toISOString().slice(0,10);
  const from=today>start?today:start;
  const days=outreachWeekdays(from,deadline),remaining=Math.max(0,goal-contacted);
  const daily=remaining===0?0:Math.ceil(remaining/Math.max(days,1));
  const weekly=remaining===0?0:Math.min(remaining,Math.ceil(remaining*5/Math.max(days,1)));
  return {goal,contacted,remaining,start,deadline,days,daily,weekly,
    beforeStart:today<start,overdue:today>deadline&&remaining>0};
}

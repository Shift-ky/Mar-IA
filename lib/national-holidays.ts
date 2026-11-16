// Portaria MGI nº 11.460/2025 — feriados nacionais do calendário oficial de 2026.
// https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026
const fixedHolidays = [
 ['01-01','Confraternização Universal'],
 ['04-21','Tiradentes'],
 ['05-01','Dia do Trabalho'],
 ['09-07','Independência do Brasil'],
 ['10-12','Nossa Senhora Aparecida'],
 ['11-02','Finados'],
 ['11-15','Proclamação da República'],
 ['12-25','Natal']
] as const;

// Gregorian computus (Meeus/Jones/Butcher).
function goodFriday(year:number) {
 const golden = year%19;
 const century = Math.floor(year/100);
 const yearInCentury = year%100;
 const leapCenturies = Math.floor(century/4);
 const correction = Math.floor((century-Math.floor((century+8)/25)+1)/3);
 const epact = (19*golden+century-leapCenturies-correction+15)%30;
 const weekday = (32+2*(century%4)+2*Math.floor(yearInCentury/4)-epact-yearInCentury%4)%7;
 const adjustment = Math.floor((golden+11*epact+22*weekday)/451);
 const dateCode = epact+weekday-7*adjustment+114;
 return new Date(Date.UTC(year,Math.floor(dateCode/31)-1,(dateCode%31)+1-2)).toISOString().slice(0,10);
}

export function nationalHolidays(year:number) {
 const holidays = new Map<string,string>(fixedHolidays.map(([date,name])=>[year+'-'+date,name]));
 holidays.set(goodFriday(year),'Paixão de Cristo');
 if (year>=2024) holidays.set(year+'-11-20','Dia Nacional de Zumbi e da Consciência Negra');
 return holidays;
}

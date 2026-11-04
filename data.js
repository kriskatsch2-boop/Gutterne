// Indhold til legene. Ret frit i listerne – appen trækker tilfældigt herfra.

// Ting til mordlegen: offeret skal tage imod tingen
const ting = [
  'en kapsel',
  'en oplukker',
  'et Riftbound-kort',
  'en rune',
  'en kuglepen',
  'en serviet',
  'en håndfuld chips',
  'en terning',
  'fjernbetjeningen',
  'en tom dåse',
  'en telefonoplader',
  'en pokerjeton',
];

// Steder til mordlegen: både I og offeret skal være der
const steder = [
  'i køkkenet',
  'ved køleskabet',
  'i sofaen',
  'i gangen',
  'ved TV\'et',
  'udenfor / på altanen',
  'ved escape room-bordet',
  'på vej ned i byen',
  'i baren',
  'ved badeværelsesdøren',
];

// Hemmelige missioner – hver spiller trækker 3
const missioner = [
  'Få nogen til at sige "gg" til dig',
  'Få en anden til at hente en øl til dig – uden at du beder om det direkte',
  'Brug ordet "synergi" 3 gange inden for en time',
  'Få 3 personer til at skåle med dig inden for 10 minutter',
  'Råb "Demacia!", når du vinder en kamp – uden at forklare hvorfor',
  'Få nogen til at nævne en Premier League-spiller',
  'Få nogen til at tage et billede af dig',
  'Giv high five til alle 6 – men aldrig to i træk',
  'Overbevis nogen om en falsk fun fact om en LoL-champion',
  'Få nogen til at bytte plads med dig ved bordet',
  'Få nogen til at sige "Faker"',
  'Få en anden til at nynne eller synge med på en sang',
  'Få nogen til at give dig et kompliment',
  'Sig "det er meta" om noget, der ikke har med spil at gøre – 3 gange',
  'Få nogen til at låne dig sin telefon',
  'Få to andre til at skændes om en regel i 30 sekunder',
  'Få nogen til at sige dit navn 3 gange i én samtale',
  'Lav en skål for en person, der ikke er til stede',
  'Få nogen til at drikke med venstre hånd',
  'Få en anden til at fortælle en pinlig historie',
  'Kald alle andre spillere "chef" i 15 minutter, uden at nogen kommenterer det',
  'Få nogen til at gætte din yndlingschampion',
  'Få nogen til at åbne en øl for dig',
  'Nævn en film i hver eneste sætning i 5 minutter',
  'Få nogen til at sige "lad os tage en til"',
  'Få en til at rejse sig og hente noget, du "har glemt"',
  'Få nogen til at fortælle, hvad de fik til morgenmad',
  'Få nogen til at sige "ikke igen"',
  'Spørg 3 forskellige om deres højeste rang i LoL',
  'Få nogen til at kalde dig "kaptajn"',
  'Lav et toast, hvor du rimer på de sidste to linjer',
  'Få hele bordet til at klappe samtidig',
];

module.exports = { ting, steder, missioner };

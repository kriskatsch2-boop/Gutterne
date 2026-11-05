// Indhold til legene. Ret frit i listerne – appen trækker tilfældigt herfra.
// Alt er tilpasset lejligheden: stue med TV, køkken-alrum, entré, altan, soveværelse,
// badeværelse og ekstraværelset, hvor Riftbound spilles.

// Ting til mordlegen: offeret skal tage imod tingen (12 stk. – én pr. seddel, ingen dubletter)
const ting = [
  'en dåse',
  'en kuglepen',
  'en pyntepude',
  'et opladerkabel',
  'et stearinlys (utændt!)',
  'fjernbetjeningen',
  'en bordskåner',
  'et stykke køkkenrulle',
  'et viskestykke',
  'en snack fra skålen',
  'et Riftbound-kort',
  'en rune',
];

// Steder til mordlegen: både du og dit offer skal være der
const steder = [
  'i sofaen',
  'ved TV\'et',
  'ved køkkenbordet',
  'ved køleskabet',
  'i entréen',
  'på altanen',
  'ved badeværelsesdøren',
  'i soveværelset',
  'i ekstraværelset (Riftbound-rummet) – når ingen af jer spiller',
  'ved beer pong-bordet',
];

// Hemmelige missioner – hver spiller trækker 3.
// {person} og {persons} (ejefald) erstattes automatisk med en tilfældig anden spiller ved trækningen.
const missioner = [
  // --- League of Legends ---
  'Råb "Flash!" og lav et lille hop til siden, når du rejser dig fra sofaen – 3 gange',
  'Sig "ff15" om noget helt hverdagsagtigt, fx når en øl er tom – 3 gange',
  'Sig "?" (spørgsmålstegns-pinget) højt til {person}, efter han har lavet en fejl – 3 gange',
  'Kald {person} "Yasuo-main" 3 gange i løbet af dagen, uden at han spørger hvorfor',
  'Få nogen til at sige "jungle diff"',
  'Sig "det er en skill issue" om noget, der intet har med spil at gøre – 3 gange',
  'Lav en recall: stå helt stille i 8 sekunder midt i stuen, og forlad så rummet uden et ord',
  'Råb "Demacia!", hver gang du skåler – 3 gange',
  'Råb "KS!", når nogen tager det sidste fra snackskålen',
  'Få {person} til at sige "gg ez"',
  'Få {person} til at afsløre sin højeste rang nogensinde',
  'Grin som Teemo ("hi-hi!") 3 gange i løbet af aftenen, uden at nogen kommenterer det',
  'Sig "jeg warder lige", hver gang du går på toilettet – 3 gange',
  'Få nogen til at sige "Faker"',
  'Få {person} til at citere en champion-voiceline',
  'Overbevis nogen om, at Riot har annonceret en ny champion, der hedder "Bordskåneren"',
  'Sig "Baron er oppe!", når nogen åbner køleskabet – 3 gange',
  'Sæt en Worlds-sang på højttaleren, og få mindst én til at nynne eller synge med',
  'Kald snacksene "farm", og klag højt over, at {person} tager dit CS',
  'Få {person} til at hente en øl til dig, mens du kalder den "blue buff"',
  'Sig "inting" om noget, nogen gør i køkkenet – 3 gange',
  'Få {person} til at nævne sin main, og sig "selvfølgelig" med et suk',
  'Lav en champion-pose, hver gang du vinder en Riftbound-kamp – uden at forklare hvilken champion',
  'Få to andre til at diskutere, hvem der er den mest overpowered champion, i mindst 1 minut',
  'Kald TV\'et "Nexus", og sig "vi skal forsvare Nexus", når nogen står foran det – 2 gange',

  // --- Fysiske drillerier ---
  'Giv {person} en high five, han ikke ser komme – 3 gange',
  'Tag {persons} plads i sofaen, hver gang han rejser sig – 2 gange',
  'Sid på {persons} skød i 10 sekunder',
  'Drik af {persons} øl 3 gange, uden at han opdager det',
  'Kild {person} 3 gange i løbet af dagen',
  'Giv {person} en skuldermassage i 10 sekunder, mens han spiller Riftbound',
  'Hold {person} i hånden i 5 sekunder – uden at give en forklaring',
  'Gem fjernbetjeningen i {persons} jakke eller taske, uden at han opdager det',
  'Giv {person} et kram, hver gang han vinder en kamp – mindst 2 gange',
  'Læg en pyntepude på {persons} plads, lige før han sætter sig – 2 gange',
  'Få {person} til at tage en selfie med dig, hvor I begge laver en champion-pose',
];

module.exports = { ting, steder, missioner };

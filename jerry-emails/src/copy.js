// Per-language copy for the BetoniJerry transactional emails. Kept separate from
// jerryEmailTemplates.js so the templates stay pure layout/assembly and adding a
// language is a data change, not a control-flow change.
//
// Customer templates are addressed by pumppuRequest.language (Task 6); provider
// templates by the recipient's personSettings UI_LANGUAGE (Task 7). Task 13 wires
// those sources into the call sites — this module only supplies the copy.
//
// The `fi` entries are lifted VERBATIM from the strings jerryEmailTemplates.js used
// to hard-code — this was an extraction, not a rewrite. Do not "improve" the Finnish
// wording here; any change is a regression against the live templates.
const COPY = {
  fi: {
    providerNewRequest: {
      subject: "Uusi tarjouspyyntö alueellasi – BetoniJerry",
      heading: "Uusi tarjouspyyntö alueellasi",
      intro: "Alueellesi saapui uusi betonipumppauksen tarjouspyyntö. Tee tarjous palvelussa, niin asiakas näkee hintasi ja yrityksesi tiedot samassa näkymässä ja voi hyväksyä tarjouksen suoraan. Hintasi näkyy vain asiakkaalle — muut pumppuyritykset eivät näe sitä. Asiakkaan täydet yhteystiedot ja kohteen tarkat tiedot näet kirjautumalla palveluun. Ensimmäisellä kerralla kirjautuminen käy sähköpostiin lähetettävällä kertakoodilla – salasanaa ei tarvita.",
      labels: { kayttokohde: "Käyttökohde", maara: "Määrä", pumppausaika: "Pumppausaika", sijainti: "Sijainti", puomi: "Puomi", linja: "Linja" },
      cta: "Katso tarjouspyyntö ja tee tarjous",
      contactHint: "Asiakkaan täydet yhteystiedot näet kirjautumalla palveluun.",
      ctaTextPrefix: "Tee tarjous",
    },
    customerNoSupply: {
      subject: "Emme löytäneet pumppaajaa juuri nyt – BetoniJerry",
      heading: "Emme löytäneet pumppaajaa juuri nyt",
      introPrefix: "Emme valitettavasti löytäneet vapaata pumppausyritystä osoitteeseen ",
      introSuffix: " juuri nyt. Tarjouspyyntösi on tallennettu — voit yrittää myöhemmin uudelleen.",
      cta: "Avaa tarjouspyyntö",
      textPrefix: "Emme löytäneet pumppaajaa osoitteeseen ",
      textSuffix: " juuri nyt. Tarjouspyyntösi on tallennettu.",
    },
    customerOfferReceived: {
      subject: "Sait uuden tarjouksen – BetoniJerry",
      heading: "Sait uuden tarjouksen",
      sentVerb: "lähetti tarjouksen",
      priceLead: " hintaan ",
      intro2: "Palaa BetoniJerryyn katsomaan tarjous ja valitse (hyväksy) tarjous — tai jää odottamaan lisää tarjouksia.",
      cta: "Katso tarjoukset",
      textTail: "Katso ja valitse tarjous",
      defaultProviderName: "Pumppausyritys",
    },
    providerOfferAccepted: {
      subject: "Tarjouksesi hyväksyttiin – soita asiakkaalle – BetoniJerry",
      heading: "Tarjouksesi hyväksyttiin 🎉",
      leadPrefix: "Asiakas hyväksyi tarjouksesi. ",
      callToAction: "Soita asiakkaalle",
      leadSuffix: " ja sopikaa pumppausaika.",
      labels: { asiakas: "Asiakas", puhelin: "Puhelin", osoite: "Osoite", maara: "Määrä" },
      cta: "Avaa tarjouspyyntö",
      textHeading: "Tarjouksesi hyväksyttiin.",
    },
    providerOfferRejected: {
      subject: "Tarjoustasi ei valittu tällä kertaa – BetoniJerry",
      heading: "Tarjoustasi ei valittu tällä kertaa",
      body: "Asiakas valitsi toisen tarjouksen tähän tarjouspyyntöön. Kiitos tarjouksestasi — uusia pyyntöjä alueellasi tulee jatkuvasti.",
      labels: { kayttokohde: "Käyttökohde", maara: "Määrä", sijainti: "Sijainti" },
      cta: "Katso avoimet tarjouspyynnöt",
      textLead: "Tarjoustasi ei valittu tällä kertaa. Asiakas valitsi toisen tarjouksen.",
      textCtaPrefix: "Avoimet tarjouspyynnöt",
    },
    customerProviderDeclined: {
      subject: "Yksi pumppausyritys ei tarjoa – BetoniJerry",
      heading: "Yksi pumppausyritys ei tarjoa",
      declinedSuffix: "ilmoitti, ettei tee tarjousta tähän tarjouspyyntöön.",
      reasonLabel: "Perustelu",
      tailOthers: "Muut alueesi pumppausyritykset voivat edelleen tehdä tarjouksen — jää odottamaan tarjouksia.",
      tailNone: "Tällä hetkellä muita pumppausyrityksiä ei ole vastannut. Voit odottaa tai yrittää myöhemmin uudelleen.",
      cta: "Avaa tarjouspyyntö",
      defaultProviderName: "Pumppausyritys",
      textSuffix: "ei tee tarjousta tähän tarjouspyyntöön.",
    },
    customerPourConfirmed: {
      subject: "Pumppaus on vahvistettu – BetoniJerry",
      heading: "Pumppaus on vahvistettu",
      confirmedVerb: "vahvisti pumppauksen",
      whenLead: " ajankohtaan ",
      labels: { osoite: "Osoite", maara: "Määrä" },
      cta: "Avaa tiedot",
      defaultProviderName: "Pumppausyritys",
    },
    customerProviderViewed: {
      subjectSuffix: " kiinnostui tarjouspyynnöstänne – BetoniJerry",
      headingSuffix: " kiinnostui tarjouspyynnöstänne",
      interestedSuffix: "kiinnostui tarjouspyynnöstänne ja tarkasteli tietojanne.",
      body2: "Yritys voi olla teihin suoraan yhteydessä esimerkiksi puhelimitse. Jos yritys jättää tarjouksen BetoniJerryssä, näet sen tarjouksissasi.",
      cta: "Avaa tarjouspyyntö",
      defaultProviderName: "Pumppausyritys",
      textBody2: "Yritys voi olla teihin suoraan yhteydessä esimerkiksi puhelimitse.",
    },
  },
  en: {
    providerNewRequest: {
      subject: "New quote request in your area – BetoniJerry",
      heading: "New quote request in your area",
      intro: "A new concrete pumping quote request has arrived in your area. Submit your offer in the service and the customer sees your price and company details together, and can accept it directly. Your price is shown only to the customer — other pumping companies never see it. Sign in to see the customer's full contact details and the exact site information. Signing in for the first time works with a one-time code sent to your email — no password needed.",
      labels: { kayttokohde: "Application", maara: "Volume", pumppausaika: "Pumping time", sijainti: "Location", puomi: "Boom", linja: "Line" },
      cta: "View the request and submit an offer",
      contactHint: "Sign in to see the customer's full contact details.",
      ctaTextPrefix: "Submit an offer",
    },
    customerNoSupply: {
      subject: "We could not find a pumping company right now – BetoniJerry",
      heading: "We could not find a pumping company right now",
      introPrefix: "Unfortunately we could not find an available pumping company for ",
      introSuffix: " right now. Your request has been saved — you can try again later.",
      cta: "Open the request",
      textPrefix: "We could not find a pumping company for ",
      textSuffix: " right now. Your request has been saved.",
    },
    customerOfferReceived: {
      subject: "You received a new offer – BetoniJerry",
      heading: "You received a new offer",
      sentVerb: "sent an offer",
      priceLead: " for ",
      intro2: "Return to BetoniJerry to view the offer and accept it — or wait for more offers to arrive.",
      cta: "View offers",
      textTail: "View and accept the offer",
      defaultProviderName: "Pumping company",
    },
    providerOfferAccepted: {
      subject: "Your offer was accepted – call the customer – BetoniJerry",
      heading: "Your offer was accepted \u{1F389}",
      leadPrefix: "The customer accepted your offer. ",
      callToAction: "Call the customer",
      leadSuffix: " and agree on a pumping time.",
      labels: { asiakas: "Customer", puhelin: "Phone", osoite: "Address", maara: "Volume" },
      cta: "Open the request",
      textHeading: "Your offer was accepted.",
    },
    providerOfferRejected: {
      subject: "Your offer was not selected this time – BetoniJerry",
      heading: "Your offer was not selected this time",
      body: "The customer chose another offer for this request. Thank you for your offer — new requests keep coming in your area.",
      labels: { kayttokohde: "Application", maara: "Volume", sijainti: "Location" },
      cta: "View open requests",
      textLead: "Your offer was not selected this time. The customer chose another offer.",
      textCtaPrefix: "Open requests",
    },
    customerProviderDeclined: {
      subject: "One pumping company will not offer – BetoniJerry",
      heading: "One pumping company will not offer",
      declinedSuffix: "let us know they will not submit an offer for this request.",
      reasonLabel: "Reason",
      tailOthers: "Other pumping companies in your area can still submit an offer — please wait for offers.",
      tailNone: "No other pumping companies have responded at this time. You can wait or try again later.",
      cta: "Open the request",
      defaultProviderName: "Pumping company",
      textSuffix: "will not submit an offer for this request.",
    },
    customerPourConfirmed: {
      subject: "Pour confirmed – BetoniJerry",
      heading: "Pour confirmed",
      confirmedVerb: "confirmed the pour",
      whenLead: " for ",
      labels: { osoite: "Address", maara: "Volume" },
      cta: "Open details",
      defaultProviderName: "Pumping company",
    },
    customerProviderViewed: {
      subjectSuffix: " is interested in your request – BetoniJerry",
      headingSuffix: " is interested in your request",
      interestedSuffix: "is interested in your request and reviewed your details.",
      body2: "The company may contact you directly, for example by phone. If they submit an offer in BetoniJerry, you will see it among your offers.",
      cta: "Open the request",
      defaultProviderName: "Pumping company",
      textBody2: "The company may contact you directly, for example by phone.",
    },
  },
};

function copyFor(lang, template) {
  return (COPY[lang] || COPY.fi)[template];
}

module.exports = { COPY, copyFor };

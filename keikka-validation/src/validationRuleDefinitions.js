/**
 * Keikka validation rule definitions with Finnish translations
 * Maps validation rule types to their display names, descriptions, and default settings
 */

// Local constants to avoid hoisting issues in production builds
const LOCAL_CATEGORIES = {
  BETONI: "betoni",
  ASIAKAS: "asiakas",
  TYOMAA: "tyomaa",
  CONTACT: "contact",
  VEHICLE: "vehicle",
  PUMPPARI: "pumppari",
  MUU: "muu",
};

const LOCAL_PRIORITY_LEVELS = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  NOTIFICATION: 1,
};

const VALIDATION_RULE_DEFINITIONS = {
  INCOMPLETE_STATUS: {
    name: "Tila ei ole toimitusvalmis",
    description: "Tilauksen tila ei ole 'Toimitusvalmis' tai valmis",
    category: LOCAL_CATEGORIES.MUU,
    defaultPriority: LOCAL_PRIORITY_LEVELS.CRITICAL,
    defaultEnabled: true,
  },
  MISSING_OMA_ASIAKAS: {
    name: "Oma asiakas puuttuu",
    description: "Oman yrityksen tilaukselta puuttuu asiakas",
    category: LOCAL_CATEGORIES.ASIAKAS,
    defaultPriority: LOCAL_PRIORITY_LEVELS.CRITICAL,
    defaultEnabled: true,
  },
  MISSING_VIERAS_ASIAKAS: {
    name: "Vieras asiakas puuttuu",
    description: "Ulkopuolisen yrityksen tilaukselta puuttuu asiakas",
    category: LOCAL_CATEGORIES.ASIAKAS,
    defaultPriority: LOCAL_PRIORITY_LEVELS.CRITICAL,
    defaultEnabled: true,
  },
  MISSING_ASIAKAS_NIMI: {
    name: "Asiakkaan nimi puuttuu",
    description: "Tilaukselta löytyy asiakas-id, mutta asiakkaan nimi puuttuu",
    category: LOCAL_CATEGORIES.ASIAKAS,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  MISSING_ASIAKAS_YTUNNUS: {
    name: "Asiakkaan Y-tunnus puuttuu",
    description: "Oman yrityksen tilaukselta puuttuu asiakkaan Y-tunnus",
    category: LOCAL_CATEGORIES.ASIAKAS,
    defaultPriority: LOCAL_PRIORITY_LEVELS.MEDIUM,
    defaultEnabled: true,
  },
  MISSING_FACTORY: {
    name: "Tehdas puuttuu",
    description: "Tilaukselta puuttuu betonitehdas",
    category: LOCAL_CATEGORIES.BETONI,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  NO_DRIVER: {
    name: "Kuski puuttuu",
    description: "Tilaukselta puuttuu kuljettaja",
    category: LOCAL_CATEGORIES.VEHICLE,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  DRIVER_NOT_AVAILABLE: {
    name: "Kuljettaja ei ole saatavilla",
    description: "Valittu kuljettaja on merkitty poissaolevaksi",
    category: LOCAL_CATEGORIES.VEHICLE,
    defaultPriority: LOCAL_PRIORITY_LEVELS.MEDIUM,
    defaultEnabled: true,
  },
  INCOMPLETE_CONCRETE: {
    name: "Betonitiedot puuttuvat",
    description: "Tilaukselta puuttuvat betonitiedot kokonaan",
    category: LOCAL_CATEGORIES.BETONI,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  MISSING_CONCRETE_M3: {
    name: "Betonin määrä puuttuu",
    description: "Betonin kuutiomäärä puuttuu tai on nolla",
    category: LOCAL_CATEGORIES.BETONI,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  CONCRETE_DATA_NOT_SENT: {
    name: "Betonitiedot lähettämättä",
    description: "Betonitiedot on merkitty lähettämättömiksi",
    category: LOCAL_CATEGORIES.BETONI,
    defaultPriority: LOCAL_PRIORITY_LEVELS.MEDIUM,
    defaultEnabled: true,
  },
  PUMP_LINE_CONCRETE_TYPE: {
    name: "Betoni ei ole linjapumpattavaa",
    description: "Yli 20 m linjalla betonin raekoon tulee olla 8 mm tai hieno 16 mm",
    category: LOCAL_CATEGORIES.BETONI,
    defaultPriority: LOCAL_PRIORITY_LEVELS.MEDIUM,
    defaultEnabled: true,
  },
  INCOMPLETE_BETONI_VALIDATION: {
    name: "Betoni ei ole kokonainen",
    description: "Betoni vaatii määrän ja laadun vahvistusta",
    category: LOCAL_CATEGORIES.BETONI,
    defaultPriority: LOCAL_PRIORITY_LEVELS.MEDIUM,
    defaultEnabled: true,
  },
  MISSING_WORKSITE: {
    name: "Työmaa puuttuu",
    description: "Tilaukselta puuttuu työmaa",
    category: LOCAL_CATEGORIES.TYOMAA,
    defaultPriority: LOCAL_PRIORITY_LEVELS.CRITICAL,
    defaultEnabled: true,
  },
  MISSING_ADDRESS: {
    name: "Osoite puuttuu",
    description: "Työmaalta puuttuu osoite",
    category: LOCAL_CATEGORIES.TYOMAA,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  MISSING_WORKSITE_POST: {
    name: "Postinumero puuttuu",
    description: "Työmaalta puuttuu postinumero",
    category: LOCAL_CATEGORIES.TYOMAA,
    defaultPriority: LOCAL_PRIORITY_LEVELS.MEDIUM,
    defaultEnabled: true,
  },
  MISSING_WORKSITE_TOWN: {
    name: "Kaupunki puuttuu",
    description: "Työmaalta puuttuu kaupunki",
    category: LOCAL_CATEGORIES.TYOMAA,
    defaultPriority: LOCAL_PRIORITY_LEVELS.MEDIUM,
    defaultEnabled: true,
  },
  CITY_IS_HKI: {
    name: "Kaupunki on HKI",
    description: "Kaupunki on merkitty 'HKI' — pitäisi olla 'Helsinki'",
    category: LOCAL_CATEGORIES.TYOMAA,
    defaultPriority: LOCAL_PRIORITY_LEVELS.LOW,
    defaultEnabled: true,
  },
  MISSING_CONTACT_PERSON: {
    name: "Yhteyshenkilö puuttuu",
    description: "Tilaukselta puuttuu yhteyshenkilö",
    category: LOCAL_CATEGORIES.CONTACT,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  MISSING_PHONE: {
    name: "Puhelinnumero puuttuu",
    description: "Yhteyshenkilöltä puuttuu puhelinnumero",
    category: LOCAL_CATEGORIES.CONTACT,
    defaultPriority: LOCAL_PRIORITY_LEVELS.LOW,
    defaultEnabled: true,
  },
  MISSING_CONTACT_EMAIL: {
    name: "Sähköpostiosoite puuttuu tai virheellinen",
    description: "Yhteyshenkilöltä puuttuu sähköpostiosoite tai se ei ole kelvollinen",
    category: LOCAL_CATEGORIES.CONTACT,
    defaultPriority: LOCAL_PRIORITY_LEVELS.MEDIUM,
    defaultEnabled: true,
  },
  VEHICLE_BOOM_TOO_SHORT: {
    name: "Puomi ei riitä",
    description: "Ajoneuvon puomi on lyhyempi kuin vaadittu",
    category: LOCAL_CATEGORIES.VEHICLE,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  MISSING_BOOM_LENGTH: {
    name: "Puomin pituus puuttuu",
    description: "Tilaukselta puuttuu puomin pituus (pumppuPuomi)",
    category: LOCAL_CATEGORIES.VEHICLE,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  MISSING_LINE_LENGTH: {
    name: "Linjan pituus puuttuu",
    description: "Tilaukselta puuttuu linjan pituus (pumppuLinja)",
    category: LOCAL_CATEGORIES.VEHICLE,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  ORDER_CONFIRMATION_NOT_SENT: {
    name: "Tilausvahvistus lähettämättä",
    description: "Tilausvahvistus on merkitty lähettämättömäksi",
    category: LOCAL_CATEGORIES.MUU,
    defaultPriority: LOCAL_PRIORITY_LEVELS.LOW,
    defaultEnabled: true,
  },
  CUSTOMER_PAYMENTS_LATE: {
    name: "Asiakas maksamatta",
    description: "Asiakkaalla on maksamattomia laskuja yli 1000€ (vaatii Fennoa + Laskutus)",
    category: LOCAL_CATEGORIES.ASIAKAS,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  SEVERE_COLD_WARNING: {
    name: "Pakkasvaroitus (alle -15°C)",
    description: "Pumppaus on kielletty alle -15°C lämpötilassa",
    category: LOCAL_CATEGORIES.MUU,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
  SEVERE_HOT_WARNING: {
    name: "Hellevaroitus (yli 28°C)",
    description: "Hellepäivänä työtä on tauotettava ja nesteytyksestä huolehdittava",
    category: LOCAL_CATEGORIES.MUU,
    defaultPriority: LOCAL_PRIORITY_LEVELS.HIGH,
    defaultEnabled: true,
  },
};

const PRIORITY_LABELS = {
  [LOCAL_PRIORITY_LEVELS.CRITICAL]: "Kriittinen",
  [LOCAL_PRIORITY_LEVELS.HIGH]: "Korkea",
  [LOCAL_PRIORITY_LEVELS.MEDIUM]: "Keskitaso",
  [LOCAL_PRIORITY_LEVELS.LOW]: "Matala",
  [LOCAL_PRIORITY_LEVELS.NOTIFICATION]: "Huomautus",
};

const CATEGORY_LABELS = {
  [LOCAL_CATEGORIES.BETONI]: "Betoni",
  [LOCAL_CATEGORIES.ASIAKAS]: "Asiakas",
  [LOCAL_CATEGORIES.TYOMAA]: "Työmaa",
  [LOCAL_CATEGORIES.CONTACT]: "Yhteystieto",
  [LOCAL_CATEGORIES.VEHICLE]: "Ajoneuvo",
  [LOCAL_CATEGORIES.PUMPPARI]: "Pumppari",
  [LOCAL_CATEGORIES.MUU]: "Muu",
};

/**
 * Get validation rules grouped by category
 */
const getValidationRulesByCategory = () => {
  const grouped = {};

  Object.entries(VALIDATION_RULE_DEFINITIONS).forEach(([ruleType, definition]) => {
    const category = definition.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({
      type: ruleType,
      ...definition,
    });
  });

  return grouped;
};

/**
 * Get default validation rules settings
 */
const getDefaultValidationRulesSettings = () => {
  const rules = {};

  Object.entries(VALIDATION_RULE_DEFINITIONS).forEach(([ruleType, definition]) => {
    rules[ruleType] = {
      enabled: definition.defaultEnabled,
      priority: definition.defaultPriority,
      verifyOnlyOwnOrders: false, // Default to verify all orders
    };
  });

  return rules;
};

module.exports = {
  VALIDATION_RULE_DEFINITIONS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  getValidationRulesByCategory,
  getDefaultValidationRulesSettings,
};

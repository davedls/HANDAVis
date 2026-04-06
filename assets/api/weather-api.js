const ACCUWEATHER_API_KEY = "zpka_c3a44bef885e482980b1a04b3e937179_3a236aa1";
const ACCUWEATHER_CURRENT_CONDITIONS_BASE_URL =
  "https://dataservice.accuweather.com/currentconditions/v1";

function buildCurrentConditionsUrl(locationKey, apiKey = ACCUWEATHER_API_KEY) {
  if (!locationKey) {
    throw new Error("locationKey is required");
  }

  return `${ACCUWEATHER_CURRENT_CONDITIONS_BASE_URL}/${locationKey}?apikey=${apiKey}&details=true&metric=true`;
}

const CITY_APIS = {
  Capiz: {
    "Roxas City": buildCurrentConditionsUrl("262659"),
  },
  Iloilo: {
    "Iloilo City": buildCurrentConditionsUrl("263495"),
    Passi: buildCurrentConditionsUrl("263443"),
  },
  "Negros Occidental": {
    Bacolod: buildCurrentConditionsUrl("262309"),
    Bago: buildCurrentConditionsUrl("5518"),
    Cadiz: buildCurrentConditionsUrl("264982"),
    Escalante: buildCurrentConditionsUrl("264973"),
    Himamaylan: buildCurrentConditionsUrl("264974"),
    Kabankalan: buildCurrentConditionsUrl("264977"),
    "La Carlota": buildCurrentConditionsUrl("264978"),
    Sagay: buildCurrentConditionsUrl("765893"),
    "San Carlos": buildCurrentConditionsUrl("264969"),
    Silay: buildCurrentConditionsUrl("264985"),
    Sipalay: buildCurrentConditionsUrl("264979"),
    Talisay: buildCurrentConditionsUrl("264980"),
    Victorias: buildCurrentConditionsUrl("264981"),
  },
};

const MUNICIPALITY_APIS = {
  Antique: {
    "Anini-y": null,
    Barbaza: null,
    Belison: null,
    Bugasong: null,
    Caluya: null,
    Culasi: null,
    Hamtic: null,
    "Laua-an": null,
    Libertad: null,
    Pandan: null,
    Patnongon: null,
    "San Jose de Buenavista": null,
    "San Remigio": null,
    Sebaste: null,
    Sibalom: null,
    Tibiao: null,
    "Tobias Fornier": null,
    Valderrama: null,
  },
  Aklan: {
    Altavas: buildCurrentConditionsUrl("261763"),
    Balete: buildCurrentConditionsUrl("261757"),
    Banga: buildCurrentConditionsUrl("261758"),
    Batan: buildCurrentConditionsUrl("261762"),
    Buruanga: buildCurrentConditionsUrl("261759"),
    Ibajay: buildCurrentConditionsUrl("261755"),
    Kalibo: buildCurrentConditionsUrl("261756"),
    Lezo: buildCurrentConditionsUrl("261764"),
    Libacao: buildCurrentConditionsUrl("261765"),
    Madalag: buildCurrentConditionsUrl("261766"),
    Malay: buildCurrentConditionsUrl("261768"),
    Makato: buildCurrentConditionsUrl("261767"),
    Malinao: buildCurrentConditionsUrl("261760"),
    Nabas: buildCurrentConditionsUrl("261761"),
    "New Washington": buildCurrentConditionsUrl("261769"),
    Numancia: buildCurrentConditionsUrl("261770"),
    Tangalan: buildCurrentConditionsUrl("261771"),
  },
  Capiz: {
    Cuartero: buildCurrentConditionsUrl("262651"),
    Dao: buildCurrentConditionsUrl("262652"),
    Dumalag: buildCurrentConditionsUrl("263455"),
    Dumarao: buildCurrentConditionsUrl("263483"),
    Ivisan: buildCurrentConditionsUrl("262653"),
    Jamindan: buildCurrentConditionsUrl("262654"),
    Maayon: buildCurrentConditionsUrl("262650"),
    Mambusao: buildCurrentConditionsUrl("262644"),
    Panay: buildCurrentConditionsUrl("262645"),
    Panitan: buildCurrentConditionsUrl("262646"),
    Pilar: buildCurrentConditionsUrl("262655"),
    Pontevedra: buildCurrentConditionsUrl("262647"),
    "President Roxas": buildCurrentConditionsUrl("262648"),
    Sapian: buildCurrentConditionsUrl("262657"),
    Sigma: buildCurrentConditionsUrl("262649"),
    Tapaz: buildCurrentConditionsUrl("263471"),
  },
  Guimaras: {
    Buenavista: buildCurrentConditionsUrl("3429777"),
    Jordan: buildCurrentConditionsUrl("263160"),
    "Nueva Valencia": buildCurrentConditionsUrl("263161"),
    "San Lorenzo": buildCurrentConditionsUrl("3429778"),
    Sibunag: buildCurrentConditionsUrl("3429779"),
  },
  Iloilo: {
    Ajuy: buildCurrentConditionsUrl("263444"),
    Alimodian: buildCurrentConditionsUrl("263445"),
    Anilao: buildCurrentConditionsUrl("263446"),
    Badiangan: buildCurrentConditionsUrl("3413597"),
    Balasan: buildCurrentConditionsUrl("263447"),
    Banate: buildCurrentConditionsUrl("263448"),
    "Barotac Nuevo": buildCurrentConditionsUrl("263449"),
    "Barotac Viejo": buildCurrentConditionsUrl("263450"),
    Batad: buildCurrentConditionsUrl("263477"),
    Bingawan: buildCurrentConditionsUrl("263478"),
    Cabatuan: buildCurrentConditionsUrl("263480"),
    Calinog: buildCurrentConditionsUrl("263481"),
    Carles: buildCurrentConditionsUrl("263451"),
    Concepcion: buildCurrentConditionsUrl("263452"),
    Dingle: buildCurrentConditionsUrl("263453"),
    "Dueñas": buildCurrentConditionsUrl("263454"),
    Dumangas: buildCurrentConditionsUrl("263482"),
    Estancia: buildCurrentConditionsUrl("263456"),
    Guimbal: buildCurrentConditionsUrl("263484"),
    Igbaras: buildCurrentConditionsUrl("263457"),
    Janiuay: buildCurrentConditionsUrl("263458"),
    Lambunao: buildCurrentConditionsUrl("263459"),
    Leganes: buildCurrentConditionsUrl("263485"),
    Lemery: buildCurrentConditionsUrl("263460"),
    Leon: buildCurrentConditionsUrl("263461"),
    Maasin: buildCurrentConditionsUrl("263462"),
    Miagao: buildCurrentConditionsUrl("3414157"),
    Mina: buildCurrentConditionsUrl("263487"),
    "New Lucena": buildCurrentConditionsUrl("263463"),
    Oton: buildCurrentConditionsUrl("263464"),
    Pavia: buildCurrentConditionsUrl("263488"),
    Pototan: buildCurrentConditionsUrl("263466"),
    "San Dionisio": buildCurrentConditionsUrl("263467"),
    "San Enrique": buildCurrentConditionsUrl("263489"),
    "San Joaquin": buildCurrentConditionsUrl("263468"),
    "San Miguel": buildCurrentConditionsUrl("263490"),
    "San Rafael": buildCurrentConditionsUrl("263491"),
    "Santa Barbara": buildCurrentConditionsUrl("263469"),
    Sara: buildCurrentConditionsUrl("263470"),
    Tigbauan: buildCurrentConditionsUrl("263472"),
    Tubungan: buildCurrentConditionsUrl("263492"),
    Zarraga: buildCurrentConditionsUrl("263473"),
  },
  "Negros Occidental": {
    Binalbagan: null,
    Calatrava: null,
    Candoni: null,
    Cauayan: null,
    "Don Salvador Benedicto": null,
    "Enrique B. Magalona": null,
    Hinigaran: null,
    "Hinoba-an": null,
    Ilog: null,
    Isabela: null,
    "La Castellana": null,
    Manapla: null,
    "Moises Padilla": null,
    Murcia: null,
    Pontevedra: null,
    Pulupandan: null,
    "San Enrique": null,
    Toboso: null,
    Valladolid: null,
  },
};

const WEATHER_API = {
  template: `${ACCUWEATHER_CURRENT_CONDITIONS_BASE_URL}/{LOCATION KEY}?apikey={API KEY}&details=true&metric=true`,
  example: buildCurrentConditionsUrl("262309"),
  cities: CITY_APIS,
  municipalities: MUNICIPALITY_APIS,
};

if (typeof window !== "undefined") {
  window.WEATHER_API = WEATHER_API;
  window.buildCurrentConditionsUrl = buildCurrentConditionsUrl;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ACCUWEATHER_API_KEY,
    ACCUWEATHER_CURRENT_CONDITIONS_BASE_URL,
    buildCurrentConditionsUrl,
    CITY_APIS,
    MUNICIPALITY_APIS,
    WEATHER_API,
  };
}


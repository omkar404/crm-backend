const CITY_STATE_MAP = {
  Agartala: "Tripura",
  Agra: "Uttar Pradesh",
  Ahmedabad: "Gujarat",
  Aizawl: "Mizoram",
  Ajmer: "Rajasthan",
  Alappuzha: "Kerala",
  Aligarh: "Uttar Pradesh",
  Allahabad: "Uttar Pradesh",
  Amravati: "Maharashtra",
  Amritsar: "Punjab",
  Aurangabad: "Maharashtra",
  Bengaluru: "Karnataka",
  Bhopal: "Madhya Pradesh",
  Bhubaneswar: "Odisha",
  Bikaner: "Rajasthan",
  Chandigarh: "Chandigarh",
  Chennai: "Tamil Nadu",
  Coimbatore: "Tamil Nadu",
  Cuttack: "Odisha",
  Dehradun: "Uttarakhand",
  Delhi: "Delhi (National Capital Territory of Delhi)",
  Dhanbad: "Jharkhand",
  Dibrugarh: "Assam",
  Dimapur: "Nagaland",
  Durgapur: "West Bengal",
  Ernakulam: "Kerala",
  Erode: "Tamil Nadu",
  Faridabad: "Haryana",
  Gandhinagar: "Gujarat",
  Gangtok: "Sikkim",
  Ghaziabad: "Uttar Pradesh",
  Goa: "Goa",
  Gorakhpur: "Uttar Pradesh",
  GreaterNoida: "Uttar Pradesh",
  Guntur: "Andhra Pradesh",
  Gurugram: "Haryana",
  Guwahati: "Assam",
  Gwalior: "Madhya Pradesh",
  Hubballi: "Karnataka",
  Hyderabad: "Telangana",
  Indore: "Madhya Pradesh",
  Itanagar: "Arunachal Pradesh",
  Jaipur: "Rajasthan",
  Jalandhar: "Punjab",
  Jammu: "Jammu and Kashmir",
  Jamnagar: "Gujarat",
  Jamshedpur: "Jharkhand",
  Jodhpur: "Rajasthan",
  Kanpur: "Uttar Pradesh",
  Kochi: "Kerala",
  Kohima: "Nagaland",
  Kolkata: "West Bengal",
  Kozhikode: "Kerala",
  Lucknow: "Uttar Pradesh",
  Ludhiana: "Punjab",
  Madurai: "Tamil Nadu",
  Mangaluru: "Karnataka",
  Meerut: "Uttar Pradesh",
  Mohali: "Punjab",
  Moradabad: "Uttar Pradesh",
  Mumbai: "Maharashtra",
  Mysuru: "Karnataka",
  Nagpur: "Maharashtra",
  Nashik: "Maharashtra",
  NaviMumbai: "Maharashtra",
  Noida: "Uttar Pradesh",
  Panaji: "Goa",
  Patna: "Bihar",
  PimpriChinchwad: "Maharashtra",
  Prayagraj: "Uttar Pradesh",
  Pune: "Maharashtra",
  Raipur: "Chhattisgarh",
  Rajkot: "Gujarat",
  Ranchi: "Jharkhand",
  Rourkela: "Odisha",
  Shillong: "Meghalaya",
  Shimla: "Himachal Pradesh",
  Siliguri: "West Bengal",
  Srinagar: "Jammu and Kashmir",
  Surat: "Gujarat",
  Thane: "Maharashtra",
  Thiruvananthapuram: "Kerala",
  Thrissur: "Kerala",
  Tiruchirappalli: "Tamil Nadu",
  Tiruppur: "Tamil Nadu",
  Udaipur: "Rajasthan",
  Vadodara: "Gujarat",
  Varanasi: "Uttar Pradesh",
  Vijayawada: "Andhra Pradesh",
  Visakhapatnam: "Andhra Pradesh",
  Warangal: "Telangana",
};

const CITY_ALIASES = {
  "Greater Noida": "GreaterNoida",
  "Navi Mumbai": "NaviMumbai",
  "Pimpri Chinchwad": "PimpriChinchwad",
  Trivandrum: "Thiruvananthapuram",
  Bangalore: "Bengaluru",
  Bombay: "Mumbai",
  Calcutta: "Kolkata",
  Madras: "Chennai",
};

const normalizeCityKey = (value = "") => String(value).replace(/\s+/g, "").trim();

const getMappedStateForCity = (city = "") => {
  const cleaned = String(city || "").trim();
  if (!cleaned) {
    return "";
  }

  const aliasKey = CITY_ALIASES[cleaned] || cleaned;
  const normalized = normalizeCityKey(aliasKey);
  const match = Object.entries(CITY_STATE_MAP).find(
    ([name]) => normalizeCityKey(name).toLowerCase() === normalized.toLowerCase()
  );

  return match?.[1] || "";
};

module.exports = {
  CITY_STATE_MAP,
  getMappedStateForCity,
};

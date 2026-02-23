export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz" },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "BWP", name: "Botswana Pula", symbol: "P" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "CDF", name: "Congolese Franc", symbol: "FC" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CLP", name: "Chilean Peso", symbol: "CL$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "COP", name: "Colombian Peso", symbol: "CO$" },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "Esc" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fdj" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "FJD", name: "Fijian Dollar", symbol: "FJ$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵" },
  { code: "GMD", name: "Gambian Dalasi", symbol: "D" },
  { code: "GNF", name: "Guinean Franc", symbol: "FG" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "KMF", name: "Comorian Franc", symbol: "CF" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "LRD", name: "Liberian Dollar", symbol: "L$" },
  { code: "LSL", name: "Lesotho Loti", symbol: "L" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD" },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "Rs" },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
  { code: "NAD", name: "Namibian Dollar", symbol: "N$" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "PGK", name: "Papua New Guinean Kina", symbol: "K" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "SBD", name: "Solomon Islands Dollar", symbol: "SI$" },
  { code: "SCR", name: "Seychellois Rupee", symbol: "SCR" },
  { code: "SDG", name: "Sudanese Pound", symbol: "SDG" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "SLL", name: "Sierra Leonean Leone", symbol: "Le" },
  { code: "SOS", name: "Somali Shilling", symbol: "Sh" },
  { code: "SSP", name: "South Sudanese Pound", symbol: "SSP" },
  { code: "STN", name: "São Tomé Dobra", symbol: "Db" },
  { code: "SZL", name: "Swazi Lilangeni", symbol: "E" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "TND", name: "Tunisian Dinar", symbol: "DT" },
  { code: "TOP", name: "Tongan Pa'anga", symbol: "T$" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { code: "VUV", name: "Vanuatu Vatu", symbol: "VT" },
  { code: "WST", name: "Samoan Tala", symbol: "WS$" },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA" },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
];

export function getCurrencySymbol(currencyCode: string): string {
  const currency = CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || currencyCode;
}

export function getCurrencyInfo(currencyCode: string): CurrencyInfo {
  return CURRENCIES.find(c => c.code === currencyCode) || { code: currencyCode, name: currencyCode, symbol: currencyCode };
}

export function formatCurrency(amount: number | string, currencyCode: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${getCurrencySymbol(currencyCode)} 0`;
  return `${getCurrencySymbol(currencyCode)} ${num.toLocaleString()}`;
}

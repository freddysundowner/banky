export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "KES", name: "Kenya Shilling", symbol: "KSh" },
  { code: "UGX", name: "Uganda Shilling", symbol: "USh" },
  { code: "TZS", name: "Tanzania Shilling", symbol: "TSh" },
  { code: "RWF", name: "Rwanda Franc", symbol: "FRw" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "BWP", name: "Botswana Pula", symbol: "P" },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz" },
  { code: "CDF", name: "Congolese Franc", symbol: "FC" },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA" },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD" },
  { code: "TND", name: "Tunisian Dinar", symbol: "DT" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$" },
  { code: "CLP", name: "Chilean Peso", symbol: "CL$" },
  { code: "COP", name: "Colombian Peso", symbol: "CO$" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "FJD", name: "Fijian Dollar", symbol: "FJ$" },
  { code: "PGK", name: "Papua New Guinean Kina", symbol: "K" },
  { code: "WST", name: "Samoan Tala", symbol: "WS$" },
  { code: "TOP", name: "Tongan Pa'anga", symbol: "T$" },
  { code: "SBD", name: "Solomon Islands Dollar", symbol: "SI$" },
  { code: "VUV", name: "Vanuatu Vatu", symbol: "VT" },
  { code: "SCR", name: "Seychellois Rupee", symbol: "SCR" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "Rs" },
  { code: "GMD", name: "Gambian Dalasi", symbol: "D" },
  { code: "SLL", name: "Sierra Leonean Leone", symbol: "Le" },
  { code: "LRD", name: "Liberian Dollar", symbol: "L$" },
  { code: "SSP", name: "South Sudanese Pound", symbol: "SSP" },
  { code: "SOS", name: "Somali Shilling", symbol: "Sh" },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fdj" },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk" },
  { code: "SDG", name: "Sudanese Pound", symbol: "SDG" },
  { code: "LSL", name: "Lesotho Loti", symbol: "L" },
  { code: "SZL", name: "Swazi Lilangeni", symbol: "E" },
  { code: "NAD", name: "Namibian Dollar", symbol: "N$" },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu" },
  { code: "KMF", name: "Comorian Franc", symbol: "CF" },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar" },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "Esc" },
  { code: "STN", name: "São Tomé Dobra", symbol: "Db" },
  { code: "GNF", name: "Guinean Franc", symbol: "FG" },
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

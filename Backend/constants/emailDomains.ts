/**
 * Popular email domains allowed for registration
 * This list includes major email providers worldwide
 */
export const ALLOWED_EMAIL_DOMAINS = [
    /* =========================
       Google
    ========================== */
    'gmail.com',
    'googlemail.com',
  
    /* =========================
       Microsoft
    ========================== */
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
  
    /* =========================
       Yahoo (Global + Regional)
    ========================== */
    'yahoo.com',
    'yahoo.co.uk',
    'yahoo.fr',
    'yahoo.de',
    'yahoo.es',
    'yahoo.it',
    'yahoo.in',
    'yahoo.ca',
    'yahoo.com.au',
    'yahoo.com.br',
    'yahoo.com.mx',
    'yahoo.co.jp',
    'ymail.com',
    'rocketmail.com',
  
    /* =========================
       Apple
    ========================== */
    'icloud.com',
    'me.com',
    'mac.com',
  
    /* =========================
       AOL
    ========================== */
    'aol.com',
    'aol.co.uk',
    'aol.fr',
    'aol.de',
  
    /* =========================
       Proton (Privacy-focused)
    ========================== */
    'proton.me',
    'protonmail.com',
  
    /* =========================
       Zoho (Business & Personal)
    ========================== */
    'zoho.com',
    'zohomail.com',
  
    /* =========================
       GMX
    ========================== */
    'gmx.com',
    'gmx.de',
    'gmx.fr',
    'gmx.co.uk',
  
    /* =========================
       Fast & Secure Mail Providers
    ========================== */
    'fastmail.com',
    'tutanota.com',
    'hushmail.com',
  
    /* =========================
       Yandex (Regional)
    ========================== */
    'yandex.com',
    'yandex.ru',
    'yandex.kz',
    'yandex.by',
  
    /* =========================
       Mail.com Network
    ========================== */
    'mail.com',
    'email.com',
  
    /* =========================
       Regional / Legacy Providers
    ========================== */
    'rediffmail.com',
    'inbox.com',
    'aim.com',
  
    /* =========================
       ISP / Telecom (Common)
    ========================== */
    'att.net',
    'verizon.net',
    'comcast.net',
    'cox.net',
    'sbcglobal.net',
    'btinternet.com',
    'virginmedia.com',
  
    /* =========================
       Enterprise Email Hosting
    ========================== */
    'office365.com',
    'exchange.microsoft.com',
  
  ] as const;
  

/**
 * Check if an email domain is in the allowed list
 */
export const isAllowedEmailDomain = (domain: string): boolean => {
  const normalizedDomain = domain.toLowerCase().trim();
  return ALLOWED_EMAIL_DOMAINS.includes(normalizedDomain as typeof ALLOWED_EMAIL_DOMAINS[number]);
};


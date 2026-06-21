import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Lazy loading locale loader helper using Vite code-splitting dynamic imports
const loadResources = async (lng) => {
  try {
    let localeData;
    switch (lng) {
      case 'hi':
        localeData = await import('./locales/hi.json');
        break;
      case 'ta':
        localeData = await import('./locales/ta.json');
        break;
      case 'te':
        localeData = await import('./locales/te.json');
        break;
      case 'bn':
        localeData = await import('./locales/bn.json');
        break;
      case 'en':
      default:
        localeData = await import('./locales/en.json');
        break;
    }
    i18n.addResourceBundle(lng, 'translation', localeData.default || localeData, true, true);
  } catch (err) {
    console.error(`Error loading translation file for language ${lng}:`, err);
  }
};

const initialLng = localStorage.getItem('imprint_lang') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {},
    lng: initialLng,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

// Pre-load the active language and the fallback language (English)
loadResources('en').then(() => {
  if (initialLng !== 'en') {
    loadResources(initialLng);
  }
});

// Listen to language change to load dynamic bundles on demand
i18n.on('languageChanged', (lng) => {
  loadResources(lng);
});

export default i18n;

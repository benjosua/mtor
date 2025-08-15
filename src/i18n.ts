import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { translations, type Locale } from './data/master-library';
import { uiTranslations } from './data/ui-translations';
import { generalMuscleTranslations } from './lib/muscleUtils';

function createResources() {
    const resources: Record<Locale, { translation: Record<string, string> }> = {
        en: { translation: {} },
        es: { translation: {} },
        de: { translation: {} },
    };

    const processTranslations = (source: any, prefix: string) => {
        for (const locale of ['en', 'es', 'de'] as Locale[]) {
            for (const category of Object.keys(source) as (keyof typeof source)[]) {
                const categoryData = source[category];

                if (!categoryData || typeof categoryData !== 'object') {
                    continue;
                }

                for (const key in categoryData) {
                    const i18nString = categoryData[key as keyof typeof categoryData];

                    if (!i18nString || typeof i18nString !== 'object' ||
                        !('en' in i18nString) || typeof i18nString.en !== 'string') {
                        continue;
                    }

                    const fullKey = `${prefix}${String(category)}.${key}`;
                    resources[locale].translation[fullKey] = (i18nString as any)[locale] || (i18nString as any).en;
                }
            }
        }
    };

    processTranslations(translations, ''); 
    processTranslations(uiTranslations, '');

    for (const locale of ['en', 'es', 'de'] as const) {
        for (const key in generalMuscleTranslations) {
            const fullKey = `generalMuscles.${key}`;
            const translationObject = generalMuscleTranslations[key as keyof typeof generalMuscleTranslations];
            resources[locale].translation[fullKey] = translationObject[locale] || translationObject.en;
        }
    }

    return resources;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: import.meta.env?.DEV || false,
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'de'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false,
    },
    resources: createResources(),
  });

export default i18n;
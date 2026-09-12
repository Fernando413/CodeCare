/*
 * Pachetele din pachete.html, intr-un singur loc.
 *
 * Textele NU stau aici. Sistemul de traducere din scripts.js citeste romana
 * direct din HTML (fiecare [data-translate]) si engleza din en.json, deci
 * textul unui pachet se scrie o singura data, in articolul lui din pagina.
 * Aici stau structura si cheile de traducere; pachete.js construieste din ele
 * tot ce repeta pachetele (cele patru directii din hero, bara de navigare
 * dintre pachete, raspunsurile de la „Nu stii ce sa alegi?”) si copiaza textul
 * din articolul pachetului, cu aceeasi cheie. Un nume sau un termen schimbat in
 * articol apare peste tot.
 *
 * Pagina nu afiseaza preturi, intentionat: proprietarul nu vrea ca o suma sa
 * sperie clientul, nici ca prea mare, nici ca prea mica.
 *
 *   id        ancora articolului (pachete.html#site-business se trimite clientilor)
 *   nr        numarul afisat
 *   nivel     1–4, complexitatea; da inaltimea blocului din hero si „etajele” lui
 *   serviciu  valoarea din formularul de pe prima pagina (index.html?serviciu=…),
 *             trebuie sa fie identica cu .custom-option[data-value] de acolo
 *   chei      cheile de traducere ale textelor refolosite
 */
window.CC_PACHETE = [
    {
        id: 'landing-page',
        nr: '01',
        nivel: 1,
        serviciu: 'landing-page',
        chei: {
            nume: 'price_start_title',
            nivel: 'prices_p1_level',
            termen: 'prices_p1_term',
            potrivit: 'price_start_fit'
        }
    },
    {
        id: 'site-prezentare',
        nr: '02',
        nivel: 2,
        serviciu: 'site-prezentare',
        chei: {
            nume: 'price_basic_title',
            nivel: 'prices_p2_level',
            termen: 'prices_p2_term',
            potrivit: 'price_basic_fit'
        }
    },
    {
        id: 'site-business',
        nr: '03',
        nivel: 3,
        serviciu: 'site-business',
        chei: {
            nume: 'price_biz_title',
            nivel: 'prices_p3_level',
            termen: 'prices_p3_term',
            potrivit: 'price_biz_fit'
        }
    },
    {
        id: 'aplicatii-custom',
        nr: '04',
        nivel: 4,
        serviciu: 'custom-app',
        chei: {
            nume: 'price_pro_title',
            nivel: 'prices_p4_level',
            termen: 'prices_p4_term',
            potrivit: 'price_pro_fit'
        }
    }
];

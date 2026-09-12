/*
 * Proiectele din proiecte.html, intr-un singur loc.
 *
 * Ca la pagina de pachete, textele NU stau aici: scripts.js citeste romana din
 * HTML (fiecare [data-translate]) si engleza din en.json, deci titlul, categoria
 * si descrierea unui proiect se scriu o singura data, in <li>-ul lui din pagina.
 * proiecte.js construieste din <li> tot ce repeta un proiect — panoul
 * proiectului din fata orbitei, navigarea 01–07, legaturile din „Ce vezi" si
 * fereastra de detalii — copiind textul impreuna cu cheia lui de traducere.
 *
 * Aici stau doar ordinea pe orbita si zonele. Toate proiectele sunt reale, iar
 * tehnologiile au fost confirmate in sursa fiecarui site (vezi CLAUDE.md):
 * nu adauga proiecte de umplutura.
 *
 *   id    ancora <li>-ului (proiecte.html#seifpro)
 *   nr    numarul afisat, in ordinea de pe orbita
 *   zone  in ce randuri din „Ce vezi" apare proiectul (id-urile din CC_ZONE)
 */
window.CC_PROIECTE = [
    { id: 'bucegi-experience', nr: '01', zone: ['web', 'seo'] },
    { id: 'seifpro', nr: '02', zone: ['mobil', 'date', 'custom'] },
    { id: 'gym-platform', nr: '03', zone: ['platforme', 'date', 'custom'] },
    { id: 'rarcri-invest', nr: '04', zone: ['web'] },
    { id: 'doctor-casa', nr: '05', zone: ['web', 'seo'] },
    { id: 'nova-creatives', nr: '06', zone: ['web'] },
    { id: 'fasttrack', nr: '07', zone: ['mobil', 'custom'] }
];

/* Randurile din „04 / Ce vezi", in ordinea din HTML. */
window.CC_ZONE = ['web', 'mobil', 'platforme', 'date', 'seo', 'custom'];

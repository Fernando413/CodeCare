/*
 * Pagina de proiecte (proiecte.html): orbita proiectelor.
 *
 * Bucatile, in ordine:
 *   1. constructia din date — panourile proiectului din fata, navigarea 01–07,
 *      eticheta si butonul fiecarui obiect de pe orbita si legaturile din
 *      „Ce vezi" se cloneaza din <template>-urile din HTML si se umplu din
 *      <li>-ul fiecarui proiect (ordinea si zonele vin din proiecte-date.js);
 *   2. orbita — derularea da o tinta de rotatie, o bucla requestAnimationFrame
 *      o ajunge din urma lin si asaza fiecare proiect pe cerc;
 *   3. navigarea — click pe un numar sau pe un proiect, sageti, glisare;
 *   4. fereastra de detalii.
 *
 * Constructia ruleaza SINCRON, la incarcarea fisierului: scripts.js citeste
 * textele romanesti la DOMContentLoaded, deci clonele trebuie sa fie deja in
 * pagina ca sa se poata traduce.
 *
 * Nicio biblioteca: transformari CSS 3D si o singura bucla care ruleaza doar cat
 * orbita chiar se misca. Scroll-ul nu are listener propriu — scripts.js tine
 * unul pentru tot site-ul si apeleaza window.acasaLaScroll, pe care o invelim.
 */
(function () {
    'use strict';

    const html = document.documentElement;
    const $ = (id) => document.getElementById(id);
    const limita = (v, a, b) => Math.min(b, Math.max(a, v));

    const pista = $('po-pista');
    const scena = $('po-scena');
    const centru = $('po-centru');
    const inel = $('po-inel');
    const lista = $('po-lista');
    if (!pista || !scena || !lista) return;

    const miscareRedusa = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Pe un ecran foarte scund (telefon tinut orizontal) orbita si panoul nu
    // incap una peste alta: acolo ramane lista editoriala.
    const mediaInaltime = window.matchMedia('(min-height: 500px)');

    html.classList.add('po-js');

    // Perechile proiect – <li>, in ordinea din date. <li>-urile se reaseaza in
    // aceeasi ordine, ca DOM-ul, orbita si navigarea sa spuna acelasi lucru.
    const proiecte = (window.CC_PROIECTE || [])
        .map((date) => ({ date, li: $(date.id) }))
        .filter((p) => p.li);
    proiecte.forEach((p) => lista.appendChild(p.li));
    const N = proiecte.length;
    if (!N) return;
    const TOTAL = String(N).padStart(2, '0');

    document.querySelectorAll('[data-numar-proiecte]').forEach((el) => { el.textContent = TOTAL; });

    // ==================== 1. constructia din date ====================

    // De unde ia fiecare [data-camp] din sabloane textul, in <li>-ul proiectului.
    const SURSE = {
        titlu: '.po-titlu',
        categorie: '.po-categorie',
        descriere: '.po-descriere',
        taguri: '.po-taguri',
        actiune: '.po-actiuni'
    };

    function umple(radacina, proiect) {
        const campuri = [radacina, ...radacina.querySelectorAll('[data-camp]')].filter((x) => x.dataset.camp);
        campuri.forEach((x) => {
            const camp = x.dataset.camp;
            delete x.dataset.camp;

            if (camp === 'nr') {
                x.textContent = proiect.date.nr;
            } else if (camp === 'total') {
                x.textContent = '/ ' + TOTAL;
            } else if (camp === 'ancora') {
                x.setAttribute('href', '#' + proiect.date.id);
            } else if (SURSE[camp]) {
                const sursa = proiect.li.querySelector(SURSE[camp]);
                if (!sursa) {
                    x.remove();
                    return;
                }
                // Cheia de traducere merge odata cu textul: clona se traduce singura.
                if (sursa.hasAttribute('data-translate')) {
                    x.setAttribute('data-translate', sursa.getAttribute('data-translate'));
                }
                x.innerHTML = sursa.innerHTML;
            }
        });
    }

    function clona(idSablon, proiect) {
        const sablon = $(idSablon);
        const model = sablon && sablon.content && sablon.content.firstElementChild;
        if (!model) return null;
        const el = model.cloneNode(true);
        umple(el, proiect);
        return el;
    }

    const panouri = [];
    const butoaneNav = [];
    const butoaneCard = [];
    const voaluri = [];

    function construieste() {
        const hud = $('po-hud');
        const nav = $('po-nav');

        proiecte.forEach((proiect, i) => {
            const interior = proiect.li.querySelector('.po-proiect-interior');

            const panou = clona('po-sablon-hud', proiect);
            if (panou && hud) {
                panou.dataset.index = i;
                hud.appendChild(panou);
                panouri.push(panou);
            }

            const buton = clona('po-sablon-nav', proiect);
            if (buton && nav) {
                buton.dataset.index = i;
                buton.setAttribute('aria-current', 'false');
                nav.appendChild(buton);
                butoaneNav.push(buton);
            }

            const eticheta = clona('po-sablon-card', proiect);
            if (eticheta && interior) interior.appendChild(eticheta);

            const val = document.createElement('span');
            val.className = 'po-val';
            interior.appendChild(val);
            voaluri.push(val);

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'po-card-buton';
            card.dataset.index = i;
            interior.appendChild(card);
            butoaneCard.push(card);

            (proiect.date.zone || []).forEach((zona) => {
                const loc = document.querySelector(`.po-zona[data-zona="${zona}"] .po-zona-proiecte`);
                const legatura = clona('po-sablon-zona', proiect);
                if (loc && legatura) {
                    legatura.dataset.index = i;
                    loc.appendChild(legatura);
                }
            });
        });

        numesteButoanele();
    }

    // Numele butoanelor de pe orbita vin din titlul proiectului; se refac la
    // schimbarea limbii, fiindca aria-label nu trece prin sistemul de traducere.
    function numesteButoanele() {
        proiecte.forEach((proiect, i) => {
            const titlu = proiect.li.querySelector('.po-titlu');
            if (butoaneCard[i] && titlu) butoaneCard[i].setAttribute('aria-label', titlu.textContent.trim());
        });
    }

    // ==================== 2. orbita ====================

    const PAS = 360 / N;              // unghiul dintre doua proiecte
    const unghi = $('po-unghi');

    let orbita = false;
    let geo = null;
    let curent = 0;                   // rotatia desenata, in „proiecte" (0 … N-1)
    let tinta = 0;                    // rotatia ceruta de derulare
    let formare = 1;                  // 0–1: cat din sistem s-a format la intrare
    let formareTinta = 1;
    let activ = -1;
    let bucla = 0;
    let ultimulCadru = 0;

    function inaltimeAntet() {
        return parseFloat(getComputedStyle(html).getPropertyValue('--nav-height')) || 66;
    }

    /*
     * Geometria depinde de latimea scenei. Desktop: raza mare si adancime
     * intreaga. Tableta: orbita mai stransa. Telefon: aproape plata, cu un
     * proiect mare in centru si vecinii lui abia intrand din laterale.
     */
    function masoara() {
        const W = scena.clientWidth || window.innerWidth;
        const mobil = W <= 820;
        const tableta = !mobil && W <= 1100;
        const cardW = mobil ? Math.min(W * 0.76, 440)
            : tableta ? W * 0.44
                : limita(W * 0.36, 360, 560);

        geo = {
            cardW,
            cardH: cardW * 0.625,
            R: mobil ? W * 0.84 : tableta ? W * 0.42 : Math.min(W * 0.4, 600),
            adancime: mobil ? 0.5 : tableta ? 0.8 : 1,
            intoarcere: mobil ? 0.5 : 0.4
        };

        scena.style.setProperty('--card-w', cardW.toFixed(1) + 'px');
        scena.style.setProperty('--r', geo.R.toFixed(1) + 'px');
        pista.style.setProperty('--n', N);
    }

    /* Popas la fiecare proiect: in jurul pozitiei lui, derularea abia misca
       orbita, ca proiectul sa „ajunga" si sa stea in fata cat il citesti;
       intre doua proiecte rotatia accelereaza si incetineste lin. */
    function cuPopas(s) {
        const k = Math.floor(s);
        if (k >= N - 1) return N - 1;
        const fractiune = s - k;
        const POPAS = 0.2;
        const t = limita((fractiune - POPAS) / (1 - 2 * POPAS), 0, 1);
        return k + t * t * (3 - 2 * t);
    }

    function citesteDerularea() {
        if (!orbita) return;
        // Cu meniul de telefon deschis body-ul e fixat si masuratorile ar minti.
        if (document.body.style.position === 'fixed') return;
        if (html.classList.contains('po-detaliu-deschis')) return;

        const vh = window.innerHeight || 800;
        const sus = inaltimeAntet();
        const r = pista.getBoundingClientRect();
        const cursa = Math.max(1, r.height - (vh - sus));
        const p = limita((sus - r.top) / cursa, 0, 1);

        tinta = cuPopas(p * (N - 1));
        // Sistemul se formeaza cat pista urca din josul ecranului pana sub antet.
        formareTinta = limita((vh - r.top) / ((vh - sus) * 0.9), 0, 1);
        pornesteBucla();
    }

    function pornesteBucla() {
        if (bucla) return;
        ultimulCadru = 0;
        bucla = requestAnimationFrame(cadru);
    }

    function cadru(timp) {
        bucla = 0;
        const dt = ultimulCadru ? Math.min(0.05, (timp - ultimulCadru) / 1000) : 1 / 60;
        ultimulCadru = timp;

        // Urmarire exponentiala: independenta de rata de cadre, fara depasire.
        curent += (tinta - curent) * (1 - Math.exp(-dt * 7));
        formare += (formareTinta - formare) * (1 - Math.exp(-dt * 6));
        if (Math.abs(tinta - curent) < 0.0005) curent = tinta;
        if (Math.abs(formareTinta - formare) < 0.002) formare = formareTinta;

        deseneaza();

        if (curent !== tinta || formare !== formareTinta) {
            bucla = requestAnimationFrame(cadru);
        }
    }

    function deseneaza() {
        if (!geo) return;
        const { R, cardH, adancime, intoarcere } = geo;

        proiecte.forEach((proiect, i) => {
            let a = (i - curent) * PAS;
            a = ((a + 180) % 360 + 360) % 360 - 180;       // intre -180 si 180
            const rad = (a * Math.PI) / 180;
            const c = Math.cos(rad);

            const x = Math.sin(rad) * R;
            const z = (c - 1) * R * adancime;
            // La intrarea in sectiune, proiectele urca pe orbita unul dupa altul.
            const aparitie = limita((formare - (i / N) * 0.55) / 0.45, 0, 1);
            const y = (1 - aparitie) * cardH * 0.9;
            const inFata = Math.pow(Math.max(0, c), 10);
            const scara = 1 + 0.05 * inFata;

            proiect.li.style.transform =
                `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) ` +
                `rotateY(${(-a * intoarcere).toFixed(2)}deg) scale(${scara.toFixed(3)})`;
            proiect.li.style.opacity = (aparitie * (0.3 + 0.7 * (c + 1) / 2)).toFixed(3);
            voaluri[i].style.opacity = (((1 - c) / 2) * 0.7).toFixed(3);
        });

        if (inel) {
            inel.style.transform =
                `translateY(${(cardH * 0.72).toFixed(1)}px) translateZ(${(-R * adancime).toFixed(1)}px) ` +
                `rotateX(90deg) scaleY(${adancime}) rotateZ(${(curent * PAS).toFixed(2)}deg)`;
        }

        scena.style.setProperty('--f', formare.toFixed(3));
        scena.style.setProperty('--indiciu', limita(1 - curent * 2.5, 0, 1).toFixed(2));
        if (unghi) unghi.textContent = `θ ${(curent * PAS).toFixed(1).padStart(5, '0')}°`;

        const nou = limita(Math.round(curent), 0, N - 1);
        if (nou !== activ) seteazaActiv(nou);
    }

    function seteazaActiv(i) {
        activ = i;
        proiecte.forEach((proiect, j) => proiect.li.classList.toggle('este-in-fata', j === i));
        panouri.forEach((panou, j) => panou.classList.toggle('este-activ', j === i));
        butoaneNav.forEach((buton, j) => buton.setAttribute('aria-current', String(j === i)));
        // Doar proiectul din fata e in ordinea tastaturii; restul se ajung din 01–07.
        butoaneCard.forEach((buton, j) => { buton.tabIndex = j === i ? 0 : -1; });
    }

    function curataOrbita() {
        proiecte.forEach((proiect) => {
            proiect.li.style.transform = '';
            proiect.li.style.opacity = '';
            proiect.li.classList.remove('este-in-fata');
        });
        voaluri.forEach((val) => { val.style.opacity = ''; });
        if (inel) inel.style.transform = '';
        scena.style.removeProperty('--f');
        activ = -1;
    }

    function aplicaModul() {
        const nou = !miscareRedusa && mediaInaltime.matches;
        if (nou !== orbita) {
            orbita = nou;
            html.classList.toggle('po-orbita', nou);
            if (!nou) {
                cancelAnimationFrame(bucla);
                bucla = 0;
                curataOrbita();
                return;
            }
        }
        if (!orbita) return;

        masoara();
        citesteDerularea();
        // La incarcare (sau dupa redimensionare) orbita sare direct in pozitie;
        // doar derularea de dupa se anima.
        cancelAnimationFrame(bucla);
        bucla = 0;
        curent = tinta;
        formare = formareTinta;
        deseneaza();
    }

    // ==================== 3. navigarea ====================

    function pozitiaProiectului(i) {
        const sus = inaltimeAntet();
        const inceput = pista.getBoundingClientRect().top + window.scrollY;
        const cursa = pista.offsetHeight - (window.innerHeight - sus);
        return inceput - sus + (N > 1 ? i / (N - 1) : 0) * cursa;
    }

    /* Rotirea spre un proiect trece tot prin derulare: pagina ajunge unde ar fi
       ajuns si cu rotita, deci derularea ramane singura sursa de adevar. */
    function mergiLa(i, instant) {
        const index = limita(i, 0, N - 1);
        if (!orbita) {
            proiecte[index].li.scrollIntoView({ behavior: instant || miscareRedusa ? 'auto' : 'smooth', block: 'start' });
            return;
        }
        window.scrollTo({ top: pozitiaProiectului(index), behavior: instant || miscareRedusa ? 'auto' : 'smooth' });
    }

    function pornesteNavigarea() {
        butoaneNav.forEach((buton) => {
            buton.addEventListener('click', () => mergiLa(Number(buton.dataset.index)));
        });

        // Proiectul din fata se deschide; unul din lateral vine mai intai in fata.
        butoaneCard.forEach((buton) => {
            buton.addEventListener('click', () => {
                const i = Number(buton.dataset.index);
                if (i === activ) deschideDetaliu(i);
                else mergiLa(i);
            });
        });

        panouri.forEach((panou) => {
            const detalii = panou.querySelector('.po-hud-detalii');
            if (detalii) detalii.addEventListener('click', () => deschideDetaliu(Number(panou.dataset.index)));
        });

        // Legaturile din „Ce vezi" duc la proiect pe orbita. Ascultatorul e pus
        // inaintea celui din scripts.js (care ar sari la <li>, adica la inceputul
        // pistei, nu la proiect), deci il poate opri.
        document.querySelectorAll('.po-zona-link').forEach((legatura) => {
            legatura.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                mergiLa(Number(legatura.dataset.index));
            });
        });

        // Sageti, cand focusul e in scena.
        scena.addEventListener('keydown', (e) => {
            if (!orbita) return;
            if (e.target.closest && e.target.closest('.po-hud-panou') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
            const inainte = e.key === 'ArrowRight' || e.key === 'ArrowDown';
            const inapoi = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
            if (!inainte && !inapoi) return;
            e.preventDefault();
            const tintaNoua = limita(activ + (inainte ? 1 : -1), 0, N - 1);
            mergiLa(tintaNoua);
            if (butoaneNav[tintaNoua]) butoaneNav[tintaNoua].focus({ preventScroll: true });
        });

        // Glisare pe orizontala pe telefon: proiectul urmator sau precedent.
        // Derularea pe verticala ramane a browserului.
        let start = null;
        scena.addEventListener('touchstart', (e) => {
            if (!orbita || e.touches.length !== 1) return;
            start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: true });
        scena.addEventListener('touchend', (e) => {
            if (!start || !orbita) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            start = null;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                mergiLa(activ + (dx < 0 ? 1 : -1));
            }
        }, { passive: true });
    }

    // ==================== 4. fereastra de detalii ====================

    const fereastra = $('po-detaliu');
    const corp = $('po-detaliu-corp');

    function deschideDetaliu(i) {
        const proiect = proiecte[i];
        if (!proiect) return;

        // Fara <dialog> (browsere foarte vechi), actiunea proiectului ramane cea
        // de pe pagina: linkul spre site, daca are unul.
        if (!fereastra || !corp || typeof fereastra.showModal !== 'function') {
            const link = proiect.li.querySelector('.po-live');
            if (link) window.open(link.href, '_blank', 'noopener');
            return;
        }

        const sursaPoza = proiect.li.querySelector('.po-poza');
        const inainte = sursaPoza ? sursaPoza.getBoundingClientRect() : null;

        const copie = proiect.li.querySelector('.po-proiect-interior').cloneNode(true);
        copie.querySelectorAll('.po-card-eticheta, .po-card-buton, .po-val').forEach((el) => el.remove());
        const titlu = copie.querySelector('.po-titlu');
        if (titlu) titlu.id = 'po-detaliu-titlu';
        corp.replaceChildren(copie);
        fereastra.setAttribute('aria-labelledby', 'po-detaliu-titlu');

        html.classList.add('po-detaliu-deschis');
        fereastra.showModal();

        // Poza „creste" din locul ei de pe orbita pana in fereastra.
        const poza = copie.querySelector('.po-poza');
        if (!miscareRedusa && poza && poza.animate && inainte && inainte.width) {
            const dupa = poza.getBoundingClientRect();
            if (dupa.width) {
                poza.animate([
                    {
                        transformOrigin: '0 0',
                        transform: `translate(${inainte.left - dupa.left}px, ${inainte.top - dupa.top}px) ` +
                            `scale(${inainte.width / dupa.width}, ${inainte.height / dupa.height})`
                    },
                    { transformOrigin: '0 0', transform: 'none' }
                ], { duration: 700, easing: 'cubic-bezier(.16, 1, .3, 1)' });
            }
        }
    }

    function pornesteFereastra() {
        if (!fereastra) return;
        const inchide = $('po-detaliu-inchide');
        if (inchide) inchide.addEventListener('click', () => fereastra.close());
        // Click pe fundalul din jurul ferestrei o inchide.
        fereastra.addEventListener('click', (e) => {
            if (e.target === fereastra) fereastra.close();
        });
        fereastra.addEventListener('close', () => {
            html.classList.remove('po-detaliu-deschis');
            corp.replaceChildren();
        });
    }

    // ==================== pornirea ====================

    construieste();
    pornesteNavigarea();
    pornesteFereastra();
    aplicaModul();

    if (mediaInaltime.addEventListener) mediaInaltime.addEventListener('change', aplicaModul);
    else if (mediaInaltime.addListener) mediaInaltime.addListener(aplicaModul);

    window.addEventListener('resize', aplicaModul);

    // Pozele si fonturile care sosesc dupa prima desenare pot muta pista.
    window.addEventListener('load', aplicaModul);

    new MutationObserver(numesteButoanele).observe(html, { attributes: true, attributeFilter: ['lang'] });

    document.addEventListener('DOMContentLoaded', () => {
        // acasa.js si-a pus deja window.acasaLaScroll (fisierul lui e inaintea
        // acestuia): il invelim, nu il inlocuim.
        const anterior = window.acasaLaScroll;
        window.acasaLaScroll = (y) => {
            if (typeof anterior === 'function') anterior(y);
            citesteDerularea();
        };

        // Un link spre un proiect anume (proiecte.html#seifpro) aduce proiectul in fata.
        const tintaAdresa = window.location.hash && proiecte.findIndex((p) => '#' + p.date.id === window.location.hash);
        if (tintaAdresa > -1 && orbita) {
            requestAnimationFrame(() => mergiLa(tintaAdresa, true));
        }
    });
})();

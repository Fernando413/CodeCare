/*
 * Pagina de pachete (pachete.html): configuratorul.
 *
 * Sase bucati, fiecare cu functia ei:
 *   1. constructia din date — tot ce repeta pachetele se cloneaza din
 *      <template>-urile din HTML si se umple din CC_PACHETE (pachete-date.js);
 *   2. scenele — hero-ul, cele trei desene de pachet, sistemul de la Custom si
 *      linia procesului, conduse de derulare pe ecran lat;
 *   3. bara dintre pachete — ce pachet citesti si cat din el;
 *   4. „Ce include si ce nu" — deschiderea detaliilor;
 *   5. „Nu stii ce sa alegi?" — intrebarea care aprinde pachetul potrivit;
 *   6. variabilele costului — taburile din arbore.
 *
 * Constructia si modul scenelor ruleaza SINCRON, cand se incarca fisierul:
 * scripts.js citeste textele romanesti din pagina la DOMContentLoaded, deci ce
 * cloneaza aici trebuie sa fie deja in pagina atunci, ca sa poata fi tradus;
 * iar hero-ul trebuie asezat inainte de prima desenare, altfel blocurile lui
 * s-ar vedea o clipa inainte sa coboare sub linia de orizont.
 *
 * Scroll-ul nu are listener propriu: scripts.js tine unul pentru tot site-ul
 * si apeleaza window.acasaLaScroll, pe care acasa.js o seteaza la
 * DOMContentLoaded; aici o invelim (vezi finalul fisierului).
 */
(function () {
    'use strict';

    const html = document.documentElement;
    const PACHETE = window.CC_PACHETE || [];
    const miscareRedusa = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Scenele lipite cer loc: pe ecran scund sau ingust n-ar incapea sub bare.
    const mediaScena = window.matchMedia('(min-width: 1024px) and (min-height: 700px)');
    const mediaHover = window.matchMedia('(hover: hover) and (pointer: fine)');

    const $ = (id) => document.getElementById(id);
    const limita = (v, a, b) => Math.min(b, Math.max(a, v));

    html.classList.add('pc-js');

    // ==================== 1. constructia din date ====================

    /*
     * Fiecare [data-camp] dintr-un sablon primeste ce ii trebuie din pachet.
     * Textele se copiaza din articolul pachetului, impreuna cu cheia lor de
     * traducere — asa clona se traduce singura, ca originalul.
     */
    function umple(el, pachet, articol) {
        const campuri = [el, ...el.querySelectorAll('[data-camp]')].filter((x) => x.dataset.camp);
        campuri.forEach((x) => {
            const camp = x.dataset.camp;
            delete x.dataset.camp;

            if (camp === 'nr') {
                x.textContent = pachet.nr;
            } else if (camp === 'ancora') {
                x.setAttribute('href', '#' + pachet.id);
            } else if (camp === 'oferta') {
                x.setAttribute('href', `index.html?serviciu=${pachet.serviciu}#contact`);
            } else if (camp === 'bare') {
                x.innerHTML = [1, 2, 3, 4].map((n) => (n <= pachet.nivel ? '<i class="plin"></i>' : '<i></i>')).join('');
            } else if (pachet.chei[camp]) {
                const cheie = pachet.chei[camp];
                const sursa = articol.querySelector(`[data-translate="${cheie}"]`);
                x.setAttribute('data-translate', cheie);
                x.innerHTML = sursa ? sursa.innerHTML : '';
            }
        });
    }

    function construieste() {
        const locuri = [
            ['pc-sablon-directie', 'pc-directii'],
            ['pc-sablon-sina', 'pc-sina'],
            ['pc-sablon-harta', 'pc-harta-mica'],
            ['pc-sablon-rezultat', 'pc-rezultate']
        ];

        locuri.forEach(([idSablon, idLoc]) => {
            const sablon = $(idSablon);
            const loc = $(idLoc);
            const model = sablon && sablon.content && sablon.content.firstElementChild;
            if (!model || !loc) return;

            PACHETE.forEach((pachet, i) => {
                const articol = $(pachet.id);
                if (!articol) return;
                const el = model.cloneNode(true);
                el.dataset.pachet = pachet.id;
                el.style.setProperty('--nivel', pachet.nivel);
                el.style.setProperty('--i', i);
                umple(el, pachet, articol);
                loc.appendChild(el);
            });
        });
    }

    // ==================== 2. scenele ====================

    /*
     * O scena: `el` e elementul masurat la derulare, `tinta` cel urmarit in
     * modul simplu, `progres` transforma pozitia lui in 0–1, `seteaza` deseneaza
     * starea, `reset` sterge ce a pus. `valoare` tine ultima stare desenata,
     * ca derularea sa nu rescrie DOM-ul cand nimic nu s-a schimbat.
     */
    const scene = [];
    let modScroll = false;
    let inaltimeAntet = 66;
    let inaltimeSina = 52;
    let observator = null;
    let masoaraCronologia = () => {};

    function masoara() {
        inaltimeAntet = parseFloat(getComputedStyle(html).getPropertyValue('--nav-height')) || 66;
        inaltimeSina = parseFloat(getComputedStyle(document.body).getPropertyValue('--sina-h')) || 52;
        masoaraCronologia();
    }

    /* 01: pagina se construieste pe etape — cadru, navigatie, hero, servicii,
       contact, online. Fara progres (modul simplu, inainte sa ajunga pe
       ecran) nu se vede nimic; pe ecran lat cadrul e acolo de la inceput. */
    function seteazaEtapele(scena, k) {
        const etapa = k <= 0 ? (modScroll ? 1 : 0) : Math.min(6, 1 + Math.floor(k * 6));
        scena.querySelectorAll('[data-e]').forEach((el) => {
            const e = Number(el.dataset.e);
            el.classList.toggle('este-activ', e <= etapa);
            el.classList.toggle('este-curent', e === etapa);
        });
        scena.classList.toggle('este-live', etapa >= 6);
    }

    function curataEtapele(scena) {
        scena.querySelectorAll('[data-e]').forEach((el) => el.classList.remove('este-activ', 'este-curent'));
        scena.classList.remove('este-live');
    }

    /* 02, 03 si 04: desenul intreg atarna de `--k` in CSS. */
    function seteazaContinuu(scena, k) {
        scena.style.setProperty('--k', k.toFixed(3));
        scena.classList.toggle('este-complet', k >= 0.97);
    }

    function curataContinuu(scena) {
        scena.style.removeProperty('--k');
        scena.classList.remove('este-complet');
    }

    function pregatesteScenele() {
        const hero = $('pc-hero');
        const directii = () => Array.from(document.querySelectorAll('.pc-directie'));

        // Hero-ul: blocurile urca pe rand din linia de jos. Doar pe ecran lat;
        // in modul simplu stau la locul lor de la inceput.
        if (hero) {
            scene.push({
                el: hero,
                doarScroll: true,
                progres: (r, vh) => limita((inaltimeAntet - r.top) / Math.max(1, r.height - (vh - inaltimeAntet)), 0, 1),
                seteaza: (p) => {
                    hero.style.setProperty('--hp', p.toFixed(3));
                    directii().forEach((li, i) => {
                        li.style.setProperty('--r', limita((p - 0.04 - i * 0.1) / 0.4, 0, 1).toFixed(3));
                    });
                },
                reset: () => {
                    hero.style.removeProperty('--hp');
                    directii().forEach((li) => li.style.removeProperty('--r'));
                }
            });
        }

        // Pachetele 01–03: scena lipita se completeaza pana pe la jumatatea
        // articolului, ca omul sa apuce sa vada desenul intreg cat citeste.
        document.querySelectorAll('.pc-pachet:not(.pc-pachet--custom)').forEach((articol) => {
            const scena = articol.querySelector('.pc-scena');
            if (!scena) return;
            const peEtape = scena.dataset.scena === 'landing';
            scene.push({
                el: articol,
                tinta: scena,
                progres: (r, vh) => limita((vh * 0.6 - r.top) / (vh * 0.6 + Math.max(1, r.height - vh) * 0.6), 0, 1),
                seteaza: (k) => {
                    articol.style.setProperty('--pk', k.toFixed(3));
                    if (peEtape) seteazaEtapele(scena, k);
                    else seteazaContinuu(scena, k);
                },
                reset: () => {
                    articol.style.removeProperty('--pk');
                    if (peEtape) curataEtapele(scena);
                    else curataContinuu(scena);
                }
            });
        });

        // 04: sistemul se leaga nod cu nod cat scena sta lipita, apoi se aprind
        // etichetele cu ce se poate construi.
        const pista = document.querySelector('.pc-custom-pista');
        const sistem = document.querySelector('.pc-sistem');
        if (pista && sistem) {
            scene.push({
                el: pista,
                tinta: sistem,
                progres: (r, vh) => {
                    const sus = inaltimeAntet + inaltimeSina;
                    const cursa = Math.max(1, r.height - (vh - sus));
                    return limita((sus + vh * 0.35 - r.top) / (cursa * 0.75 + vh * 0.35), 0, 1);
                },
                seteaza: (k) => {
                    seteazaContinuu(sistem, k);
                    // Lista e inlocuita intreaga la schimbarea limbii, deci o
                    // cautam din nou de fiecare data.
                    const etichete = sistem.querySelectorAll('.pc-capabilitati li');
                    const aprinse = Math.round(limita((k - 0.5) / 0.45, 0, 1) * etichete.length);
                    etichete.forEach((li, i) => li.classList.toggle('este-activ', i < aprinse));
                },
                reset: () => {
                    curataContinuu(sistem);
                    sistem.querySelectorAll('.pc-capabilitati li').forEach((li) => li.classList.remove('este-activ'));
                }
            });
        }

        // Procesul: linia se trage de la primul cerc la ultimul, iar fiecare pas
        // se aprinde cand linia ajunge la cercul lui.
        const cronologie = $('pc-cronologie');
        if (cronologie) {
            const etape = Array.from(cronologie.querySelectorAll('.pc-etapa'));
            let pozitii = etape.map((_, i) => i / Math.max(1, etape.length - 1));

            // Unde se opreste firul si unde cade fiecare cerc pe el. Pe telefon
            // pasii sunt unul sub altul, cu texte de lungimi diferite, deci
            // cercurile nu stau la distante egale: le masuram.
            masoaraCronologia = () => {
                const ultim = etape[etape.length - 1];
                if (etape.length < 2) return;
                const CENTRU = 28;
                const vertical = etape[1].offsetTop > etape[0].offsetTop + 4;
                if (vertical) {
                    cronologie.style.setProperty('--fir-jos', Math.max(0, cronologie.offsetHeight - ultim.offsetTop - CENTRU) + 'px');
                    cronologie.style.removeProperty('--fir-dreapta');
                    pozitii = etape.map((e) => e.offsetTop / Math.max(1, ultim.offsetTop));
                } else {
                    cronologie.style.setProperty('--fir-dreapta', Math.max(0, cronologie.offsetWidth - ultim.offsetLeft - CENTRU) + 'px');
                    cronologie.style.removeProperty('--fir-jos');
                    pozitii = etape.map((e) => e.offsetLeft / Math.max(1, ultim.offsetLeft));
                }
            };
            masoaraCronologia();

            scene.push({
                el: cronologie,
                tinta: cronologie,
                progres: (r, vh) => limita((vh * 0.78 - r.top) / (vh * 0.45 + r.height * 0.5), 0, 1),
                seteaza: (p) => {
                    cronologie.style.setProperty('--p', p.toFixed(3));
                    etape.forEach((el, i) => el.classList.toggle('este-activ', p > 0 && p >= pozitii[i] - 0.005));
                },
                reset: () => {
                    cronologie.style.removeProperty('--p');
                    etape.forEach((el) => el.classList.remove('este-activ'));
                }
            });
        }
    }

    function deseneaza(scena, valoare) {
        scena.valoare = valoare;
        scena.seteaza(valoare);
    }

    /*
     * Doua moduri. Pe ecran lat scenele urmaresc derularea. Altfel (telefon,
     * tableta, ecran scund) fiecare scena porneste de la zero si se construieste
     * o data, cand ajunge pe ecran, prin tranzitiile din CSS. Cu „miscare
     * redusa" totul e desenat complet de la inceput.
     */
    function aplicaModul() {
        modScroll = !miscareRedusa && mediaScena.matches;
        html.classList.toggle('pc-scroll', modScroll);
        masoara();

        if (observator) {
            observator.disconnect();
            observator = null;
        }

        html.classList.add('pc-fara-tranzitii');
        scene.forEach((s) => {
            s.valoare = null;
            s.reset();
        });

        if (!modScroll) {
            const simple = scene.filter((s) => !s.doarScroll);
            if (miscareRedusa || !('IntersectionObserver' in window)) {
                simple.forEach((s) => deseneaza(s, 1));
            } else {
                simple.forEach((s) => deseneaza(s, 0));
                observator = new IntersectionObserver((intrari) => {
                    intrari.forEach((intrare) => {
                        if (!intrare.isIntersecting) return;
                        const s = simple.find((x) => x.tinta === intrare.target);
                        if (s) deseneaza(s, 1);
                        observator.unobserve(intrare.target);
                    });
                }, { threshold: 0.25 });
                simple.forEach((s) => observator.observe(s.tinta));
            }
        }

        actualizeaza();
        // Citirea forteaza aplicarea valorilor de pornire cat inca nu exista
        // tranzitii; abia apoi le dam drumul.
        void document.body.offsetHeight;
        html.classList.remove('pc-fara-tranzitii');
    }

    let cadruCerut = false;

    function cereActualizare() {
        if (cadruCerut) return;
        cadruCerut = true;
        requestAnimationFrame(actualizeaza);
    }

    function actualizeaza() {
        cadruCerut = false;
        // Cu meniul de telefon deschis, body-ul e fixat si orice masuratoare
        // ar spune ca suntem in capul paginii.
        if (document.body.style.position === 'fixed') return;

        const vh = window.innerHeight || 800;
        actualizeazaSina(vh);
        if (!modScroll) return;

        scene.forEach((s) => {
            const k = Math.round(s.progres(s.el.getBoundingClientRect(), vh) * 1000) / 1000;
            if (k !== s.valoare) deseneaza(s, k);
        });
    }

    // ==================== 3. bara dintre pachete ====================

    let legaturiSina = [];
    let sinaActiva = null;

    function actualizeazaSina(vh) {
        const linie = vh * 0.45;
        let activa = null;

        legaturiSina.forEach((a) => {
            const articol = $(a.dataset.pachet);
            if (!articol) return;
            const r = articol.getBoundingClientRect();
            a.style.setProperty('--f', limita((linie - r.top) / Math.max(1, r.height), 0, 1).toFixed(3));
            const aici = r.top <= linie && r.bottom > linie;
            a.classList.toggle('este-activ', aici);
            if (aici) activa = a;
        });

        // Pe telefon bara deruleaza pe orizontala: pachetul curent vine la mijloc.
        if (activa && activa !== sinaActiva) {
            const banda = activa.parentElement;
            if (banda.scrollWidth > banda.clientWidth + 1) {
                banda.scrollTo({
                    left: activa.offsetLeft - (banda.clientWidth - activa.offsetWidth) / 2,
                    behavior: miscareRedusa ? 'auto' : 'smooth'
                });
            }
        }
        sinaActiva = activa;
    }

    // ==================== 4. ce include si ce nu ====================

    function pornesteDetaliile() {
        document.querySelectorAll('.pc-detalii').forEach((detalii) => {
            const buton = detalii.querySelector('.pc-detalii-buton');
            if (!buton) return;
            buton.addEventListener('click', () => {
                const deschide = !detalii.classList.contains('este-deschis');
                detalii.classList.toggle('este-deschis', deschide);
                buton.setAttribute('aria-expanded', String(deschide));
                // Articolul se lungeste, deci progresul scenei lui se schimba.
                cereActualizare();
            });
        });
    }

    // ==================== 5. nu stii ce sa alegi ====================

    function pornesteAlegerea() {
        const rezultat = $('pc-rezultat');
        const optiuni = Array.from(document.querySelectorAll('.pc-optiune input'));
        if (!rezultat || !optiuni.length) return;

        // Rezultatul e sub intrebare pe telefon. Il aducem pe ecran doar dupa o
        // atingere sau un click — nu si cand cineva trece prin optiuni cu
        // sagetile, unde fiecare apasare ar muta pagina.
        let atingere = 0;
        const intrebare = optiuni[0].closest('fieldset');
        if (intrebare) intrebare.addEventListener('pointerdown', () => { atingere = Date.now(); });

        const alege = (valoare) => {
            optiuni.forEach((input) => {
                input.closest('.pc-optiune').classList.toggle('este-ales', input.value === valoare);
            });

            rezultat.classList.add('are-alegere');
            rezultat.querySelectorAll('.pc-rezultat-panou').forEach((panou) => {
                panou.hidden = (panou.dataset.pachet || panou.dataset.pentru) !== valoare;
            });
            rezultat.querySelectorAll('.pc-harta-mica li').forEach((li) => {
                li.classList.toggle('este-ales', li.dataset.pachet === valoare);
            });

            // Recomandarea se vede si in restul paginii: pe bloc, pe bara si pe articol.
            document.querySelectorAll('.pc-pachet, .pc-directie, .pc-sina-link').forEach((el) => {
                el.classList.toggle('este-recomandat', el.dataset.pachet === valoare);
            });

            if (Date.now() - atingere < 800 && !mediaScena.matches) {
                const r = rezultat.getBoundingClientRect();
                if (r.top > window.innerHeight * 0.6) {
                    rezultat.scrollIntoView({ behavior: miscareRedusa ? 'auto' : 'smooth', block: 'start' });
                }
            }
        };

        optiuni.forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) alege(input.value);
            });
        });
    }

    // ==================== 6. variabilele costului ====================

    function pornesteFactorii() {
        const taburi = Array.from(document.querySelectorAll('.pc-ramura'));
        if (!taburi.length) return;

        const activeaza = (index, cuFocus) => {
            taburi.forEach((tab, i) => {
                const ales = i === index;
                tab.setAttribute('aria-selected', String(ales));
                tab.tabIndex = ales ? 0 : -1;
                const panou = $(tab.getAttribute('aria-controls'));
                if (panou) panou.classList.toggle('este-activ', ales);
            });
            if (cuFocus) taburi[index].focus();
        };

        taburi.forEach((tab, i) => {
            const panou = $(tab.getAttribute('aria-controls'));
            if (panou) panou.tabIndex = 0;

            tab.addEventListener('click', () => activeaza(i, false));
            // Pe desktop e destul sa treci cu mouse-ul pe ramura; clickul ramane
            // pentru touch si tastatura, iar nimic nu se ascunde doar dupa hover.
            tab.addEventListener('mouseenter', () => {
                if (mediaHover.matches) activeaza(i, false);
            });
            tab.addEventListener('keydown', (e) => {
                const n = taburi.length;
                let tinta = null;
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') tinta = (i + 1) % n;
                else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') tinta = (i - 1 + n) % n;
                else if (e.key === 'Home') tinta = 0;
                else if (e.key === 'End') tinta = n - 1;
                if (tinta === null) return;
                e.preventDefault();
                activeaza(tinta, true);
            });
        });

        activeaza(0, false);
    }

    // ==================== semnul din final ====================

    /* Acelasi desen al logo-ului ca in antet si subsol (animatia e in
       acasa.css): porneste cand finalul ajunge pe ecran si se reia la 2,5 s
       dupa fiecare desen, doar cat e vizibil. */
    function pornesteSemnulFinal() {
        const semn = document.querySelector('.pc-final-semn');
        if (!semn || miscareRedusa || !('IntersectionObserver' in window)) return;

        const DURATA = 1900;
        const PAUZA = 2500;
        let ruleaza = false;
        let peEcran = false;
        let urmatoarea = 0;

        const programeaza = () => {
            clearTimeout(urmatoarea);
            urmatoarea = setTimeout(() => {
                if (document.hidden || !peEcran) {
                    programeaza();
                    return;
                }
                reda();
            }, PAUZA);
        };

        const reda = () => {
            if (ruleaza) return;
            ruleaza = true;
            semn.classList.remove('cc-semn--anim', 'cc-semn--asteapta');
            void semn.getBoundingClientRect();
            semn.classList.add('cc-semn--anim');
            setTimeout(() => {
                ruleaza = false;
                programeaza();
            }, DURATA);
        };

        semn.classList.add('cc-semn--asteapta');
        new IntersectionObserver((intrari) => {
            peEcran = intrari.some((i) => i.isIntersecting);
            if (peEcran && !ruleaza && !semn.classList.contains('cc-semn--anim')) reda();
        }, { threshold: 0.6 }).observe(semn);
    }

    // ==================== pornirea ====================

    construieste();
    legaturiSina = Array.from(document.querySelectorAll('.pc-sina-link'));
    pregatesteScenele();
    aplicaModul();
    pornesteDetaliile();
    pornesteAlegerea();
    pornesteFactorii();
    pornesteSemnulFinal();

    if (mediaScena.addEventListener) mediaScena.addEventListener('change', aplicaModul);
    else if (mediaScena.addListener) mediaScena.addListener(aplicaModul);

    window.addEventListener('resize', () => {
        masoara();
        // Masuratorile noi (capetele firului) trebuie redesenate chiar daca
        // progresul a ramas acelasi.
        if (modScroll) scene.forEach((s) => { s.valoare = null; });
        cereActualizare();
    });

    // Fonturile care sosesc dupa prima desenare reaseaza textele, iar pe
    // telefon asta muta cercurile procesului.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            masoaraCronologia();
            cereActualizare();
        });
    }

    // La schimbarea limbii, scripts.js inlocuieste continutul elementelor
    // traduse; clasele puse pe ele (etichetele sistemului) se pierd, asa ca
    // redesenam starea curenta. `lang` se schimba dupa inlocuire.
    new MutationObserver(() => {
        masoaraCronologia();
        scene.forEach((s) => {
            if (typeof s.valoare === 'number') s.seteaza(s.valoare);
        });
    }).observe(html, { attributes: true, attributeFilter: ['lang'] });

    document.addEventListener('DOMContentLoaded', () => {
        // Ascultatorul lui acasa.js a rulat deja (fisierul e inaintea acestuia),
        // deci window.acasaLaScroll exista: il invelim, nu il inlocuim.
        const anterior = window.acasaLaScroll;
        window.acasaLaScroll = (y) => {
            if (typeof anterior === 'function') anterior(y);
            actualizeaza();
        };
        cereActualizare();
    });
})();

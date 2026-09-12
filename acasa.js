/*
 * Prima pagina: comportamentele din designul „CodeCare Homepage v2".
 *
 * scripts.js ramane motorul comun al site-ului (limba, meniul de telefon,
 * formularul, contorul de vizite). Aici stau doar efectele acestei pagini:
 * incarcatorul, hero-ul WebGL, aparitia la derulare, procesul pe orizontala,
 * cifrele si intrebarile.
 *
 * Scroll-ul nu are listener propriu. scripts.js tine un singur handler pentru
 * tot site-ul si apeleaza window.acasaLaScroll la fiecare cadru; aici mai sunt
 * doar `resize` si o verificare la 400 ms, plasa de siguranta din design pentru
 * cazurile in care browserul nu trimite evenimente de scroll (derulare
 * inertiala pe iOS, salt la ancora).
 */
(function () {
    'use strict';

    const html = document.documentElement;
    const miscareRedusa = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ecranMic = window.matchMedia('(max-width: 820px)').matches;
    const CHEIE_INCARCATOR = 'codecare-incarcator';

    // Clasele se pun sincron, inainte de prima desenare: CSS-ul ascunde
    // continutul animat doar cand stie ca scriptul chiar ruleaza. Daca fisierul
    // asta nu se incarca, pagina ramane intreaga si statica.
    html.classList.add('cc-gata');
    if (miscareRedusa) html.classList.add('cc-static');

    // Incarcatorul apare o singura data pe sesiune, si deloc cand vizitatorul
    // vine cu o tinta clara (un link spre #contact din pagina de pachete): nu
    // are rost sa-l tinem o secunda si jumatate in fata formularului cautat.
    let arataIncarcator = !miscareRedusa && !window.location.hash && !window.location.search;
    try {
        if (sessionStorage.getItem(CHEIE_INCARCATOR)) arataIncarcator = false;
    } catch (eroare) {
        /* navigare privata: incarcatorul poate aparea din nou, nu strica nimic */
    }
    if (arataIncarcator) html.classList.add('cc-incarcare');

    const $ = (id) => document.getElementById(id);
    const limita = (v, a, b) => Math.min(b, Math.max(a, v));

    let intro, stage, rezerva, portal, intra, indiciu, fundalFinal;
    let progres, proces, pista, pasBara, grilaCifre;
    let hero = null;
    let introBlocat = false;
    let incarcatorActiv = arataIncarcator;
    let cifrePornite = false;
    let deAratat = [];
    let redaLogoAntet = null;

    document.addEventListener('DOMContentLoaded', porneste);

    function porneste() {
        intro = $('home');
        stage = $('cc-stage');
        rezerva = $('cc-rezerva');
        portal = $('cc-portal');
        intra = $('cc-intra');
        indiciu = $('cc-indiciu');
        fundalFinal = $('cc-fundal-final');
        progres = $('cc-progres');
        proces = $('proces');
        pista = $('cc-pista');
        pasBara = $('cc-pas-bara');
        grilaCifre = document.querySelector('.cc-cifre-grila');

        pregatesteAparitia();
        pregatesteCifrele();
        pornesteIncarcatorul();
        pornesteLogourile();
        pornestePetele();
        pornesteStelele();
        pornesteLumina();
        pornesteIntrebarile();
        pornesteHero();

        window.acasaLaScroll = actualizeaza;
        window.addEventListener('resize', actualizeaza);
        setInterval(() => {
            if (!document.hidden) actualizeaza();
        }, 400);
        actualizeaza();

        // Plasele de siguranta din design: daca dupa 2,5 s nimic n-a aparut
        // (masuratorile au dat gres), aratam tot; iar daca pagina nu se poate
        // derula deloc, sarim direct la finalul hero-ului, ca titlul si
        // butoanele sa fie mereu la indemana.
        setTimeout(() => {
            if (!document.querySelector('[data-reveal].este-vizibil')) arataTot();
        }, 2500);
        setTimeout(() => {
            const doc = document.documentElement;
            const sePoateDerula = doc.scrollHeight - doc.clientHeight > 40;
            if (!sePoateDerula && (window.scrollY || 0) === 0) {
                arataTot();
                fixeazaFinalulIntro();
            }
        }, 2200);
    }

    // ==================== actualizarea la derulare ====================

    function actualizeaza() {
        const vh = window.innerHeight || 800;
        // Cat timp meniul de telefon e deschis, body-ul e position: fixed si
        // window.scrollY citeste 0 — masuratorile ar spune ca suntem sus.
        const blocat = document.body.style.position === 'fixed';

        actualizeazaIntro(vh);

        if (deAratat.length) {
            deAratat = deAratat.filter((el) => {
                const r = el.getBoundingClientRect();
                if (r.top < vh * 0.9 && r.bottom > -40) {
                    el.classList.add('este-vizibil');
                    return false;
                }
                return true;
            });
        }

        if (progres && !blocat) {
            const max = Math.max(1, document.documentElement.scrollHeight - vh);
            progres.style.width = Math.min(100, (window.scrollY || 0) / max * 100) + '%';
        }

        if (proces && pista && !html.classList.contains('cc-static')) {
            const r = proces.getBoundingClientRect();
            const p = limita(-r.top / Math.max(1, r.height - vh), 0, 1);
            // Latimea pistei include padding-ul simetric din CSS, deci ultimul pas
            // se opreste la aceeasi distanta de margine ca primul.
            const distanta = Math.max(0, pista.offsetWidth - pista.parentElement.clientWidth);
            pista.style.transform = `translate3d(${(-p * distanta).toFixed(1)}px,0,0)`;
            if (pasBara) pasBara.style.width = (p * 100).toFixed(1) + '%';
        }

        if (!cifrePornite && !incarcatorActiv && grilaCifre) {
            const r = grilaCifre.getBoundingClientRect();
            if (r.top < vh * 0.9 && r.bottom > 0) pornesteCifrele();
        }

        // Hero-ul se deseneaza doar cat e pe ecran.
        if (hero && intro) {
            const r = intro.getBoundingClientRect();
            hero.setActiv(r.bottom > 0 && r.top < vh);
        }
    }

    // ==================== aparitia ====================

    function pregatesteAparitia() {
        deAratat = Array.from(document.querySelectorAll('[data-reveal]'));

        // Intarziere in trepte de 90 ms intre fratii din aceeasi grila.
        deAratat.forEach((el) => {
            const frati = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
            const i = frati.indexOf(el);
            if (frati.length > 1 && i > 0) el.style.animationDelay = `${i * 90}ms`;
        });

        if (html.classList.contains('cc-static')) arataTot();
    }

    function arataTot() {
        deAratat.forEach((el) => el.classList.add('este-vizibil'));
        deAratat = [];
    }

    // ==================== incarcatorul ====================

    function pornesteIncarcatorul() {
        const loader = $('cc-loader');
        if (!loader) return;
        if (!arataIncarcator) {
            loader.remove();
            return;
        }

        // Marcat la inceput, nu la final: cine pleaca de pe pagina in timpul
        // numaratorii nu trebuie sa o revada la intoarcere.
        try {
            sessionStorage.setItem(CHEIE_INCARCATOR, '1');
        } catch (eroare) {
            /* fara stocare, incarcatorul poate reaparea — inofensiv */
        }

        // 2 s = animatia logo-ului din acasa.css (~1,9 s: desenul, bataia si
        // textul) plus o clipa in care se vede intreg.
        setTimeout(() => {
            loader.classList.add('este-gata');
            incarcatorActiv = false;
            // Logo-ul din antet se deseneaza chiar cand incarcatorul se estompeaza.
            if (redaLogoAntet) redaLogoAntet();
            setTimeout(() => {
                loader.remove();
                html.classList.remove('cc-incarcare');
            }, 850);
            actualizeaza();
        }, 2000);
    }

    // ==================== logo-ul ====================

    /*
     * Acelasi desen ca in incarcator, doar pe semn: textul de sub el nu se
     * misca. Antetul il reda la pornire (sau cand se estompeaza incarcatorul)
     * si la hover; subsolul cand ajunge pe ecran si la hover. Dupa fiecare
     * desen urmeaza o pauza de 2,5 s si semnul se redeseneaza, la nesfarsit.
     * O redare nu poate fi intrerupta de alta — altfel un cursor care trece
     * de doua ori peste logo l-ar reseta la jumatate.
     */
    function pornesteLogourile() {
        if (html.classList.contains('cc-static')) return;
        const DURATA = 1900;
        const PAUZA = 2500;

        const peEcran = (el) => {
            const r = el.getBoundingClientRect();
            return r.bottom > 0 && r.top < (window.innerHeight || 800);
        };

        const reda = (semn) => {
            if (semn.dataset.ruleaza) return;
            clearTimeout(semn.ccUrmatoarea);
            semn.dataset.ruleaza = '1';
            semn.classList.remove('cc-semn--anim', 'cc-semn--asteapta');
            // Citirea dimensiunii forteaza recalcularea stilului: fara ea,
            // scoaterea si punerea clasei in acelasi cadru nu repornesc animatia.
            void semn.getBoundingClientRect();
            semn.classList.add('cc-semn--anim');
            setTimeout(() => {
                delete semn.dataset.ruleaza;
                programeaza(semn);
            }, DURATA);
        };

        // Bucla: cu tab-ul ascuns sau cu logo-ul in afara ecranului (subsolul,
        // cat citesti restul paginii) nu redesenam — doar verificam din nou
        // dupa inca o pauza, ca desenul sa reinceapa cand revii la el.
        const programeaza = (semn) => {
            clearTimeout(semn.ccUrmatoarea);
            semn.ccUrmatoarea = setTimeout(() => {
                if (document.hidden || !peEcran(semn)) {
                    programeaza(semn);
                    return;
                }
                reda(semn);
            }, PAUZA);
        };

        const leaga = (logo) => {
            const semn = logo && logo.querySelector('.cc-semn');
            if (!semn) return null;
            logo.addEventListener('mouseenter', () => reda(semn));
            logo.addEventListener('focus', () => reda(semn));
            return semn;
        };

        const antet = leaga(document.querySelector('.navbar .cc-logo'));
        if (antet) {
            redaLogoAntet = () => reda(antet);
            if (!incarcatorActiv) reda(antet);
        }

        const subsol = leaga(document.querySelector('.cc-subsol .cc-logo'));
        if (subsol && 'IntersectionObserver' in window) {
            subsol.classList.add('cc-semn--asteapta');
            const obs = new IntersectionObserver((intrari) => {
                if (!intrari.some((i) => i.isIntersecting)) return;
                obs.disconnect();
                reda(subsol);
            }, { threshold: 0.8 });
            obs.observe(subsol);
        }
    }

    // ==================== cifrele ====================

    function formateazaCifra(el, k) {
        const tinta = parseFloat(el.dataset.numar) || 0;
        const zecimale = parseInt(el.dataset.zecimale || '0', 10);
        return (el.dataset.prefix || '') + (tinta * k).toFixed(zecimale) + (el.dataset.sufix || '');
    }

    function pregatesteCifrele() {
        // In HTML stau valorile finale (pentru Google si pentru cine n-are JS);
        // cu animatia pornita, ele incep de la zero.
        if (html.classList.contains('cc-static')) return;
        document.querySelectorAll('[data-numar]').forEach((el) => {
            el.textContent = formateazaCifra(el, 0);
        });
    }

    function pornesteCifrele() {
        cifrePornite = true;
        const elemente = Array.from(document.querySelectorAll('[data-numar]'));

        if (html.classList.contains('cc-static')) {
            elemente.forEach((el) => { el.textContent = formateazaCifra(el, 1); });
            return;
        }

        const t0 = performance.now();
        const pas = (t) => {
            const k = Math.min(1, (t - t0) / 1600);
            const e = 1 - Math.pow(1 - k, 3);
            elemente.forEach((el) => { el.textContent = formateazaCifra(el, e); });
            if (k < 1) requestAnimationFrame(pas);
        };
        requestAnimationFrame(pas);
    }

    // ==================== fundalul ====================

    function pornestePetele() {
        const c = $('cc-pete');
        if (!c) return;
        // Pe telefon, un canvas pe tot ecranul cu `filter: blur(54px)` costa mai
        // mult decat aduce; ramane vigneta si grila.
        if (miscareRedusa || ecranMic) {
            c.remove();
            return;
        }

        const W = (c.width = 240);
        const H = (c.height = 150);
        const ctx = c.getContext('2d');
        const pete = [188, 272, 320, 210].map((h, i) => ({
            h,
            x: 0.2 + (i % 2) * 0.6,
            y: 0.25 + Math.floor(i / 2) * 0.5,
            sx: (Math.random() - 0.5) * 0.0018,
            sy: (Math.random() - 0.5) * 0.0018,
            r: 0.4 + Math.random() * 0.35,
            p: Math.random() * 6.28
        }));

        const cadru = (t) => {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#06060d';
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';
            for (const b of pete) {
                b.x += b.sx;
                b.y += b.sy;
                if (b.x < -0.15 || b.x > 1.15) b.sx *= -1;
                if (b.y < -0.15 || b.y > 1.15) b.sy *= -1;
                const puls = 0.85 + 0.15 * Math.sin(t / 1800 + b.p);
                const g = ctx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r * W * puls);
                g.addColorStop(0, `hsla(${b.h}, 88%, 58%, 0.5)`);
                g.addColorStop(0.55, `hsla(${b.h}, 88%, 48%, 0.16)`);
                g.addColorStop(1, 'hsla(0,0%,0%,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            }
            requestAnimationFrame(cadru);
        };
        requestAnimationFrame(cadru);
    }

    /*
     * Stelele din fundalul paginii, in locul grilei de patrate. Fiecare stea are
     * o adancime z (0,2–1) care ii da marimea, luminozitatea si cat aluneca la
     * derulare: cele apropiate se misca mai mult, de aici impresia de 3D. Pe
     * desktop se deplaseaza si putin dupa mouse. Subtile intentionat.
     * Coordonatele sunt relative (0–1), deci o redimensionare nu le amesteca.
     */
    function pornesteStelele() {
        const c = $('cc-stele');
        const ctx = c && c.getContext('2d');
        if (!ctx) return;

        const cuMouse = !miscareRedusa && window.matchMedia('(hover: hover) and (min-width: 821px)').matches;
        const mouse = { x: 0, y: 0, cx: 0, cy: 0 };
        let W = 0;
        let H = 0;
        let stele = [];
        let ultimulScroll = 0;

        const creeaza = () => {
            const n = Math.round(limita((W * H) / 7000, 60, 260));
            // Bara de adresa de pe telefon schimba inaltimea des: pastram stelele
            // cat timp numarul lor ar ramane aproape acelasi.
            if (stele.length && Math.abs(stele.length - n) / n < 0.25) return;
            stele = Array.from({ length: n }, () => {
                const r = Math.random();
                return {
                    x: Math.random(),
                    y: Math.random(),
                    z: 0.2 + Math.pow(Math.random(), 1.6) * 0.8,
                    culoare: r < 0.12 ? '124, 233, 224' : r < 0.2 ? '170, 135, 255' : '255, 255, 255',
                    faza: Math.random() * 6.28,
                    viteza: 0.4 + Math.random() * 1.1
                };
            });
        };

        const potriveste = () => {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            W = window.innerWidth || 1;
            H = window.innerHeight || 1;
            c.width = Math.round(W * dpr);
            c.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            creeaza();
        };

        const deseneaza = (t) => {
            ctx.clearRect(0, 0, W, H);
            // Cu meniul de telefon deschis body-ul e fixat si scrollY citeste 0:
            // stelele ar sari; folosim ultima pozitie reala.
            if (document.body.style.position !== 'fixed') ultimulScroll = window.scrollY || 0;
            const sy = miscareRedusa ? 0 : ultimulScroll;
            mouse.cx += (mouse.x - mouse.cx) * 0.05;
            mouse.cy += (mouse.y - mouse.cy) * 0.05;

            for (const s of stele) {
                let y = (s.y * H - sy * s.z * 0.1 - mouse.cy * s.z * 10) % H;
                if (y < 0) y += H;
                const x = s.x * W - mouse.cx * s.z * 14;
                const clipire = miscareRedusa ? 1 : 0.65 + 0.35 * Math.sin((t / 1000) * s.viteza + s.faza);
                const alfa = (0.1 + s.z * 0.5) * clipire;
                const raza = 0.35 + s.z * 0.95;
                if (s.z > 0.8) {
                    ctx.fillStyle = `rgba(${s.culoare}, ${(alfa * 0.18).toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(x, y, raza * 3.2, 0, 6.2832);
                    ctx.fill();
                }
                ctx.fillStyle = `rgba(${s.culoare}, ${alfa.toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(x, y, raza, 0, 6.2832);
                ctx.fill();
            }
        };

        potriveste();
        window.addEventListener('resize', () => {
            potriveste();
            if (miscareRedusa) deseneaza(0);
        });
        if (cuMouse) {
            window.addEventListener('mousemove', (e) => {
                mouse.x = (e.clientX / W) * 2 - 1;
                mouse.y = (e.clientY / H) * 2 - 1;
            }, { passive: true });
        }

        if (miscareRedusa) {
            deseneaza(0);
            return;
        }

        const cadru = (t) => {
            // Cat timp hero-ul (cu fundal opac) acopera tot ecranul, stelele de
            // dedesubt nu se vad: nu le desenam degeaba.
            const acoperit = intro && intro.getBoundingClientRect().bottom >= H;
            if (!acoperit) deseneaza(t);
            requestAnimationFrame(cadru);
        };
        requestAnimationFrame(cadru);
    }

    function pornesteLumina() {
        const lumina = $('cc-lumina');
        if (!lumina) return;
        if (!window.matchMedia('(hover: hover) and (min-width: 821px)').matches) {
            lumina.remove();
            return;
        }
        window.addEventListener('mousemove', (e) => {
            lumina.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        }, { passive: true });
    }

    // ==================== intrebarile ====================

    function pornesteIntrebarile() {
        const intrebari = Array.from(document.querySelectorAll('.cc-faq'));
        intrebari.forEach((faq) => {
            const buton = faq.querySelector('.cc-faq-intrebare');
            if (!buton) return;
            buton.addEventListener('click', () => {
                const deschide = !faq.classList.contains('este-deschis');
                intrebari.forEach((alta) => {
                    alta.classList.remove('este-deschis');
                    const b = alta.querySelector('.cc-faq-intrebare');
                    if (b) b.setAttribute('aria-expanded', 'false');
                });
                if (deschide) {
                    faq.classList.add('este-deschis');
                    buton.setAttribute('aria-expanded', 'true');
                }
            });
        });
    }

    // ==================== hero-ul ====================

    function pornesteHero() {
        if (!stage || html.classList.contains('cc-static')) return;

        // Codul din hero e esantionat dintr-un canvas scris cu JetBrains Mono.
        // Daca fontul nu e gata, particulele iau forma fontului de rezerva.
        const font = document.fonts && document.fonts.load
            ? Promise.race([
                document.fonts.load('500 56px "JetBrains Mono"'),
                new Promise((gata) => setTimeout(gata, 1500))
            ])
            : Promise.resolve();

        font
            .then(() => import('./hero-portal.js'))
            .then((modul) => {
                const creat = modul.createHero(stage, { onFrame: deseneazaPortal });
                // null = WebGL indisponibil: ramane varianta de rezerva din design.
                if (!creat) return;
                hero = creat;
                html.classList.add('cc-hero-3d');
                if (rezerva) rezerva.style.opacity = '0';
                if (introBlocat) hero.jumpTo(1);
                actualizeaza();
            })
            .catch((eroare) => {
                console.warn('Hero-ul WebGL nu a pornit, raman pe varianta de rezerva:', eroare);
            });
    }

    function actualizeazaIntro(vh) {
        if (!intro || html.classList.contains('cc-static')) return;

        if (introBlocat) {
            if ((window.scrollY || 0) < 20) return;
            introBlocat = false;
            if (portal) {
                portal.style.opacity = '0';
                portal.style.pointerEvents = 'none';
            }
        }

        const r = intro.getBoundingClientRect();
        const p = limita(-r.top / Math.max(1, r.height - vh), 0, 1);

        if (hero) hero.setProgress(p);
        if (indiciu) indiciu.style.opacity = (1 - Math.min(1, p / 0.09)).toFixed(2);
        if (intra) {
            const o = Math.max(0, Math.min((p - 0.84) / 0.06, 1) - Math.max(0, (p - 0.95) / 0.04));
            intra.style.opacity = o.toFixed(2);
        }

        // Fara WebGL (sau pana se incarca), codul static se estompeaza si
        // titlul apare simplu, fara portal.
        if (!hero && rezerva) {
            if (fundalFinal) fundalFinal.style.opacity = limita((p - 0.6) / 0.3, 0, 1).toFixed(2);
            rezerva.style.opacity = (1 - Math.min(1, p / 0.5)).toFixed(2);
            rezerva.style.transform = `scale(${(1 - p * 0.25).toFixed(3)})`;
            if (portal) {
                const o = limita((p - 0.6) / 0.3, 0, 1);
                portal.style.opacity = o.toFixed(2);
                portal.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
            }
        }
    }

    /*
     * Titlul apare din blur, crescand usor, peste fundalul luminos. In design
     * era decupat in forma cadrului portalului; cadrul a fost scos (din el se
     * vedeau doar doua dungi verticale la marginile ecranului), iar o decupare
     * fara chenar ar fi lasat doar margini taiate drept prin text.
     */
    function deseneazaPortal(rect, p) {
        if (!portal || introBlocat) return;

        if (fundalFinal) fundalFinal.style.opacity = limita((p - 0.86) / 0.12, 0, 1).toFixed(2);

        const deschis = p > 0.86 ? (p - 0.86) / 0.14 : 0;

        if (deschis <= 0) {
            portal.style.opacity = '0';
            portal.style.pointerEvents = 'none';
            return;
        }

        if (p >= 0.955) {
            portal.style.opacity = '1';
            portal.style.filter = 'none';
            portal.style.transform = 'none';
            portal.style.pointerEvents = 'auto';
            return;
        }

        portal.style.opacity = (0.18 + 0.82 * Math.min(1, deschis * 1.25)).toFixed(2);
        portal.style.filter = `blur(${(10 * (1 - Math.min(1, deschis * 1.2))).toFixed(1)}px)`;
        portal.style.transform = `scale(${(0.94 + 0.06 * Math.min(1, deschis * 1.3)).toFixed(3)})`;
        portal.style.pointerEvents = 'none';
    }

    function fixeazaFinalulIntro() {
        introBlocat = true;
        if (fundalFinal) fundalFinal.style.opacity = '1';
        if (hero) hero.jumpTo(1);
        if (rezerva) rezerva.style.opacity = '0';
        if (indiciu) indiciu.style.opacity = '0';
        if (intra) intra.style.opacity = '0';
        if (portal) {
            portal.style.opacity = '1';
            portal.style.filter = 'none';
            portal.style.clipPath = 'none';
            portal.style.transform = 'none';
            portal.style.pointerEvents = 'auto';
        }
    }
})();

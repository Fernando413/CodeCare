/**
 * Intro-ul paginii de pachete (adresa a ramas preturi.html).
 *
 * Coregrafia, in ordine:
 *   1. praf de lumina care pluteste in intuneric;
 *   2. un cerc subtire se traseaza in jurul lui;
 *   3. pe cerc apar cinci cuvinte care descriu munca, si se rotesc incet;
 *   4. reperele se strang spre centru si se sparg in particule;
 *   5. particulele se aseaza in cuvantul PACHETE;
 *   6. cuvantul vine spre privitor si trecem prin el in pagina.
 *
 * Trei reguli fara de care animatia ar lucra impotriva paginii:
 *
 *   - **O singura data pe sesiune.** Cine intreaba „cat costa" si revine peste
 *     zece minute nu mai are chef de spectacol.
 *   - **Se poate sari oricand** — click, tasta, derulare, sau butonul din colt.
 *   - **Pagina de dedesubt e intreaga.** Cuvantul desenat aici e decor; titlul
 *     si pachetele sunt text normal in HTML, deci Google si cititoarele de
 *     ecran vad continutul chiar daca animatia nu ruleaza niciodata.
 *
 * Cine are „miscare redusa" pornita in sistem intra direct in pagina.
 */

(function () {
    'use strict';

    const CHEIE_SESIUNE = 'codecare-intro-preturi';

    const cortina = document.getElementById('pret-intro');
    if (!cortina) return;

    const panza = cortina.querySelector('.pret-intro-panza');
    const butonSari = cortina.querySelector('.pret-intro-sari');

    const miscareRedusa = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let vazutaDeja = false;
    try {
        vazutaDeja = sessionStorage.getItem(CHEIE_SESIUNE) === '1';
    } catch (eroare) {
        // Navigare privata: `sessionStorage` arunca. Atunci animatia ruleaza,
        // ceea ce e mai bine decat sa nu se incarce pagina.
    }

    if (miscareRedusa || vazutaDeja || !panza || !panza.getContext) {
        cortina.remove();
        return;
    }

    // ==================== date ====================

    // Cuvintele care se rotesc pe cerc. Pagina nu mai afiseaza preturi, deci
    // nici intro-ul nu mai are sume: se termina in numele paginii, PACHETE.
    const REPERE = ['DESIGN', 'PREMIUM', 'MODERN', 'PERFORMANT', 'INOVATOR'];
    const CUVANT = 'PACHETE';

    const DURATE = {
        praf: 430,        // particulele plutesc singure
        cerc: 520,        // se traseaza cercul
        aparitie: 560,    // cuvintele apar pe cerc, care sta pe loc
        asteptare: 420,   // totul sta nemiscat — omul apuca sa le citeasca
        rotire: 1500,     // cercul se roteste, incet la inceput, tot mai repede
        implozie: 460,    // se strang spre centru, intr-un ghem de lumina
        asezare: 720,     // particulele compun cuvantul
        pauza: 300,       // cuvantul sta intreg o clipa
        apropiere: 520    // cuvantul vine spre privitor
    };

    // Cate rotatii complete face cercul. Miscarea porneste de la zero si
    // accelereaza pana la implozie, ca si cum ar fi prinsa intr-o palnie.
    const ROTATII = 2.4;

    const TOTAL = Object.values(DURATE).reduce((a, b) => a + b, 0);

    // ==================== unelte ====================

    const ctx = panza.getContext('2d');
    let latime = 0;
    let inaltime = 0;
    let dpr = 1;
    let raza = 0;
    let peTelefon = false;

    function dimensioneaza() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        latime = window.innerWidth;
        inaltime = window.innerHeight;
        peTelefon = latime < 700;
        panza.width = Math.round(latime * dpr);
        panza.height = Math.round(inaltime * dpr);
        panza.style.width = latime + 'px';
        panza.style.height = inaltime + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        raza = Math.min(latime, inaltime) * (peTelefon ? 0.34 : 0.26);

        // Cercul se stramteaza pana cand incape si cel mai lung cuvant.
        // „PERFORMANT" are 120px la fontul de telefon: pe un ecran de 390px,
        // asezat pe cerc si impins in afara, iesea din ecran cu totul.
        ctx.font = fontEtichete();
        ctx.letterSpacing = SPATIERE_ETICHETE;
        let ceaMaiLata = 0;
        for (const text of REPERE) {
            ceaMaiLata = Math.max(ceaMaiLata, ctx.measureText(text).width);
        }

        const MARGINE = 16;
        const razaMaximaX = (latime / 2 - ceaMaiLata / 2 - MARGINE) / 1.2;
        const razaMaximaY = (inaltime / 2 - marimeEtichete() - MARGINE) / 1.2;
        raza = Math.max(70, Math.min(raza, razaMaximaX, razaMaximaY));
    }

    const marimeEtichete = () => (peTelefon ? 11 : 15);
    const fontEtichete = () => `500 ${marimeEtichete()}px Inter, system-ui, sans-serif`;
    const SPATIERE_ETICHETE = '3px';

    const usor = t => 1 - Math.pow(1 - t, 3);                 // incetineste la final
    const usorInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const intre = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

    /**
     * Punctele din care e facut cuvantul.
     *
     * Il scriem o data pe o panza ascunsa, citim pixelii aprinsi si pastram
     * unul din cativa. Asa particulele stiu unde sa se aseze, indiferent de
     * fontul pe care il are omul instalat.
     */
    function punctelePentruCuvant(text) {
        const marime = Math.min(latime * (peTelefon ? 0.16 : 0.13), 190);
        // Pas mic = puncte multe si marunte, dar si mai mult de desenat.
        // La 4 pixeli cuvantul e inca fin, iar numarul de particule scade cu
        // aproape jumatate fata de 3.
        const pas = peTelefon ? 5 : 4;

        const ajutor = document.createElement('canvas');
        ajutor.width = Math.round(latime);
        ajutor.height = Math.round(marime * 1.8);
        const c = ajutor.getContext('2d');

        c.fillStyle = '#fff';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `700 ${marime}px Inter, system-ui, sans-serif`;
        c.letterSpacing = `${Math.round(marime * 0.06)}px`;
        c.fillText(text, ajutor.width / 2, ajutor.height / 2);

        const date = c.getImageData(0, 0, ajutor.width, ajutor.height).data;
        const puncte = [];
        const decalajX = latime / 2 - ajutor.width / 2;
        const decalajY = inaltime / 2 - ajutor.height / 2;

        for (let y = 0; y < ajutor.height; y += pas) {
            for (let x = 0; x < ajutor.width; x += pas) {
                if (date[(y * ajutor.width + x) * 4 + 3] > 128) {
                    puncte.push({ x: x + decalajX, y: y + decalajY });
                }
            }
        }
        return puncte;
    }

    // ==================== particule ====================

    let particule = [];

    function pregatesteParticule() {
        const tinte = punctelePentruCuvant(CUVANT);
        particule = tinte.map((tinta, i) => {
            // Pornesc de undeva de pe cerc: la implozie par ca vin din repere.
            const unghi = (i / tinte.length) * Math.PI * 2 + Math.random() * 0.6;
            const distanta = raza * (0.35 + Math.random() * 0.85);
            // Trei pozitii pentru fiecare particula: de unde pleaca (pe cerc),
            // unde se aduna (aproape de centru) si unde ajunge (in litera).
            // Fara popasul din centru nu exista implozie: particulele ar aluneca
            // de-a dreptul in cuvant, si pe ecran se vede o dunga, nu o explozie.
            const imprastiere = raza * 0.06;
            return {
                tx: tinta.x,
                ty: tinta.y,
                cx: latime / 2 + (Math.random() - 0.5) * imprastiere,
                cy: inaltime / 2 + (Math.random() - 0.5) * imprastiere,
                x: latime / 2 + Math.cos(unghi) * distanta,
                y: inaltime / 2 + Math.sin(unghi) * distanta,
                ox: latime / 2 + Math.cos(unghi) * distanta,
                oy: inaltime / 2 + Math.sin(unghi) * distanta,
                unghi: unghi,
                distanta: distanta,
                marime: 0.45 + Math.random() * 0.85,
                faza: Math.random() * Math.PI * 2,
                intarziere: Math.random() * 0.3
            };
        });
    }

    // ==================== desen ====================

    function deseneazaPrafPlutitor(timp, alfa) {
        const nr = peTelefon ? 40 : 70;
        for (let i = 0; i < nr; i++) {
            const p = particule[Math.floor((i / nr) * particule.length)];
            if (!p) continue;
            const x = p.ox + Math.sin(timp / 900 + p.faza) * 14;
            const y = p.oy + Math.cos(timp / 1100 + p.faza) * 14;
            punct(x, y, p.marime, alfa * (0.5 + Math.sin(timp / 500 + p.faza) * 0.3));
        }
    }

    /*
     * Desenul particulelor, in loturi.
     *
     * Cuvantul e facut din cateva mii de puncte. Desenate unul cate unul —
     * `globalAlpha`, `beginPath`, `arc`, `fill` de fiecare data — animatia
     * cobora la 46 de cadre pe secunda si se simtea sacadata. Acum
     * transparentele se rotunjesc la opt trepte, iar fiecare treapta se
     * deseneaza dintr-o singura trasatura: opt umpleri pe cadru in loc de cateva
     * mii. Punctele sunt patrate, nu cercuri — la doi pixeli nu se vede
     * diferenta, dar un dreptunghi se rasterizeaza mult mai repede.
     */
    const TREPTE_ALFA = 8;
    let loturi = [];

    function pregatesteLoturi() {
        // Golim vectorii, nu ii inlocuim: opt vectori noi la fiecare cadru
        // inseamna gunoi de strans pentru colectorul de memorie, adica exact
        // sincopele de zeci de milisecunde pe care le vedeai.
        if (!loturi.length) {
            for (let i = 0; i < TREPTE_ALFA; i++) loturi.push([]);
            return;
        }
        for (let i = 0; i < TREPTE_ALFA; i++) loturi[i].length = 0;
    }

    function punct(x, y, marime, alfa) {
        if (alfa <= 0.02) return;
        const treapta = Math.min(TREPTE_ALFA - 1, Math.floor(alfa * TREPTE_ALFA));
        loturi[treapta].push(x, y, marime);
    }

    function deseneazaLoturile() {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < TREPTE_ALFA; i++) {
            const lot = loturi[i];
            if (!lot.length) continue;
            ctx.globalAlpha = (i + 0.5) / TREPTE_ALFA;
            ctx.beginPath();
            for (let j = 0; j < lot.length; j += 3) {
                const m = lot[j + 2];
                ctx.rect(lot[j] - m, lot[j + 1] - m, m * 2, m * 2);
            }
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function deseneazaCerc(progres, alfa) {
        ctx.save();
        ctx.globalAlpha = alfa;
        ctx.strokeStyle = 'rgba(180, 200, 255, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(latime / 2, inaltime / 2, raza, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progres);
        ctx.stroke();
        ctx.restore();
    }

    function deseneazaRepere(rotatie, alfa, stransoare) {
        ctx.save();
        ctx.globalAlpha = alfa;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = fontEtichete();
        ctx.letterSpacing = SPATIERE_ETICHETE;

        REPERE.forEach((text, i) => {
            const unghi = (i / REPERE.length) * Math.PI * 2 + rotatie - Math.PI / 2;
            const r = raza * (1 - stransoare);
            const x = latime / 2 + Math.cos(unghi) * r;
            const y = inaltime / 2 + Math.sin(unghi) * r;

            // Punctul de ancorare de pe cerc
            ctx.fillStyle = 'rgba(190, 210, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(x, y, 2.4, 0, Math.PI * 2);
            ctx.fill();

            // Eticheta, impinsa in afara cercului ca sa nu stea peste linie
            const et = raza * 0.2;
            ctx.fillStyle = 'rgba(235, 240, 255, 0.92)';
            ctx.fillText(text, x + Math.cos(unghi) * et, y + Math.sin(unghi) * et);
        });
        ctx.restore();
    }

    /** Particulele se strang din cerc intr-un singur ghem de lumina. */
    function deseneazaImplozie(progres) {
        const e = usorInOut(progres);
        for (const p of particule) {
            const x = intre(p.ox, p.cx, e);
            const y = intre(p.oy, p.cy, e);
            // Cu cat se apropie de centru, cu atat sunt mai stralucitoare
            punct(x, y, p.marime * (1 + e * 1.4), 0.35 + e * 0.65);
        }
    }

    /**
     * Ghemul se sparge si fiecare particula isi gaseste locul in litera.
     *
     * `scara` mareste cuvantul in interiorul panzei, nu prin `transform` pe
     * element: o panza marita cu CSS e o poza marita, deci literele ar iesi
     * patratoase exact in cadrul in care se vad cel mai mare.
     */
    function deseneazaCuvant(progres, alfa, scara) {
        const cx = latime / 2;
        const cy = inaltime / 2;
        for (const p of particule) {
            const t = Math.max(0, Math.min(1, (progres - p.intarziere) / (1 - p.intarziere)));
            const e = usor(t);
            const x = intre(p.cx, p.tx, e);
            const y = intre(p.cy, p.ty, e);
            punct(
                cx + (x - cx) * scara,
                cy + (y - cy) * scara,
                p.marime * (1 + (1 - e) * 1.6) * Math.max(1, scara * 0.85),
                alfa * (0.4 + e * 0.6)
            );
        }
    }

    /*
     * Haloul. Degradeul se construieste o singura data, la dimensionare, si se
     * reciteste apoi doar cu `globalAlpha`: un `createRadialGradient` pe cadru
     * inseamna recalcularea rampei de culoare de saizeci de ori pe secunda,
     * pentru un rezultat identic.
     */
    let degradeHalou = null;

    function pregatesteHalou() {
        degradeHalou = ctx.createRadialGradient(
            latime / 2, inaltime / 2, 0,
            latime / 2, inaltime / 2, raza * 1.6
        );
        degradeHalou.addColorStop(0, 'rgba(200, 215, 255, 0.72)');
        degradeHalou.addColorStop(0.25, 'rgba(140, 150, 255, 0.38)');
        degradeHalou.addColorStop(0.55, 'rgba(120, 100, 240, 0.16)');
        degradeHalou.addColorStop(1, 'rgba(10, 10, 25, 0)');
    }

    function deseneazaHalou(intensitate) {
        if (intensitate <= 0 || !degradeHalou) return;
        ctx.globalAlpha = Math.min(1, intensitate);
        ctx.fillStyle = degradeHalou;
        ctx.fillRect(0, 0, latime, inaltime);
        ctx.globalAlpha = 1;
    }

    // ==================== bucla ====================

    let pornire = 0;
    let cerere = 0;
    let terminat = false;

    function cadru(acum) {
        if (!pornire) pornire = acum;
        const t = acum - pornire;

        ctx.clearRect(0, 0, latime, inaltime);
        pregatesteLoturi();

        let capat = 0;
        const etapa = nume => {
            const inceput = capat;
            capat += DURATE[nume];
            return Math.max(0, Math.min(1, (t - inceput) / DURATE[nume]));
        };

        const pPraf = etapa('praf');
        const pCerc = etapa('cerc');
        const pAparitie = etapa('aparitie');
        const pAsteptare = etapa('asteptare');
        const pRotire = etapa('rotire');
        const pImplozie = etapa('implozie');
        const pAsezare = etapa('asezare');
        etapa('pauza');
        const pApropiere = etapa('apropiere');

        // 1-2. praf si cerc
        if (pImplozie === 0) {
            deseneazaPrafPlutitor(t, intre(0, 1, pPraf));
        }
        if (pCerc > 0 && pImplozie < 1) {
            deseneazaCerc(usorInOut(pCerc), 1 - pImplozie);
        }

        // 3-5. cuvintele apar, stau pe loc, apoi se rotesc din ce in ce mai
        // repede si se strang spre centru.
        if (pAparitie > 0 && pAsezare === 0) {
            // `t^3` porneste aproape de zero si creste brusc spre final: asta e
            // acceleratia care se vede pe ecran. La implozie mai adaugam o
            // jumatate de tura, ca sa nu se opreasca brusc din invartit.
            const rotatie =
                Math.pow(pRotire, 3) * ROTATII * Math.PI * 2 +
                usor(pImplozie) * Math.PI;

            deseneazaRepere(
                rotatie,
                Math.min(1, pAparitie * 1.6) * (1 - pImplozie),
                usor(pImplozie)
            );
        }

        // 5. lumina care creste odata cu ghemul si se stinge la explozie
        if (pImplozie > 0.25) {
            const intensitate = pAsezare > 0
                ? Math.max(0, 1 - pAsezare * 2)
                : (pImplozie - 0.25) / 0.75;
            deseneazaHalou(intensitate);
        }

        // 6. implozia, apoi cuvantul care se compune si vine spre privitor
        if (pImplozie > 0 && pAsezare === 0) {
            deseneazaImplozie(pImplozie);
        }
        if (pAsezare > 0) {
            const scara = pApropiere > 0
                ? 1 + usor(pApropiere) * (peTelefon ? 2.4 : 3.6)
                : 1;

            // Cat creste, cuvantul se destrama in lumina. Daca l-am duce marit
            // pana la capat, s-ar vedea reteaua de puncte din care e facut —
            // marite de patru ori, punctele se departeaza unul de altul si
            // literele arata gaurite. Asa, ultimul lucru pe care il vezi e
            // stralucirea, nu grila.
            const stingere = usor(Math.max(0, (pApropiere - 0.15) / 0.85));
            deseneazaCuvant(pAsezare, 1 - stingere * 0.9, scara);

            if (pApropiere > 0) {
                deseneazaHalou(usor(pApropiere) * 0.55);
            }
        }

        if (pApropiere > 0) {
            cortina.style.opacity = String(1 - usor(Math.max(0, (pApropiere - 0.35) / 0.65)));
        }

        deseneazaLoturile();

        if (t >= TOTAL) {
            incheie();
            return;
        }
        cerere = requestAnimationFrame(cadru);
    }

    // ==================== pornire / oprire ====================

    function incheie() {
        if (terminat) return;
        terminat = true;
        cancelAnimationFrame(cerere);
        document.documentElement.classList.remove('pret-intro-activ');
        cortina.style.opacity = '0';
        window.setTimeout(() => cortina.remove(), 320);
        window.removeEventListener('keydown', laTasta);
        window.removeEventListener('wheel', incheie);
        window.removeEventListener('touchstart', incheie);
    }

    function laTasta(e) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') incheie();
    }

    function porneste() {
        // Marcam sesiunea la START, nu la final: cine deschide pagina si sare
        // pe alt link dupa doua secunde, apoi se intoarce, o vazuse deja.
        try {
            sessionStorage.setItem(CHEIE_SESIUNE, '1');
        } catch (eroare) {
            // Navigare privata — atunci se va relua la urmatoarea vizita.
        }

        cortina.hidden = false;
        document.documentElement.classList.add('pret-intro-activ');
        dimensioneaza();
        pregatesteHalou();
        pregatesteParticule();

        // Prima scriere cu un font pe panza il forteaza sa fie pregatit — o
        // operatie care poate inghiti sute de milisecunde exact in cadrul in
        // care apar cuvintele. O facem acum, cu cerneala transparenta, ca sa
        // se intample inainte sa inceapa animatia.
        ctx.save();
        ctx.globalAlpha = 0;
        ctx.font = fontEtichete();
        ctx.letterSpacing = SPATIERE_ETICHETE;
        for (const text of REPERE) ctx.fillText(text, -9999, -9999);
        ctx.restore();

        cortina.addEventListener('click', incheie);
        butonSari && butonSari.addEventListener('click', incheie);
        window.addEventListener('keydown', laTasta);
        window.addEventListener('wheel', incheie, { passive: true });
        window.addEventListener('touchstart', incheie, { passive: true });

        // Redimensionarea in timpul animatiei (rotirea telefonului) ar cere
        // recalcularea tuturor tintelor; mai simplu si mai onest e sa o incheiem.
        window.addEventListener('resize', incheie, { once: true });

        cerere = requestAnimationFrame(cadru);
    }

    // Fonturile conteaza: daca desenam cuvantul inainte sa se incarce Inter,
    // punctele ies dintr-un font de rezerva si litera arata altfel.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(porneste).catch(porneste);
    } else {
        porneste();
    }
})();

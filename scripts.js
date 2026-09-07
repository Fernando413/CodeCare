// Global variables
let currentLanguage = 'ro';
// Obiectul va ține traducerile: 'ro' citit din HTML, 'en' citit din JSON
let translations = {
    ro: {},
    en: null
};

// Limba aleasa trebuie sa supravietuiasca navigarii intre index.html si
// proiecte.html. In navigare privata localStorage arunca, deci il izolam.
const LANG_STORAGE_KEY = 'codecare-lang';

function readStoredLanguage() {
    try {
        const value = localStorage.getItem(LANG_STORAGE_KEY);
        return value === 'en' || value === 'ro' ? value : null;
    } catch (error) {
        return null;
    }
}

function storeLanguage(lang) {
    try {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (error) {
        /* navigare privata sau stocare blocata: limba ramane doar pe pagina curenta */
    }
}

// Citim inaltimea barei din --nav-height, ca sa avem o singura sursa de adevar
// intre CSS si offset-ul de scroll (variabila se schimba la breakpoint-uri).
function getNavHeight() {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--nav-height');
    return parseInt(value, 10) || 72;
}

// DOM Elements
const languageToggle = document.getElementById('language-toggle');
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const contactForm = document.querySelector('.contact-form');

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    initializeLanguage();
    initializeLanguageLabels();
    initializeNavigation();
    initializeScrollHandler();
    initializeScrollEffects();
    initializeContactForm();
    initializeAnimations();
    initializeThumbnailFallback();
    initializePortfolioTouch();
    initializeCustomSelect();
    initializePricingButtons();
    preselecteazaServiciulDinAdresa();
    initializeScurtaturiPreturi();
    numaraVizita();
});

/**
 * Contorul de vizite al site-ului.
 *
 * Aceeasi functie care numara vizitele demo-urilor (`/api/vizita`), doar cu alt
 * slug. Cere o imagine de 1x1: nu are nevoie de CORS, nu blocheaza randarea si
 * nu depinde de vreo librarie externa.
 *
 * Nu se scrie nimic in browserul vizitatorului si nu se salveaza niciun IP —
 * functia numara si atat. De asta nu e nevoie de banner de consimtamant.
 */
function numaraVizita() {
    const PAGINI = {
        '/': 'site-acasa',
        '/index.html': 'site-acasa',
        '/preturi.html': 'site-preturi',
        '/proiecte.html': 'site-proiecte',
    };

    const slug = PAGINI[window.location.pathname];
    if (!slug) return;

    try {
        // Acelasi domeniu, deci adresa relativa e suficienta.
        new Image().src = `/api/vizita?slug=${slug}&t=${Date.now()}`;
    } catch (eroare) {
        // Un contor care nu merge nu are voie sa strice pagina.
    }
}

// --- Language Management (Sistemul Nou) ---

async function initializeLanguage() {
    try {
        // 1. Colectăm textul în Română care este deja pe site.
        //    Obligatoriu ÎNAINTE de a aplica engleza, altfel am face
        //    snapshot-ul românesc peste text deja tradus.
        collectRomanianTranslations();

        // 2. Setăm funcționalitatea butonului de switch
        if (languageToggle) {
            languageToggle.checked = false;
            languageToggle.addEventListener('change', handleLanguageToggle);

            // 3. Restaurăm limba aleasă anterior (inclusiv de pe altă pagină)
            if (readStoredLanguage() === 'en') {
                languageToggle.checked = true;
                await handleLanguageToggle();
                return;
            }
        }

        updateLanguageLabels();
    } catch (error) {
        console.error('Error initializing language:', error);
    }
}

/*
 * Pe mobil comutatorul e ascuns si raman doar etichetele RO / EN, ca butoane
 * segmentate. Fara asta, un tap pe "EN" nu ar face nimic.
 */
function initializeLanguageLabels() {
    const labels = { ro: document.getElementById('lang-ro'), en: document.getElementById('lang-en') };

    Object.keys(labels).forEach(lang => {
        const label = labels[lang];
        if (!label || !languageToggle) return;

        const select = () => {
            const wantsEnglish = lang === 'en';
            if (languageToggle.checked === wantsEnglish) return;
            languageToggle.checked = wantsEnglish;
            languageToggle.dispatchEvent(new Event('change'));
        };

        label.addEventListener('click', select);
        label.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select();
            }
        });
    });
}

// Această funcție citește HTML-ul și salvează textele în memoria JS
function collectRomanianTranslations() {
    const elementsToTranslate = document.querySelectorAll('[data-translate]');

    elementsToTranslate.forEach(element => {
        const key = element.getAttribute('data-translate');

        // Salvăm conținutul în funcție de tipul elementului
        if (element.tagName === 'INPUT' && element.type === 'submit') {
            translations.ro[key] = element.value;
        } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            translations.ro[key] = element.placeholder;
        } else if (element.tagName === 'META') {
            translations.ro[key] = element.content;
        } else if (element.tagName === 'TITLE') {
            translations.ro[key] = element.textContent;
        } else {
            translations.ro[key] = element.innerHTML;
        }
    });
}

async function handleLanguageToggle() {
    const newLanguage = languageToggle.checked ? 'en' : 'ro';

    if (newLanguage === 'en') {
        // Dacă nu am descărcat încă engleza, o facem acum
        if (!translations.en) {
            await loadEnglishTranslations();
        }
        applyTranslations(translations.en, 'en');
    } else {
        // Revenim la română folosind memoria (nu descărcăm nimic)
        applyTranslations(translations.ro, 'ro');
    }

    currentLanguage = newLanguage;
    storeLanguage(newLanguage);
    updateLanguageLabels();
}

async function loadEnglishTranslations() {
    const submitBtn = document.querySelector('.language-switch');
    try {
        submitBtn.style.opacity = '0.5'; // Mic efect vizual de loading
        const response = await fetch('en.json');
        if (!response.ok) throw new Error('Nu am putut încărca en.json');

        translations.en = await response.json();
    } catch (error) {
        console.error('Eroare la încărcarea limbii engleze:', error);
        // Dacă eșuează, debifăm butonul (rămânem pe RO)
        languageToggle.checked = false;
        storeLanguage('ro');
        alert("Nu s-a putut încărca limba engleză. Verifică fișierul en.json.");
    } finally {
        submitBtn.style.opacity = '1';
    }
}

function applyTranslations(translationData, langCode) {
    if (!translationData) return;

    const elementsToTranslate = document.querySelectorAll('[data-translate]');

    elementsToTranslate.forEach(element => {
        const key = element.getAttribute('data-translate');

        if (translationData[key]) {
            if (element.tagName === 'INPUT' && element.type === 'submit') {
                element.value = translationData[key];
            } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translationData[key];
            } else if (element.tagName === 'META') {
                element.content = translationData[key];
            } else if (element.tagName === 'TITLE') {
                element.textContent = translationData[key];
            } else {
                element.innerHTML = translationData[key];
            }
        }
    });

    document.documentElement.lang = langCode;
}

function updateLanguageLabels() {
    const roLabel = document.getElementById('lang-ro');
    const enLabel = document.getElementById('lang-en');

    if (roLabel && enLabel) {
        // Resetăm clasele
        roLabel.classList.remove('active');
        enLabel.classList.remove('active');

        // Adăugăm clasa activă
        if (languageToggle.checked) {
            enLabel.classList.add('active');
        } else {
            roLabel.classList.add('active');
        }

        roLabel.setAttribute('aria-pressed', String(!languageToggle.checked));
        enLabel.setAttribute('aria-pressed', String(languageToggle.checked));
    }
}

// --- Navigation Management (Standard) ---
function initializeNavigation() {
    if (hamburger && navMenu) {
        hamburger.setAttribute('tabindex', '0');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.addEventListener('click', toggleMobileMenu);
        // Hamburger-ul e un <div role="button">, deci tastatura trebuie tratata manual
        hamburger.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleMobileMenu();
            }
        });
    }

    // Escape inchide meniul mobil
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) {
            closeMobileMenu();
        }
    });
    navLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });
    document.addEventListener('click', function (event) {
        if (!event.target.closest('.navbar')) {
            closeMobileMenu();
        }
    });
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                // `offsetTop` se masoara fata de primul parinte pozitionat, nu
                // fata de document: e destul ca o sectiune sa aiba
                // `position: relative` si saltul aterizeaza cu sute de pixeli
                // mai jos. `getBoundingClientRect` nu are problema asta.
                const y = target.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({ top: y - getNavHeight(), behavior: 'smooth' });
            }
        });
    });
}

/*
 * `overflow: hidden` pe body nu opreste derularea: elementul care deruleaza
 * este <html>. Singura tehnica ce tine pe toate browserele mobile, inclusiv
 * iOS Safari, e sa fixam body-ul si sa retinem pozitia.
 */
let scrollLockY = 0;
let scrollLocked = false;

function lockPageScroll() {
    if (scrollLocked) return;
    scrollLockY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollLockY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    scrollLocked = true;
}

function unlockPageScroll() {
    if (!scrollLocked) return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    scrollLocked = false;
    // 'instant' e obligatoriu: html are scroll-behavior: smooth, deci un
    // scrollTo obisnuit ar anima intoarcerea la pozitia salvata.
    window.scrollTo({ top: scrollLockY, behavior: 'instant' });
}

function toggleMobileMenu() {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
    const isOpen = navMenu.classList.contains('active');
    hamburger.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) {
        lockPageScroll();
    } else {
        unlockPageScroll();
    }
}

function closeMobileMenu() {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    unlockPageScroll();
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPosition = window.scrollY + 100;
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            navLinks.forEach(link => link.classList.remove('active'));
            if (navLink) navLink.classList.add('active');
        }
    });
}

// --- Scroll Effects & Animations ---

// Un singur handler de scroll pentru tot: navbar, link activ si parallax.
// Rulam pe requestAnimationFrame ca sa nu facem layout de mai multe ori pe frame.
function initializeScrollHandler() {
    const navbar = document.querySelector('.navbar');
    const particles = document.querySelector('.hero-particles');
    let ticking = false;

    function onScroll() {
        // Cat timp meniul e deschis, body-ul e position:fixed si window.scrollY
        // devine 0. Fara garda asta, updateActiveNavLink() ar crede ca suntem
        // in capul paginii si ar muta sublinierea pe "Acasa".
        if (scrollLocked) {
            ticking = false;
            return;
        }

        const scrollY = window.scrollY;

        if (navbar) {
            navbar.classList.toggle('scrolled', scrollY > 24);
        }
        if (particles) {
            particles.style.transform = `translateY(${scrollY * 0.5}px)`;
        }
        updateActiveNavLink();

        ticking = false;
    }

    window.addEventListener('scroll', function () {
        if (!ticking) {
            window.requestAnimationFrame(onScroll);
            ticking = true;
        }
    }, { passive: true });

    onScroll();
}

function initializeScrollEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll(
        '.service-card, .portfolio-card, .contact-item, ' +
        '.pret-pas, .pret-pachet, .pret-tabel-cadru, .pret-conditii > div'
    ).forEach(el => observer.observe(el));
}

/**
 * Bara de scurtaturi din pagina de preturi urmareste pachetul din dreptul
 * ecranului.
 *
 * Fara ea, bara ramane lipita sus dar nu spune nimic: derulezi patru pachete
 * lungi si nu mai stii la care esti. Marcam ultimul pachet care a trecut de
 * linia superioara a ecranului, nu pe cel mai vizibil — asa pastilele nu
 * clipesc inainte si inapoi cand doua carduri se vad in acelasi timp.
 */
function initializeScurtaturiPreturi() {
    const legaturi = Array.from(document.querySelectorAll('.pret-scurtaturi a'));
    if (!legaturi.length) return;

    const sectiuni = legaturi
        .map(a => document.querySelector(a.getAttribute('href')))
        .filter(Boolean);
    if (!sectiuni.length) return;

    let ticking = false;

    function actualizeaza() {
        ticking = false;
        const inaltime = window.innerHeight || 0;
        const prag = inaltime * 0.35;

        // Se aprinde DOAR pachetul care e chiar in dreptul ecranului. Inainte
        // pornea cu primul marcat de sus, de la inceputul paginii, si ramanea
        // aprins si dupa ce treceai de ultimul pachet — bara spunea „esti la
        // Landing Page" cand tu citeai despre costuri sau conditii.
        let activ = -1;
        sectiuni.forEach((sectiune, i) => {
            const r = sectiune.getBoundingClientRect();
            const aInceput = r.top <= prag;
            const nuS_aTerminat = r.bottom > inaltime * 0.2;
            if (aInceput && nuS_aTerminat) activ = i;
        });

        legaturi.forEach((a, i) => a.classList.toggle('este-activ', i === activ));
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(actualizeaza);
            ticking = true;
        }
    }, { passive: true });

    actualizeaza();
}

function initializeAnimations() {
    document.querySelectorAll('.service-card').forEach((card, i) => card.style.animationDelay = `${i * 0.08}s`);
    document.querySelectorAll('.portfolio-card').forEach((card, i) => card.style.animationDelay = `${i * 0.08}s`);
}

// --- Contact Form ---
function initializeContactForm() {
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactFormSubmit);

        // MODIFICARE AICI: Am adăugat ', select' la querySelectorAll
        const formInputs = contactForm.querySelectorAll('input, textarea, select');

        formInputs.forEach(input => {
            // Verificare inițială (dacă browserul a completat automat)
            if (input.value) input.classList.add('has-value');

            // 'input' prinde si completarea automata a browserului, care nu
            // declanseaza niciun 'blur'; fara ea eticheta ar cadea peste text.
            const sincronizeaza = function () {
                this.classList.toggle('has-value', Boolean(this.value));
            };
            input.addEventListener('input', sincronizeaza);
            input.addEventListener('blur', sincronizeaza);
            input.addEventListener('change', sincronizeaza);

            // Pentru select, ascultăm și evenimentul 'change'
            if (input.tagName === 'SELECT') {
                input.addEventListener('change', function () {
                    if (this.value) this.classList.add('has-value');
                });
            }
        });
    }
}

function handleContactFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(contactForm);
    const formObject = {};
    formData.forEach((value, key) => formObject[key] = value);

    if (!validateContactForm(formObject)) return;

    const isEn = languageToggle.checked;
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    // Prefix în subiect ca mesajele de pe site să fie ușor de filtrat în inbox,
    // separat de restul corespondenței.
    formObject.subject = `[codecare.ro] ${formObject.subject}`;

    submitButton.textContent = isEn ? 'Sending...' : 'Se trimite...';
    submitButton.disabled = true;

    fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(formObject)
    })
        .then(raspuns => raspuns.json())
        .then(rezultat => {
            if (!rezultat.success) throw new Error(rezultat.message || 'submit failed');

            showNotification(isEn ? 'Message sent successfully!' : 'Mesajul a fost trimis cu succes!', 'success');
            contactForm.reset();
            contactForm.querySelectorAll('input, textarea').forEach(i => i.classList.remove('has-value'));
            resetCustomSelect();

            // Rămâne pe ecran după ce notificarea dispare: îi spune omului de pe ce
            // adresă vine răspunsul și să se uite și în Spam. Domeniul e nou, deci
            // primul mesaj chiar ajunge acolo la unele căsuțe.
            const confirmare = document.getElementById('form-confirm');
            if (confirmare) confirmare.hidden = false;
        })
        .catch(eroare => {
            // Nu inventăm un succes când trimiterea a eșuat: vizitatorul ar pleca
            // convins că l-am primit. Îi dăm adresa de email ca alternativă imediată.
            console.error('Web3Forms:', eroare);
            showNotification(
                isEn
                    ? 'The message could not be sent. Please write to contact@codecare.ro.'
                    : 'Mesajul nu a putut fi trimis. Te rog scrie-mi direct la contact@codecare.ro.',
                'error'
            );
        })
        .finally(() => {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        });
}

// contactForm.reset() golește <select>-ul real, dar nu și textul din selectul
// vizual construit peste el, care ar rămâne cu serviciul ales anterior.
function resetCustomSelect() {
    const wrapper = document.querySelector('.custom-select-wrapper');
    if (!wrapper) return;

    const text = wrapper.querySelector('.selection-text');
    if (text) text.textContent = '';
    wrapper.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
    wrapper.querySelector('.custom-select')?.classList.remove('open');
    // 'active' pe wrapper e ce ține eticheta ridicată; fără asta ar rămâne sus
    // deasupra unui câmp gol.
    wrapper.classList.remove('active');
}

function validateContactForm(formData) {
    const errors = [];
    const isEn = languageToggle.checked;

    if (!formData.name || formData.name.trim().length < 2) {
        errors.push(isEn ? 'Name is required (min 2 chars)' : 'Numele este obligatoriu (minim 2 caractere)');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
        errors.push(isEn ? 'Email is not valid' : 'Email-ul nu este valid');
    }
    if (!formData.service) {
        errors.push(currentLanguage === 'ro' ? 'Te rog alege un tip de serviciu' : 'Please select a service type');
    }
    if (!formData.subject || formData.subject.trim().length < 3) {
        errors.push(isEn ? 'Subject is required (min 3 chars)' : 'Subiectul este obligatoriu (minim 3 caractere)');
    }
    if (!formData.message || formData.message.trim().length < 10) {
        errors.push(isEn ? 'Message is required (min 10 chars)' : 'Mesajul este obligatoriu (minim 10 caractere)');
    }

    if (errors.length > 0) {
        showNotification(errors.join('\n'), 'error');
        return false;
    }
    return true;
}

function showNotification(message, type = 'info') {
    // Stilurile pentru .notification traiesc in styles.css
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
    notification.innerHTML = `<div class="notification-content"><span class="notification-message"></span><button class="notification-close" aria-label="Închide">&times;</button></div>`;
    notification.querySelector('.notification-message').textContent = message;

    document.body.appendChild(notification);
    notification.querySelector('.notification-close').addEventListener('click', () => notification.remove());
    setTimeout(() => notification.remove(), 5000);
}

/*
 * Daca un thumbnail lipseste (de exemplu inainte ca poza unui proiect nou sa
 * fie salvata in assets/), scoatem <img> ca sa ramana panoul-placeholder de
 * dedesubt, nu iconita de imagine stricata.
 */
function initializeThumbnailFallback() {
    document.querySelectorAll('.project-thumbnail').forEach(img => {
        const drop = () => img.remove();
        if (img.complete && img.naturalWidth === 0) {
            drop();
        } else {
            img.addEventListener('error', drop, { once: true });
        }
    });
}

/*
 * Pe touch nu exista hover, deci lista de tehnologii se dezvaluie la tap.
 * Un singur card deschis o data; butonul Live isi pastreaza comportamentul.
 */
function initializePortfolioTouch() {
    if (window.matchMedia('(hover: hover)').matches) return;

    document.querySelectorAll('.portfolio-card').forEach(card => {
        const image = card.querySelector('.portfolio-image');
        if (!image) return;

        image.addEventListener('click', function (event) {
            if (event.target.closest('.portfolio-live-btn')) return;

            const opening = !card.classList.contains('tech-visible');
            document.querySelectorAll('.portfolio-card.tech-visible')
                .forEach(other => other.classList.remove('tech-visible'));

            if (opening) {
                card.classList.add('tech-visible');
                // gestul a fost descoperit: oprim indiciile animate
                document.body.classList.add('tech-discovered');
            }
        });
    });

    // tap in afara cardurilor inchide lista deschisa
    document.addEventListener('click', function (event) {
        if (event.target.closest('.portfolio-card')) return;
        document.querySelectorAll('.portfolio-card.tech-visible')
            .forEach(card => card.classList.remove('tech-visible'));
    });
}

function initializeCustomSelect() {
    const wrapper = document.querySelector('.custom-select-wrapper');
    // proiecte.html nu are formular de contact
    if (!wrapper) return;

    const select = wrapper.querySelector('.custom-select');
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const selectionText = wrapper.querySelector('.selection-text');
    const options = wrapper.querySelectorAll('.custom-option');
    const realSelect = document.getElementById('service');

    // 1. Deschide/Închide meniul la click
    trigger.addEventListener('click', function () {
        select.classList.toggle('open');
        wrapper.classList.toggle('active', select.classList.contains('open') || realSelect.value !== "");
    });

    // 2. Selectează o opțiune
    options.forEach(option => {
        option.addEventListener('click', function () {
            // Ia valoarea și textul
            const value = this.getAttribute('data-value');
            const text = this.textContent;

            // Actualizează UI-ul
            selectionText.textContent = text;
            wrapper.classList.add('active'); // Ține label-ul sus
            select.classList.remove('open'); // Închide meniul

            // Actualizează clasele 'selected'
            options.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');

            // Actualizează SELECT-UL REAL (Ascuns)
            realSelect.value = value;

            // Declanșează un eveniment 'change' manual pentru validare
            realSelect.dispatchEvent(new Event('change'));
        });
    });

    // 3. Închide meniul dacă dai click în afară
    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            select.classList.remove('open');
            // Dacă nu e selectat nimic, coboară label-ul
            if (realSelect.value === "") {
                wrapper.classList.remove('active');
            }
        }
    });
}

/*
 * Butoanele de pe preturi.html trimit spre index.html?serviciu=...#contact.
 * Aici citim parametrul si apasam programatic optiunea potrivita, ca sa ajunga
 * omul cu formularul deja completat. Pe paginile fara formular nu se intampla
 * nimic, pentru ca nu exista nicio optiune de gasit.
 */
function preselecteazaServiciulDinAdresa() {
    let valoare = null;
    try {
        valoare = new URLSearchParams(window.location.search).get('serviciu');
    } catch (error) {
        return;
    }
    if (!valoare) return;

    const optiune = document.querySelector(`.custom-option[data-value="${CSS.escape(valoare)}"]`);
    if (optiune) optiune.click();

    // Scoatem parametrul din bara de adrese: la un refresh sau la partajarea
    // linkului nu mai are ce cauta acolo, iar ancora #contact ramane.
    try {
        const curat = window.location.pathname + window.location.hash;
        window.history.replaceState(null, '', curat);
    } catch (error) {
        /* browserele care nu permit replaceState pot ramane cu parametrul */
    }
}

function initializePricingButtons() {
    // Selectăm toate butoanele care au atributul data-service
    const pricingButtons = document.querySelectorAll('a[data-service]');

    pricingButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            // Lăsăm comportamentul default (scroll la #contact) să se întâmple, 
            // dar actualizăm formularul înainte.

            const serviceValue = this.getAttribute('data-service');

            // Găsim opțiunea custom care corespunde cu acest serviciu
            const customOption = document.querySelector(`.custom-option[data-value="${serviceValue}"]`);

            if (customOption) {
                // Simulăm un click pe opțiunea custom. 
                // Asta va declanșa logica din initializeCustomSelect() 
                // care actualizează textul, input-ul ascuns și animația label-ului.
                customOption.click();
            }
        });
    });
}